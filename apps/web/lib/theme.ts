"use client";

export type ThemePreference = "dark" | "light";

const KEY_THEME = "nora.theme";

function safeGet(key: string): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getThemePreference(): ThemePreference {
  const v = safeGet(KEY_THEME);
  return v === "light" ? "light" : "dark";
}

export function applyThemePreference(value: ThemePreference) {
  try {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = value;
  } catch {
    // ignore
  }
}

export function setThemePreference(value: ThemePreference) {
  safeSet(KEY_THEME, value);
  applyThemePreference(value);
}

