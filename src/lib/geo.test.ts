import { describe, expect, it } from "vitest";
import { haversineKm, isFresh, roughEtaMinutes, shouldSend, validCoord } from "./geo";

const PEJE = { lat: 42.6593, lng: 20.2887 };
const PRISHTINA = { lat: 42.6629, lng: 21.1655 };

describe("haversineKm", () => {
  it("measures Pejë to Prishtina at about 72 km", () => {
    expect(haversineKm(PEJE, PRISHTINA)).toBeGreaterThan(70);
    expect(haversineKm(PEJE, PRISHTINA)).toBeLessThan(74);
  });
  it("is zero for the same point", () => {
    expect(haversineKm(PEJE, PEJE)).toBe(0);
  });
});

describe("roughEtaMinutes", () => {
  it("rounds up to 5 minutes with a 5 minute minimum", () => {
    expect(roughEtaMinutes(1)).toBe(5);
    expect(roughEtaMinutes(72)).toBe(105); // 72 × 1.3 / 55 h = 102 min
  });
  it("treats under half a kilometre as arrived", () => {
    expect(roughEtaMinutes(0.3)).toBeNull();
  });
});

describe("shouldSend", () => {
  const at = 1_000_000;
  it("sends the first fix", () => {
    expect(shouldSend(null, { ...PEJE, at })).toBe(true);
  });
  it("never sends twice within 10 seconds", () => {
    expect(shouldSend({ ...PEJE, at }, { ...PRISHTINA, at: at + 5_000 })).toBe(false);
  });
  it("sends after 150 m or after 30 seconds", () => {
    const moved = { lat: PEJE.lat + 0.002, lng: PEJE.lng, at: at + 12_000 }; // ~220 m
    expect(shouldSend({ ...PEJE, at }, moved)).toBe(true);
    expect(shouldSend({ ...PEJE, at }, { ...PEJE, at: at + 12_000 })).toBe(false);
    expect(shouldSend({ ...PEJE, at }, { ...PEJE, at: at + 30_000 })).toBe(true);
  });
});

describe("isFresh / validCoord", () => {
  it("accepts positions up to 10 minutes old", () => {
    const now = Date.now();
    expect(isFresh(new Date(now - 9 * 60_000), now)).toBe(true);
    expect(isFresh(new Date(now - 11 * 60_000), now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
  it("rejects out-of-range and null-island coordinates", () => {
    expect(validCoord(42.6, 20.3)).toBe(true);
    expect(validCoord(0, 0)).toBe(false);
    expect(validCoord(91, 20)).toBe(false);
    expect(validCoord(Number.NaN, 20)).toBe(false);
  });
});
