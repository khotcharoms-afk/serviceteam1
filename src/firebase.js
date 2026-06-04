import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

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

// Use indexedDB persistence for iOS/Safari compatibility
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence
});

// ── FCM: ขอ registration token (คืน null ถ้าเบราว์เซอร์ไม่รองรับ/ผิดพลาด) ──
export async function getFcmToken(swRegistration) {
  try {
    if (!(await isSupported())) return null;   // เช่น iOS เก่ากว่า 16.4 / เบราว์เซอร์ไม่รองรับ
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    return token || null;
  } catch (e) {
    console.error("getFcmToken error:", e);
    return null;
  }
}
