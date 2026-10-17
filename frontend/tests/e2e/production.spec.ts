import { test, expect, type Page } from "@playwright/test";

interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
}
type CspWindow = Window & { taskflowCspViolations: CspViolation[] };

async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const browserWindow = window as CspWindow;
    browserWindow.taskflowCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      browserWindow.taskflowCspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
      });
    });
  });
}

async function verifyCsp(page: Page) {
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(csp).toBeTruthy();
  const connectSources = csp
    ?.split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("connect-src "));
  expect(connectSources).toBe("connect-src 'self'");
  expect(csp).not.toContain("unsafe-eval");
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(() => (window as CspWindow).taskflowCspViolations),
  ).toEqual([]);
}

test.describe("production same-origin static delivery", () => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION !== "1",
    "Requires the built same-origin app and disposable local static/API proxy.",
  );

  for (const route of ["/app", "/app/projects", "/app/settings"]) {
    test(`serves and refreshes ${route}, then protects the client route`, async ({
      browser,
      page,
      baseURL,
    }) => {
      // Disable scripts in this separate context to verify a refresh of the
      // nested URL itself, before React redirects an unauthenticated visitor.
      const staticContext = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
      });
      try {
        const staticPage = await staticContext.newPage();
        const initial = await staticPage.goto(route);
        expect(initial?.status()).toBe(200);
        expect(initial?.headers()["content-type"]).toMatch(/^text\/html\b/);
        await expect(staticPage).toHaveURL(`${baseURL}${route}`);
        const refreshed = await staticPage.reload();
        expect(refreshed?.status()).toBe(200);
        expect(refreshed?.headers()["content-type"]).toMatch(/^text\/html\b/);
        await expect(staticPage).toHaveURL(`${baseURL}${route}`);
      } finally {
        await staticContext.close();
      }

      await watchCsp(page);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/login$/);
      await expect(
        page.getByRole("heading", { name: "Welcome back", exact: true }),
      ).toBeVisible();
      await verifyCsp(page);
      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
      await verifyCsp(page);
    });
  }

  test("serves real bundle assets and returns 404 for missing assets", async ({
    request,
  }) => {
    const document = await request.get("/app/projects");
    expect(document.status()).toBe(200);
    expect(document.headers()["content-type"]).toMatch(/^text\/html\b/);
    const html = await document.text();
    const assets = [
      ...new Set(
        [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);
    expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);
    for (const asset of assets) {
      const response = await request.get(asset);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(
        asset.endsWith(".css")
          ? /^text\/css\b/
          : /^(?:application|text)\/javascript\b/,
      );
      const body = await response.text();
      expect(body.trim().length).toBeGreaterThan(0);
      expect(body).not.toMatch(/^\s*<!doctype html/i);
    }
    for (const extension of ["js", "css"]) {
      const missing = await request.get(
        `/assets/taskflow-production-check-missing.${extension}`,
      );
      expect(missing.status()).toBe(404);
      expect(await missing.text()).not.toContain('<div id="root">');
    }
  });
});
