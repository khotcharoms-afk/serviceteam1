import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import OTModal from "./OTModal.jsx";

export default function OTPage({ onBack, projects, users, currentUser }) {
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
  const isAdmin = currentUser?.role === "dev";

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
          });
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const u = onSnapshot(collection(db, "otRecords"), snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      data.sort((a,b) => (b.dateIn||"").localeCompare(a.dateIn||""));
      setRecords(data);
    });
    return u;
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    const uid = currentUser?.id || currentUser?.uid;
    await setDoc(doc(db,"otProfiles",uid), { ...profile, updatedAt: new Date().toISOString() });
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
  const myRecords = isAdmin ? records : records.filter(r => r.createdBy === currentUser?.id);
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
    setShowORDatePicker(true);
  }

  async function doExportAllOR() {
    const from = orDateFrom ? new Date(orDateFrom) : null;
    const to   = orDateTo   ? new Date(orDateTo)   : null;
    const exportRecords = myRecords.filter(r => {
      if (r.createdBy !== (currentUser?.id||currentUser?.uid)) return false;
      const d = new Date(r.dateIn||"");
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    }).sort((a,b)=>(a.dateIn||"").localeCompare(b.dateIn||""));
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

  const inputStyle = { border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",
    fontSize:12,fontFamily:"inherit",background:"#f8fafc",outline:"none" };

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>⏰ บันทึก OT</div>
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
          <button onClick={exportAllOR}
            style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",
              borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            🖨 Export ใบ OR
          </button>
          <button onClick={exportExcel}
            style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
              borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            📥 Export Excel
          </button>
          <button onClick={()=>{ setEditRecord(null); setShowModal(true); }}
            style={{ background:"#F97316",border:"none",color:"#fff",borderRadius:8,
              padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            + บันทึก OT
          </button>
        </div>
      </div>

      <div style={{ padding:isMobile?"12px 14px 48px":"16px 20px 48px",maxWidth:1100,margin:"0 auto" }}>

        {/* Tab bar */}
        <div style={{ display:"flex",gap:6,marginBottom:16,background:"#fff",border:"1px solid #e2e8f0",
          borderRadius:10,padding:6 }}>
          {[{key:"list",label:"📋 รายการ"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{ flex:1,padding:"7px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",
                background:tab===t.key?"#F97316":"transparent",
                color:tab===t.key?"#fff":"#64748b" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Period Section — แสดงเหนือ list เสมอ */}
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
          padding:"16px 20px",marginBottom:16 }}>
          <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:12 }}>รอบเบิก OT</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,alignItems:"end" }}>
            <div>
              <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>เดือนที่เบิก</div>
              <input value={profile.periodMonth||""} placeholder="เช่น กรกฎาคม"
                onChange={e=>setProfile(p=>({...p,periodMonth:e.target.value}))}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,
                  padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
            </div>
            <div>
              <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>วันที่เริ่ม</div>
              <input type="date"
                value={profile.periodStart
                  ? (profile.periodStart.includes("/")
                    ? (()=>{ const p=profile.periodStart.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; })()
                    : profile.periodStart)
                  : ""}
                onChange={e=>{
                  const val = e.target.value;
                  const MONTH_TH=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
                  const mo = val ? MONTH_TH[parseInt(val.slice(5,7))-1] : "";
                  const fmt = val ? `${val.slice(8,10)}/${val.slice(5,7)}/${val.slice(0,4)}` : "";
                  setProfile(p=>({...p, periodStart:fmt, periodMonth:mo||p.periodMonth}));
                }}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,
                  padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
            </div>
            <div>
              <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>วันที่สิ้นสุด</div>
              <input type="date"
                value={profile.periodEnd
                  ? (profile.periodEnd.includes("/")
                    ? (()=>{ const p=profile.periodEnd.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; })()
                    : profile.periodEnd)
                  : ""}
                onChange={e=>{
                  const val = e.target.value;
                  const fmt = val ? `${val.slice(8,10)}/${val.slice(5,7)}/${val.slice(0,4)}` : "";
                  setProfile(p=>({...p,periodEnd:fmt}));
                }}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,
                  padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
            </div>
          </div>
          <button onClick={saveProfile} disabled={profileSaving}
            style={{ marginTop:12,background:profileSaved?"#16a34a":"#F97316",border:"none",color:"#fff",
              borderRadius:8,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            {profileSaving?"กำลังบันทึก...":profileSaved?"✅ บันทึกแล้ว":"💾 บันทึกรอบเบิก"}
          </button>
        </div>

        {/* KPI */}
        {tab==="list" && <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:16 }}>
          {[
            { label:"รายการทั้งหมด", val:filtered.length, color:"#F97316" },
            { label:"ชั่วโมง OT รวม", val:`${totalHours} ชม.`, color:"#6B21A8" },
            { label:"เฉลี่ยต่อครั้ง", val:`${filtered.length>0?(totalHours/filtered.length).toFixed(1):0} ชม.`, color:"#16a34a" },
          ].map(k=>(
            <div key={k.label} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px" }}>
              <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:20,fontWeight:800,color:k.color }}>{k.val}</div>
            </div>
          ))}
        </div>}

        {/* Filters — เฉพาะ tab รายการ */}
        {tab==="list" && <>
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
          padding:"12px 16px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          {isAdmin && (
            <select value={filterName} onChange={e=>setFilterName(e.target.value)} style={inputStyle}>
              <option value="all">ทุกคน</option>
              {names.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={inputStyle}>
            <option value="">ทุกเดือน</option>
            {months.map(m=><option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
          {(filterName!=="all"||filterMonth) && (
            <button onClick={()=>{ setFilterName("all"); setFilterMonth(""); }}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
              ล้าง
            </button>
          )}
        </div>

        {/* Records */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center",color:"#cbd5e1",padding:48,fontSize:14 }}>
            ยังไม่มีข้อมูล OT
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {filtered.map(r => {
              const proj = projects.find(p=>p.id===r.projectId);
              return (
                <div key={r.id} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
                  padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start" }}>
                  <div style={{ width:44,height:44,borderRadius:10,background:"#fff7ed",
                    border:"1px solid #fed7aa",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:20,flexShrink:0 }}>⏰</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{r.name}</span>
                      <span style={{ fontSize:13,fontWeight:700,color:"#F97316" }}>{r.hours} ชม.</span>
                    </div>
                    {proj && (
                      <div style={{ fontSize:12,color:"#64748b",display:"flex",alignItems:"center",gap:5,marginBottom:3 }}>
                        <span style={{ width:8,height:8,borderRadius:"50%",background:proj.color||"#94a3b8" }}/>
                        {proj.name}
                      </div>
                    )}
                    <div style={{ fontSize:12,color:"#475569",marginBottom:3 }}>{r.desc}</div>
                    <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                      <span style={{ fontSize:11,color:"#94a3b8" }}>📅 {fmtDate(r.dateIn)} {r.timeIn} - {r.timeOut}</span>
                      {r.location && <span style={{ fontSize:11,color:"#94a3b8" }}>📍 {r.location}</span>}
                      <span style={{ fontSize:11,color:"#94a3b8" }}>{r.remark}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                    <button onClick={()=>exportOR(r)}
                      style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
                        borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>🖨</button>
                    <button onClick={()=>{ setEditRecord(r); setShowModal(true); }}
                      style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                        borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>✏️</button>
                    {isAdmin && (
                      <button onClick={()=>setConfirmId(r.id)}
                        style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                          borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>🗑</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}
      </div>

      {/* Confirm delete */}
      {confirmId && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:16,padding:24,maxWidth:320,width:"100%",
            textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:32,marginBottom:12 }}>🗑</div>
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:8 }}>ลบรายการ OT นี้?</div>
            <div style={{ fontSize:13,color:"#64748b",marginBottom:20 }}>ไม่สามารถกู้คืนได้</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <button onClick={()=>setConfirmId(null)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={()=>deleteOT(confirmId)}
                style={{ background:"#ef4444",border:"none",color:"#fff",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {showORDatePicker && (
        <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={()=>setShowORDatePicker(false)}>
          <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:380,
            padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:16 }}>🖨 Export ใบ OR — เลือกช่วงวันที่</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
              <div>
                <label style={{ fontSize:11,color:"#94a3b8",fontWeight:700,display:"block",marginBottom:4 }}>ตั้งแต่วันที่</label>
                <input type="date" value={orDateFrom} onChange={e=>setOrDateFrom(e.target.value)}
                  style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",
                    fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
              </div>
              <div>
                <label style={{ fontSize:11,color:"#94a3b8",fontWeight:700,display:"block",marginBottom:4 }}>ถึงวันที่</label>
                <input type="date" value={orDateTo} onChange={e=>setOrDateTo(e.target.value)}
                  style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",
                    fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
              <button onClick={()=>setShowORDatePicker(false)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={doExportAllOR}
                style={{ background:"#1d4ed8",border:"none",color:"#fff",
                  borderRadius:10,padding:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                🖨 Export ใบ OR
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <OTModal onClose={()=>{ setShowModal(false); setEditRecord(null); }}
          onSave={saveOT} saving={saving}
          projects={projects} users={users} currentUser={currentUser}
          editRecord={editRecord} profile={profile}/>
      )}
    </div>
  );
}
