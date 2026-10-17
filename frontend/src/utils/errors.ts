import { isAxiosError } from "axios";
import i18n from "../i18n";

/** Keep server internals out of the UI and translate errors in the current language. */
export function getErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return i18n.t("errors.generic");
  if (!error.response) return i18n.t("errors.network");
  const status = error.response.status;
  if (status === 401) return i18n.t("errors.invalidCredentials");
  if (status === 403) return i18n.t("errors.forbidden");
  if (status === 404) return i18n.t("errors.notFound");
  if (status === 409) return i18n.t("errors.conflict");
  if (status === 422) return i18n.t("errors.validation");
  if (status >= 500) return i18n.t("errors.server");
  return i18n.t("errors.generic");
}
