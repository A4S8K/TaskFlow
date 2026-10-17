import axios from "axios";
import i18n from "../i18n";

// Access tokens live in this module's memory only. Reloading requires sign-in.
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 20_000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config) => {
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
      accessToken
    ) {
      accessToken = null;
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
