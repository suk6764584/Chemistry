// ActionBox service worker. Its only job is Android's "공유 → ActionBox" (Web Share Target):
// it keeps what was shared in Cache Storage and opens the app, which saves it
// (src/lib/items/share.ts). It caches nothing else and leaves every other request alone.
const CACHE = "actionbox-share";
const MAX_FILES = 10;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  event.respondWith(receiveShare(event.request));
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(CACHE);
    // A new share replaces one that was never opened.
    await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
    const images = form.getAll("media").filter((f) => f instanceof File && f.type.startsWith("image/"));
    const files = [];
    for (const [i, file] of images.slice(0, MAX_FILES).entries()) {
      const key = `/share-target/file/${i}`;
      await cache.put(key, new Response(file, { headers: { "content-type": file.type } }));
      files.push({ key, name: file.name || `shared-${i + 1}`, type: file.type });
    }
    const field = (name) => {
      const v = form.get(name);
      return typeof v === "string" ? v.slice(0, 10000) : "";
    };
    const pending = {
      title: field("title"),
      text: field("text"),
      url: field("url"),
      files,
      skipped: Math.max(0, images.length - MAX_FILES),
    };
    await cache.put("/share-target/pending", new Response(JSON.stringify(pending), { headers: { "content-type": "application/json" } }));
  } catch {
    // Open the app anyway; there is simply nothing to pick up.
  }
  return Response.redirect("/", 303);
}
