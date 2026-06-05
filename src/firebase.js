import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { isSupported } from "firebase/messaging";
import { getInstallations, getToken as getFISToken } from "firebase/installations";

const firebaseConfig = {
  apiKey: "AIzaSyBMrGDqwru9eJYQgjDV268oOgUQ-Gisu2U",
  authDomain: "serviceteam-d2649.firebaseapp.com",
  projectId: "serviceteam-d2649",
  storageBucket: "serviceteam-d2649.firebasestorage.app",
  messagingSenderId: "427057704026",
  appId: "1:427057704026:web:67a39c5139dd7299fa7c63",
  measurementId: "G-1NEYP0THDR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });

function bufToBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function getFcmToken(swRegistration) {
  try {
    if (!(await isSupported())) return null;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) { console.error("FCM: VAPID key missing"); return null; }

    // Step 1: FIS auth token (proven working)
    const installations = getInstallations(app);
    const fisToken = await getFISToken(installations, true);
    if (!fisToken) { console.error("FCM: FIS token null"); return null; }
    console.log("FCM: FIS token ✅ len=" + fisToken.length);

    // Step 2: Fresh push subscription
    const old = await swRegistration.pushManager.getSubscription();
    if (old) await old.unsubscribe();
    const sub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const authBuf  = sub.getKey('auth');
    const p256dhBuf = sub.getKey('p256dh');
    const auth   = authBuf  ? bufToBase64url(authBuf)  : null;
    const p256dh = p256dhBuf ? bufToBase64url(p256dhBuf) : null;
    const endpoint = sub.endpoint;

    // Step 3: origin ของ SW (field ที่ขาดไปก่อน!)
    let origin;
    try { origin = new URL(swRegistration.scope).host; }
    catch { origin = window.location.host; }

    console.log("FCM: origin=" + origin);

    // Step 4: register กับ FCM — ใช้ headers และ body เหมือน Firebase SDK จริงๆ
    const body = { web: { origin, endpoint, auth, p256dh, applicationPubKey: vapidKey } };

    const res = await fetch(
      `https://fcmregistrations.googleapis.com/v1/projects/${app.options.projectId}/registrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-goog-api-key': app.options.apiKey,
          'x-goog-firebase-installations-auth': `FIS ${fisToken}`,
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("FCM: registration failed", res.status, errText);
      return null;
    }

    const data = await res.json();
    console.log("FCM: token registered ✅", data.token?.slice(0, 20) + "...");
    return data.token || null;
  } catch (e) {
    console.error("getFcmToken error:", e);
    return null;
  }
}
