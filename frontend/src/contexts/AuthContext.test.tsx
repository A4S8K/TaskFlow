import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { meApi, write } from "../api/resources";
import type { User } from "../types";

vi.mock("../api/resources", () => ({ meApi: vi.fn(), write: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
});
function Harness() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.user?.username ?? "guest"}</span>
      <button onClick={() => void auth.login("alex@example.com", "password")}>
        login
      </button>
      <button onClick={() => void auth.language("ru")}>language</button>
      <button onClick={auth.logout}>logout</button>
    </>
  );
}
it("does not restore authentication when a preference response arrives after logout", async () => {
  const profile = {
    id: 1,
    username: "Alex",
    email: "alex@example.com",
    preferred_language: "en",
  } as User;
  vi.mocked(meApi).mockResolvedValue(profile);
  let resolvePreference: (value: User) => void = () => undefined;
  vi.mocked(write)
    .mockResolvedValueOnce({ access_token: "test-token" })
    .mockReturnValueOnce(
      new Promise<User>((resolve) => {
        resolvePreference = resolve;
      }),
    );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByText("login"));
  expect(await screen.findByText("Alex")).toBeVisible();
  await user.click(screen.getByText("language"));
  await waitFor(() =>
    expect(write).toHaveBeenCalledWith("patch", "/users/me/preferences", {
      preferred_language: "ru",
    }),
  );
  await user.click(screen.getByText("logout"));
  expect(screen.getByText("guest")).toBeVisible();
  await act(async () => {
    resolvePreference({ ...profile, preferred_language: "ru" });
  });
  expect(screen.getByText("guest")).toBeVisible();
});

function renderHarness() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

it("does not restore a session when login completes after logout", async () => {
  let resolveLogin: (value: { access_token: string }) => void = () => undefined;
  vi.mocked(write).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveLogin = resolve;
    }),
  );
  const user = renderHarness();
  await user.click(screen.getByText("login"));
  await user.click(screen.getByText("logout"));
  await act(async () => {
    resolveLogin({ access_token: "late-test-token" });
  });
  expect(screen.getByText("guest")).toBeVisible();
  expect(meApi).not.toHaveBeenCalled();
});

it("does not restore a session when the profile completes after logout", async () => {
  let resolveProfile: (value: User) => void = () => undefined;
  vi.mocked(write).mockResolvedValueOnce({ access_token: "test-token" });
  vi.mocked(meApi).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveProfile = resolve;
    }),
  );
  const user = renderHarness();
  await user.click(screen.getByText("login"));
  await waitFor(() => expect(meApi).toHaveBeenCalledOnce());
  await user.click(screen.getByText("logout"));
  await act(async () => {
    resolveProfile({
      id: 1,
      username: "Late",
      preferred_language: "en",
    } as User);
  });
  expect(screen.getByText("guest")).toBeVisible();
});

it("keeps the newer login when an older profile arrives last", async () => {
  let resolveOldProfile: (value: User) => void = () => undefined;
  vi.mocked(write)
    .mockResolvedValueOnce({ access_token: "old-test-token" })
    .mockResolvedValueOnce({ access_token: "new-test-token" });
  vi.mocked(meApi)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldProfile = resolve;
      }),
    )
    .mockResolvedValueOnce({
      id: 2,
      username: "Current",
      preferred_language: "en",
    } as User);
  const user = renderHarness();
  await user.click(screen.getByText("login"));
  await waitFor(() => expect(meApi).toHaveBeenCalledOnce());
  await user.click(screen.getByText("login"));
  expect(await screen.findByText("Current")).toBeVisible();
  await act(async () => {
    resolveOldProfile({
      id: 1,
      username: "Old",
      preferred_language: "en",
    } as User);
  });
  expect(screen.getByText("Current")).toBeVisible();
  expect(screen.queryByText("Old")).not.toBeInTheDocument();
});
