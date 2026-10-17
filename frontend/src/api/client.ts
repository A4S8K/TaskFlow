import axios from "axios";
import i18n from "../i18n";

// Access tokens live in this module's memory only. Reloading requires sign-in.
let accessToken: string | null = null;
let sessionGeneration = 0;
const requestGenerations = new WeakMap<object, number>();
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  sessionGeneration++;
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: __TASKFLOW_API_BASE_URL__,
  timeout: 20_000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config) => {
  requestGenerations.set(config, sessionGeneration);
  config.headers.set("Accept-Language", i18n.resolvedLanguage || "en");
  if (accessToken) config.headers.set("Authorization", `Bearer ${accessToken}`);
  else config.headers.delete("Authorization");
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      accessToken &&
      error.config &&
      requestGenerations.get(error.config) === sessionGeneration
    ) {
      setAccessToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
