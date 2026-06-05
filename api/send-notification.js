// api/send-notification.js — ส่ง Web Push ตรงไปที่ subscription (ไม่ผ่าน FCM token)
import webpush from 'web-push';
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { toUid, title, body, caseId } = req.body || {};
  if (!toUid || !title) return res.status(400).json({ error: "toUid and title are required" });

  try {
    webpush.setVapidDetails(
      'mailto:admin@serviceteam1.vercel.app',
      process.env.VITE_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const db = getFirestore(getAdminApp());
    const snap = await db.collection("fcmTokens").doc(toUid).get();
    if (!snap.exists) return res.status(200).json({ skipped: true, reason: "no subscription" });

    const { endpoint, auth, p256dh } = snap.data();
    if (!endpoint || !auth || !p256dh)
      return res.status(200).json({ skipped: true, reason: "incomplete subscription" });

    // payload ต้องตรงกับที่ sw.js รับ
    const payload = JSON.stringify({
      notification: { title, body: body || '' },
      data: caseId ? { caseId: String(caseId) } : {}
    });

    await webpush.sendNotification({ endpoint, keys: { auth, p256dh } }, payload);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("send-notification error:", err);
    // subscription หมดอายุ → ลบออก
    if (err.statusCode === 410 || err.statusCode === 404) {
      try { await getFirestore(getAdminApp()).collection("fcmTokens").doc(toUid).delete(); } catch (_) {}
      return res.status(200).json({ skipped: true, reason: "subscription expired" });
    }
    return res.status(500).json({ error: err.message });
  }
}
