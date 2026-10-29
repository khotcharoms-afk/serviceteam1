// รายงาน Smart Pole รายวัน — จำนวนใบหน้า / VIP / Blacklist ของไซต์ Mett Pole จาก Grafana (ผ่าน /api/smartpole)
import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useTheme } from "./theme.js";
import { today, addDays } from "./utils.js";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmtDay = (s) => { const [y, m, d] = s.split("-"); return `${Number(d)}/${Number(m)}/${Number(y) + 543}`; };
const fmtLong = (s) => { const [y, m, d] = s.split("-"); return `${Number(d)} ${TH_MONTH[Number(m) - 1]} ${Number(y) + 543}`; };
const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString());

export function buildSmartPoleReport(date, sites) {
  const lines = [`รายงาน Smart Pole ประจำวันที่ ${fmtDay(date)}`, ""];
  for (const s of sites) {
    lines.push(s.site);
    if (s.faces === null && s.vip === null && s.blacklist === null) lines.push("ไม่มีข้อมูล");
    else lines.push(`ใบหน้า ${num(s.faces)} | VIP ${num(s.vip)} | Blacklist ${num(s.blacklist)}`);
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

  const sites = data?.sites || [];
  const total = (k) => sites.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const report = data ? buildSmartPoleReport(date, sites) : "";
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
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: c.text900, flex: 1 }}>รายงานประจำวัน</span>
                <button onClick={copy} style={btn(true)}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, color: c.text900, background: c.bg, borderRadius: 8,
                padding: 12, margin: 0, lineHeight: 1.7, maxHeight: 420, overflowY: "auto" }}>{report}</pre>
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
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
