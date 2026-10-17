import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.use({ viewport: { width: 390, height: 844 } });
test("mobile navigation, responsive layout, and memory-only session", async ({
  page,
  request,
}) => {
  const unique = Date.now();
  const email = `mobile${unique}@example.com`;
  const password = `Mobile-${unique}-password`;
  const registration = await request.post(
    "http://localhost:8000/api/v1/auth/register",
    { data: { username: `mobile${unique}`, email, password } },
  );
  expect(registration.status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".page-title")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  if (process.env.CAPTURE_SCREENSHOTS) {
    await mkdir("../screenshots", { recursive: true });
    await page.screenshot({
      path: "../screenshots/dashboard-mobile.png",
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/login/);
  const stored = await page.evaluate(() => ({ ...localStorage }));
  expect(
    Object.keys(stored).every((key) =>
      ["taskflow-language", "taskflow-theme"].includes(key),
    ),
  ).toBe(true);
});
