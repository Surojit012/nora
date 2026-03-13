"use client";

type ExploreLayout = "feed" | "media";
type ExploreMode = "for_you" | "trending" | "latest";

const KEY_EXPLORE_LAYOUT = "nora.explore.layout";
const KEY_EXPLORE_MODE = "nora.explore.mode";

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

export function getExploreLayoutPreference(): ExploreLayout {
  const v = safeGet(KEY_EXPLORE_LAYOUT);
  return v === "media" ? "media" : "feed";
}

export function setExploreLayoutPreference(value: ExploreLayout) {
  safeSet(KEY_EXPLORE_LAYOUT, value);
}

export function getExploreModePreference(): ExploreMode {
  const v = safeGet(KEY_EXPLORE_MODE);
  if (v === "latest" || v === "trending" || v === "for_you") return v;
  return "for_you";
}

export function setExploreModePreference(value: ExploreMode) {
  safeSet(KEY_EXPLORE_MODE, value);
}

