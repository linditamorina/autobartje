import { describe, expect, it } from "vitest";
import { defaultDurationMin, findConflicts, type SlotInput } from "./conflicts";

const d = (s: string) => new Date(`2026-11-02T${s}:00Z`);
const base = (): SlotInput => ({
  start: d("08:00"),
  end: d("10:00"),
  orderOptions: {},
  isDrivable: true,
  driverId: "drv1",
  driver: { isActive: true, licenseExpires: new Date("2030-01-01"), cpcExpires: null },
  truck: { id: "t1", isActive: true, capacityVehicles: 1, hasWinch: true, isEnclosed: false, insuranceExpires: null, registrationExpires: null, inspectionExpires: null, nextServiceAt: null },
  existing: [],
});
const codes = (i: SlotInput) => findConflicts(i).map((c) => `${c.code}:${c.severity}`);

describe("findConflicts", () => {
  it("accepts a free, valid slot", () => {
    expect(findConflicts(base())).toEqual([]);
  });

  it("rejects an end before the start", () => {
    expect(codes({ ...base(), end: d("07:00") })).toEqual(["invalid_slot:block"]);
  });

  it("blocks a truck that is already out, but not back-to-back jobs", () => {
    const busy = { ...base(), existing: [{ orderNumber: "P-2026-00001", driverId: "drv2", truckId: "t1", start: d("09:00"), end: d("11:00") }] };
    expect(findConflicts(busy)).toEqual([{ code: "truck_full", severity: "block", ref: "P-2026-00001" }]);
    const after = { ...base(), existing: [{ orderNumber: "P-2026-00001", driverId: "drv2", truckId: "t1", start: d("10:00"), end: d("11:00") }] };
    expect(findConflicts(after)).toEqual([]);
  });

  it("lets a car carrier take several cars up to its capacity", () => {
    const carrier = { ...base().truck, capacityVehicles: 3 };
    const job = (n: number) => ({ orderNumber: `P-2026-0000${n}`, driverId: "drv1", truckId: "t1", start: d("08:00"), end: d("10:00") });
    expect(findConflicts({ ...base(), truck: carrier, existing: [job(1), job(2)] })).toEqual([]);
    expect(codes({ ...base(), truck: carrier, existing: [job(1), job(2), job(3)] })).toEqual(["truck_full:block"]);
  });

  it("blocks a driver who is on another truck at the same time", () => {
    const i = { ...base(), existing: [{ orderNumber: "P-2026-00009", driverId: "drv1", truckId: "t2", start: d("07:00"), end: d("08:30") }] };
    expect(codes(i)).toEqual(["driver_busy:block"]);
  });

  it("blocks expired licence, CPC and truck papers, and warns on service due", () => {
    const i = base();
    i.driver = { isActive: true, licenseExpires: d("09:00"), cpcExpires: d("09:30") };
    i.truck = { ...i.truck, insuranceExpires: d("08:00"), registrationExpires: new Date("2020-01-01"), inspectionExpires: d("09:59"), nextServiceAt: d("09:00") };
    expect(codes(i)).toEqual([
      "license_expired:block",
      "cpc_expired:block",
      "insurance_expired:block",
      "registration_expired:block",
      "inspection_expired:block",
      "service_due:warn",
    ]);
  });

  it("warns when the truck lacks an enclosed body or a winch the job needs", () => {
    const i = { ...base(), orderOptions: { enclosed: true }, isDrivable: false, truck: { ...base().truck, hasWinch: false } };
    expect(codes(i)).toEqual(["needs_enclosed:warn", "needs_winch:warn"]);
  });

  it("blocks inactive driver and truck", () => {
    const i = base();
    i.driver.isActive = false;
    i.truck.isActive = false;
    expect(codes(i)).toEqual(["driver_inactive:block", "truck_inactive:block"]);
  });
});

describe("defaultDurationMin", () => {
  it("sizes slots by service and drive time", () => {
    expect(defaultDurationMin("ROADSIDE_ASSISTANCE", 10)).toBe(60);
    expect(defaultDurationMin("EMERGENCY_TOWING", 40)).toBe(135);
    expect(defaultDurationMin("DOMESTIC_TRANSPORT", null)).toBe(90);
    expect(defaultDurationMin("INTERNATIONAL_TRANSPORT", 900)).toBe(4320);
  });
});
