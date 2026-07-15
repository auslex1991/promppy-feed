// promppy push service worker — 속보 alerts only.
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "promppy", body: event.data.text() };
  }
  const options = {
    body: data.body,
    icon: "/pwa-icon/192",
    badge: "/pwa-icon/192",
    tag: data.tag || "promppy-breaking",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "promppy 속보", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
