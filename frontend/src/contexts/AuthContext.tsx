import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setAccessToken, setUnauthorizedHandler } from "../api/client";
import { meApi, write } from "../api/resources";
import i18n from "../i18n";
import type { Language, User } from "../types";

interface Auth {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  language: (value: Language) => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const cache = useQueryClient();
  function logout() {
    setAccessToken(null);
    setUser(null);
    cache.clear();
  }
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast.error(i18n.t("auth.sessionExpired"));
    });
    return () => setUnauthorizedHandler(null);
    // The handler only needs the stable query client and state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache]);
  async function login(email: string, password: string) {
    const result = await write<{ access_token: string }>(
      "post",
      "/auth/login",
      { email, password },
    );
    setAccessToken(result.access_token);
    try {
      const profile = await meApi();
      cache.clear();
      setUser(profile);
      await i18n.changeLanguage(profile.preferred_language);
    } catch (error) {
      logout();
      throw error;
    }
  }
  async function language(value: Language) {
    await i18n.changeLanguage(value);
    if (user) {
      try {
        const profile = await write<User>("patch", "/users/me/preferences", {
          preferred_language: value,
        });
        // A preference response arriving after logout must not restore a session.
        setUser((current) => (current?.id === profile.id ? profile : current));
      } catch {
        toast.error(i18n.t("notifications.languageSaveFailed"));
      }
    }
  }
  return (
    <Context.Provider value={{ user, login, logout, language }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider required");
  return auth;
}
