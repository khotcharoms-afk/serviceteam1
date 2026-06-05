// api/send-notification.js — Web Push ส่งตรงทุก browser (Chrome, Edge, Safari iOS)
import webpush from "web-push";
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
    const db = getFirestore(getAdminApp());
    const tokenDoc = await db.collection("fcmTokens").doc(toUid).get();
    if (!tokenDoc.exists) return res.status(200).json({ skipped: true, reason: "no subscription" });

    const { endpoint, auth, p256dh } = tokenDoc.data();
    if (!endpoint || !auth || !p256dh) return res.status(200).json({ skipped: true, reason: "incomplete subscription" });

    webpush.setVapidDetails(
      "mailto:admin@serviceteam1.vercel.app",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    await webpush.sendNotification(
      { endpoint, keys: { auth, p256dh } },
      JSON.stringify({
        title,
        body: body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { caseId: caseId || null, url: "/" },
      })
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-notification error:", err);
    if (err.statusCode === 410 || err.statusCode === 404) {
      try { await getFirestore(getAdminApp()).collection("fcmTokens").doc(toUid).delete(); }
      catch (_) {}
      return res.status(200).json({ skipped: true, reason: "expired subscription, deleted" });
    }
    return res.status(500).json({ error: err.message });
  }
}
