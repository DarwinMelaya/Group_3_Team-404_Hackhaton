import { expect, test } from "@playwright/test";

test("portal routes, branding, demo boundaries, and unknown-route handling", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to SMART-ANI." }),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByText(/^Backend status: Supabase/)).toBeVisible();
  await expect(page.getByText(/sb_(secret|publishable)_/)).toHaveCount(0);
  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Good things are growing." }),
  ).toBeVisible();
  for (const [label, path] of [
    ["Harvest Exchange", "harvest-exchange"],
    ["Supply Pooling", "supply-pooling"],
    ["Processor Requests", "processor-requests"],
    ["AI Value-Add Analysis", "ai-value-add"],
    ["Transactions", "transactions"],
  ]) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${label}.*SMART-ANI`));
    await page.reload();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/not-a-real-route");
  await expect(
    page.getByRole("heading", { name: "This path hasn’t been planted yet." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("exchange filters combine correctly and recover from empty results", async ({
  page,
}) => {
  await page.goto("/harvest-exchange");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("textbox", { name: "Search harvests" }).fill("banana");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Municipality", { exact: true }).selectOption("Gasan");
  await expect(page.getByText("No harvests match your filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page
    .getByLabel("Priority", { exact: true })
    .selectOption("Priority outreach");
  await expect(page.locator("tbody tr")).toHaveCount(3);
});

test("portal renders at desktop and mobile sizes with working mobile navigation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Good things are growing." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("portal-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("portal-dashboard-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Harvest Exchange", exact: true })
    .click();
  await expect(page).toHaveURL(/\/harvest-exchange$/);
  await expect(
    page.getByRole("heading", { name: "Harvest Exchange", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("portal-mobile.png"),
    fullPage: true,
  });
});

test("farmer validation, save, refresh persistence, filter, and all five routes", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:8081");
  await expect(
    page.getByRole("heading", { name: "A good day to grow." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("farmer-dashboard.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Add Harvest", exact: true })
    .click();
  await page.getByRole("button", { name: "Save demo harvest" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter a quantity greater than 0",
  );
  await page
    .getByRole("textbox", { name: "Quantity (kg)", exact: true })
    .fill("175");
  await page
    .getByRole("textbox", { name: "Asking price (PHP / kg)", exact: true })
    .fill("28");
  await page
    .getByRole("textbox", { name: "Harvest date (YYYY-MM-DD)", exact: true })
    .fill("2026-02-30");
  await page.getByRole("button", { name: "Save demo harvest" }).click();
  await expect(page.getByRole("alert")).toContainText("valid calendar date");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await page
    .getByRole("textbox", { name: "Harvest date (YYYY-MM-DD)", exact: true })
    .fill(today);
  await page
    .getByRole("textbox", { name: "Barangay", exact: true })
    .fill("Browser test barangay");
  await page
    .getByRole("radio", { name: "Outreach priority: Priority", exact: true })
    .click();
  await page.getByRole("button", { name: "Save demo harvest" }).click();
  await expect(page.getByRole("status")).toContainText("Harvest saved");
  await expect(
    page.getByText("Browser test barangay · Boac", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Browser test barangay · Boac", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Filter listings: Priority", exact: true })
    .click();
  await expect(
    page.getByText("Browser test barangay · Boac", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cassava", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("farmer-saved-harvest.png"),
    fullPage: true,
  });
  for (const [name, heading] of [
    ["Transactions", "Transactions"],
    ["Profile", "My profile"],
    ["Dashboard", "A good day to grow."],
    ["My Harvests", "My harvests"],
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (name === "Profile")
      await expect(page.getByText("Backend connection", { exact: true })).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("farmer reports broken storage without overwriting existing records", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("smart-link:demo-harvests:v1", "{invalid-json"),
  );
  await page.goto("http://localhost:8081/harvests");
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("smart-link:demo-harvests:v1"),
    ),
  ).toBe("{invalid-json");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Add Harvest", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save demo harvest" }),
  ).toBeDisabled();
});
