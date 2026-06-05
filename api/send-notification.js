// api/send-notification.js
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { toUid, title, body, caseId } = req.body || {};
  if (!toUid || !title) return res.status(400).json({ error: "toUid and title are required" });

  try {
    const app = getAdminApp();
    const db  = getFirestore(app);
    const msg = getMessaging(app);

    const tokenDoc = await db.collection("fcmTokens").doc(toUid).get();
    if (!tokenDoc.exists) return res.status(200).json({ skipped: true, reason: "no token" });

    const { token } = tokenDoc.data();
    if (!token) return res.status(200).json({ skipped: true, reason: "empty token" });

    await msg.send({
      token,
      notification: { title, body: body || "" },
      webpush: {
        notification: {
          icon: "https://serviceteam1.vercel.app/icon-192.png",
          badge: "https://serviceteam1.vercel.app/icon-192.png",
        },
        // data ต้องอยู่ใน webpush โดยตรง ไม่ใช่ใน notification
        ...(caseId ? { data: { caseId: String(caseId) } } : {}),
        fcmOptions: {
          link: "https://serviceteam1.vercel.app/",
        },
      },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-notification error:", err);
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
