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

// ลิงก์แผนที่จากช่อง location ของโครงการ — ถ้าเป็นลิงก์อยู่แล้ว (เช่น Google Maps) ใช้ตามนั้น
// ถ้าเป็นที่อยู่/พิกัด ให้ค้นใน Google Maps
export const mapsUrl = (loc) => {
  const s = (loc || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`;
};
