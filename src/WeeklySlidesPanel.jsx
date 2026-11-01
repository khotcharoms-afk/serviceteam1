// สไลด์รายสัปดาห์จากชีต Weekly สรุป → รูป PNG 1920×1080 ไว้ลากใส่ Canva (ไม่แตะไฟล์ Canva หลัก)
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme.js";
import { DAYS, groupColumns, slideList, renderSlide, prepare, below } from "./weeklySlides.js";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lastWeek = () => { const d = new Date(); d.setDate(d.getDate() - 7); return iso(d); };
const NEXT_MARK = { "": "*", "*": "**", "**": "" };

function SlideCanvas({ slide, marks, ready }) {
  const ref = useRef(null);
  useEffect(() => { if (ready && ref.current) renderSlide(ref.current, slide, marks); }, [slide, marks, ready]);
  return <canvas ref={ref} style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: "1px solid rgba(0,0,0,.12)" }} />;
}

function toBlob(slide, marks) {
  const cv = document.createElement("canvas");
  renderSlide(cv, slide, marks);
  return new Promise((r) => cv.toBlob(r, "image/png"));
}
function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export default function WeeklySlidesPanel({ onClose }) {
  const { c } = useTheme();
  const [date, setDate] = useState(lastWeek());
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);
  const [marks, setMarks] = useState({});
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(() => { prepare().then(() => setReady(true)); }, []);
  useEffect(() => {
    let cancelled = false;
    setBusy(true); setErr(null); setData(null); setMarks({});
    (async () => {
      try {
        const res = await fetch(`/api/sheet-sync?mode=week&date=${date}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((j.error || "โหลดข้อมูลไม่สำเร็จ") + (j.detail ? ` — ${j.detail}` : ""));
        if (j.error) throw new Error(j.error);
        if (!cancelled) setData(j);
      } catch (e) { if (!cancelled) setErr(e.message); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [date]);

  const groups = data ? groupColumns(data.columns) : [];
  const slides = slideList(groups);
  const fname = (i, s) => `METTBOT_${date}_${String(i + 1).padStart(2, "0")}_${s.kind === "table" ? "table" : s.days[0] === 0 ? "chart-mon-wed" : "chart-thu-sun"}.png`;

  async function downloadAll() {
    setZipBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) zip.file(fname(i, slides[i]), await toBlob(slides[i], marks));
      save(await zip.generateAsync({ type: "blob" }), `METTBOT_weekly_${date}.zip`);
    } finally { setZipBusy(false); }
  }

  const btn = (primary) => ({ border: primary ? "none" : `1px solid ${c.border}`, background: primary ? c.ink : c.card, color: primary ? c.onInk : c.text900,
    borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: c.bg, overflowY: "auto", fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, background: c.card, borderBottom: `1px solid ${c.border}`, padding: "12px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onClose} style={{ background: c.bg, border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: c.text500 }}>←</button>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text900 }}>สไลด์รายสัปดาห์</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>ข้อมูลจากชีต Weekly สรุป · ดาวน์โหลดเป็นรูปแล้วลากใส่ Canva (ไม่แก้ไฟล์ Canva หลัก)</div>
          </div>
          <span style={{ fontSize: 12.5, color: c.text500 }}>สัปดาห์ที่มีวันที่</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
            style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, background: c.card, color: c.text900, fontFamily: "inherit" }} />
          {slides.length > 0 && <button onClick={downloadAll} disabled={zipBusy} style={btn(true)}>{zipBusy ? "กำลังเตรียม…" : `ดาวน์โหลดทั้งหมด (${slides.length} รูป)`}</button>}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 16px 60px" }}>
        {busy && <div style={{ padding: 40, textAlign: "center", color: c.text400, fontSize: 13.5 }}>กำลังอ่านชีต…</div>}
        {err && <div style={{ background: c.card, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.danger}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: c.text900 }}>{err}</div>}
        {data && !busy && (<>
          <div style={{ fontSize: 12.5, color: c.text500, marginBottom: 12 }}>
            {data.title && <b style={{ color: c.text900 }}>{data.title}</b>} · {data.columns.length} ไซต์ที่มีตัวเลข · {groups.length} ชุด
            <div style={{ marginTop: 4 }}>ตัวเลขดึงจากชีตตามที่เขียนไว้ ถ้ายังไม่ได้ส่งยอดของวันไหนเข้าชีต ให้กด "ส่งเข้า Google Sheet" ก่อน · ช่องสีแดง = ต่ำกว่า target · กดที่ตัวเลขในตารางด้านล่างเพื่อใส่ * หรือ **</div>
          </div>
          {slides.map((s, i) => (
            <div key={s.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.text900, flex: 1 }}>{i + 1}. {s.label}</span>
                <button onClick={async () => save(await toBlob(s, marks), fname(i, s))} style={btn(false)}>ดาวน์โหลด PNG</button>
              </div>
              <SlideCanvas slide={s} marks={marks} ready={ready} />
              {s.kind === "table" && (
                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
                    <thead><tr>
                      <th style={{ padding: "4px 6px", textAlign: "left", color: c.text500 }}>ใส่หมายเหตุ</th>
                      {s.group.cols.map((col) => <th key={col.name} style={{ padding: "4px 6px", color: c.text500, fontWeight: 600, whiteSpace: "nowrap" }}>{col.name.replace(/^ARL\s*-\s*/, "")}</th>)}
                    </tr></thead>
                    <tbody>{DAYS.map((d, di) => (
                      <tr key={d}>
                        <td style={{ padding: "3px 6px", color: c.text500 }}>{d}</td>
                        {s.group.cols.map((col) => {
                          const k = `${col.name}|${di}`; const mk = marks[k] ?? col.cells[di].mark ?? "";
                          return (
                            <td key={k} style={{ padding: 2, textAlign: "center" }}>
                              <button onClick={() => setMarks((m) => ({ ...m, [k]: NEXT_MARK[mk] }))} title="กดเพื่อสลับ ไม่มี → * → **"
                                style={{ width: "100%", minWidth: 58, border: `1px solid ${mk ? c.ink : c.borderSoft}`, background: mk ? c.borderSoft : "transparent", borderRadius: 5,
                                  padding: "3px 4px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: below(col, di) ? c.danger : c.text900 }}>
                                {col.cells[di].value === null ? "-" : `${mk}${col.cells[di].value}`}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}
