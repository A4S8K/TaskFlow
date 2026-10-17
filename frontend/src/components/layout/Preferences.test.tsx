import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { Preferences } from "./Preferences";
import { ThemeProvider } from "../../contexts/ThemeContext";
import i18n from "../../i18n";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ language: (value: string) => i18n.changeLanguage(value) }),
}));
beforeEach(async () => {
  await i18n.changeLanguage("en");
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
it("switches all three languages immediately", async () => {
  render(
    <ThemeProvider>
      <Preferences />
    </ThemeProvider>,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Language"), "ru");
  expect(document.documentElement.lang).toBe("ru");
  await user.selectOptions(
    screen.getByRole("combobox", { name: i18n.t("common.language") }),
    "kk",
  );
  expect(document.documentElement.lang).toBe("kk");
  expect(localStorage.getItem("taskflow-language")).toBe("kk");
});
it("applies and persists light, dark and system themes", async () => {
  render(
    <ThemeProvider>
      <Preferences />
    </ThemeProvider>,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Theme"), "dark");
  expect(document.documentElement).toHaveClass("dark");
  expect(localStorage.getItem("taskflow-theme")).toBe("dark");
  await user.selectOptions(screen.getByLabelText("Theme"), "light");
  expect(document.documentElement).not.toHaveClass("dark");
  await user.selectOptions(screen.getByLabelText("Theme"), "system");
  expect(localStorage.getItem("taskflow-theme")).toBe("system");
});
