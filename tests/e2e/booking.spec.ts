import { expect, test } from "@playwright/test";

// Stand-in for Cloudflare's widget so the tests don't need the network. It answers with
// Cloudflare's dummy token after a short delay, like the real widget with the test site key.
test.beforeEach(async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = { render(el, o) { setTimeout(() => o.callback("XXXX.DUMMY.TOKEN.XXXX"), 300); return "w"; }, remove() {} };`,
    }),
  );
});

test.describe("quote calculator", () => {
  test.use({ geolocation: { latitude: 42.6655, longitude: 20.3123 }, permissions: ["geolocation"] });

  test("shows an estimated price with VAT for roadside help", async ({ page }) => {
    await page.goto("/en/quote");
    await page.getByLabel("Roadside help on the spot").check();
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByLabel("Pickup address")).toHaveValue(/Use my location \(42\.66/);
    await page.getByRole("button", { name: "Show price" }).click();
    await expect(page.getByTestId("quote-total")).toContainText("€");
    await expect(page.getByText("incl. 18% VAT")).toBeVisible();
    await expect(page.getByText("Final price is confirmed by the operator.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Book this transport" })).toBeVisible();
  });

  test("asks for the addresses before pricing", async ({ page }) => {
    await page.goto("/en/quote?service=DOMESTIC_TRANSPORT");
    await page.getByRole("button", { name: "Show price" }).click();
    await expect(page.getByText("This field is required.").first()).toBeVisible();
  });
});

test.describe("booking wizard", () => {
  test("books a planned transport in 5 steps and shows the order number", async ({ page }) => {
    await page.goto("/en/book");
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    // 1. Service and route
    await page.getByLabel("Planned transport").check();
    await page.getByLabel("Pickup address").fill("Rruga Mbretëresha Teutë 12, Pejë");
    await page.getByLabel("Delivery address").fill("Bulevardi Nënë Tereza, Prishtinë");
    await page.getByLabel("SUV / 4x4").check();
    await page.getByLabel("Yes").check();
    await page.getByRole("button", { name: "Continue" }).click();

    // 2. Vehicle
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    await page.getByLabel("Make").fill("Volkswagen");
    await page.getByLabel("Model").fill("Tiguan");
    await page.getByLabel("Year").fill("2019");
    await page.getByLabel("Licence plate").fill("03-111-AA");
    await page.getByRole("button", { name: "Continue" }).click();

    // 3. Time
    await expect(page.getByText("Step 3 of 5")).toBeVisible();
    await page.getByLabel("Choose date and time").check();
    const tomorrow = new Date(Date.now() + 864e5);
    tomorrow.setHours(10, 0, 0, 0);
    const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await page.getByLabel("Pickup date and time").fill(local);
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Contact (invalid phone first)
    await expect(page.getByText("Step 4 of 5")).toBeVisible();
    await page.getByLabel("Full name").fill("Test Customer");
    await page.getByLabel("Phone number").fill("123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
    // A fresh number per run: bookings are rate-limited per phone.
    const phone = `044 ${100000 + Math.floor(Math.random() * 899999)}`;
    await page.getByLabel("Phone number").fill(phone);
    await page.getByLabel("WhatsApp").check();
    await page.getByRole("button", { name: "Continue" }).click();

    // 5. Summary and consents
    await expect(page.getByText("Step 5 of 5")).toBeVisible();
    await expect(page.getByText("Volkswagen Tiguan 2019")).toBeVisible();
    await page.getByRole("button", { name: "Send booking" }).click();
    await expect(page.getByText("Please accept to continue.").first()).toBeVisible();
    await page.getByLabel(/I accept the terms of service/).check();
    await page.getByLabel(/I have read the privacy policy/).check();
    await page.getByRole("button", { name: "Send booking" }).click();

    await expect(page).toHaveURL(/\/en\/book\/done\?order=P-\d{4}-\d{5}/);
    await expect(page.getByTestId("order-number")).toHaveText(/^P-\d{4}-\d{5}$/);
    const number = (await page.getByTestId("order-number").textContent())!.trim();

    // Tracking page from the confirmation
    await page.getByRole("link", { name: "Track your order" }).click();
    await expect(page).toHaveURL(/\/en\/track\/[a-f0-9]{64}$/);
    const trackUrl = page.url();
    await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText("Request received");
    await expect(page.getByText("Volkswagen")).toHaveCount(0);

    // ... and by order number + phone
    await page.goto("/en/track");
    await page.getByLabel("Order number").fill(number);
    await page.getByLabel("Phone number").fill("044 000 001");
    await page.getByRole("button", { name: "Show my order" }).click();
    await expect(page.getByText(/could not find an order/)).toBeVisible();
    await page.getByLabel("Phone number").fill(phone);
    await page.getByRole("button", { name: "Show my order" }).click();
    await expect(page).toHaveURL(trackUrl);
  });

  test("keeps progress after a reload (autosave)", async ({ page }) => {
    await page.goto("/en/book");
    await page.getByLabel("Planned transport").check();
    await page.getByLabel("Pickup address").fill("Pejë");
    await page.reload();
    await expect(page.getByLabel("Planned transport")).toBeChecked();
    await expect(page.getByLabel("Pickup address")).toHaveValue("Pejë");
  });
});
