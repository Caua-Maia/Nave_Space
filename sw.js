const CACHE = "space-survivor-v62";
const BASE = new URL("./", self.location);
const FILES = [
  "",
  "index.html",
  "css/style.css",
  "js/audio.js",
  "js/input.js",
  "js/platform.js",
  "js/help-controls.js",
  "js/touch.js",
  "js/entities.js",
  "js/save.js",
  "js/integrity.js",
  "js/cloud.js",
  "js/settings.js",
  "js/story.js",
  "js/net.js",
  "js/megaboss-titan.js",
  "js/megaboss-survival.js",
  "js/megaboss-prisma.js",
  "js/megaboss-orbita.js",
  "js/easter-egg-stars.js",
  "js/game.js",
  "js/main.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

const ASSETS = FILES.map((file) => new URL(file, BASE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          ASSETS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((response) => {
                if (!response.ok) return null;
                return cache.put(url, response);
              })
              .catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isFreshBootAsset(url) {
  const p = url.pathname;
  if (p.endsWith("/")) return true;
  return /\.(?:js|html)$/i.test(p) || p.endsWith("sw.js");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const freshFirst = isFreshBootAsset(url);

  event.respondWith(
    fetch(event.request, freshFirst ? { cache: "no-cache" } : undefined)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(new URL("index.html", BASE).href))
      )
  );
});
