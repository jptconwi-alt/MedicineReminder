// sw.js
const CACHE_NAME = 'medicine-reminder-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Add to sw.js
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/static/icon-192.png',
            badge: '/static/icon-192.png',
            tag: 'medicine-reminder',
            requireInteraction: true,
            actions: [
                {
                    action: 'taken',
                    title: 'Mark as Taken'
                },
                {
                    action: 'snooze',
                    title: 'Snooze 10 min'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'taken') {
        // Mark medicine as taken
        clients.openWindow('/');
    } else if (event.action === 'snooze') {
        // Snooze logic
        console.log('Snoozed reminder');
    } else {
        clients.openWindow('/');
    }
});
