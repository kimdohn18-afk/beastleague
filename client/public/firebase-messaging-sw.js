importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyANPNTD5DZblywXwp8dLXr9fjgvWp8TSMA',
  authDomain: 'beastleague-push.firebaseapp.com',
  projectId: 'beastleague-push',
  storageBucket: 'beastleague-push.firebasestorage.app',
  messagingSenderId: '541115431444',
  appId: '1:541115431444:web:c825664cf7f5d09068501',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '비스트리그';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
