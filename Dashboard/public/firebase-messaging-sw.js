/* FestNet — Firebase Cloud Messaging service worker (background web push for staff).
 * The public web config arrives in the registration URL (see src/services/push.ts).
 * Notification messages (with a `notification` block) are displayed by the FCM SDK itself; this
 * worker only adds click handling that opens the alert in the dashboard. */
/* global importScripts, firebase, clients */
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification.data && (event.notification.data.FCM_MSG || event.notification.data)) || {};
  const url = (data.data && data.data.url) || data.url || "/emergency";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
