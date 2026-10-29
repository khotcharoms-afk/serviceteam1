// รายงานสถานะอุปกรณ์ประจำกะ — รวม Smart Pole (Grafana) → EV Car (Imou) → หุ่นยนต์ทำความสะอาด (VIGGO) เป็นข้อความเดียว พร้อมคัดลอกส่งไลน์
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useTheme } from "./theme.js";
import { today, addDays } from "./utils.js";
import { REPORT_SITES, loadPrefs, savePrefs, reportRows, buildStatusReport } from "./statusReport.js";
import { EXCLUDED_CODES, isWorked, buildDailyReport } from "./robotReport.js";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmtLong = (s) => { const [y, m, d] = s.split("-"); return `${Number(d)} ${TH_MONTH[Number(m) - 1]} ${Number(y) + 543}`; };

async function authFetch(url) {
  const user = auth.currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `ดึงข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
  return json;
}

export default function DeviceReportPage({ onBack }) {
  const { c } = useTheme();
  const [date, setDate] = useState(today());
  const [shift, setShift] = useState(() => (new Date().getHours() < 12 ? "เช้า" : "บ่าย"));
  const [copied, setCopied] = useState(false);
  // Smart Pole
  const [pole, setPole] = useState(null);
  const [poleBusy, setPoleBusy] = useState(false);
  const [poleErr, setPoleErr] = useState(null);
  const [edits, setEdits] = useState({});        // ตัวเลขที่แก้ของวันนี้ (ล้างเมื่อเปลี่ยนวัน)
  const [prefs, setPrefs] = useState(loadPrefs);  // สถานะ/หมายเหตุ จำข้ามวัน
  // EV
  const [imou, setImou] = useState(null);
  const [imouBusy, setImouBusy] = useState(false);
  const [imouErr, setImouErr] = useState(null);
  // หุ่นยนต์
  const [robots, setRobots] = useState(null);
  const [robotBusy, setRobotBusy] = useState(false);
  const [robotErr, setRobotErr] = useState(null);
  const [rawBusy, setRawBusy] = useState(false);
  const [rawMsg, setRawMsg] = useState(null);
  const [open, setOpen] = useState({ pole: true, ev: true, robot: false });
  const narrow = typeof window !== "undefined" && window.innerWidth < 720;

  useEffect(() => {
    let cancelled = false;
    setEdits({}); setRawMsg(null);
    (async () => {
      setPoleBusy(true); setPoleErr(null);
      try { const j = await authFetch(`/api/smartpole?date=${date}`); if (!cancelled) setPole(j); }
      catch (e) { if (!cancelled) { setPoleErr(e.message); setPole(null); } }
      finally { if (!cancelled) setPoleBusy(false); }
    })();
    (async () => {
      setRobotBusy(true); setRobotErr(null);
      try {
        const params = new URLSearchParams({ start_time: date, end_time: date, page: "1", size: "100" });
        const res = await fetch(`/api/robot-stats?${params}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `ดึงข้อมูลหุ่นยนต์ไม่สำเร็จ (HTTP ${res.status})`);
        if (!cancelled) setRobots((j.result || []).filter((r) => !EXCLUDED_CODES.includes(r.project_name)));
      } catch (e) { if (!cancelled) { setRobotErr(e.message); setRobots(null); } }
      finally { if (!cancelled) setRobotBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [date]);

  async function pullImou() {
    setImouBusy(true); setImouErr(null);
    try {
      const j = await authFetch("/api/imou");
      setImou(j);
      const next = { ...prefs };
      for (const r of REPORT_SITES.filter((x) => x.section === "ev")) {
        const car = j.cars?.[r.key];
        if (car && car.online !== null) next[r.key] = { ...(next[r.key] || {}), offline: !car.online };
      }
      setPrefs(next); savePrefs(next);
    } catch (e) { setImouErr(e.message); }
    finally { setImouBusy(false); }
  }

  // หุ่นที่เป็น 0 อาจอัปโหลดข้อมูลช้า — ดึงข้อมูลดิบย้อนหลังเฉพาะเมื่อกด
  async function pullRaw() {
    setRawBusy(true); setRawMsg(null);
    try {
      const params = new URLSearchParams({ start_time: date, end_time: date, page: "1", size: "100", raw: "1" });
      const res = await fetch(`/api/robot-stats?${params}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "ดึงข้อมูลย้อนหลังไม่สำเร็จ");
      const byVin = {};
      (j.result || []).forEach((r) => { if (r.from_raw) byVin[r.vin] = r; });
      const n = Object.keys(byVin).length;
      setRobots((list) => (list || []).map((r) => (byVin[r.vin] && !isWorked(r) ? { ...r, ...byVin[r.vin] } : r)));
      setRawMsg(n ? `อัปเดตจากข้อมูลย้อนหลัง ${n} คัน` : "ไม่พบข้อมูลย้อนหลังเพิ่ม");
    } catch (e) { setRawMsg(e.message); }
    finally { setRawBusy(false); }
  }

  const rows = reportRows(pole?.sites || [], edits, prefs);
  const poleRows = rows.filter((r) => r.section !== "ev");
  const evRows = rows.filter((r) => r.section === "ev");
  const robotText = robots ? buildDailyReport(robots, shift === "เช้า" ? "morning" : "evening") : "";
  const report = buildStatusReport(date, rows, shift, robotText);
  const robotTotal = robots?.length || 0;
  const robotWorked = (robots || []).filter(isWorked).length;
  const robotZero = robotTotal - robotWorked;

  const setPref = (key, patch) => { const next = { ...prefs, [key]: { ...(prefs[key] || {}), ...patch } }; setPrefs(next); savePrefs(next); };
  const setEdit = (key, patch) => setEdits((e) => ({ ...e, [key]: { ...(e[key] || {}), ...patch } }));
  const isToday = date >= today();

  async function copy() {
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { alert("คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความเพื่อเลือกเอง"); }
  }

  const btn = (primary, extra = {}) => ({ border: primary ? "none" : `1px solid ${c.border}`, background: primary ? c.ink : c.card,
    color: primary ? c.onInk : c.text900, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap", ...extra });
  const small = { ...btn(false), padding: "4px 10px" };
  const card = { background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 };
  const sub = { fontSize: 11.5, color: c.text400, fontWeight: 400 };

  const Head = ({ id, title, status, children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ color: c.text400, fontSize: 11, width: 10 }}>{open[id] ? "▾" : "▸"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: c.text900 }}>{title}</span>
        <span style={sub}>{status}</span>
      </button>
      {children}
    </div>
  );

  const poleOff = poleRows.filter((r) => r.offline).length;
  const evOff = evRows.filter((r) => r.offline).length;

  const RowEdit = (r) => {
    const hasNums = r.kind === "face" || r.kind === "incident";
    const inp = (k) => (
      <input type="number" min="0" value={r[k] ?? ""} placeholder="0" onChange={(e) => setEdit(r.key, { [k]: e.target.value === "" ? null : Number(e.target.value) })}
        style={{ width: 64, border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5, background: c.bg, color: c.text900, fontFamily: "inherit" }} />
    );
    const cam = r.section === "ev" ? imou?.cars?.[r.key] : null;
    return (
      <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "7px 0", borderTop: `1px solid ${c.borderSoft}` }}>
        <span style={{ width: narrow ? "100%" : 150, fontSize: 13, fontWeight: 600, color: c.text900 }}>
          {r.label}{r.car && <span style={{ fontSize: 10.5, color: c.text400, fontWeight: 400 }}> {r.car}</span>}
          {cam && (
            <span title={cam.cams.map((x) => `${x.name || x.sn}: ${x.online === null ? "ไม่ทราบ" : x.online ? "ออนไลน์" : "ออฟไลน์"}`).join("\n")}
              style={{ display: "block", fontSize: 10.5, color: c.text400, fontWeight: 400 }}>
              {cam.online === null ? "Imou: ไม่พบกล้อง" : `Imou: กล้องออนไลน์ ${cam.camsOnline}/4`}
            </span>
          )}
          {hasNums && !r.fromGrafana && <span style={{ fontSize: 10.5, color: c.text400, fontWeight: 400 }}> (กรอกเอง)</span>}
        </span>
        <button onClick={() => setPref(r.key, { offline: !r.offline })}
          style={{ ...small, color: r.offline ? c.danger : c.text900 }}>{r.offline ? "🔴 ออฟไลน์" : "🟢 ออนไลน์"}</button>
        {hasNums && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: c.text500, flexWrap: "wrap" }}>
          {r.kind === "incident" ? "Incident" : "ใบหน้า"} {inp("faces")} VIP {inp("vip")} Blacklist {inp("blacklist")}
        </span>}
        {r.kind !== "ev" && <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: c.text500, cursor: "pointer" }}>
          <input type="checkbox" checked={r.stale} onChange={(e) => setPref(r.key, { stale: e.target.checked })} style={{ accentColor: c.ink }} />
          Grafana ไม่อัปเดต
        </label>}
        <input value={r.note} placeholder="หมายเหตุ" onChange={(e) => setPref(r.key, { note: e.target.value })}
          style={{ flex: 1, minWidth: 120, border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12.5, background: c.bg, color: c.text900, fontFamily: "inherit" }} />
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: "14px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 960, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: c.bg, border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: c.text500 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>รายงานสถานะอุปกรณ์</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>Smart Pole · EV Car · หุ่นยนต์ทำความสะอาด — รวมเป็นข้อความเดียวส่งไลน์</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button onClick={() => setDate(addDays(date, -1))} style={btn(false, { width: 34, padding: "7px 0" })}>‹</button>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value > today() ? today() : e.target.value)}
            style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, background: c.card, color: c.text900, fontFamily: "inherit" }} />
          <button onClick={() => setDate(addDays(date, 1))} disabled={isToday} style={btn(false, { width: 34, padding: "7px 0", opacity: isToday ? 0.4 : 1 })}>›</button>
          {!isToday && <button onClick={() => setDate(today())} style={{ ...btn(false), border: "none", background: "transparent", color: c.ink }}>วันนี้</button>}
          <span style={{ fontSize: 12.5, color: c.text500 }}>{fmtLong(date)}</span>
          <div style={{ flex: 1 }} />
          {["เช้า", "บ่าย"].map((k) => <button key={k} onClick={() => setShift(k)} style={btn(shift === k)}>กะ{k}</button>)}
        </div>

        {/* 1. Smart Pole */}
        <div style={card}>
          <Head id="pole" title="Smart Pole"
            status={poleBusy ? "กำลังดึงจาก Grafana… (อาจใช้เวลาครึ่งนาที)" : poleErr ? "" : `${poleRows.length} ไซต์ · ออฟไลน์ ${poleOff}`} />
          {poleErr && <div style={{ fontSize: 12.5, color: c.danger, marginTop: 6 }}>{poleErr} — กรอกตัวเลขเองได้</div>}
          {open.pole && <div style={{ marginTop: 6 }}>{poleRows.map(RowEdit)}</div>}
        </div>

        {/* 2. EV Car */}
        <div style={card}>
          <Head id="ev" title="EV Car" status={`${evRows.length} คัน · ออฟไลน์ ${evOff}`}>
            <button onClick={pullImou} disabled={imouBusy} style={small}>{imouBusy ? "กำลังดึง…" : "ดึงสถานะจาก Imou"}</button>
          </Head>
          {imouErr && <div style={{ fontSize: 12, color: c.danger, marginTop: 6 }}>{imouErr}</div>}
          {imou?.errors?.length > 0 && <div style={{ ...sub, marginTop: 4 }}>{imou.errors.join(" · ")}</div>}
          {imou && <div style={{ ...sub, marginTop: 4 }}>บัญชี Imou เห็นอุปกรณ์ {imou.deviceCount} ตัว · ใช้ API {imou.apiCalls} ครั้ง</div>}
          {open.ev && <div style={{ marginTop: 6 }}>{evRows.map(RowEdit)}</div>}
        </div>

        {/* 3. หุ่นยนต์ */}
        <div style={card}>
          <Head id="robot" title="หุ่นยนต์ทำความสะอาด"
            status={robotBusy ? "กำลังดึงข้อมูล…" : robotErr ? "" : `${robotTotal} คัน · ทำงาน ${robotWorked} · เป็น 0 ${robotZero}`}>
            {robots && robotZero > 0 && <button onClick={pullRaw} disabled={rawBusy} style={small}>{rawBusy ? "กำลังดึง…" : "ดึงย้อนหลังคันที่เป็น 0"}</button>}
          </Head>
          {robotErr && <div style={{ fontSize: 12.5, color: c.danger, marginTop: 6 }}>{robotErr}</div>}
          {rawMsg && <div style={{ ...sub, marginTop: 4 }}>{rawMsg}</div>}
          {open.robot && robots && (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, color: c.text500, margin: "8px 0 0", lineHeight: 1.7 }}>{robotText || "ไม่มีข้อมูล"}</pre>
          )}
          <div style={{ ...sub, marginTop: 6 }}>กะเช้า = สถานะออนไลน์ · กะบ่าย = พร้อมพื้นที่ที่ทำความสะอาด (ตามปุ่มกะด้านบน)</div>
        </div>

        {/* ข้อความรวม */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.text900, flex: 1 }}>ข้อความรายงาน</span>
            <button onClick={copy} style={btn(true)}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, color: c.text900, background: c.bg, borderRadius: 8,
            padding: 12, margin: 0, lineHeight: 1.7, maxHeight: 640, overflowY: "auto" }}>{report}</pre>
        </div>
      </div>
    </div>
  );
}
