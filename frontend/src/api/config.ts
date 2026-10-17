export interface ApiEnvironment {
  apiURL?: string;
  apiMode?: string;
  production: boolean;
  vercel?: boolean;
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host.includes(":")
  )
    return true;

  // Production uses a public DNS origin; reject numeric/private/reserved IPs.
  return /^\d+(?:\.\d+){3}$/.test(host);
}

/** Build-time public configuration only. Never pass credentials through VITE_. */
export function resolveApiConfig(environment: ApiEnvironment): string {
  const mode = environment.apiMode?.trim() || "external";
  const value = environment.apiURL?.trim();
  if (mode !== "external" && mode !== "same-origin") {
    throw new Error("VITE_API_MODE must be external or same-origin.");
  }
  if (mode === "same-origin") {
    if (environment.vercel) {
      throw new Error(
        "Vercel requires external mode and a public VITE_API_URL.",
      );
    }
    if (value) {
      throw new Error(
        "VITE_API_URL must be empty in explicit same-origin mode.",
      );
    }
    return "";
  }
  if (!value) {
    throw new Error("VITE_API_URL is required in external mode.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) origin.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "VITE_API_URL must be an HTTP(S) origin without credentials, path, query or fragment.",
    );
  }
  if (
    environment.production &&
    (url.protocol !== "https:" || isLocalHost(url.hostname))
  ) {
    throw new Error(
      "Production VITE_API_URL must be a public HTTPS DNS origin.",
    );
  }
  return url.origin;
}

export function productionCsp(apiBaseURL: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Radix, charts and drag/drop components use dynamic inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${apiBaseURL ? ` ${new URL(apiBaseURL).origin}` : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}
