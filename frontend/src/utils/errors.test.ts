import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { getErrorMessage } from "./errors";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("getErrorMessage", () => {
  it.each([
    [401, "errors.invalidCredentials"],
    [403, "errors.forbidden"],
    [404, "errors.notFound"],
    [409, "errors.conflict"],
    [422, "errors.validation"],
    [500, "errors.server"],
    [503, "errors.server"],
    [400, "errors.generic"],
  ])("maps HTTP %s to a localized safe message", (status, key) => {
    expect(
      getErrorMessage({
        isAxiosError: true,
        response: { status, data: { detail: "private server internals" } },
      }),
    ).toBe(i18n.t(key));
  });

  it("distinguishes connection failures from unknown errors", () => {
    expect(getErrorMessage({ isAxiosError: true })).toBe(
      i18n.t("errors.network"),
    );
    expect(getErrorMessage(new Error("private server internals"))).toBe(
      i18n.t("errors.generic"),
    );
    expect(getErrorMessage(null)).toBe(i18n.t("errors.generic"));
  });

  it("uses the active language when the error is displayed", async () => {
    await i18n.changeLanguage("kk");
    expect(
      getErrorMessage({ isAxiosError: true, response: { status: 403 } }),
    ).toBe(i18n.t("errors.forbidden"));
  });
});
