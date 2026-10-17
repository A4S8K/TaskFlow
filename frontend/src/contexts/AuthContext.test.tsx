import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { meApi, write } from "../api/resources";
import type { User } from "../types";

vi.mock("../api/resources", () => ({ meApi: vi.fn(), write: vi.fn() }));
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
