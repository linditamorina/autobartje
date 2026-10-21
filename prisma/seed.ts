/**
 * Seed data: roles, the first owner account, settings, starting price list,
 * route tariffs, holidays, service areas, FAQ, and demo fleet + orders.
 * Safe to run more than once (upserts). Demo data is skipped with SEED_DEMO=false.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SYSTEM_ROLES } from "../src/server/auth/permissions";
import { DEFAULT_PRICING_RULES, DEFAULT_ROUTE_TARIFFS } from "../src/server/pricing/defaults";
import { DEFAULT_SETTINGS } from "../src/server/settings/defaults";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const demo = process.env.SEED_DEMO !== "false";

// Kosovo public holidays. Fixed dates plus 2026–2027 moving dates (Easter, Eid);
// the Eid dates depend on the moon sighting, so the owner should confirm them in admin.
const HOLIDAYS: [string, string][] = [
  ["2026-01-01", "Viti i Ri"], ["2026-01-02", "Viti i Ri"], ["2026-01-07", "Krishtlindjet ortodokse"],
  ["2026-02-17", "Dita e Pavarësisë"], ["2026-03-20", "Fitër Bajrami"], ["2026-04-06", "Pashkët katolike"],
  ["2026-04-09", "Dita e Kushtetutës"], ["2026-04-13", "Pashkët ortodokse"], ["2026-05-01", "Dita e Punës"],
  ["2026-05-09", "Dita e Evropës"], ["2026-05-27", "Kurban Bajrami"], ["2026-12-25", "Krishtlindjet katolike"],
  ["2027-01-01", "Viti i Ri"], ["2027-01-02", "Viti i Ri"], ["2027-01-07", "Krishtlindjet ortodokse"],
  ["2027-02-17", "Dita e Pavarësisë"], ["2027-03-10", "Fitër Bajrami"], ["2027-03-29", "Pashkët katolike"],
  ["2027-04-09", "Dita e Kushtetutës"], ["2027-05-01", "Dita e Punës"], ["2027-05-03", "Pashkët ortodokse"],
  ["2027-05-09", "Dita e Evropës"], ["2027-05-17", "Kurban Bajrami"], ["2027-12-25", "Krishtlindjet katolike"],
];

const AREAS: [string, string, number, number][] = [
  ["peje", "Pejë", 42.6593, 20.2887],
  ["prishtine", "Prishtinë", 42.6629, 21.1655],
  ["prizren", "Prizren", 42.2139, 20.7397],
  ["gjakove", "Gjakovë", 42.3803, 20.4308],
  ["mitrovice", "Mitrovicë", 42.8914, 20.866],
  ["ferizaj", "Ferizaj", 42.3702, 21.1553],
  ["gjilan", "Gjilan", 42.4635, 21.4694],
  ["istog", "Istog", 42.7808, 20.4875],
  ["kline", "Klinë", 42.6214, 20.5778],
  ["decan", "Deçan", 42.5402, 20.2879],
];

async function main() {
  // Roles
  const roles: Record<string, string> = {};
  for (const r of SYSTEM_ROLES) {
    const role = await db.role.upsert({
      where: { key: r.key },
      update: { name: r.name, permissions: r.permissions, requires2fa: r.requires2fa, isSystem: true },
      create: { key: r.key, name: r.name, permissions: r.permissions, requires2fa: r.requires2fa, isSystem: true },
    });
    roles[r.key] = role.id;
  }

  // First owner account. 2FA setup is forced on first login.
  const email = (process.env.SEED_ADMIN_EMAIL ?? "owner@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me-now-please";
  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Owner", roleId: roles.OWNER, passwordHash: await hash(password) },
  });

  // Settings (only missing keys, so admin edits are never overwritten)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }

  // Pricing
  if ((await db.pricingRule.count()) === 0) {
    await db.pricingRule.createMany({
      data: DEFAULT_PRICING_RULES.map((r) => ({ ...r, conditions: r.conditions ? { ...r.conditions } : undefined })),
    });
  }
  if ((await db.routeTariff.count()) === 0) {
    await db.routeTariff.createMany({ data: DEFAULT_ROUTE_TARIFFS });
  }
  for (const [date, name] of HOLIDAYS) {
    await db.holiday.upsert({ where: { date: new Date(`${date}T00:00:00Z`) }, update: {}, create: { date: new Date(`${date}T00:00:00Z`), name } });
  }

  // Service areas (city pages)
  for (const [slug, name, lat, lng] of AREAS) {
    await db.serviceArea.upsert({
      where: { slug },
      update: {},
      create: { slug, name: { sq: name, en: name, de: name }, lat, lng },
    });
  }

  if (!demo) return;

  // Demo fleet
  const in6Months = new Date(Date.now() + 182 * 864e5);
  const in20Days = new Date(Date.now() + 20 * 864e5);
  const trucks = [
    { plate: "03-123-AB", name: "Platforma 1", kind: "flatbed", hasWinch: true, insuranceExpires: in6Months, registrationExpires: in6Months, inspectionExpires: in20Days },
    { plate: "03-456-AB", name: "Platforma 2", kind: "flatbed", hasWinch: true, insuranceExpires: in6Months, registrationExpires: in6Months, inspectionExpires: in6Months },
    { plate: "03-789-AB", name: "Bartës 4 vende", kind: "car carrier", capacityVehicles: 4, insuranceExpires: in6Months, registrationExpires: in6Months, inspectionExpires: in6Months },
  ];
  for (const t of trucks) await db.truck.upsert({ where: { plate: t.plate }, update: {}, create: t });

  const drivers = [
    { email: "arben@example.com", name: "Arben K.", category: "C" as const },
    { email: "driton@example.com", name: "Driton M.", category: "CE" as const },
  ];
  for (const d of drivers) {
    const user = await db.user.upsert({
      where: { email: d.email },
      update: {},
      create: { email: d.email, name: d.name, roleId: roles.DRIVER, passwordHash: await hash("driver-demo-password") },
    });
    await db.driver.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, licenseCategory: d.category, licenseExpires: new Date("2029-06-30") },
    });
  }

  // FAQ
  if ((await db.faqItem.count()) === 0) {
    await db.faqItem.createMany({
      data: [
        { locale: "sq", position: 1, question: "Sa shpejt mund të vini?", answer: "Në Pejë dhe rrethinë zakonisht brenda 30 minutave, ditë e natë." },
        { locale: "sq", position: 2, question: "A është i siguruar automjeti gjatë transportit?", answer: "Po, çdo automjet është i siguruar nga momenti i ngarkimit deri në dorëzim." },
        { locale: "en", position: 1, question: "How fast can you arrive?", answer: "In Peja and nearby usually within 30 minutes, day and night." },
        { locale: "en", position: 2, question: "Is my vehicle insured during transport?", answer: "Yes, every vehicle is insured from loading until delivery." },
        { locale: "de", position: 1, question: "Wie schnell können Sie da sein?", answer: "In Peja und Umgebung meist innerhalb von 30 Minuten, Tag und Nacht." },
        { locale: "de", position: 2, question: "Ist mein Fahrzeug während des Transports versichert?", answer: "Ja, jedes Fahrzeug ist vom Aufladen bis zur Übergabe versichert." },
      ],
    });
  }

  // Demo customers and orders
  if ((await db.order.count()) === 0) {
    const customer = await db.customer.create({
      data: { fullName: "Blerim Gashi", phone: "+38344111222", preferredChannel: "WHATSAPP" },
    });
    const statuses = ["RECEIVED", "CONFIRMED", "DELIVERED"] as const;
    for (const [i, status] of statuses.entries()) {
      await db.order.create({
        data: {
          number: `AB-${new Date().getFullYear()}-${String(i + 1).padStart(6, "0")}`,
          status,
          priority: i === 0 ? "URGENT" : "NORMAL",
          service: i === 0 ? "EMERGENCY_TOWING" : "DOMESTIC_TRANSPORT",
          channel: i === 0 ? "PHONE" : "WEB_BOOKING",
          customerId: customer.id,
          pickupAddress: "Rruga Mbretëresha Teutë, Pejë",
          pickupLat: 42.6593,
          pickupLng: 20.2887,
          dropoffAddress: "Prishtinë",
          dropoffLat: 42.6629,
          dropoffLng: 21.1655,
          distanceKm: 85,
          isAsap: i === 0,
          options: {},
          estimatedCents: 13500,
          statusEvents: { create: { to: status } },
        },
      });
    }
    await db.counter.upsert({ where: { key: `order:${new Date().getFullYear()}` }, update: {}, create: { key: `order:${new Date().getFullYear()}`, value: statuses.length } });
  }
}

main()
  .then(() => console.log("Seed complete."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
