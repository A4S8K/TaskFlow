import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "./i18n";
import App from "./App";

vi.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    language: (value: string) => i18n.changeLanguage(value),
  }),
}));
vi.mock("./contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

it.each([
  "/app",
  "/app/projects",
  "/app/projects/1",
  "/app/tasks",
  "/app/settings",
])("redirects unauthenticated visitors from %s to sign in", async (route) => {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(
      screen.queryByRole("link", { name: "Dashboard" }),
  ).not.toBeInTheDocument();
});
