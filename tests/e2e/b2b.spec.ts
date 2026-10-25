import { expect, test } from "@playwright/test";
import { ensureStaff, login, testDb } from "./helpers";

const OFFICE = { email: "e2e-dispatcher@example.com", password: "e2e-dispatcher-password" };
const ACCOUNTANT = { email: "e2e-accountant@example.com", password: "e2e-accountant-password" };

test("business customer: office sets up the company, the dealer requests a transport, the month is invoiced", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  test.setTimeout(120_000);
  await ensureStaff("DISPATCHER", OFFICE.email, OFFICE.password);
  await ensureStaff("ACCOUNTANT", ACCOUNTANT.email, ACCOUNTANT.password);
  const stamp = String(Date.now()).slice(-7);
  const companyName = `E2E Dealer ${stamp}`;
  const dealerEmail = `e2e-dealer-${stamp}@example.com`;
  const dealerPassword = "dealer-password-123";

  const newContext = async () => {
    const c = await browser.newContext({ baseURL });
    await c.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
    return c;
  };

  // Office: company, contract price, portal login
  const officeCtx = await newContext();
  const office = await officeCtx.newPage();
  await login(office, OFFICE.email, OFFICE.password);
  await office.getByRole("link", { name: "Customers" }).first().click();
  await office.getByRole("link", { name: "New company" }).click();
  await office.getByLabel("Company name").fill(companyName);
  await office.getByLabel("Fiscal no. (NUI)").fill(`81${stamp}`);
  await office.getByLabel("One invoice per month").check();
  await office.getByRole("button", { name: "Save" }).click();
  await expect(office.getByRole("heading", { name: companyName })).toBeVisible();
  const companyUrl = office.url();

  const contract = office.locator("section", { has: office.getByRole("heading", { name: "Contract prices" }) });
  await contract.getByLabel("Base fee (€)").fill("30");
  await contract.getByLabel("Per km (€)").fill("0,90");
  await contract.getByRole("button", { name: "Add price" }).click();
  await expect(contract.getByText(/Base €30\.00 · €0\.90\/km/)).toBeVisible();

  const logins = office.locator("section", { has: office.getByRole("heading", { name: "Portal logins" }) });
  await logins.getByLabel("Name").fill("Dea Dealer");
  await logins.getByLabel("Email (login)").fill(dealerEmail);
  await logins.getByLabel("Language").selectOption("en");
  await logins.getByLabel("Initial password").fill(dealerPassword);
  await logins.getByRole("button", { name: "Add login" }).click();
  await expect(logins.getByText(dealerEmail)).toBeVisible();

  // Dealer: lands in the portal, sees the prices, sends a request
  const dealerCtx = await newContext();
  const dealer = await dealerCtx.newPage();
  await login(dealer, dealerEmail, dealerPassword);
  await expect(dealer).toHaveURL(/\/portal$/);
  await expect(dealer.getByText("No open orders.")).toBeVisible();
  await dealer.getByRole("link", { name: "Prices" }).click();
  await expect(dealer.getByRole("cell", { name: "€30.00" })).toBeVisible();

  await dealer.getByRole("link", { name: "New request" }).first().click();
  await dealer.getByLabel("Pickup address").fill("Rruga Eliot Engel, Pejë");
  await dealer.getByLabel("Delivery address").fill("Prishtinë");
  await dealer.getByLabel("Pickup date and time").fill(`${new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)}T10:00`);
  await dealer.getByLabel("Make").fill("Audi");
  await dealer.getByLabel("Model").fill("A4");
  await dealer.getByLabel("Your reference (PO, stock no.)").fill(`PO-${stamp}`);
  await dealer.getByRole("button", { name: "Send request" }).click();
  await expect(dealer.getByText("Please check the marked fields.")).toBeVisible();
  // The form keeps what was typed
  await expect(dealer.getByLabel("Make")).toHaveValue("Audi");
  await dealer.getByLabel("Contact phone").fill("044 123 456");
  await dealer.getByRole("button", { name: "Send request" }).click();
  await expect(dealer.getByText(/^Request P-\d{4}-\d{5} sent/)).toBeVisible();
  await expect(dealer.getByText(`Your ref.: PO-${stamp}`)).toBeVisible();
  const orderId = dealer.url().match(/orders\/([^?]+)/)![1];

  // Another customer's order is not there for the dealer
  const db = testDb();
  const other = await db.order.findFirstOrThrow({ where: { companyId: null } });
  expect((await dealer.goto(`/portal/orders/${other.id}`))?.status()).toBe(404);

  // Office sees the request with the company and reference
  await office.goto(`/admin/orders/${orderId}`);
  await expect(office.getByRole("link", { name: companyName })).toBeVisible();
  await expect(office.getByText(`Customer ref.: PO-${stamp}`)).toBeVisible();

  // Delivered this month at an agreed price ...
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED", finalCents: 8850, deliveredAt: new Date() } });
  await db.$disconnect();

  // ... the accountant puts it on the monthly invoice and issues it
  const accCtx = await newContext();
  const acc = await accCtx.newPage();
  await login(acc, ACCOUNTANT.email, ACCOUNTANT.password);
  await acc.goto(companyUrl);
  const monthly = acc.locator("section", { has: acc.getByRole("heading", { name: "Monthly invoice" }) });
  await expect(monthly.getByRole("option", { name: /\(1 order\)/ })).toHaveCount(1);
  await monthly.getByRole("button", { name: "Create draft" }).click();
  await expect(acc.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await expect(acc.getByTestId("draft-totals")).toContainText("88.50");
  acc.once("dialog", (d) => d.accept());
  await acc.getByRole("button", { name: "Issue invoice" }).click();
  await expect(acc.getByRole("heading", { name: /^Invoice AB-\d{4}-\d{5}$/ })).toBeVisible();

  // The dealer sees the invoice and can open the PDF
  await dealer.goto("/portal/invoices");
  await expect(dealer.getByText(/Open: €88\.50 on 1 invoice/)).toBeVisible();
  const pdf = await dealer.request.get((await dealer.getByRole("link", { name: "PDF" }).getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Portal users stay out of the office screens
  await dealer.goto("/admin/orders");
  await expect(dealer).toHaveURL(/\/portal$/);
  await Promise.all([officeCtx.close(), dealerCtx.close(), accCtx.close()]);
});

test("portal works on a 360px phone", async ({ page, context, baseURL }, info) => {
  test.skip(info.project.name !== "mobile-360", "phone layout");
  await context.addCookies([{ name: "ab_admin_locale", value: "en", url: baseURL! }]);
  await login(page, "dealer@example.com", "portal-demo-password");
  await expect(page).toHaveURL(/\/portal$/);
  for (const path of ["/portal", "/portal/new", "/portal/invoices", "/portal/prices"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }
});
