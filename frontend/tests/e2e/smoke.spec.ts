import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("register, sign in, create a project and task, update status, sign out", async ({
  page,
}) => {
  const unique = Date.now().toString();
  const email = `smoke${unique}@example.com`;
  const password = `Smoke-${unique}-pass`;
  await page.goto("/register");
  await page.getByLabel("Language", { exact: true }).selectOption("en");
  await page.getByLabel("Username", { exact: true }).fill(`smoke${unique}`);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".page-title")).toBeVisible();
  await page.getByRole("button", { name: "New project" }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill(`Smoke project ${unique}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("link")
    .filter({ hasText: `Smoke project ${unique}` })
    .click();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Ship the first release");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Verified through the real API.");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const handle = page.getByRole("button", {
    name: "Move Ship the first release",
    exact: true,
  });
  const inProgress = page.locator(".board-column").filter({
    has: page.getByRole("heading", { name: "In progress", exact: true }),
  });
  const from = await handle.boundingBox();
  const to = await inProgress.boundingBox();
  if (!from || !to) throw new Error("Board drag targets are unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 15, from.y + 15, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 20 });
  await page.mouse.up();
  await expect(
    inProgress.getByRole("heading", { name: "Ship the first release" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Ship the first release/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("DONE");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const doneColumn = page
    .locator(".board-column")
    .filter({ has: page.getByRole("heading", { name: "Done", exact: true }) });
  await expect(
    doneColumn.getByRole("heading", { name: "Ship the first release" }),
  ).toBeVisible();
  if (process.env.CAPTURE_SCREENSHOTS) {
    await mkdir("../screenshots", { recursive: true });
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await page.screenshot({
      path: "../screenshots/board-en.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toBeVisible();
    await page.screenshot({
      path: "../screenshots/dashboard-en.png",
      fullPage: true,
    });
    await page
      .getByRole("link")
      .filter({ hasText: `Smoke project ${unique}` })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Smoke project ${unique}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.getByLabel("Language", { exact: true }).selectOption("ru");
  await expect(
    page.getByRole("button", { name: "Новая задача", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Язык", { exact: true }).selectOption("kk");
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await page.locator(".preferences select").first().selectOption("en");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveClass("dark");
  if (process.env.CAPTURE_SCREENSHOTS)
    await page.screenshot({
      path: "../screenshots/board-dark.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/app");
  await expect(page).toHaveURL(/login/);
});
