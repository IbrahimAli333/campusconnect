/**
 * Lightweight trilingual i18n: Azerbaijani (default), English, Russian.
 *
 * Dictionaries are keyed by the English source string, so `t("Log in")`
 * needs no separate key names and untranslated strings safely render in
 * English. `{var}` placeholders are interpolated after lookup.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { az } from "./az";
import { ru } from "./ru";

export type Language = "az" | "en" | "ru";

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "az", label: "AZ" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

const LANGUAGE_KEY = "campusconnect.language";
const DEFAULT_LANGUAGE: Language = "az";

const dictionaries: Record<Language, Record<string, string>> = {
  az,
  en: {},
  ru,
};

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(language: Language, source: string, vars?: Vars): string {
  const entry = dictionaries[language][source];
  return interpolate(entry ?? source, vars);
}

async function loadLanguage(): Promise<Language> {
  try {
    const stored =
      Platform.OS === "web"
        ? (typeof localStorage === "undefined" ? null : localStorage.getItem(LANGUAGE_KEY))
        : await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (stored === "az" || stored === "en" || stored === "ru") {
      return stored;
    }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_LANGUAGE;
}

async function persistLanguage(language: Language): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LANGUAGE_KEY, language);
      }
      return;
    }
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  } catch {
    // Best-effort; the in-memory choice still applies for this session.
  }
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
  t: (source, vars) => translate(DEFAULT_LANGUAGE, source, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    let cancelled = false;
    void loadLanguage().then((stored) => {
      if (!cancelled) {
        setLanguageState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void persistLanguage(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (source, vars) => translate(language, source, vars),
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
