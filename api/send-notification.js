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

    // query ทุก subscription ของ user นี้ (รองรับหลาย device)
    const snaps = await db.collection("fcmTokens").where("uid","==",toUid).get();
    if (snaps.empty) return res.status(200).json({ skipped: true, reason: "no subscription" });

    const payload = JSON.stringify({
      notification: { title, body: body || '' },
      data: caseId ? { caseId: String(caseId) } : {}
    });

    const results = await Promise.allSettled(
      snaps.docs.map(async (d) => {
        const { endpoint, auth, p256dh } = d.data();
        if (!endpoint || !auth || !p256dh) return;
        try {
          await webpush.sendNotification({ endpoint, keys: { auth, p256dh } }, payload);
          console.log("Push sent to device:", d.id);
        } catch (err) {
          // subscription หมดอายุ → ลบออก
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log("Push: expired subscription, deleting:", d.id);
            await db.collection("fcmTokens").doc(d.id).delete();
          } else {
            throw err;
          }
        }
      })
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    return res.status(200).json({ success: true, sent: succeeded, total: snaps.size });

  } catch (err) {
    console.error("send-notification error:", err);
    return res.status(500).json({ error: err.message });
  }
}
