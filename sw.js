const CACHE = "space-survivor-v7";
const BASE = new URL("./", self.location);
const FILES = [
  "",
  "index.html",
  "css/style.css",
  "js/audio.js",
  "js/input.js",
  "js/touch.js",
  "js/entities.js",
  "js/save.js",
  "js/story.js",
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
            fetch(url, { cache: "reload" }).then((response) => {
              if (!response.ok) throw new Error(url);
              return cache.put(url, response);
            })
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
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
