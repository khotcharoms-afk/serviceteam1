// admin/dev ตั้งรหัสผ่านใหม่ให้ผู้ใช้ทันที (ไม่ต้องส่งอีเมล)
// - ตรวจ token ของผู้เรียก + role ต้องเป็น admin หรือ dev
// - admin แตะบัญชี dev ไม่ได้ (เหมือนกติกาในหน้าจัดการ User)
// - หลังตั้งรหัส บังคับให้ session เดิมของผู้ใช้นั้นหลุดทุกเครื่อง
// - บันทึกประวัติไว้ที่ adminLogs (ไม่เก็บรหัสผ่าน)
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  if (existing) return existing;
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "ต้องเข้าสู่ระบบก่อน" });

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  let caller;
  try {
    caller = await auth.verifyIdToken(m[1], true);
  } catch {
    return res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }

  const { uid, password } = req.body || {};
  if (typeof uid !== "string" || !uid) return res.status(400).json({ error: "ไม่ระบุผู้ใช้" });
  if (typeof password !== "string" || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: "รหัสผ่านต้องยาว 8–128 ตัวอักษร" });

  const [callerSnap, targetSnap] = await Promise.all([
    db.collection("users").doc(caller.uid).get(),
    db.collection("users").doc(uid).get(),
  ]);
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  if (!["admin", "dev"].includes(callerRole)) return res.status(403).json({ error: "เฉพาะ admin/dev เท่านั้น" });
  if (!targetSnap.exists) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
  const target = targetSnap.data();
  const targetIsDev = target.role === "dev" || (target.role === "disabled" && target.prevRole === "dev");
  if (targetIsDev && callerRole !== "dev") return res.status(403).json({ error: "เฉพาะ Dev เท่านั้นที่ตั้งรหัสให้บัญชี Dev ได้" });

  try {
    await auth.updateUser(uid, { password });
    if (uid !== caller.uid) await auth.revokeRefreshTokens(uid);
    await db.collection("adminLogs").add({
      action: "set-password",
      targetUid: uid,
      targetName: target.name || "",
      byUid: caller.uid,
      byName: callerSnap.data().name || "",
      at: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e?.code === "auth/user-not-found" ? "ไม่พบบัญชีนี้ในระบบล็อกอิน" : (e?.message || "ตั้งรหัสไม่สำเร็จ");
    return res.status(500).json({ error: msg });
  }
}
