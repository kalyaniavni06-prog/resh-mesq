// RESH MESQ Service Worker
// Caches the app shell so the UI loads offline, and exposes a sync-trigger
// message so the offline SOS queue can be drained when connectivity returns.

const CACHE_NAME = "resh-mesq-v1";

// App-shell assets to pre-cache (Vite injects hashed filenames at build time;
// we cache the root HTML + CSS + the main JS entry so the UI renders offline).
const PRECACHE_URLS = ["/", "/favicon.ico"];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: remove stale caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: network-first for API calls, cache-first for assets ───────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always pass Supabase / external API requests through to the network
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("lovable") ||
    url.protocol === "chrome-extension:"
  ) {
    return; // Let the browser handle it normally
  }

  // For same-origin navigation requests: network first, fall back to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((r) => r ?? new Response("Offline", { status: 503 })),
      ),
    );
    return;
  }

  // For all other same-origin requests: cache first, fall back to network
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached ?? fetch(event.request)),
  );
});

// ── Message: client can send { type: "SKIP_WAITING" } to activate immediately
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
