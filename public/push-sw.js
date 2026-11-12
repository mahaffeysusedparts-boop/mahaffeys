// Development push worker deliberately never intercepts Vite or caches application assets.
importScripts('/push-events.js');
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
