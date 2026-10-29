// รายงาน Smart Pole รายวัน — จำนวนใบหน้า / VIP / Blacklist ของไซต์ Mett Pole จาก Grafana (ผ่าน /api/smartpole)
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useTheme } from "./theme.js";
import { today, addDays } from "./utils.js";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmtDay = (s) => { const [y, m, d] = s.split("-"); return `${Number(d)}/${Number(m)}/${Number(y) + 543}`; };
const fmtLong = (s) => { const [y, m, d] = s.split("-"); return `${Number(d)} ${TH_MONTH[Number(m) - 1]} ${Number(y) + 543}`; };
const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString());

// ── รูปแบบรายงานสถานะอุปกรณ์ (ตามที่ทีมส่งในไลน์) ──
// kind: face = ตรวจจับใบหน้า (ดึงตัวเลขจาก dashboard ใน src) · incident = ตรวจจับ Incident
//       intrusion = มีแค่ Intrusion · standalone = เครื่อง Stand alone (ไม่มีข้อมูลใน Grafana)
// offline / stale / note = ค่าเริ่มต้น (ตามรายงานวันที่ 29/10/69) — กดเปลี่ยนในหน้าเว็บแล้วระบบจำค่าใหม่
// src = ชื่อ dashboard ใน Grafana (ตรงกับ SITES ใน api/_grafana.js) — ไม่มี = กรอกเอง
export const REPORT_SITES = [
  { label: "SINGHA COMPLEX", kind: "face", src: "[METTRIQ] Singha Complex", stale: true },
  { label: "CSD DAD 1", kind: "face", src: "[MIOC] DAD" },
  { label: "CSD DAD 2", kind: "intrusion" },
  { label: "KKP 1", kind: "standalone", offline: true },
  { label: "KKP 2", kind: "standalone", offline: true },
  { label: "SCG  1", kind: "face", src: "[METTRIQ] SCG", unit: " คน", stale: true, note: "(ยังไม่มีข้อมูล Backlist,VIP)" },
  { label: "SCG  2", kind: "face", unit: " คน" },
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
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch { return {}; } }
function savePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ไม่เป็นไร */ } }

const n0 = (v) => (v === null || v === undefined || v === "" ? 0 : v);

// แถวของรายงาน: ค่าจาก Grafana + สิ่งที่ผู้ใช้แก้ (edits)
export function reportRows(sites, edits = {}, prefs = {}) {
  const order = [...REPORT_SITES.filter((r) => r.section !== "ev"), ...REPORT_SITES.filter((r) => r.section === "ev")];
  return order.map((r) => {
    const key = r.key || r.label;
    const g = r.src ? sites.find((s) => s.site === r.src) : null;
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

export function buildSmartPoleReport(date, rows, shift = "เช้า") {
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
    else {
      const what = r.kind === "incident" ? "ตรวจจับ Incident" : "ตรวจจับใบหน้าทั่วไป";
      body = `${dot}${what} ${n0(r.faces)}${r.unit || ""} VIP ${n0(r.vip)} Backlist ${n0(r.blacklist)}`;
    }
    if (r.note) body += ` ${r.note}`;
    if (r.stale) body += " **Grafana ไม่อัปเดตข้อมูล**";
    lines.push(body);
  }
  return lines.join("\n");
}

export default function SmartPolePage({ onBack }) {
  const { c } = useTheme();
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shift, setShift] = useState(() => (new Date().getHours() < 12 ? "เช้า" : "เย็น"));
  const [edits, setEdits] = useState({});      // ค่าที่แก้ในรายงานวันนี้ (ล้างเมื่อเปลี่ยนวัน)
  const [prefs, setPrefs] = useState(loadPrefs); // สถานะออนไลน์/หมายเหตุ จำข้ามวัน
  const narrow = typeof window !== "undefined" && window.innerWidth < 720;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
        const token = await user.getIdToken();
        const res = await fetch(`/api/smartpole?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `ดึงข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) { setError(e.message); setData(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);
  useEffect(() => { setEdits({}); }, [date]);

  const sites = data?.sites || [];
  const total = (k) => sites.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const rows = reportRows(sites, edits, prefs);
  const report = data ? buildSmartPoleReport(date, rows, shift) : "";
  // สถานะ/หมายเหตุ: จำไว้ใช้วันถัดไปด้วย · ตัวเลข: แก้เฉพาะวันนี้
  const setPref = (label, patch) => { const next = { ...prefs, [label]: { ...(prefs[label] || {}), ...patch } }; setPrefs(next); savePrefs(next); };
  const setEdit = (label, patch) => setEdits((e) => ({ ...e, [label]: { ...(e[label] || {}), ...patch } }));
  const isToday = date >= today();

  async function copy() {
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { alert("คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความเพื่อเลือกเอง"); }
  }

  const btn = (primary, extra = {}) => ({ border: primary ? "none" : `1px solid ${c.border}`, background: primary ? c.ink : c.card,
    color: primary ? c.onInk : c.text900, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap", ...extra });
  const cell = { padding: "10px 12px", fontSize: 13, borderTop: `1px solid ${c.borderSoft}` };
  const numCell = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: "14px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 960, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: c.bg, border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: c.text500 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>Smart Pole</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>จำนวนใบหน้า / VIP / Blacklist รายวัน · ข้อมูลจาก Grafana</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button onClick={() => setDate(addDays(date, -1))} disabled={loading} style={btn(false, { width: 34, padding: "7px 0" })}>‹</button>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value > today() ? today() : e.target.value)}
            style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, background: c.card, color: c.text900, fontFamily: "inherit" }} />
          <button onClick={() => setDate(addDays(date, 1))} disabled={loading || isToday} style={btn(false, { width: 34, padding: "7px 0", opacity: isToday ? 0.4 : 1 })}>›</button>
          {!isToday && <button onClick={() => setDate(today())} style={{ ...btn(false), border: "none", background: "transparent", color: c.ink }}>วันนี้</button>}
          <span style={{ fontSize: 12.5, color: c.text500 }}>{fmtLong(date)}</span>
          <div style={{ flex: 1 }} />
          {data && <button onClick={() => setShowReport((v) => !v)} style={btn(showReport)}>{showReport ? "ซ่อนรายงาน" : "สร้างรายงานประจำวัน"}</button>}
        </div>

        {loading && <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: c.text400, fontSize: 13.5 }}>
          กำลังดึงข้อมูลจาก Grafana ทั้ง 16 ไซต์… (อาจใช้เวลาครึ่งนาที)</div>}
        {error && !loading && <div style={{ background: c.card, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.danger}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: c.text900 }}>{error}</div>}

        {data && !loading && (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            {[["ใบหน้าทั้งหมด", total("faces")], ["VIP", total("vip")], ["Blacklist", total("blacklist")]].map(([l, v]) => (
              <div key={l} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: l === "Blacklist" && v > 0 ? c.danger : c.text900, lineHeight: 1 }}>{v.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: c.text500, marginTop: 5, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>

          {showReport && (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: c.text900, flex: 1 }}>รายงานสถานะอุปกรณ์</span>
                {["เช้า", "เย็น"].map((k) => <button key={k} onClick={() => setShift(k)} style={btn(shift === k)}>กะ{k}</button>)}
                <button onClick={copy} style={btn(true)}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
              </div>
              <div style={{ fontSize: 11.5, color: c.text400, marginBottom: 8 }}>
                ตัวเลขดึงจาก Grafana แก้ได้ · สถานะออนไลน์/ออฟไลน์ และหมายเหตุ ระบบจำไว้ใช้วันถัดไป
              </div>
              <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                {rows.map((r) => {
                  const hasNums = r.kind === "face" || r.kind === "incident";
                  const inp = (k) => (
                    <input type="number" min="0" value={r[k] ?? ""} placeholder="0" onChange={(e) => setEdit(r.key, { [k]: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 64, border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5, background: c.bg, color: c.text900, fontFamily: "inherit" }} />
                  );
                  return (
                    <React.Fragment key={r.key}>
                    {r.section === "ev" && rows.findIndex((x) => x.section === "ev") === rows.indexOf(r) && (
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text500, padding: "10px 0 2px" }}>EV Car <span style={{ fontWeight: 400, color: c.text400 }}>· ดูสถานะในโปรแกรม Imou แล้วกดสลับ</span></div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${c.borderSoft}` }}>
                      <span style={{ width: narrow ? "100%" : 150, fontSize: 13, fontWeight: 600, color: c.text900 }}>
                        {r.label}{r.car && <span style={{ fontSize: 10.5, color: c.text400, fontWeight: 400 }}> {r.car}</span>}{hasNums && !r.fromGrafana && <span style={{ fontSize: 10.5, color: c.text400, fontWeight: 400 }}> (กรอกเอง)</span>}
                      </span>
                      <button onClick={() => setPref(r.key, { offline: !r.offline })}
                        style={{ ...btn(false), padding: "4px 10px", color: r.offline ? c.danger : c.text900 }}>{r.offline ? "🔴 ออฟไลน์" : "🟢 ออนไลน์"}</button>
                      {hasNums && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: c.text500 }}>
                        {r.kind === "incident" ? "Incident" : "ใบหน้า"} {inp("faces")} VIP {inp("vip")} Blacklist {inp("blacklist")}
                      </span>}
                      {r.kind !== "ev" && <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: c.text500, cursor: "pointer" }}>
                        <input type="checkbox" checked={r.stale} onChange={(e) => setPref(r.key, { stale: e.target.checked })} style={{ accentColor: c.ink }} />
                        Grafana ไม่อัปเดต
                      </label>}
                      <input value={r.note} placeholder="หมายเหตุ" onChange={(e) => setPref(r.key, { note: e.target.value })}
                        style={{ flex: 1, minWidth: 120, border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12.5, background: c.bg, color: c.text900, fontFamily: "inherit" }} />
                    </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, color: c.text900, background: c.bg, borderRadius: 8,
                padding: 12, margin: 0, lineHeight: 1.7, maxHeight: 520, overflowY: "auto" }}>{report}</pre>
            </div>
          )}

          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: c.bg }}>
                  {["ไซต์", "ใบหน้า", "VIP", "Blacklist"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 12px", fontSize: 11.5, color: c.text500, fontWeight: 700, textAlign: i ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.site}>
                    <td style={{ ...cell, color: c.text900, fontWeight: 600 }}>
                      {s.site}
                      {s.errors?.length > 0 && <div style={{ fontSize: 11, color: c.text400, fontWeight: 400, marginTop: 2 }}>{s.errors[0]}</div>}
                    </td>
                    <td style={{ ...numCell, color: c.text900 }}>{num(s.faces)}</td>
                    <td style={{ ...numCell, color: c.text900 }}>{num(s.vip)}</td>
                    <td style={{ ...numCell, color: s.blacklist > 0 ? c.danger : c.text900, fontWeight: s.blacklist > 0 ? 700 : 400 }}>{num(s.blacklist)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => setShowDetail((v) => !v)} style={{ ...btn(false), border: "none", background: "transparent", color: c.text500, marginTop: 8, padding: "6px 0" }}>
            {showDetail ? "▴ ซ่อนที่มาของตัวเลข" : "▾ ดูว่าดึงตัวเลขจาก panel ไหน"}
          </button>
          {showDetail && (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: c.text500, lineHeight: 1.8 }}>
              {sites.map((s) => (
                <div key={s.site} style={{ borderTop: `1px solid ${c.borderSoft}`, padding: "6px 0" }}>
                  <div style={{ color: c.text900, fontWeight: 600 }}>{s.site}</div>
                  {["faces", "vip", "blacklist"].map((k) => (
                    <div key={k}>{{ faces: "ใบหน้า", vip: "VIP", blacklist: "Blacklist" }[k]}: {s.panels?.[k] || "— ไม่พบ panel"}</div>
                  ))}
                  {(s.errors || []).map((e, i) => <div key={i} style={{ color: c.danger }}>{e}</div>)}
                  {s.dashboard && <div style={{ color: c.text400 }}>dashboard: {s.dashboard}</div>}
                  {s.allPanels?.length > 0 && (
                    <details style={{ marginTop: 2 }}>
                      <summary style={{ cursor: "pointer", color: c.text500 }}>panel ทั้งหมดใน dashboard นี้ ({s.allPanels.length})</summary>
                      <ol style={{ margin: "4px 0 4px 18px", padding: 0 }}>{s.allPanels.map((t, i) => <li key={i}>{t}</li>)}</ol>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
