/* Cargo+420 — push alerts for the owner/driver app AND the customer app */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Cargo+420', body: e.data && e.data.text() }; }
  const staff = !d.url || String(d.url).startsWith('/admin');
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Cargo+420', {
      body: d.body || 'New activity',
      tag: d.tag || undefined,
      renotify: true,
      requireInteraction: staff,
      icon: staff ? '/img/icon-192.png' : '/img/store-icon-192.png',
      badge: '/img/badge-96.png',
      vibrate: staff ? [250, 120, 250, 120, 500] : [200, 100, 200],
      data: { url: d.url || '/admin.html#orders' }
    });
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((c) => c.postMessage({ type: 'push', payload: d }));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || '/admin.html';
  const url = new URL(raw, self.location.origin).href;
  const staff = raw.startsWith('/admin');
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.includes('/admin') === staff) { await c.focus(); if (c.navigate) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
