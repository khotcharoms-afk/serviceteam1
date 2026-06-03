// api/send-notification.js
// Vercel Serverless Function — ส่ง FCM push notification ให้ผู้รับ
// เรียกจาก App.jsx หลัง saveHandover เขียน Firestore สำเร็จ

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Init Firebase Admin (ครั้งเดียว — Vercel reuse instance ข้าม invocations)
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  // รับเฉพาะ POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { toUid, title, body, caseId } = req.body || {};
  if (!toUid || !title) {
    return res.status(400).json({ error: "toUid and title are required" });
  }

  try {
    const app = getAdminApp();
    const db  = getFirestore(app);
    const msg = getMessaging(app);

    // ดึง FCM token ของผู้รับจาก collection fcmTokens
    const tokenDoc = await db.collection("fcmTokens").doc(toUid).get();
    if (!tokenDoc.exists) {
      // ผู้รับยังไม่มี token (ใช้ browser ที่ไม่รองรับ / ยังไม่ grant permission)
      return res.status(200).json({ skipped: true, reason: "no token" });
    }

    const { token } = tokenDoc.data();
    if (!token) {
      return res.status(200).json({ skipped: true, reason: "empty token" });
    }

    // ส่ง push
    await msg.send({
      token,
      notification: { title, body: body || "" },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          // คลิก notification เปิดหน้าเคสเลย (ถ้ามี caseId)
          ...(caseId ? { data: { caseId } } : {}),
        },
        fcmOptions: {
          link: "/",
        },
      },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-notification error:", err);
    // ถ้า token หมดอายุ / invalid → ลบออกจาก Firestore ป้องกัน error ซ้ำ
    if (err.code === "messaging/registration-token-not-registered") {
      try {
        const app = getAdminApp();
        await getFirestore(app).collection("fcmTokens").doc(toUid).delete();
      } catch (_) {}
      return res.status(200).json({ skipped: true, reason: "invalid token, deleted" });
    }
    return res.status(500).json({ error: err.message });
  }
}
