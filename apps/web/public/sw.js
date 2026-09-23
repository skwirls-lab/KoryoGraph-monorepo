// KoryoGraph Home service worker: an offline shell only (no data is cached), plus web push display.
const CACHE = "kg-shell-v1";
const SHELL = ["/offline", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Home page navigations: always the network (live data); if offline, the cached offline page.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !(url.pathname === "/home" || url.pathname.startsWith("/home/"))) return;
  event.respondWith(fetch(req).catch(() => caches.match("/offline").then((r) => r || new Response("Offline", { status: 503 }))));
});

self.addEventListener("push", (event) => {
  let data = { title: "Your school", body: "You have a new message.", url: "/home/notifications" };
  try { data = { ...data, ...event.data.json() }; } catch { /* plain payload */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home/notifications";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c && c.url.includes("/home")) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
