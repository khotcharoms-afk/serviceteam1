// ค่าตั้งต้นใบ OR ต่อโครงการ — เก็บจริงที่ Firestore settings/orProjects (แก้ได้ในหน้า OT → ⚙ ตั้งค่าใบ OR)
// key = รหัสโครงการ (project.code)

export const EXAMINER_OPTS = ["นายณัฐพงศ์ รัตนไชย", "นายพีรพงษ์ คล่องวิชา", "นายเจริญชัย สุวรรณประทีป"];

export const AOTGA_PRESETS = [
  "ซัพพอร์ตเคส Workforce คอยมอนิเตอร์ และแก้ไขปัญหาใบหน้าให้ลูกค้า ตรวจสอบดูรายงานแต่ละที่เพื่อให้ถูกต้องและตรงต่อการใช้งานของลูกค้า 5 ท่า ได้แก่ สุวรรณภูมิ ดอนเมือง หาดใหญ่ ภูเก็ต รวมถึง SAT-1",
  "ตรวจสอบการทำงานของระบบ Workforce และเครื่องสแกนใบหน้าของแต่ละท่า ติดตามสถานะการเชื่อมต่อ และแจ้งเตือนหากพบความผิดปกติ",
  "มอนิเตอร์ระบบนอกเวลาทำการ ตรวจสอบการลงเวลาของพนักงานแต่ละท่า และประสานงานแก้ไขปัญหาเร่งด่วนให้ลูกค้า",
];

export const DEFAULT_OR_PROJECTS = {
  "00802026": { label: "AOTGA", displayName: "SE-KD AOTGA WF", defaultLocation: "ออฟฟิศ",
                defaultExaminer: "นายเจริญชัย สุวรรณประทีป", presets: AOTGA_PRESETS },
  "02102022": { label: "Plan B", displayName: "", defaultLocation: "",
                defaultExaminer: "นายพีรพงษ์ คล่องวิชา", presets: [] },
  "02302025": { label: "Deves", displayName: "", defaultLocation: "",
                defaultExaminer: "นายพีรพงษ์ คล่องวิชา", presets: [] },
};

// ตัด "โครงการ :" / "โครงการ " ข้างหน้า และรวมช่องว่างซ้อน
export function cleanProjectName(name) {
  return String(name || "").trim().replace(/^โครงการ\s*:?\s*/, "").replace(/\s+/g, " ").trim();
}

// ค่าตั้งของโครงการ (ใช้ code ก่อน ถ้าไม่มี code ลองจับคำว่า AOTGA ในชื่อ)
export function orSettingsFor(project, cfg) {
  if (!project) return null;
  const map = { ...DEFAULT_OR_PROJECTS, ...(cfg || {}) };
  if (project.code && map[project.code]) return map[project.code];
  if (/AOTGA/i.test(project.name || "")) return map["00802026"] || null;
  return null;
}

export function orDisplayName(project, cfg) {
  const s = orSettingsFor(project, cfg);
  return (s?.displayName || "").trim() || cleanProjectName(project?.name);
}

// แบบถัดไปจาก record ล่าสุดของโครงการเดียวกัน (วน 1→2→3→1)
export function nextPresetIndex(presets, lastDesc) {
  if (!presets?.length) return -1;
  const i = presets.findIndex(p => p.trim() === String(lastDesc || "").trim());
  return i < 0 ? 0 : (i + 1) % presets.length;
}

export function isOvernight(timeIn, timeOut) {
  return !!(timeIn && timeOut && timeOut < timeIn);
}

export function addDays(dateStr, n) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
