// ค่าตั้งต้นใบ OR ต่อโครงการ — เก็บจริงที่ Firestore settings/orProjects (แก้ได้ในหน้า OT → ⚙ ตั้งค่าใบ OR)
// key = รหัสโครงการ (project.code)

export const EXAMINER_OPTS = ["นายณัฐพงศ์ รัตนไชย", "นายพีรพงษ์ คล่องวิชา", "นายเจริญชัย สุวรรณประทีป"];

export const AOTGA_PRESETS = [
  { id: 1, label: "ซัพพอร์ตเคส / แก้ปัญหาใบหน้า", text: "ซัพพอร์ตเคส Workforce คอยมอนิเตอร์ และแก้ไขปัญหาใบหน้าให้ลูกค้า ตรวจสอบดูรายงานแต่ละที่เพื่อให้ถูกต้องและตรงต่อการใช้งานของลูกค้า 5 ท่า ได้แก่ สุวรรณภูมิ ดอนเมือง หาดใหญ่ ภูเก็ต รวมถึง SAT-1" },
  { id: 2, label: "ตรวจสอบระบบ / เครื่องสแกน", text: "ตรวจสอบการทำงานของระบบ Workforce และเครื่องสแกนใบหน้าของแต่ละท่า ติดตามสถานะการเชื่อมต่อ และแจ้งเตือนหากพบความผิดปกติ" },
  { id: 3, label: "มอนิเตอร์นอกเวลา / ลงเวลา", text: "มอนิเตอร์ระบบนอกเวลาทำการ ตรวจสอบการลงเวลาของพนักงานแต่ละท่า และประสานงานแก้ไขปัญหาเร่งด่วนให้ลูกค้า" },
];

export const DEFAULT_OR_PROJECTS = {
  "00802026": { label: "AOTGA", displayName: "SE-KD AOTGA WF", defaultLocation: "ออฟฟิศ",
                defaultExaminer: "นายเจริญชัย สุวรรณประทีป", descriptionMode: "preset", presets: AOTGA_PRESETS },
  "02102022": { label: "Plan B", displayName: "", defaultLocation: "",
                defaultExaminer: "นายพีรพงษ์ คล่องวิชา", presets: [] },
  "02302025": { label: "Deves", displayName: "", defaultLocation: "",
                defaultExaminer: "นายพีรพงษ์ คล่องวิชา", presets: [] },
};

// ตัด "โครงการ :" / "โครงการ " ข้างหน้า และรวมช่องว่างซ้อน
export function cleanProjectName(name) {
  return String(name || "").trim().replace(/^โครงการ\s*:?\s*/, "").replace(/\s+/g, " ").trim();
}

// presets รองรับทั้งรูปแบบใหม่ {id,label,text} และแบบเก่า (string)
export function normPresets(list) {
  return (list || []).map((p, i) => typeof p === "string"
    ? { id: i + 1, label: `แบบ ${i + 1}`, text: p }
    : { id: Number(p.id) || i + 1, label: p.label || `แบบ ${i + 1}`, text: p.text || "" })
    .filter(p => p.text.trim());
}

// รวมค่าตั้งใน Firestore ทับค่าตั้งต้นทีละโครงการ (cache ต่อ cfg เพื่อให้ object เดิมเทียบ === ได้)
const _mapCache = new WeakMap();
const _empty = {};
export function orMap(cfg) {
  const key = cfg || _empty;
  if (!_mapCache.has(key)) {
    const m = { ...DEFAULT_OR_PROJECTS };
    for (const [k, v] of Object.entries(cfg || {})) m[k] = { ...(DEFAULT_OR_PROJECTS[k] || {}), ...v };
    _mapCache.set(key, m);
  }
  return _mapCache.get(key);
}

// ค่าตั้งของโครงการ: จับด้วยรหัสโครงการ หรือ (record เก่าที่ไม่มีรหัส) ด้วยชื่อย่อใบ OR ที่บันทึกไว้
export function orSettingsFor(project, cfg) {
  if (!project) return null;
  const map = orMap(cfg);
  if (project.code && map[project.code]) return map[project.code];
  const disp = (project.orProjectName || "").trim();
  if (disp) return Object.values(map).find(s => (s.displayName || "").trim() === disp) || null;
  return null;
}

export const isPresetMode = s => s?.descriptionMode === "preset" && normPresets(s.presets).length > 0;

export function orDisplayName(project, cfg) {
  const s = orSettingsFor(project, cfg);
  return (s?.displayName || "").trim() || cleanProjectName(project?.name);
}

// แบบที่ record ใช้ (description_preset_id ก่อน ไม่มีก็เทียบข้อความ)
export function presetIndexOf(presets, rec) {
  if (!rec) return -1;
  const byId = presets.findIndex(p => p.id === Number(rec.description_preset_id));
  if (byId >= 0) return byId;
  return presets.findIndex(p => p.text.trim() === String(rec.desc || "").trim());
}
// แบบถัดไปต่อจาก record ล่าสุด (วน 1→2→3→1) ไม่เคยมี → แบบ 1
export function nextPresetIndex(presets, lastRec) {
  if (!presets?.length) return -1;
  const i = presetIndexOf(presets, lastRec);
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
