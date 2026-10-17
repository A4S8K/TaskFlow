import { describe, expect, it } from "vitest";
import { productionCsp, resolveApiConfig } from "./config";

describe("production API configuration", () => {
  it("requires an explicit public HTTPS API origin", () => {
    expect(
      resolveApiConfig({
        production: true,
        apiURL: "https://api.example.com/",
      }),
    ).toBe("https://api.example.com");
    for (const apiURL of [
      undefined,
      "",
      "http://api.example.com",
      "https://localhost:8000",
      "https://127.0.0.1",
      "https://10.0.0.1",
      "https://[::1]",
      "https://backend",
      "https://api.local",
      "https://api.internal",
    ]) {
      expect(() => resolveApiConfig({ production: true, apiURL })).toThrow(
        /VITE_API_URL/,
      );
    }
  });

  it("rejects embedded secrets and unintended API prefixes", () => {
    for (const apiURL of [
      "https://user:secret@api.example.com",
      "https://api.example.com/api/v1",
      "https://api.example.com?secret=redacted",
      "https://api.example.com#fragment",
      "javascript:alert(1)",
      "not a URL",
    ]) {
      expect(() => resolveApiConfig({ production: true, apiURL })).toThrow(
        /VITE_API_URL/,
      );
    }
  });

  it("allows explicit same-origin Docker builds but forbids that mode on Vercel", () => {
    expect(resolveApiConfig({ production: true, apiMode: "same-origin" })).toBe(
      "",
    );
    expect(() =>
      resolveApiConfig({
        production: true,
        apiMode: "same-origin",
        vercel: true,
      }),
    ).toThrow(/Vercel/);
    expect(() =>
      resolveApiConfig({
        production: true,
        apiMode: "same-origin",
        apiURL: "https://api.example.com",
      }),
    ).toThrow(/empty/);
    expect(() =>
      resolveApiConfig({ production: true, apiMode: "unknown" }),
    ).toThrow(/VITE_API_MODE/);
  });

  it("accepts an explicitly supplied HTTP origin only for development", () => {
    expect(
      resolveApiConfig({ production: false, apiURL: "http://localhost:18000" }),
    ).toBe("http://localhost:18000");
  });

  it("limits production connections to the configured API and own origin", () => {
    expect(productionCsp("https://api.example.com")).toContain(
      "connect-src 'self' https://api.example.com",
    );
    expect(productionCsp("")).toContain("connect-src 'self';");
    expect(productionCsp("")).not.toContain("unsafe-eval");
  });
});
