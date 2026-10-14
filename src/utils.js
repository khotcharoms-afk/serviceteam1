// ── Constants ─────────────────────────────────────────────────
export const WARRANTY_OPTS = [
  { value: "none", label: "ไม่มีประกัน", color: "#94a3b8", years: 0 },
  { value: "1yr",  label: "ประกัน 1 ปี", color: "#3b82f6", years: 1 },
  { value: "3yr",  label: "ประกัน 3 ปี", color: "#8b5cf6", years: 3 },
  { value: "5yr",  label: "ประกัน 5 ปี", color: "#10b981", years: 5 },
];

export const STATUS_OPTS = [
  { value: "open",       label: "เปิดเคส",        color: "#f59e0b", bg: "#fef3c7" },
  { value: "inprogress", label: "กำลังดำเนินการ",  color: "#3b82f6", bg: "#dbeafe" },
  { value: "done",       label: "เสร็จสิ้น",       color: "#10b981", bg: "#d1fae5" },
  { value: "hold",       label: "รอดำเนินการ",     color: "#ef4444", bg: "#fee2e2" },
];

export const SERVICE_TYPES = [
  "ติดตั้งอุปกรณ์","เปลี่ยนอุปกรณ์","ซ่อมบำรุง","ตรวจสอบระบบ",
  "Config / Setup","อัปเกรด","เดินสาย","ทดสอบระบบ","อบรม","อื่นๆ",
];

export const COLOR_OPTS = [
  "#3b82f6","#8b5cf6","#10b981","#f97316","#ec4899","#f59e0b",
  "#ef4444","#06b6d4","#84cc16","#f43f5e","#a855f7","#14b8a6",
];

// ── Helpers ───────────────────────────────────────────────────
export const today = () => new Date().toISOString().slice(0, 10);

export const daysLeft = (s) => {
  if (!s) return null;
  return Math.ceil((new Date(s) - new Date()) / 86400000);
};

export const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

// สีอ่านจาก CSS variable ที่ App.jsx ตั้งไว้ตามธีม
// ค่าหลังคอมมาคือ fallback = สีเดิม (ถ้าตัวแปรยังไม่ถูกตั้ง)
export const IS = (x = {}) => ({
  width: "100%",
  background: "var(--input-bg, #fff)",
  border: "1px solid var(--input-border, #e2e8f0)",
  borderRadius: 8,
  color: "var(--input-text, #1e293b)",
  padding: "10px 13px", fontSize: 14,
  outline: "none", fontFamily: "inherit", boxSizing: "border-box", ...x,
});

export const emptyCase = {
  projectId: "", site: "", siteOther: false, title: "", type: SERVICE_TYPES[0],
  tech: "", techs: [], date: today(), status: "open", note: "",
  handoverLog: [], updateLog: [],
};

// ── บันทึกการรับเคส ───────────────────────────────────────────
// เวลารับ / เวลาปิด / สรุปการแก้ไข
// เคสใหม่มี receivedAt + closedAt + resolution เก็บจริง
// เคสเก่าที่สร้างก่อนมีฟีเจอร์นี้ → คำนวณย้อนจากข้อมูลที่มีอยู่

// ใช้ตอนบันทึกเคส: จดเวลาปิดเมื่อเพิ่งเปลี่ยนเป็น "เสร็จสิ้น" / ล้างเมื่อเปิดเคสกลับ
export function applyCloseInfo(next, prev, now) {
  if (next.status !== "done") return { ...next, closedAt: null };
  if (next.closedAt) return next;
  // ปิดไว้ตั้งแต่ก่อนมีระบบนี้ → ไม่จดเวลาใหม่ ให้ getClosedAt ดึงจากประวัติอัปเดตแทน
  if (prev?.status === "done") return next;
  return { ...next, closedAt: now };
}

export function getReceivedAt(cs) {
  if (cs?.receivedAt) return cs.receivedAt;
  // id ของเคสคือ Date.now() ตอนกดสร้าง
  if (/^\d{12,14}$/.test(cs?.id || "")) return new Date(Number(cs.id)).toISOString();
  return cs?.activityAt || (cs?.date ? `${cs.date}T00:00:00` : null);
}

function lastDoneEntry(cs) {
  return [...(cs?.updateLog || [])].reverse().find(u => u.status === "done") || null;
}

export function getClosedAt(cs) {
  if (cs?.status !== "done") return null;
  if (cs.closedAt) return cs.closedAt;
  const u = lastDoneEntry(cs);
  if (u?.date) return /^\d{1,2}:\d{2}$/.test(u.time || "") ? `${u.date}T${u.time.padStart(5,"0")}:00` : `${u.date}T00:00:00`;
  return null;
}

export function getResolution(cs) {
  return cs?.resolution || lastDoneEntry(cs)?.text || "";
}

export const fmtDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d)) return "";
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
};
