/* Multi Timer — service worker: shows notifications with action buttons and forwards clicks to open pages. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (e) => {
  const n = e.notification;
  const action = e.action || "open";
  const id = n.data && n.data.id;
  n.close();
  e.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      list.forEach((c) => c.postMessage({ type: "mt-notif-action", action, id }));
      if (action !== "open") return;
      const target = list.find((c) => !c.url.includes("notifier")) || list[0];
      if (target) return target.focus();
      return self.clients.openWindow("./");
    })()
  );
});
