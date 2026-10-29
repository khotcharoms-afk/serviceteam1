// รายงาน Smart Pole รายวัน (ใบหน้า / VIP / Blacklist) จาก Grafana — ตรรกะอยู่ใน _grafana.js
// ตั้งค่าบน Vercel: GRAFANA_USER, GRAFANA_PASSWORD (และ GRAFANA_URL ถ้าไม่ใช่ https://bi.know.studio)
// ต้องล็อกอิน ServiceLog (ส่ง Firebase ID token มาใน Authorization) — ข้อมูลกล้องไม่เปิดให้คนนอกเรียก
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { smartPoleReport } from "./_grafana.js";

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
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "ต้องระบุ date (YYYY-MM-DD)" });
  const user = process.env.GRAFANA_USER, password = process.env.GRAFANA_PASSWORD;
  if (!user || !password) return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า GRAFANA_USER / GRAFANA_PASSWORD บน Vercel" });
  try {
    const authErr = await authenticate(req);
    if (authErr) return res.status(401).json({ error: authErr });
  } catch (e) {
    return res.status(500).json({ error: "ตรวจสิทธิ์ไม่สำเร็จ", detail: e.message });
  }
  try {
    const sites = await smartPoleReport({ base: process.env.GRAFANA_URL || "https://bi.know.studio", user, password, date });
    res.status(200).json({ date, sites });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
