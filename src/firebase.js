import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { isSupported, getMessaging, getToken } from "firebase/messaging";

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

// ── FCM: ขอ registration token ───────────────────────────────────────────────
// ล้าง push subscription เก่า (ที่ไม่มี VAPID key) ก่อน แล้วค่อยให้ SDK สร้างใหม่
// เหตุที่ต้องทำ: subscription เก่าทำให้ SDK ข้าม FIS auth → 401
export async function getFcmToken(swRegistration) {
  try {
    if (!(await isSupported())) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) { console.error("FCM: VITE_FIREBASE_VAPID_KEY missing"); return null; }

    // ล้าง push subscription เก่าทิ้ง → SDK จะสร้างใหม่พร้อม VAPID key ที่ถูกต้อง
    const existingSub = await swRegistration.pushManager.getSubscription();
    if (existingSub) {
      console.log("FCM: clearing old push subscription...");
      await existingSub.unsubscribe();
    }

    // SDK จัดการ FIS auth + registration ให้ทั้งหมด
    console.log("FCM: calling getToken()...");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) console.log("FCM: token registered ✅", token.slice(0,20)+"...");
    return token || null;
  } catch (e) {
    console.error("getFcmToken error:", e);
    return null;
  }
}
