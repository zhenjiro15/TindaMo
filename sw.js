// TindaMo service worker: cache-first, so the app opens offline after the first visit.
const CACHE = 'tindamo-web-1.0.0';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/helpers.js', 'js/storage.js', 'js/i18n.js', 'js/accounts.js', 'js/state.js', 'js/ui.js', 'js/auth.js', 'js/cashier.js', 'js/shell.js', 'js/sell.js', 'js/inventory.js', 'js/utang.js', 'js/sales.js', 'js/sticker.js', 'js/camera.js', 'js/profile.js', 'js/recent.js', 'js/colorpick.js', 'js/scanner.js', 'js/reminders.js', 'js/sync.js', 'js/config.js', 'js/cloud.js', 'js/link.js', 'js/inbox.js', 'js/shop.js', 'js/team.js', 'js/version.js', 'js/stock.js', 'js/receipt.js', 'js/events.js', 'js/native.js', 'js/versions/v1.0.0.js', 'js/main.js', 'SFX/scan.mp3', 'SFX/success.mp3', 'SFX/error.mp3', 'SFX/tap.mp3', 'SFX/tap-up.mp3', 'SFX/tap-down.mp3', 'SFX/tap-tab.mp3', 'SFX/tap-ok.mp3', 'SFX/tap-no.mp3', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (/\/version\.json$/.test(new URL(e.request.url).pathname)) return;   // laging bago mula sa network (update check)
  const same = new URL(e.request.url).origin === self.location.origin;
  // Sariling files (html/css/js): network muna para laging bago ang code, cache kapag offline.
  // Fonts at barcode library: cache muna.
  e.respondWith(same
    ? fetch(e.request).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)))
    : caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => undefined))
  );
});

// Abiso sa utang kahit sarado ang app (best-effort: Chrome Android, naka-install na app)
self.addEventListener('periodicsync', e => { if (e.tag === 'tindamo-due') e.waitUntil(dueCheck()); });
async function dueCheck() {
  const c = await caches.open('tindamo-due'), r = await c.match('due.json');
  if (!r) return;
  const d = await r.json();
  if (!d.on) return;
  const now = Date.now(), today = new Date().toDateString();
  for (const x of d.list) {
    if (x.due - now > (d.lead || 1) * 864e5) continue;
    const over = x.due < now;
    await self.registration.showNotification(over ? 'Lampas na sa takdang araw' : 'Malapit na ang bayaran', {
      body: x.name + ' — ₱' + Number(x.bal).toFixed(2) + (over ? ' ang utang, lampas na.' : ' ang utang, due na.'),
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'due-' + x.key + '-' + today
    });
  }
}
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('./index.html');
  }));
});
