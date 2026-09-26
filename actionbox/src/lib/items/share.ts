/**
 * "공유 → ActionBox" on Android (Web Share Target, see `share_target` in the
 * manifest). The service worker (`public/sw.js`) receives what was shared,
 * parks it in Cache Storage and opens the app; the app picks it up here once
 * someone is signed in, so a sign-in detour never loses it.
 */
const CACHE = "actionbox-share";
const PENDING = "/share-target/pending";

export type SharedContent = { title: string; text: string; url: string; files: File[]; skipped: number };

export function registerShareWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export async function hasPendingShare(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return Boolean(await (await caches.open(CACHE)).match(PENDING));
  } catch {
    return false;
  }
}

/** Reads the pending share and removes it, so it is saved once. */
export async function takePendingShare(): Promise<SharedContent | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE);
  const meta = await cache.match(PENDING);
  if (!meta) return null;
  const data = (await meta.json()) as {
    title?: string;
    text?: string;
    url?: string;
    skipped?: number;
    files?: { key: string; name: string; type: string }[];
  };
  const files: File[] = [];
  for (const f of data.files ?? []) {
    const res = await cache.match(f.key);
    if (res) files.push(new File([await res.blob()], f.name || "shared", { type: f.type }));
  }
  await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
  return { title: data.title ?? "", text: data.text ?? "", url: data.url ?? "", files, skipped: data.skipped ?? 0 };
}

/** Shared text as one thing to save: a link when it is essentially a link, otherwise a memo. */
export function sharedText(share: Pick<SharedContent, "title" | "text" | "url">): { kind: "url" | "text"; value: string } | null {
  const text = share.text.trim();
  const url = share.url.trim();
  const link = (url || text).match(/https?:\/\/\S+/)?.[0] ?? null;
  if (link) {
    const rest = text.replace(link, "").trim();
    // "Page title https://…" from a browser or blog app: the page itself is read from the link.
    if (rest.length <= 120 && !rest.includes("\n")) return { kind: "url", value: link };
  }
  const body = (text.includes(url) ? text : [text, url].filter(Boolean).join("\n")).trim() || share.title.trim();
  return body ? { kind: "text", value: body } : null;
}
