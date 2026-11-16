import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc, query, where } from "firebase/firestore";
import OTModal from "./OTModal.jsx";
import { useTheme } from "./theme.js";
import { ORSettingsPanel, ORMigrateModal, planMigration } from "./ORSettingsPanel.jsx";

export default function OTPage({ onBack, projects, users, currentUser }) {
  const { c } = useTheme();
  const [tab, setTab]           = useState("list");
  const [records, setRecords]   = useState([]);
  const [profile, setProfile]   = useState({ nameTH:"", periodStart:"", periodEnd:"", periodMonth:"" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  const [filterName, setFilterName] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [showORDatePicker, setShowORDatePicker] = useState(false);
  const [orDateFrom, setOrDateFrom] = useState("");
  const [orDateTo, setOrDateTo]     = useState("");
  const isAdmin = false; // ทุกคน รวม admin/dev เห็นเฉพาะ OT ของตัวเอง
  const canEditORSettings = ["admin","dev"].includes(currentUser?.role);
  const [orCfg, setOrCfg] = useState(null);
  const [showORSettings, setShowORSettings] = useState(false);
  const [migratePlan, setMigratePlan] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const uid = currentUser?.id || currentUser?.uid;

  useEffect(() => onSnapshot(doc(db,"settings","orProjects"),
    d => setOrCfg(d.exists() ? (d.data().projects || null) : null), () => {}), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // โหลด profile ของ user นี้
    const uid = currentUser?.id || currentUser?.uid;
    if (uid) {
      getDoc(doc(db,"otProfiles",uid)).then(d => {
        if (d.exists()) {
          const data = d.data();
          setProfile({
            nameTH: data.nameTH||"",
            empId: data.empId||"",
            position: data.position||"",
            dept: data.dept||"",
            division: data.division||"",
            supervisor: data.supervisor||"",
            supervisorOT: data.supervisorOT||"",
            staff: data.staff||"",
            periodStart: data.periodStart||"",
            periodEnd: data.periodEnd||"",
            periodMonth: data.periodMonth||"",
            signatures: Array.isArray(data.signatures) ? data.signatures : [],
          });
        }
      });
    }
  }, [currentUser]);

  // ดึงเฉพาะ OT ของตัวเอง (createdBy = uid) + รายการเก่าที่ยังไม่มีเจ้าของ (createdBy = "")
  // ต้อง query แบบมีเงื่อนไข เพราะ Firestore rules อนุญาตให้อ่านเฉพาะรายการเหล่านี้
  useEffect(() => {
    if (!uid) return;
    const parts = { mine: [], orphan: [], all: [] };
    const push = () => {
      const m = new Map();
      [...parts.all, ...parts.mine, ...parts.orphan].forEach(r => m.set(r.id, r));
      const data = [...m.values()].sort((a,b) => (b.dateIn||"").localeCompare(a.dateIn||""));
      setRecords(data);
    };
    const sub = (key, q) => onSnapshot(q, snap => {
      parts[key] = snap.docs.map(d => ({ id:d.id, ...d.data() })); push();
    }, err => console.error("otRecords", key, err));
    // ใช้ query แบบมีเงื่อนไขเสมอ (ผ่าน rules ทุกแบบ)
    const u1 = sub("mine",   query(collection(db, "otRecords"), where("createdBy", "==", uid)));
    const u2 = sub("orphan", query(collection(db, "otRecords"), where("createdBy", "==", "")));
    // admin/dev: ลองอ่านทั้งหมดเพิ่ม (ถ้า rules อนุญาต) เพื่อเก็บรายการเก่าที่ชื่อเป็นของเราแต่ createdBy ไม่ตรง
    // ถ้า rules ไม่อนุญาตก็แค่ข้าม ไม่กระทบ 2 query ข้างบน
    let u3 = () => {};
    if (["admin","dev"].includes(currentUser?.role)) {
      u3 = onSnapshot(collection(db, "otRecords"), snap => {
        parts.all = snap.docs.map(d => ({ id:d.id, ...d.data() })); push();
      }, () => { parts.all = []; push(); });
    }
    return () => { u1(); u2(); u3(); };
  }, [uid, currentUser?.role]);

  async function saveProfile() {
    setProfileSaving(true);
    const uid = currentUser?.id || currentUser?.uid;
    const { signatures, ...rest } = profile; // ลายเซ็นแก้ที่หน้าโปรไฟล์เท่านั้น
    await setDoc(doc(db,"otProfiles",uid), { ...rest, updatedAt: new Date().toISOString() }, { merge:true });
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function saveOT(data, id) {
    setSaving(true);
    try {
      const docId = id || Date.now().toString();
      await setDoc(doc(db, "otRecords", docId), data, { merge: true });
      setShowModal(false);
      setEditRecord(null);
    } catch(err) {
      alert("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOT(id) {
    await deleteDoc(doc(db, "otRecords", id));
    setConfirmId(null);
  }

  // filter
  const myRecords = records.filter(r => r.createdBy === uid || [profile.nameTH, currentUser?.name].map(n=>(n||"").trim()).filter(Boolean).includes((r.name||"").trim()));
  const filtered = myRecords.filter(r => {
    if (filterName !== "all" && r.name !== filterName) return false;
    if (filterMonth && !(r.dateIn||"").startsWith(filterMonth)) return false;
    return true;
  });
  const names = [...new Set(myRecords.map(r=>r.name).filter(Boolean))].sort();
  const totalHours = filtered.reduce((s,r) => s+(r.hours||0), 0);

  // months list
  const months = [...new Set(myRecords.map(r=>(r.dateIn||"").slice(0,7)).filter(Boolean))].sort().reverse();
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const fmtMonth = m => { const [y,mo]=m.split("-"); return `${MONTH_TH[parseInt(mo)-1]} ${(parseInt(y)+543)%100}`; };
  const fmtDate = d => { if(!d) return ""; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${parseInt(y)+543}`; };

  async function exportOR(r) {
    if (!profile.nameTH?.trim()) {
      alert("กรุณาตั้งค่าข้อมูล OT ในโปรไฟล์ก่อน (tab 👤 โปรไฟล์)");
      setTab("profile");
      return;
    }
    try {
      const res = await fetch("/api/generate-or", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: r, profile }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OR_${r.dateIn||"date"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      alert("Export ใบ OR ไม่สำเร็จ: " + err.message);
    }
  }

  async function exportAllOR() {
    if (!profile.nameTH?.trim()) {
      alert("กรุณาตั้งค่าข้อมูล OT ในโปรไฟล์ก่อน (tab 👤 โปรไฟล์)");
      setTab("profile");
      return;
    }
    const iso = v => !v ? "" : v.includes("/") ? (([d,m,y])=>`${y}-${m}-${d}`)(v.split("/")) : v;
    if (!orDateFrom && profile.periodStart) setOrDateFrom(iso(profile.periodStart));
    if (!orDateTo && profile.periodEnd) setOrDateTo(iso(profile.periodEnd));
    setShowORDatePicker(true);
  }

  // รายการของผู้ใช้คนนี้: createdBy ตรง หรือชื่อผู้เข้าทำงานตรง (กันรายการที่ createdBy หาย/ถูกเขียนทับ)
  const myNames = [profile.nameTH, currentUser?.name].map(n=>(n||"").trim()).filter(Boolean);
  const isMine = r => r.createdBy === uid || myNames.includes((r.name||"").trim());
  const ownRecords = records.filter(isMine);
  const inRange = r => {
    const d = (r.dateIn||"").slice(0,10);   // เทียบเป็น string YYYY-MM-DD ไม่แปลงเป็น Date (กันปัญหา timezone)
    if (orDateFrom && d < orDateFrom) return false;
    if (orDateTo   && d > orDateTo)   return false;
    return true;
  };

  function openMigrate() {
    const plan = planMigration(ownRecords.filter(inRange), { projects, orCfg, nameTH: profile.nameTH?.trim(), uid });
    setMigratePlan(plan);
  }
  async function runMigrate() {
    setMigrating(true);
    try {
      for (const { r, ch } of migratePlan) await updateDoc(doc(db,"otRecords",r.id), ch);
      setMigratePlan(null);
    } catch(err) { alert("ปรับข้อมูลไม่สำเร็จ: " + err.message); }
    setMigrating(false);
  }

  async function doExportAllOR() {
    const exportRecords = ownRecords.filter(inRange)
      .sort((a,b)=>`${a.dateIn||""} ${a.timeIn||""}`.localeCompare(`${b.dateIn||""} ${b.timeIn||""}`));
    if (exportRecords.length === 0) { alert("ไม่มีรายการในช่วงวันที่นี้"); return; }
    setShowORDatePicker(false);
    try {
      const res = await fetch("/api/generate-or", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: exportRecords, profile }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OR_${profile.nameTH||"export"}_${orDateFrom||"all"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      alert("Export ใบ OR ไม่สำเร็จ: " + err.message);
    }
  }

  async function exportExcel() {
    const exportRecords = filtered.length > 0 ? filtered : myRecords;
    if (exportRecords.length === 0) return;
    if (!profile.nameTH?.trim()) {
      alert("กรุณาตั้งค่าข้อมูล OT ในโปรไฟล์ก่อน (tab 👤 โปรไฟล์)");
      setTab("profile");
      return;
    }
    try {
      const res = await fetch("/api/generate-ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          records: exportRecords,
          periodMonth: filterMonth || (exportRecords[0]?.dateIn||"").slice(0,7) || "",
        }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OT_${profile.nameTH||"export"}_${filterMonth||"all"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      alert("Export ไม่สำเร็จ: " + err.message);
    }
  }

  // ── สไตล์จาก theme (รองรับโหมดมืด) ──
  const ctl = { height:32,border:`1px solid ${c.border}`,borderRadius:8,padding:"0 12px",
    fontSize:13,fontFamily:"inherit",background:c.card,color:c.text900,outline:"none" };
  const field = { ...ctl, width:"100%", height:36 };
  const lbl = { fontSize:12,color:c.text500,fontWeight:500,marginBottom:8,display:"block" };
  const btnOutline = { background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,height:32,
    padding:"0 12px",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap" };
  const btnPrimary = { ...btnOutline, background:c.ink, border:"none", color:c.onInk };
  const btnGhost = { ...btnOutline, background:"transparent", border:"none", color:c.text500 };
  const card = { background:c.card,border:`1px solid ${c.border}`,borderRadius:8 };
  const toInput = v => !v ? "" : v.includes("/") ? (()=>{ const p=v.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; })() : v;

  return (
    <div style={{ minHeight:"100vh",background:c.bg,color:c.text900 }}>

      {/* Header */}
      <div style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:isMobile?"0 12px":"0 24px",height:56,
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={btnGhost}>← กลับ</button>
        <span style={{ width:1,height:16,background:c.border }}/>
        <div style={{ fontSize:15,fontWeight:600 }}>บันทึก OT</div>
        <div style={{ marginLeft:"auto",display:"flex",gap:8,overflowX:"auto" }}>
          {canEditORSettings && !isMobile && (
            <button onClick={()=>setShowORSettings(v=>!v)} style={btnGhost}>ตั้งค่าใบ OR</button>
          )}
          <button onClick={exportAllOR} style={btnOutline}>{isMobile?"ใบ OR":"Export ใบ OR"}</button>
          <button onClick={exportExcel} style={btnOutline}>{isMobile?"Excel":"Export หน้าปก Excel"}</button>
          <button onClick={()=>{ setEditRecord(null); setShowModal(true); }} style={btnPrimary}>+ บันทึก OT</button>
        </div>
      </div>

      <div style={{ padding:isMobile?"16px 12px 48px":"24px 24px 48px",maxWidth:1100,margin:"0 auto" }}>

        {showORSettings && canEditORSettings && <ORSettingsPanel key={JSON.stringify(orCfg)} orCfg={orCfg} projects={projects} onClose={()=>setShowORSettings(false)}/>}

        {/* รอบเบิก */}
        <div style={{ ...card,padding:16,marginBottom:16 }}>
          <div style={{ display:"flex",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:14,fontWeight:600 }}>รอบเบิก OT</div>
            <span style={{ fontSize:12,color:c.text500,marginLeft:8 }}>ใช้กับหน้าปก Excel และช่วงวันที่ของใบ OR</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr auto",gap:12,alignItems:"end" }}>
            <div style={{ gridColumn:isMobile?"1 / -1":"auto" }}>
              <label style={lbl}>เดือนที่เบิก</label>
              <input value={profile.periodMonth||""} placeholder="เช่น พฤศจิกายน"
                onChange={e=>setProfile(p=>({...p,periodMonth:e.target.value}))} style={field}/>
            </div>
            <div>
              <label style={lbl}>วันที่เริ่ม</label>
              <input type="date" value={toInput(profile.periodStart)}
                onChange={e=>{
                  const val = e.target.value;
                  const MONTH_TH=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
                  const mo = val ? MONTH_TH[parseInt(val.slice(5,7))-1] : "";
                  const fmt = val ? `${val.slice(8,10)}/${val.slice(5,7)}/${val.slice(0,4)}` : "";
                  setProfile(p=>({...p, periodStart:fmt, periodMonth:mo||p.periodMonth}));
                }} style={field}/>
            </div>
            <div>
              <label style={lbl}>วันที่สิ้นสุด</label>
              <input type="date" value={toInput(profile.periodEnd)}
                onChange={e=>{
                  const val = e.target.value;
                  const fmt = val ? `${val.slice(8,10)}/${val.slice(5,7)}/${val.slice(0,4)}` : "";
                  setProfile(p=>({...p,periodEnd:fmt}));
                }} style={field}/>
            </div>
            <button onClick={saveProfile} disabled={profileSaving}
              style={{ ...(profileSaved?btnOutline:btnPrimary),height:36,gridColumn:isMobile?"1 / -1":"auto",justifyContent:"center",
                color:profileSaved?c.ok:(btnPrimary.color) }}>
              {profileSaving?"กำลังบันทึก...":profileSaved?"บันทึกแล้ว ✓":"บันทึกรอบเบิก"}
            </button>
          </div>
        </div>

        {/* ตัวเลขสรุป */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:isMobile?8:16,marginBottom:16 }}>
          {[
            { label:"รายการ", val:filtered.length, unit:"ครั้ง" },
            { label:"ชั่วโมง OT รวม", val:totalHours, unit:"ชม." },
            { label:"เฉลี่ยต่อครั้ง", val:filtered.length>0?(totalHours/filtered.length).toFixed(1):0, unit:"ชม." },
          ].map(k=>(
            <div key={k.label} style={{ ...card,padding:isMobile?12:16 }}>
              <div style={{ fontSize:12,color:c.text500 }}>{k.label}</div>
              <div style={{ marginTop:8,display:"flex",alignItems:"baseline",gap:4 }}>
                <span style={{ fontSize:isMobile?20:24,fontWeight:600,letterSpacing:"-0.02em",lineHeight:1 }}>{k.val}</span>
                <span style={{ fontSize:13,color:c.text500 }}>{k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ตัวกรอง */}
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12 }}>
          <div style={{ fontSize:14,fontWeight:600,marginRight:"auto" }}>
            รายการ OT <span style={{ color:c.text400,fontWeight:400 }}>{filtered.length}</span>
          </div>
          {isAdmin && (
            <select value={filterName} onChange={e=>setFilterName(e.target.value)} style={ctl}>
              <option value="all">ทุกคน</option>
              {names.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ ...ctl,minWidth:140 }}>
            <option value="">ทุกเดือน</option>
            {months.map(m=><option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
          {(filterName!=="all"||filterMonth) && (
            <button onClick={()=>{ setFilterName("all"); setFilterMonth(""); }} style={btnGhost}>ล้าง</button>
          )}
        </div>

        {/* รายการ */}
        {filtered.length === 0 ? (
          <div style={{ ...card,border:`1px dashed ${c.border}`,borderRadius:12,textAlign:"center",color:c.text500,padding:48,fontSize:14 }}>
            ยังไม่มีข้อมูล OT
            <div style={{ marginTop:16 }}>
              <button onClick={()=>{ setEditRecord(null); setShowModal(true); }} style={btnPrimary}>+ บันทึก OT แรก</button>
            </div>
          </div>
        ) : (
          <div style={{ ...card,overflow:"hidden" }}>
            {filtered.map((r,i) => {
              const proj = projects.find(p=>p.id===r.projectId);
              const projName = r.orProjectName || proj?.name || r.projectName || "";
              return (
                <div key={r.id} style={{ padding:isMobile?12:16,display:"flex",gap:16,alignItems:"flex-start",
                  borderTop:i>0?`1px solid ${c.border}`:"none" }}>
                  {/* วันที่ */}
                  <div style={{ width:isMobile?72:84,flexShrink:0 }}>
                    <div style={{ fontSize:13,fontWeight:600 }}>{fmtDate(r.dateIn)}</div>
                    <div style={{ fontSize:12,color:c.text500,marginTop:4 }}>{r.timeIn}–{r.timeOut}</div>
                  </div>
                  {/* รายละเอียด */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,minWidth:0 }}>
                      {proj && <span style={{ width:6,height:6,borderRadius:"50%",background:proj.color||c.text400,flexShrink:0 }}/>}
                      <span style={{ fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{projName || "ไม่ระบุโครงการ"}</span>
                    </div>
                    {r.desc && <div style={{ fontSize:13,color:c.text500,marginTop:4,lineHeight:1.5,
                      overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{r.desc}</div>}
                    <div style={{ fontSize:12,color:c.text400,marginTop:4,display:"flex",gap:12,flexWrap:"wrap" }}>
                      {r.location && <span>{r.location}</span>}
                      {r.examiner && <span>ผู้ตรวจสอบ {r.examiner}</span>}
                      {r.remark && <span>{r.remark}</span>}
                    </div>
                  </div>
                  {/* ชั่วโมง + ปุ่ม */}
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0 }}>
                    <span style={{ fontSize:14,fontWeight:600,color:c.ink }}>{r.hours} ชม.</span>
                    <div style={{ display:"flex",gap:4 }}>
                      <button onClick={()=>exportOR(r)} title="Export ใบ OR ของรายการนี้" style={{ ...btnGhost,height:28,padding:"0 8px",fontSize:12 }}>ใบ OR</button>
                      <button onClick={()=>{ setEditRecord(r); setShowModal(true); }} style={{ ...btnGhost,height:28,padding:"0 8px",fontSize:12 }}>แก้ไข</button>
                      {(isAdmin || r.createdBy === uid) && (
                        <button onClick={()=>setConfirmId(r.id)} style={{ ...btnGhost,height:28,padding:"0 8px",fontSize:12,color:c.danger }}>ลบ</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmId && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ ...card,borderRadius:12,padding:24,maxWidth:340,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,.16)" }}>
            <div style={{ fontSize:16,fontWeight:600,marginBottom:8 }}>ลบรายการ OT นี้?</div>
            <div style={{ fontSize:13,color:c.text500,marginBottom:24 }}>ลบแล้วกู้คืนไม่ได้</div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <button onClick={()=>setConfirmId(null)} style={{ ...btnOutline,height:36 }}>ยกเลิก</button>
              <button onClick={()=>deleteOT(confirmId)} style={{ ...btnPrimary,height:36,background:c.danger,color:"#fff" }}>ลบ</button>
            </div>
          </div>
        </div>
      )}

      {showORDatePicker && (
        <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={()=>setShowORDatePicker(false)}>
          <div style={{ ...card,borderRadius:12,width:"100%",maxWidth:400,padding:24,boxShadow:"0 16px 48px rgba(0,0,0,.16)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:16,fontWeight:600,marginBottom:4 }}>Export ใบ OR</div>
            <div style={{ fontSize:13,color:c.text500,marginBottom:20 }}>เลือกช่วงวันที่ — 1 รายการ = 1 หน้า</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
              <div>
                <label style={lbl}>ตั้งแต่วันที่</label>
                <input type="date" value={orDateFrom} onChange={e=>setOrDateFrom(e.target.value)} style={field}/>
              </div>
              <div>
                <label style={lbl}>ถึงวันที่</label>
                <input type="date" value={orDateTo} onChange={e=>setOrDateTo(e.target.value)} style={field}/>
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <button onClick={()=>setShowORDatePicker(false)} style={{ ...btnOutline,height:36 }}>ยกเลิก</button>
              <button onClick={doExportAllOR} style={{ ...btnPrimary,height:36 }}>
                Export {ownRecords.filter(inRange).length} หน้า
              </button>
            </div>
            <div style={{ borderTop:`1px solid ${c.border}`,marginTop:20,paddingTop:16 }}>
              <button onClick={openMigrate} style={{ ...btnGhost,padding:0,height:"auto",color:c.text900,textDecoration:"underline" }}>
                ปรับข้อมูลเก่าในช่วงนี้ให้ตรงค่าตั้งใบ OR
              </button>
              <div style={{ fontSize:12,color:c.text500,marginTop:4 }}>แสดงรายการที่จะเปลี่ยนให้ดูก่อนยืนยัน</div>
              {!(profile.signatures||[]).length && (
                <div style={{ marginTop:8,fontSize:12,color:c.warn }}>ยังไม่มีลายเซ็น — อัปโหลดได้ที่ โปรไฟล์ → ข้อมูล OT</div>
              )}
            </div>
          </div>
        </div>
      )}

      {migratePlan && (
        <ORMigrateModal plan={migratePlan} from={orDateFrom} to={orDateTo} running={migrating}
          onConfirm={runMigrate} onClose={()=>setMigratePlan(null)}/>
      )}

      {showModal && (
        <OTModal onClose={()=>{ setShowModal(false); setEditRecord(null); }}
          onSave={saveOT} saving={saving}
          projects={projects} users={users} currentUser={currentUser}
          editRecord={editRecord} profile={profile} orCfg={orCfg} myRecords={ownRecords}/>
      )}
    </div>
  );
}
