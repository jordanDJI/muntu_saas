/* Service Worker Klientys — Web Push notifications (SMS-like) */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Klientys", body: event.data.text() }; }

  const title = data.title || "Klientys";
  // Tag unique par message (pas de fusion) — comme les SMS
  const tag = data.tag || `klientys-${Date.now()}`;

  const options = {
    body:             data.body || "",
    icon:             data.icon || "/icon-192.png",
    badge:            "/icon-192.png",
    data:             { url: data.url || "/dashboard" },
    tag,
    renotify:         true,       // son + vibration même si même tag
    requireInteraction: true,     // reste affichée jusqu'au tap (comme SMS)
    vibrate:          [300, 100, 300, 100, 300], // motif SMS
    silent:           false,
    actions: [
      { action: "open",    title: "Ouvrir" },
      { action: "dismiss", title: "Ignorer" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focalise un onglet existant si déjà ouvert
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
