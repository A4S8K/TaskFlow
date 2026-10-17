import { describe, expect, it } from "vitest";
import {
  formatDate,
  localDateTimeToUtc,
  parseUtc,
  toLocalDateTimeInput,
} from "./dates";

describe("UTC and local dates", () => {
  it("interprets naive API timestamps as UTC", () => {
    expect(parseUtc("2026-10-17T10:30:00").toISOString()).toBe(
      "2026-10-17T10:30:00.000Z",
    );
  });
  it("preserves explicit UTC offsets", () => {
    expect(parseUtc("2026-10-17T15:30:00+05:00").toISOString()).toBe(
      "2026-10-17T10:30:00.000Z",
    );
  });
  it("round-trips local input back to UTC", () => {
    const utc = "2026-10-17T10:30:00.000Z";
    expect(localDateTimeToUtc(toLocalDateTimeInput(utc))).toBe(utc);
  });
  it("supports clearing a deadline and malformed display values", () => {
    expect(localDateTimeToUtc("")).toBeNull();
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(formatDate("invalid")).toBe("—");
  });
});
