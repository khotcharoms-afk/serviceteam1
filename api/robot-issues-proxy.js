// วางไฟล์นี้ไว้ที่ api/robot-issues-proxy.js ใน repo ServiceLog (khotcharoms-afk/serviceteam1)
// เหมือนแพทเทิร์นของ api/robot-stats.js ที่มีอยู่แล้ว — proxy เข้า Firestore ของ
// โปรเจกต์บอท "robot-report-bot" ซึ่งเป็นคนคนละ Firebase project กับ ServiceLog เอง
// (ServiceLog อ่านข้อมูลบอทได้ทางเดียว บอทไม่รู้จัก ServiceLog เลย)

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── init แยกต่างหากจาก Firebase Admin ของ ServiceLog เอง ──
// ตั้งชื่อ named app กัน conflict กับ Firebase Admin app หลักของ ServiceLog ที่มีอยู่แล้ว
function getBotServiceAccount() {
  const json = Buffer.from(
    process.env.ROBOT_BOT_SERVICE_ACCOUNT_KEY_BASE64,
    "base64"
  ).toString("utf-8");
  return JSON.parse(json);
}

function getBotDb() {
  const APP_NAME = "robot-report-bot-readonly";
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app = existing || initializeApp({ credential: cert(getBotServiceAccount()) }, APP_NAME);
  return getFirestore(app);
}

// ── แจ้งเตือนกลับไปหาผู้แจ้งผ่าน LINE เมื่อสถานะเคสเปลี่ยน ──
// ใช้ raw fetch ยิง LINE Messaging API ตรงๆ ไม่ต้องพึ่ง @line/bot-sdk
// (ServiceLog เป็นคนละ Vercel project กับบอท เลยต้องมี LINE_CHANNEL_ACCESS_TOKEN
// เป็นของตัวเองแยกต่างหาก — token คนละตัวกับที่บอทใช้ก็ได้ เพราะ token ผูกกับ
// channel เดียวกัน ใช้ยิง push message แทนกันได้)
const STATUS_LABEL_TH = {
  acknowledged: "รับทราบแล้ว",
  in_progress: "กำลังดำเนินการ",
  resolved: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

async function notifyReporter(lineUserId, ticketNo, newStatus) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return; // ยังไม่ได้ตั้งค่า token หรือเคสไม่มี lineUserId ก็ข้ามไปเงียบๆ

  const statusText = STATUS_LABEL_TH[newStatus] || newStatus;
  const text = `📢 อัปเดตสถานะเคส #${ticketNo}\n\nสถานะล่าสุด: ${statusText}`;

  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    });
  } catch (err) {
    // แจ้งเตือนไม่สำเร็จไม่ควรทำให้การอัปเดตสถานะ fail ไปด้วย แค่ log ไว้เฉยๆ
    console.error("notifyReporter error:", err);
  }
}

export default async function handler(req, res) {
  const db = getBotDb();

  if (req.method === "GET") {
    try {
      const { status, category, limit } = req.query;
      let ref = db.collection("robotIssues").orderBy("createdAt", "desc");
      if (status) ref = ref.where("status", "==", status);
      if (category) ref = ref.where("category", "==", category);
      ref = ref.limit(limit ? parseInt(limit, 10) : 50);

      const snap = await ref.get();
      const issues = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
        };
      });
      res.status(200).json({ issues });
    } catch (err) {
      console.error("robot-issues-proxy GET error:", err);
      res.status(500).json({ error: "fetch-failed" });
    }
    return;
  }

  if (req.method === "POST") {
    // อัปเดตสถานะเคส เช่น "acknowledged" | "in_progress" | "resolved" | "cancelled"
    try {
      const { issueId, newStatus, note, changedBy } = req.body || {};
      if (!issueId || !newStatus) {
        res.status(400).json({ error: "missing-fields" });
        return;
      }
      const ref = db.collection("robotIssues").doc(issueId);

      // ดึงข้อมูลเคสก่อนอัปเดต เพื่อเอา lineUserId/ticketNo ไปใช้แจ้งเตือนกลับ
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "not-found" });
        return;
      }
      const issueData = snap.data();

      await ref.update({
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: newStatus,
          changedAt: new Date().toISOString(),
          changedBy: changedBy || "servicelog",
          note: note || "",
        }),
      });

      // แจ้งเตือนกลับไปหาผู้แจ้งผ่าน LINE (ไม่ block response หลักถ้าแจ้งไม่สำเร็จ)
      await notifyReporter(issueData.lineUserId, issueData.ticketNo, newStatus);

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("robot-issues-proxy POST error:", err);
      res.status(500).json({ error: "update-failed" });
    }
    return;
  }

  res.status(405).json({ error: "method-not-allowed" });
}
