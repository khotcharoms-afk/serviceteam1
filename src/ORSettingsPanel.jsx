import { useState } from "react";
import { db } from "./firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { DEFAULT_OR_PROJECTS, EXAMINER_OPTS, orSettingsFor, orDisplayName, cleanProjectName } from "./orConfig.js";

const IS = { width:"100%", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 10px",
  fontSize:12, fontFamily:"inherit", outline:"none", background:"#f8fafc", boxSizing:"border-box" };
const LB = { fontSize:10, color:"#94a3b8", fontWeight:700, marginBottom:3, display:"block" };
const BTN = { border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };

// ── ตั้งค่าใบ OR ต่อโครงการ (Firestore settings/orProjects) ─────────────
export function ORSettingsPanel({ orCfg, projects, onClose }) {
  const [rows, setRows] = useState(() => {
    const m = { ...DEFAULT_OR_PROJECTS, ...(orCfg || {}) };
    return Object.entries(m).map(([code, v]) => ({ code, ...v, presetsText: (v.presets || []).join("\n") }));
  });
  const [addCode, setAddCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const projOf = code => (projects || []).find(p => p.code === code);
  const set = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));

  async function save() {
    setSaving(true); setMsg("");
    try {
      const out = {};
      rows.forEach(r => {
        if (!r.code.trim()) return;
        out[r.code.trim()] = {
          label: (r.label || "").trim(),
          displayName: (r.displayName || "").trim(),
          defaultLocation: (r.defaultLocation || "").trim(),
          defaultExaminer: (r.defaultExaminer || "").trim(),
          presets: (r.presetsText || "").split("\n").map(s => s.trim()).filter(Boolean),
        };
      });
      await setDoc(doc(db, "settings", "orProjects"), { projects: out, updatedAt: new Date().toISOString() });
      setMsg("✅ บันทึกแล้ว");
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  }

  const unused = (projects || []).filter(p => p.code && !rows.some(r => r.code === p.code));

  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>⚙ ตั้งค่าใบ OR ต่อโครงการ</div>
        <button onClick={onClose} style={{ ...BTN, marginLeft:"auto", background:"#f1f5f9", color:"#64748b", padding:"4px 10px" }}>ปิด</button>
      </div>
      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:12 }}>
        เติมอัตโนมัติตอนเลือกโครงการในฟอร์ม (แก้เองได้เสมอ) · รายละเอียดสำเร็จรูป 1 บรรทัด = 1 แบบ
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ border:"1px solid #f1f5f9", borderRadius:10, padding:12, marginBottom:10, background:"#fcfcfd" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#334155", marginBottom:8 }}>
            {r.label || cleanProjectName(projOf(r.code)?.name) || r.code}
            <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:6 }}>รหัส {r.code}</span>
            <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
              style={{ float:"right", background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:12 }}>ลบ</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={LB}>ชื่อย่อสำหรับใบ OR</label>
              <input style={IS} value={r.displayName || ""} placeholder={cleanProjectName(projOf(r.code)?.name) || "ว่าง = ใช้ชื่อโครงการ"}
                onChange={e => set(i, "displayName", e.target.value)} /></div>
            <div><label style={LB}>สถานที่เริ่มต้น</label>
              <input style={IS} value={r.defaultLocation || ""} onChange={e => set(i, "defaultLocation", e.target.value)} /></div>
            <div><label style={LB}>ผู้ตรวจสอบเริ่มต้น</label>
              <input style={IS} list="or-examiners" value={r.defaultExaminer || ""} onChange={e => set(i, "defaultExaminer", e.target.value)} /></div>
          </div>
          <label style={LB}>รายละเอียดสำเร็จรูป</label>
          <textarea style={{ ...IS, resize:"vertical" }} rows={Math.max(2, (r.presetsText || "").split("\n").length)}
            value={r.presetsText || ""} onChange={e => set(i, "presetsText", e.target.value)} />
        </div>
      ))}
      <datalist id="or-examiners">{EXAMINER_OPTS.map(o => <option key={o} value={o} />)}</datalist>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <select value={addCode} onChange={e => setAddCode(e.target.value)} style={{ ...IS, width:"auto", maxWidth:320 }}>
          <option value="">+ เพิ่มโครงการ...</option>
          {unused.map(p => <option key={p.id} value={p.code}>{p.code} · {cleanProjectName(p.name)}</option>)}
        </select>
        <button disabled={!addCode} onClick={() => { setRows(rs => [...rs, { code:addCode, label:"", displayName:"", defaultLocation:"", defaultExaminer:"", presetsText:"" }]); setAddCode(""); }}
          style={{ ...BTN, background:"#eff6ff", color:"#1d4ed8", opacity:addCode ? 1 : .5 }}>เพิ่ม</button>
        <button onClick={save} disabled={saving} style={{ ...BTN, marginLeft:"auto", background:"#F97316", color:"#fff" }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกค่าตั้ง"}
        </button>
        {msg && <span style={{ fontSize:12, color:msg.startsWith("✅") ? "#16a34a" : "#ef4444" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── คำนวณรายการที่ต้องแก้ (migrate ครั้งเดียว) ───────────────────────────
export function planMigration(records, { projects, orCfg, nameTH, uid }) {
  const sorted = records.slice().sort((a, b) => `${a.dateIn||""} ${a.timeIn||""}`.localeCompare(`${b.dateIn||""} ${b.timeIn||""}`));
  const rot = new Map(); // นับลำดับต่อโครงการที่มีรายละเอียดสำเร็จรูป
  const plan = [];
  for (const r of sorted) {
    const proj = (projects || []).find(p => p.id === r.projectId) || { code: r.projectCode, name: r.projectName };
    const s = orSettingsFor(proj, orCfg);
    const ch = {};
    if (nameTH && (r.name || "").trim() !== nameTH) ch.name = nameTH;
    const disp = orDisplayName(proj, orCfg);
    if (disp && (r.orProjectName || "") !== disp) ch.orProjectName = disp;
    if (s?.defaultExaminer && (r.examiner || "") !== s.defaultExaminer) ch.examiner = s.defaultExaminer;
    if (s?.defaultLocation && (r.location || "") !== s.defaultLocation) ch.location = s.defaultLocation;
    const ps = (s?.presets || []).filter(Boolean);
    if (ps.length) {
      const k = rot.get(s) || 0; rot.set(s, k + 1);
      const d = (r.desc || "").trim();
      const want = ps[k % ps.length];
      if ((d.length < 10 || ps.includes(d)) && d !== want) ch.desc = want;
    }
    if (!r.createdBy && uid) ch.createdBy = uid;
    if (Object.keys(ch).length) plan.push({ r, ch });
  }
  return plan;
}

const FIELD_TH = { name:"ผู้เข้าทำงาน", orProjectName:"ชื่อโครงการ (ใบ OR)", examiner:"ผู้ตรวจสอบ", location:"สถานที่", desc:"รายละเอียด", createdBy:"เจ้าของรายการ" };
const short = v => { const s = String(v ?? ""); return s.length > 48 ? s.slice(0, 48) + "…" : (s || "—"); };

export function ORMigrateModal({ plan, from, to, onConfirm, onClose, running }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:700, background:"rgba(15,23,42,.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:760, maxHeight:"88vh", overflowY:"auto", padding:24 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:4 }}>🛠 ปรับข้อมูลเก่าให้ตรงค่าตั้งใบ OR</div>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:14 }}>
          ช่วง {from || "—"} ถึง {to || "—"} · จะเปลี่ยน {plan.length} รายการ — ตรวจดูก่อน แล้วกดยืนยัน
        </div>
        {plan.length === 0 ? (
          <div style={{ textAlign:"center", color:"#94a3b8", padding:24, fontSize:13 }}>ข้อมูลตรงค่าตั้งแล้ว ไม่มีอะไรต้องเปลี่ยน</div>
        ) : plan.map(({ r, ch }) => (
          <div key={r.id} style={{ border:"1px solid #f1f5f9", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#334155", marginBottom:4 }}>
              {r.dateIn} {r.timeIn}-{r.timeOut} · {short(cleanProjectName(r.projectName))}
            </div>
            {Object.entries(ch).map(([k, v]) => (
              <div key={k} style={{ fontSize:11, color:"#475569", display:"grid", gridTemplateColumns:"110px 1fr", gap:6 }}>
                <span style={{ color:"#94a3b8" }}>{FIELD_TH[k] || k}</span>
                <span><s style={{ color:"#ef4444" }}>{short(r[k])}</s> → <b style={{ color:"#16a34a" }}>{k === "createdBy" ? "ฉัน" : short(v)}</b></span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:8, marginTop:12 }}>
          <button onClick={onClose} style={{ ...BTN, background:"#f8fafc", border:"1px solid #e2e8f0", color:"#475569", padding:10 }}>ยกเลิก</button>
          <button onClick={onConfirm} disabled={running || plan.length === 0}
            style={{ ...BTN, background:"#16a34a", color:"#fff", padding:10, opacity:(running || plan.length === 0) ? .5 : 1 }}>
            {running ? "กำลังบันทึก..." : `✅ ยืนยันเปลี่ยน ${plan.length} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
}
