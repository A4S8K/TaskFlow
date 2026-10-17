import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { AuthForm, type AuthFormProps } from "./AuthForm";

function renderForm(props: Partial<AuthFormProps> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <I18nextProvider i18n={i18n}>
      <AuthForm mode="login" {...props} onSubmit={onSubmit} />
    </I18nextProvider>,
  );
  return { user: userEvent.setup(), onSubmit };
}

async function fillLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(i18n.t("auth.email")),
    "person@example.com",
  );
  await user.type(
    screen.getByLabelText(i18n.t("auth.password")),
    "strong-password",
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("AuthForm", () => {
  it("shows required field errors and focuses the first invalid field", async () => {
    const { user, onSubmit } = renderForm();
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    );
    const email = screen.getByLabelText(i18n.t("auth.email"));
    expect(screen.getByText(i18n.t("validation.emailRequired"))).toBeVisible();
    expect(
      screen.getByText(i18n.t("validation.passwordRequired")),
    ).toBeVisible();
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      i18n.t("validation.emailRequired"),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates email format and password length before submission", async () => {
    const { user, onSubmit } = renderForm();
    await user.type(screen.getByLabelText(i18n.t("auth.email")), "invalid");
    await user.type(screen.getByLabelText(i18n.t("auth.password")), "short");
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    );
    expect(screen.getByText(i18n.t("validation.emailInvalid"))).toBeVisible();
    expect(
      screen.getByText(i18n.t("validation.passwordMin", { min: 8 })),
    ).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits login values without registration-only fields", async () => {
    const { user, onSubmit } = renderForm();
    await fillLogin(user);
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        email: "person@example.com",
        password: "strong-password",
      }),
    );
  });

  it("requires a username and matching passwords for registration", async () => {
    const { user, onSubmit } = renderForm({ mode: "register" });
    await fillLogin(user);
    await user.type(
      screen.getByLabelText(i18n.t("auth.confirmPassword")),
      "other-password",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.register") }),
    );
    expect(
      screen.getByText(i18n.t("validation.usernameRequired")),
    ).toBeVisible();
    expect(
      screen.getByText(i18n.t("validation.passwordMismatch")),
    ).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(i18n.t("auth.username")), " Jamie ");
    await user.clear(screen.getByLabelText(i18n.t("auth.confirmPassword")));
    await user.type(
      screen.getByLabelText(i18n.t("auth.confirmPassword")),
      "strong-password",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.register") }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        email: "person@example.com",
        password: "strong-password",
        username: "Jamie",
      }),
    );
  });

  it("toggles password visibility without submitting the form", async () => {
    const { user, onSubmit } = renderForm();
    const password = screen.getByLabelText(i18n.t("auth.password"));
    expect(password).toHaveAttribute("type", "password");
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.showPassword") }),
    );
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: i18n.t("auth.hidePassword") }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.hidePassword") }),
    );
    expect(password).toHaveAttribute("type", "password");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports safe localized errors when submission fails", async () => {
    const { user } = renderForm({
      onSubmit: vi
        .fn()
        .mockRejectedValue(new Error("private server internals")),
    });
    await fillLogin(user);
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("errors.generic"),
    );
    expect(
      screen.queryByText("private server internals"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    ).toBeEnabled();
  });

  it("displays an external API error in the selected language", async () => {
    await i18n.changeLanguage("ru");
    renderForm({
      error: {
        isAxiosError: true,
        response: { status: 401, data: { detail: "internal details" } },
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("errors.invalidCredentials"),
    );
    expect(screen.getByLabelText(i18n.t("auth.email"))).toBeVisible();
    expect(screen.queryByText("internal details")).not.toBeInTheDocument();
  });

  it("disables fields while a request is pending and prevents duplicate submissions", async () => {
    let resolveRequest: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { user } = renderForm({ onSubmit });
    await fillLogin(user);
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    );
    const pendingButton = screen.getByRole("button", {
      name: i18n.t("auth.signingIn"),
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText(i18n.t("auth.email"))).toBeDisabled();
    await user.click(pendingButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRequest();
    });
    expect(
      screen.getByRole("button", { name: i18n.t("auth.login") }),
    ).toBeEnabled();
  });

  it("respects the externally controlled pending state", () => {
    renderForm({ mode: "register", pending: true });
    expect(
      screen.getByRole("button", { name: i18n.t("auth.registering") }),
    ).toBeDisabled();
    expect(screen.getByLabelText(i18n.t("auth.username"))).toBeDisabled();
    expect(
      screen.getByLabelText(i18n.t("auth.confirmPassword")),
    ).toBeDisabled();
  });
});
