import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { apiClient, setAccessToken, setUnauthorizedHandler } from "./client";

describe("central API client", () => {
  const originalAdapter = apiClient.defaults.adapter;
  let received: InternalAxiosRequestConfig | undefined;

  beforeEach(() => {
    received = undefined;
    setAccessToken(null);
    apiClient.defaults.adapter = async (config) => {
      received = config;
      return {
        config,
        status: 200,
        statusText: "OK",
        data: {},
        headers: new AxiosHeaders(),
      };
    };
  });

  afterEach(async () => {
    setAccessToken(null);
    setUnauthorizedHandler(null);
    apiClient.defaults.adapter = originalAdapter;
    await i18n.changeLanguage("en");
  });

  it("sends the active language and memory-only access token", async () => {
    await i18n.changeLanguage("kk");
    setAccessToken("test-memory-token");
    await apiClient.get("/test-resource");
    expect(received?.headers.get("Accept-Language")).toBe("kk");
    expect(received?.headers.get("Authorization")).toBe(
      "Bearer test-memory-token",
    );
    expect(Object.values(localStorage)).not.toContain("test-memory-token");
  });

  it("removes authorization when signing out and forwards cancellation", async () => {
    setAccessToken("test-memory-token");
    setAccessToken(null);
    const controller = new AbortController();
    await apiClient.get("/test-resource", { signal: controller.signal });
    expect(received?.headers.has("Authorization")).toBe(false);
    expect(received?.signal).toBe(controller.signal);
  });

  it("clears an expired session on 401 and notifies the application", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAccessToken("expired-memory-token");
    const rejectUnauthorized: AxiosAdapter = async (config) => {
      throw new AxiosError(
        "Unauthorized",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        {
          config,
          status: 401,
          statusText: "Unauthorized",
          data: {},
          headers: new AxiosHeaders(),
        },
      );
    };
    apiClient.defaults.adapter = rejectUnauthorized;
    await expect(apiClient.get("/test-resource")).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(onUnauthorized).toHaveBeenCalledOnce();
    apiClient.defaults.adapter = async (config) => {
      received = config;
      return {
        config,
        status: 200,
        statusText: "OK",
        data: {},
        headers: new AxiosHeaders(),
      };
    };
    await apiClient.get("/test-resource");
    expect(received?.headers.has("Authorization")).toBe(false);
  });

  it("does not clear a newer session when an old request returns 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAccessToken("old-token");
    let rejectOldRequest: (error: unknown) => void = () => undefined;
    apiClient.defaults.adapter = (config) => {
      received = config;
      return new Promise((_resolve, reject) => {
        rejectOldRequest = reject;
      });
    };
    const oldRequest = apiClient.get("/slow-request");
    const rejection = expect(oldRequest).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(received).toBeDefined());
    const oldConfig = received!;
    setAccessToken("new-token");
    rejectOldRequest(
      new AxiosError("Unauthorized", "ERR_BAD_REQUEST", oldConfig, undefined, {
        config: oldConfig,
        status: 401,
        statusText: "Unauthorized",
        data: {},
        headers: new AxiosHeaders(),
      }),
    );
    await rejection;
    expect(onUnauthorized).not.toHaveBeenCalled();
    apiClient.defaults.adapter = async (config) => {
      received = config;
      return {
        config,
        status: 200,
        statusText: "OK",
        data: {},
        headers: new AxiosHeaders(),
      };
    };
    await apiClient.get("/new-session-request");
    expect(received?.headers.get("Authorization")).toBe("Bearer new-token");
  });
});
