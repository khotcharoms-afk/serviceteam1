// รายงานสถานะอุปกรณ์ประจำกะ: Smart Pole → EV Car → หุ่นยนต์ — ค่าตั้งต้นของแต่ละไซต์ และตัวสร้างข้อความ
// ── รูปแบบรายงานสถานะอุปกรณ์ (ตามที่ทีมส่งในไลน์) ──
// kind: face = ตรวจจับใบหน้า (ดึงตัวเลขจาก dashboard ใน src) · incident = ตรวจจับ Incident
//       intrusion = มีแค่ Intrusion · standalone = เครื่อง Stand alone (ไม่มีข้อมูลใน Grafana)
// offline / stale / note = ค่าเริ่มต้น (ตามรายงานวันที่ 29/10/69) — กดเปลี่ยนในหน้าเว็บแล้วระบบจำค่าใหม่
// part = ป้ายเสาในชื่อ panel เช่น [SCG01] (ไซต์ที่ dashboard เดียวมีหลายเสา)
// src = ชื่อ dashboard ใน Grafana (ตรงกับ SITES ใน api/_grafana.js) — ไม่มี = กรอกเอง
export const REPORT_SITES = [
  { label: "SINGHA COMPLEX", kind: "face", src: "[METTRIQ] Singha Complex", stale: true },
  { label: "CSD DAD 1", kind: "face", src: "[MIOC] DAD" },
  { label: "CSD DAD 2", kind: "intrusion" },
  { label: "KKP 1", kind: "standalone", offline: true },
  { label: "KKP 2", kind: "standalone", offline: true },
  { label: "SCG  1", kind: "face", src: "[METTRIQ] SCG", part: "SCG01", unit: " คน", stale: true, note: "(ยังไม่มีข้อมูล Backlist,VIP)" },
  { label: "SCG  2", kind: "face", src: "[METTRIQ] SCG", part: "SCG02", unit: " คน" },
  { label: "MDES", kind: "face", src: "[METTRIQ] MDES", stale: true },
  { label: "PTT AREAR-04", kind: "intrusion" },
  { label: "PTT AREAR-06", kind: "intrusion" },
  { label: "AOTGA-BKK", kind: "face", src: "[METTRIQ] AOTGA-BKK", offline: true },
  { label: "AOTGA-HKT", kind: "face", src: "[METTRIQ] AOTGA-HKT" },
  { label: "TRUE Rangsit", kind: "face", src: "[METTRIQ] TRUE Call Center Rangsit", stale: true },
  { label: "TRUE Srinakarin", kind: "face", src: "[METTRIQ] TRUE Call Center Srinakarin" },
  { label: "PTT 11 chai nat", kind: "incident", src: "[METTRIQ] Smart Pole – PTT 11 Chai Nat", offline: true, stale: true },
  // ── EV Car: 1 คัน = 1 ไซต์ (router Metthier_EVxx + กล้อง EVxx_FRONT_01/02, EVxx_REAR_03/04 ในโปรแกรม Imou)
  //    ดูสถานะใน Imou บนคอม แล้วกดสลับในหน้านี้ (ยังไม่ได้ดึงอัตโนมัติ) — รายการตาม inventory_EVMT
  { key: "ev01", section: "ev", label: "หัวหินวิลล่า", car: "EV01", kind: "ev", offline: true },
  { key: "ev02", section: "ev", label: "ปท.9ปทุมธานี", car: "EV02", kind: "ev", offline: true },
  { key: "ev03", section: "ev", label: "ปท.2อยุธยา", car: "EV03", kind: "ev", offline: true },
  { key: "ev04", section: "ev", label: "ปท.11สิงห์บุรี (วังน้อย)", car: "EV04", kind: "ev", offline: true },
  { key: "ev05", section: "ev", label: "ปท.5ราชบุรี", car: "EV05", kind: "ev", offline: true },
  { key: "ev06", section: "ev", label: "ปท.8กาญจนบุรี", car: "EV06", kind: "ev", offline: true },
  { key: "ev07", section: "ev", label: "SCG บางซื่อ", car: "EV07", kind: "ev", offline: false },
  { key: "ev08", section: "ev", label: "ปท.4ขอนแก่น", car: "EV08", kind: "ev", offline: true },
  { key: "ev09", section: "ev", label: "AECตลาดต่อยอด", car: "EV09", kind: "ev", offline: true },
  { key: "ev10", section: "ev", label: "ลู่ปั่น", car: "EV10", kind: "ev", offline: true },
  { key: "ev11", section: "ev", label: "Fabrinet Chonburi", car: "EV11", kind: "ev", offline: true },
  { label: "PTT 11 nakhon sawan", kind: "incident", src: "[METTRIQ] Smart Pole – PTT 11 Nakhon Sawan", offline: true, stale: true },
];

const PREF_KEY = "smartpole-report-prefs"; // สถานะออนไลน์/หมายเหตุล่าสุดของแต่ละไซต์ (จำไว้ใช้วันถัดไป)
export function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch { return {}; } }
export function savePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ไม่เป็นไร */ } }

const n0 = (v) => (v === null || v === undefined || v === "" ? 0 : v);

// แถวของรายงาน: ค่าจาก Grafana + สิ่งที่ผู้ใช้แก้ (edits)
export function reportRows(sites, edits = {}, prefs = {}) {
  const order = [...REPORT_SITES.filter((r) => r.section !== "ev"), ...REPORT_SITES.filter((r) => r.section === "ev")];
  return order.map((r) => {
    const key = r.key || r.label;
    const site = r.src ? sites.find((s) => s.site === r.src) : null;
    // ไซต์หลายเสา: ใช้ตัวเลขของเสานั้น (part = ป้าย [SCG01] ในชื่อ panel) ถ้ายังไม่มีข้อมูลรายเสา → ไม่เดา
    const g = site && r.part ? (site.parts?.[r.part] ? { faces: null, vip: null, blacklist: null, ...site.parts[r.part] } : null) : site;
    const p = prefs[key] || {};
    const e = edits[key] || {};
    return {
      ...r, key,
      offline: e.offline ?? p.offline ?? !!r.offline,
      stale: e.stale ?? p.stale ?? !!r.stale,
      note: e.note ?? p.note ?? (r.note || ""),
      faces: e.faces ?? g?.faces ?? null,
      vip: e.vip ?? g?.vip ?? null,
      blacklist: e.blacklist ?? g?.blacklist ?? null,
      fromGrafana: !!g,
    };
  });
}

const BE2 = (date) => { const [y, m, d] = date.split("-"); return `${Number(d)}/${Number(m)}/${String(Number(y) + 543).slice(-2)}`; };

// robotText = ข้อความรายงานหุ่นยนต์ (จาก robotReport.js) — ต่อท้ายหลัง EV Car
export function buildStatusReport(date, rows, shift = "เช้า", robotText = "") {
  const lines = [`รายงานสถานะอุปกรณ์กะ${shift} วันที่ ${BE2(date)}`, "", "Smart Pole", "Site"];
  let evHeader = false;
  for (const r of rows) {
    if (r.section === "ev" && !evHeader) { lines.push("", "EV Car", "Site"); evHeader = true; }
    lines.push(r.label);
    const dot = r.offline ? "🔴ออฟไลน์ " : "🟢";
    let body;
    if (r.kind === "ev") body = r.offline ? "🔴ออฟไลน์" : "🟢ออนไลน์ปกติ";
    else if (r.kind === "intrusion") body = `${dot}Intrution`;
    else if (r.kind === "standalone") body = `${dot}Stand alone`;
    // กล้อง Intrusion ที่ไม่มี AI ใบหน้า — นับได้แค่เหตุการณ์ ไม่มี VIP/Backlist
    else if (r.kind === "incident") body = `${dot}ตรวจจับ Incident ${n0(r.faces)}`;
    else body = `${dot}ตรวจจับใบหน้าทั่วไป ${n0(r.faces)}${r.unit || ""} VIP ${n0(r.vip)} Backlist ${n0(r.blacklist)}`;
    if (r.note) body += ` ${r.note}`;
    if (r.stale) body += " **Grafana ไม่อัปเดตข้อมูล**";
    lines.push(body);
  }
  if (robotText) lines.push("", "หุ่นยนต์ทำความสะอาด", "Site", ...robotText.split("\n"));
  return lines.join("\n");
}
