import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { indexedDBLocalPersistence, initializeAuth } from "firebase/auth";

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

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

function bufToBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── FCM: ลงทะเบียน Web Push Subscription ──────────────────────────────────
// ใช้ Web Push โดยตรง (รองรับ Chrome, Edge, Firefox, Safari iOS)
// เก็บ push subscription ใน Firestore แทนการ register กับ fcmregistrations
export async function registerPushSubscription(swRegistration, uid, userName) {
  try {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) { console.error("VITE_VAPID_PUBLIC_KEY missing"); return false; }

    let sub = await swRegistration.pushManager.getSubscription();

    // ตรวจสอบว่า subscription ปัจจุบันยังใช้ได้ไหม
    if (sub) {
      const isExpired = !sub.endpoint || (sub.expirationTime && sub.expirationTime < Date.now());
      if (isExpired) {
        console.log("Push: subscription expired, re-subscribing...");
        await sub.unsubscribe();
        sub = null;
      }
    }

    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      console.log("Push: new subscription created ✅");
    } else {
      console.log("Push: subscription still valid ✅");
    }

    const authBuf   = sub.getKey('auth');
    const p256dhBuf = sub.getKey('p256dh');

    // สร้าง deviceId จาก endpoint (hash สั้นๆ) เพื่อแยก device
    const deviceId = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g,'').slice(-20);
    const docId = `${uid}_${deviceId}`;

    // บันทึก subscription แยกตาม device → 1 user มีได้หลาย device
    await setDoc(doc(db, 'fcmTokens', docId), {
      uid,
      deviceId,
      name: userName,
      endpoint: sub.endpoint,
      auth:   authBuf   ? bufToBase64url(authBuf)   : null,
      p256dh: p256dhBuf ? bufToBase64url(p256dhBuf) : null,
      updatedAt: new Date().toISOString(),
    });

    console.log("Push: saved subscription for device", deviceId);
    return true;
  } catch (e) {
    console.error("registerPushSubscription error:", e);
    try {
      const old = await swRegistration.pushManager.getSubscription();
      if (old) await old.unsubscribe();
    } catch(_) {}
    return false;
  }
}
