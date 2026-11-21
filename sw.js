const CACHE = "pora-dom-v25";
const ASSETS = ["./", "./index.html", "./runtime-config.js", "./styles.css?v=25", "./app.js?v=25", "./manifest.webmanifest", "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(async keys => {
    const stale = keys.filter(key => key.startsWith("pora-dom-") && key !== CACHE);
    await Promise.all(stale.map(key => caches.delete(key)));
    await self.clients.claim();
    if (stale.length) {
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.all(windows.map(client => client.navigate(client.url).catch(() => {})));
    }
  }));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.endsWith("/runtime-config.js")) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows[0];
    if (existing) {
      existing.postMessage({ type: "pora-reminder-open" });
      return existing.focus();
    }
    return clients.openWindow("./?from=notification");
  }));
});
