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

export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence
});

// helper: แปลง VAPID key base64url → Uint8Array สำหรับ pushManager.subscribe
function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ── FCM: ลงทะเบียน token แบบ manual ──────────────────────────────────────────
// bypass firebase/messaging getToken() ที่มี bug ไม่ส่ง FIS auth header
// แทนที่ด้วยการดึง FIS token โดยตรง แล้ว POST ไป fcmregistrations เอง
export async function getFcmToken(swRegistration) {
  try {
    if (!(await isSupported())) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) { console.error("FCM: VITE_FIREBASE_VAPID_KEY missing"); return null; }

    // Step 1: ดึง FIS auth token โดยตรง (ไม่ผ่าน messaging SDK)
    const installations = getInstallations(app);
    const fisToken = await getFISToken(installations, true);
    if (!fisToken) { console.error("FCM: FIS auth token is null"); return null; }
    console.log("FCM: FIS token obtained ✅");

    // Step 2: ดึง push subscription (สร้างถ้ายังไม่มี)
    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    const { endpoint, keys } = sub.toJSON();

    // Step 3: ลงทะเบียนกับ FCM พร้อม auth header ที่ถูกต้อง
    const res = await fetch(
      `https://fcmregistrations.googleapis.com/v1/projects/${app.options.projectId}/registrations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `FIREBASE_INSTALLATIONS_AUTH ${fisToken}`,
          'x-goog-api-key': app.options.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          web: { endpoint, auth: keys?.auth, p256dh: keys?.p256dh, applicationPubKey: vapidKey }
        })
      }
    );

    if (!res.ok) {
      console.error("FCM: registration failed", res.status, await res.text());
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
