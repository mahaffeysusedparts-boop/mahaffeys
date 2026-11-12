self.addEventListener('push', event => {
  let message;
  try { message = event.data?.json(); } catch { message = null; }
  event.waitUntil(self.registration.showNotification(message?.title || 'Mahaffeys operator alert', {
    body: message?.body || 'Open the app to review an operator action.',
    icon: '/mahaffeys-logo.png',
    data: { url: '/settings?section=notifications' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/settings?section=notifications', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});
