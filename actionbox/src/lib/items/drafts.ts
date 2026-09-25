import { useSyncExternalStore } from "react";

/**
 * One unsaved capture kept in localStorage: written before the save request
 * and cleared only once the server confirms, so a dropped connection, a closed
 * tab or a sign-in detour never loses what the user entered. The id is reused
 * on retry, which the server treats as the same item (no duplicates).
 */
export type Draft =
  | { id: string; kind: "url"; value: string }
  | { id: string; kind: "text"; value: string }
  | { id: string; kind: "image"; originalType: "image" | "screenshot"; base64: string; mime: string };

const KEY = "actionbox.draft.v1";
const EVENT = "actionbox-draft";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

/** Returns false when the browser refused to store it (private mode, or an image over quota). */
export function saveDraft(draft: Draft): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(id?: string) {
  try {
    if (id && loadDraft()?.id !== id) return;
    window.localStorage.removeItem(KEY);
    notify();
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function loadDraft(): Draft | null {
  const raw = read();
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Draft;
    return d && typeof d.id === "string" && typeof d.kind === "string" ? d : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The pending draft's raw JSON (stable between renders), or null. */
export function useDraftSnapshot(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
