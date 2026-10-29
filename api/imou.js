// สถานะรถ EV (กล้อง Imou) สำหรับรายงาน — ตรรกะอยู่ใน _imou.js
// ตั้งค่าบน Vercel: IMOU_APP_ID, IMOU_APP_SECRET (และ IMOU_BASE ถ้าไม่ใช่ https://openapi-sg.easy4ip.com)
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { evStatus } from "./_imou.js";

function getAdminApp() {
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  if (existing) return existing;
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

async function authenticate(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return "ต้องเข้าสู่ระบบก่อน";
  const app = getAdminApp();
  let decoded;
  try { decoded = await getAuth(app).verifyIdToken(m[1]); } catch { return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"; }
  const snap = await getFirestore(app).collection("users").doc(decoded.uid).get();
  if (!snap.exists || !["admin", "dev", "user"].includes(snap.data().role)) return "บัญชีนี้ยังไม่มีสิทธิ์";
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const appId = process.env.IMOU_APP_ID, appSecret = process.env.IMOU_APP_SECRET;
  if (!appId || !appSecret) return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า IMOU_APP_ID / IMOU_APP_SECRET บน Vercel" });
  try {
    const err = await authenticate(req);
    if (err) return res.status(401).json({ error: err });
  } catch (e) {
    return res.status(500).json({ error: "ตรวจสิทธิ์ไม่สำเร็จ", detail: e.message });
  }
  try {
    res.status(200).json(await evStatus({ appId, appSecret, base: process.env.IMOU_BASE || "https://openapi-sg.easy4ip.com" }));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
