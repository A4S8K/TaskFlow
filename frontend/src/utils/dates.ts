const locales: Record<string, string> = {
  en: "en-GB",
  ru: "ru-RU",
  kk: "kk-KZ",
};

// Naive server timestamps are interpreted as UTC, never as the browser timezone.
export function parseUtc(value: string): Date {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  return new Date(normalized);
}

export function formatDate(
  value: string,
  language = "en",
  withTime = false,
): string {
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locales[language] || "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function toLocalDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function localDateTimeToUtc(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date.toISOString();
}
