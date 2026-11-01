// สไลด์รายสัปดาห์จากชีต Weekly สรุป → รูป PNG 1920×1080 ไว้ลากใส่ Canva (ไม่แตะไฟล์ Canva หลัก)
import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { useTheme } from "./theme.js";
import { DAYS, MARKS, groupColumns, slideList, renderSlide, prepare, below, markOf, defaultNote, applyTargets, targetFor } from "./weeklySlides.js";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lastWeek = () => { const d = new Date(); d.setDate(d.getDate() - 7); return iso(d); };
const TARGET_DOC = doc(db, "settings", "robotTargets");

function SlideCanvas({ slide, marks, notes, ready }) {
  const ref = useRef(null);
  useEffect(() => { if (ready && ref.current) renderSlide(ref.current, slide, marks, notes); }, [slide, marks, notes, ready]);
  return <canvas ref={ref} style={{ width: "100%", height: "auto", display: "block", borderRadius: 6, border: "1px solid rgba(0,0,0,.12)" }} />;
}

function toBlob(slide, marks, notes) {
  const cv = document.createElement("canvas");
  renderSlide(cv, slide, marks, notes);
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
  const [notes, setNotes] = useState({});      // หมายเหตุใต้ตารางของแต่ละชุด (ยังไม่แก้ = สร้างจากเครื่องหมายที่ใช้)
  const [zipBusy, setZipBusy] = useState(false);
  const [saved, setSaved] = useState({});      // target ที่ตั้งไว้ในระบบ
  const [showTargets, setShowTargets] = useState(false);
  const [draft, setDraft] = useState({});
  const [tMsg, setTMsg] = useState(null);

  useEffect(() => { prepare().then(() => setReady(true)); }, []);
  useEffect(() => { getDoc(TARGET_DOC).then((s) => s.exists() && setSaved(s.data().targets || {})).catch(() => {}); }, []);
  useEffect(() => {
    let cancelled = false;
    setBusy(true); setErr(null); setData(null); setMarks({}); setNotes({});
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

  const columns = data ? applyTargets(data.columns, saved) : [];
  const groups = groupColumns(columns);
  const slides = slideList(groups);
  const fname = (i, s) => `METTBOT_${date}_${String(i + 1).padStart(2, "0")}_${s.kind}.png`;

  async function downloadAll() {
    setZipBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) zip.file(fname(i, slides[i]), await toBlob(slides[i], marks, notes));
      save(await zip.generateAsync({ type: "blob" }), `METTBOT_weekly_${date}.zip`);
    } finally { setZipBusy(false); }
  }

  async function saveTargets() {
    setTMsg(null);
    const next = { ...saved };
    for (const [k, v] of Object.entries(draft)) next[k] = v === "" ? 0 : Number(v);
    try {
      await setDoc(TARGET_DOC, { targets: next, updatedAt: Date.now(), updatedBy: auth.currentUser?.email || "" });
      setSaved(next); setDraft({}); setTMsg("บันทึกแล้ว");
    } catch (e) {
      setTMsg(e.code === "permission-denied" ? "บันทึกไม่ได้: ยังไม่ได้ Publish Firestore rules ชุดใหม่ (settings)" : `บันทึกไม่สำเร็จ: ${e.message}`);
    }
  }

  const btn = (primary) => ({ border: primary ? "none" : `1px solid ${c.border}`, background: primary ? c.ink : c.card, color: primary ? c.onInk : c.text900,
    borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const input = { border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5, background: c.bg, color: c.text900, fontFamily: "inherit" };

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
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...input, padding: "6px 10px", fontSize: 13, background: c.card }} />
          {data && <button onClick={() => setShowTargets((v) => !v)} style={btn(showTargets)}>ตั้งค่า Target</button>}
          {slides.length > 0 && <button onClick={downloadAll} disabled={zipBusy} style={btn(true)}>{zipBusy ? "กำลังเตรียม…" : `ดาวน์โหลดทั้งหมด (${slides.length} รูป)`}</button>}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 16px 60px" }}>
        {busy && <div style={{ padding: 40, textAlign: "center", color: c.text400, fontSize: 13.5 }}>กำลังอ่านชีต…</div>}
        {err && <div style={{ background: c.card, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.danger}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: c.text900 }}>{err}</div>}

        {showTargets && data && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text900 }}>Target ของแต่ละไซต์ (ตร.ม./วัน)</div>
            <div style={{ fontSize: 11.5, color: c.text400, margin: "2px 0 10px" }}>ถ้าแถว Target ในชีตมีตัวเลข จะใช้ของชีตก่อน · 0 หรือเว้นว่าง = ไม่มี target · บันทึกแล้วใช้ทุกสัปดาห์ ทุกคนเห็นเหมือนกัน</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 6 }}>
              {data.columns.map((col) => {
                const fromSheet = !!col.target;
                const val = draft[col.name] ?? (targetFor(col.name, saved) ?? "");
                return (
                  <label key={col.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: c.text900 }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.name}</span>
                    {fromSheet ? <span style={{ fontSize: 11.5, color: c.text400 }}>ชีต: {col.target}</span>
                      : <input type="number" min="0" value={val} onChange={(e) => setDraft((d) => ({ ...d, [col.name]: e.target.value }))} style={{ ...input, width: 80 }} />}
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <button onClick={saveTargets} disabled={!Object.keys(draft).length} style={{ ...btn(true), opacity: Object.keys(draft).length ? 1 : 0.5 }}>บันทึก Target</button>
              {tMsg && <span style={{ fontSize: 12, color: tMsg === "บันทึกแล้ว" ? c.text500 : c.danger }}>{tMsg}</span>}
            </div>
          </div>
        )}

        {data && !busy && (<>
          <div style={{ fontSize: 12.5, color: c.text500, marginBottom: 12 }}>
            {data.title && <b style={{ color: c.text900 }}>{data.title}</b>} · {data.columns.length} ไซต์ที่มีตัวเลข · {groups.length} ชุด
            <div style={{ marginTop: 4 }}>ตัวเลขดึงจากชีต ถ้ายังไม่ได้ส่งยอดของวันไหนเข้าชีต ให้กด "ส่งเข้า Google Sheet" ก่อน · ตัวเลขสีแดง = ต่ำกว่า target · กดที่ตัวเลขในตารางใต้สไลด์เพื่อสลับ ไม่มี → * → ** → *** → หยุด</div>
          </div>
          {slides.map((s, i) => (
            <div key={s.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.text900, flex: 1 }}>{i + 1}. {s.label}</span>
                <button onClick={async () => save(await toBlob(s, marks, notes), fname(i, s))} style={btn(false)}>ดาวน์โหลด PNG</button>
              </div>
              <SlideCanvas slide={s} marks={marks} notes={notes} ready={ready} />
              {s.kind === "table" && (<>
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
                          const k = `${col.name}|${di}`; const mk = markOf(marks, col, di);
                          const next = MARKS[(MARKS.indexOf(mk) + 1) % MARKS.length];
                          return (
                            <td key={k} style={{ padding: 2, textAlign: "center" }}>
                              <button onClick={() => setMarks((m) => ({ ...m, [k]: next }))} title="กดเพื่อสลับ ไม่มี → * → ** → *** → หยุด"
                                style={{ width: "100%", minWidth: 58, border: `1px solid ${mk ? c.ink : c.borderSoft}`, background: mk ? c.borderSoft : "transparent", borderRadius: 5,
                                  padding: "3px 4px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: below(col, di) || mk === "หยุด" ? c.danger : c.text900 }}>
                                {mk === "หยุด" ? "หยุด" : col.cells[di].value === null ? "-" : `${mk}${col.cells[di].value}`}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: c.text500, marginBottom: 4 }}>หมายเหตุใต้ตาราง (ขึ้นบรรทัดใหม่ได้ · เว้นว่าง = ไม่มีหมายเหตุ)</div>
                  <textarea rows={2} value={notes[s.group.id] ?? defaultNote(s.group, marks)} onChange={(e) => setNotes((n) => ({ ...n, [s.group.id]: e.target.value }))}
                    placeholder="เช่น หมายเหตุ * = Operation ติดหน้างาน / ** = Map มีปัญหา" style={{ ...input, width: "100%", resize: "vertical", fontSize: 13 }} />
                </div>
              </>)}
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}
