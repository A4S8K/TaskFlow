import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "../../utils/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "../../utils/errors";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

export interface AuthValues {
  email: string;
  password: string;
  username?: string;
}

export interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (values: AuthValues) => Promise<void>;
  pending?: boolean;
  error?: unknown;
}

type FormField = "email" | "password" | "username" | "confirmPassword";

export function AuthForm({
  mode,
  onSubmit,
  pending = false,
  error,
}: AuthFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const submittingRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submissionError, setSubmissionError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";
  const isPending = pending || submitting;
  const activeError = submissionError ?? error;

  const schema = z
    .object({
      email: z
        .string()
        .trim()
        .min(1, "validation.emailRequired")
        .pipe(z.email("validation.emailInvalid")),
      password: z
        .string()
        .min(1, "validation.passwordRequired")
        .min(8, "validation.passwordMin")
        .max(128, "validation.passwordMax"),
      username: isRegister
        ? z
            .string()
            .trim()
            .min(1, "validation.usernameRequired")
            .min(2, "validation.usernameMin")
            .max(100, "validation.maxLength")
        : z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((value, context) => {
      if (isRegister && !value.confirmPassword)
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "validation.required",
        });
      else if (isRegister && value.password !== value.confirmPassword)
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "validation.passwordMismatch",
        });
    });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
      confirmPassword: "",
    },
  });
  const validationErrors = Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, value.message]),
  );

  async function submit(values: z.infer<typeof schema>) {
    if (pending || submittingRef.current) return;
    const email = values.email;
    const username = values.username;
    setSubmissionError(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit({
        email,
        password: values.password,
        ...(isRegister ? { username } : {}),
      });
    } catch (caught) {
      setSubmissionError(caught);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function fieldProps(field: FormField) {
    const fieldId = `${id}-${field}`;
    const validationError = validationErrors[field];
    return {
      id: fieldId,
      ...register(field, { onChange: () => setSubmissionError(null) }),
      disabled: isPending,
      "aria-invalid": validationError ? true : undefined,
      "aria-describedby": validationError ? `${fieldId}-error` : undefined,
    };
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="auth-form"
      aria-busy={isPending}
    >
      {activeError ? (
        <div className="form-error" role="alert">
          {getErrorMessage(activeError)}
        </div>
      ) : null}

      {isRegister ? (
        <Field
          label={t("auth.username")}
          htmlFor={`${id}-username`}
          error={
            validationErrors.username
              ? t(validationErrors.username, { min: 2, max: 100 })
              : undefined
          }
        >
          <Input
            {...fieldProps("username")}
            autoComplete="username"
            placeholder={t("auth.usernamePlaceholder")}
            required
            maxLength={100}
          />
        </Field>
      ) : null}

      <Field
        label={t("auth.email")}
        htmlFor={`${id}-email`}
        error={validationErrors.email ? t(validationErrors.email) : undefined}
      >
        <Input
          {...fieldProps("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("auth.emailPlaceholder")}
          required
        />
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor={`${id}-password`}
        error={
          validationErrors.password
            ? t(validationErrors.password, { min: 8, max: 128 })
            : undefined
        }
      >
        <div className="password-field">
          <Input
            {...fieldProps("password")}
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder={t(
              isRegister
                ? "auth.newPasswordPlaceholder"
                : "auth.passwordPlaceholder",
            )}
            minLength={8}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            disabled={isPending}
            aria-label={t(
              showPassword ? "auth.hidePassword" : "auth.showPassword",
            )}
            aria-pressed={showPassword}
            aria-controls={`${id}-password`}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
      </Field>

      {isRegister ? (
        <Field
          label={t("auth.confirmPassword")}
          htmlFor={`${id}-confirmPassword`}
          error={
            validationErrors.confirmPassword
              ? t(validationErrors.confirmPassword)
              : undefined
          }
        >
          <Input
            {...fieldProps("confirmPassword")}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("auth.confirmPasswordPlaceholder")}
            minLength={8}
            required
          />
        </Field>
      ) : null}

      <Button type="submit" loading={isPending} className="w-full">
        {t(
          isPending
            ? isRegister
              ? "auth.registering"
              : "auth.signingIn"
            : isRegister
              ? "auth.register"
              : "auth.login",
        )}
      </Button>
    </form>
  );
}
