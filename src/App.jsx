import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, writeBatch
} from "firebase/firestore";

// ── Constants ─────────────────────────────────────────────────
const WARRANTY_OPTS = [
  { value: "none", label: "ไม่มีประกัน", color: "#94a3b8", years: 0 },
  { value: "1yr",  label: "ประกัน 1 ปี", color: "#3b82f6", years: 1 },
  { value: "3yr",  label: "ประกัน 3 ปี", color: "#8b5cf6", years: 3 },
  { value: "5yr",  label: "ประกัน 5 ปี", color: "#10b981", years: 5 },
];

const STATUS_OPTS = [
  { value: "open",       label: "เปิดเคส",        color: "#f59e0b", bg: "#fef3c7" },
  { value: "inprogress", label: "กำลังดำเนินการ",  color: "#3b82f6", bg: "#dbeafe" },
  { value: "done",       label: "เสร็จสิ้น",       color: "#10b981", bg: "#d1fae5" },
  { value: "hold",       label: "รอดำเนินการ",     color: "#ef4444", bg: "#fee2e2" },
];

const SERVICE_TYPES = [
  "ติดตั้งอุปกรณ์","เปลี่ยนอุปกรณ์","ซ่อมบำรุง","ตรวจสอบระบบ",
  "Config / Setup","อัปเกรด","เดินสาย","ทดสอบระบบ","อบรม","อื่นๆ",
];

const COLOR_OPTS = ["#3b82f6","#8b5cf6","#10b981","#f97316","#ec4899","#f59e0b"];

const today = () => new Date().toISOString().slice(0, 10);
const addYears = (dateStr, yrs) => {
  if (!dateStr || !yrs) return null;
  const d = new Date(dateStr); d.setFullYear(d.getFullYear() + yrs);
  return d.toISOString().slice(0, 10);
};
const daysLeft = (endStr) => {
  if (!endStr) return null;
  return Math.ceil((new Date(endStr) - new Date()) / 86400000);
};
const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const emptyCase = { projectId:"", site:"", title:"", type:SERVICE_TYPES[0], tech:"", date:today(), warranty:"none", status:"open", note:"" };

// ── Style helper ──────────────────────────────────────────────
const IS = (x={}) => ({
  width:"100%", background:"#ffffff", border:"1px solid #e2e8f0",
  borderRadius:8, color:"#1e293b", padding:"9px 13px", fontSize:13,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  transition:"border-color .15s", ...x,
});

// ── UI Components ─────────────────────────────────────────────
function WarrantyPill({ warranty, warrantyEnd }) {
  const opt = WARRANTY_OPTS.find(w => w.value === warranty) || WARRANTY_OPTS[0];
  const days = daysLeft(warrantyEnd);
  const expired = days !== null && days < 0;
  const warn = days !== null && days >= 0 && days <= 90;
  const col = expired ? "#ef4444" : warn ? "#f59e0b" : opt.color;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      background:col+"18", color:col, border:`1px solid ${col}40`,
      borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col }}/>
      {opt.label}
      {expired && " (หมดแล้ว)"}
      {!expired && warn && days !== null && ` (เหลือ ${days} วัน)`}
    </span>
  );
}

function StatusPill({ value }) {
  const s = STATUS_OPTS.find(x => x.value === value) || STATUS_OPTS[0];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      background:s.bg, color:s.color, borderRadius:20,
      padding:"3px 10px", fontSize:11, fontWeight:700 }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:s.color }}/>
      {s.label}
    </span>
  );
}

function Modal({ open, onClose, title, wide, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,.45)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center" }}
      onClick={onClose}>
      <div style={{ background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:16,
        padding:"28px 28px",width:wide?"720px":"480px",maxWidth:"96vw",maxHeight:"92vh",
        overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.12)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
          <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:"#0f172a" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",
            color:"#64748b",cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, span, children }) {
  return (
    <div style={{ gridColumn:span?`span ${span}`:"span 1", marginBottom:14 }}>
      <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5,letterSpacing:.3 }}>{label}</div>
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, children, style={} }) {
  return (
    <button onClick={onClick} style={{ background:"#2563eb",border:"none",color:"#fff",
      borderRadius:9,padding:"10px 22px",fontSize:13,fontWeight:600,cursor:"pointer",
      fontFamily:"inherit",transition:"background .15s",...style }}
      onMouseEnter={e=>e.currentTarget.style.background="#1d4ed8"}
      onMouseLeave={e=>e.currentTarget.style.background="#2563eb"}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
      color:"#475569",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:600,
      cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}
      onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
      onMouseLeave={e=>e.currentTarget.style.background="#f8fafc"}>
      {children}
    </button>
  );
}

function SideItem({ active, onClick, icon, label, count, color }) {
  return (
    <button onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
      width:"100%",background:active?color+"15":"transparent",
      border:active?`1px solid ${color}30`:"1px solid transparent",
      borderRadius:8,padding:"8px 10px",cursor:"pointer",fontFamily:"inherit",
      marginBottom:2,textAlign:"left",transition:"all .15s" }}>
      <span style={{ display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0 }}>
        <span style={{ fontSize:9,color:active?color:"#cbd5e1",flexShrink:0 }}>{icon}</span>
        <span style={{ fontSize:13,color:active?"#0f172a":"#64748b",fontWeight:active?600:400,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
      </span>
      <span style={{ fontSize:11,background:active?color+"15":"#f1f5f9",borderRadius:20,
        padding:"1px 8px",color:active?color:"#94a3b8",flexShrink:0,marginLeft:4,fontWeight:600 }}>{count}</span>
    </button>
  );
}

function MiniBtn({ onClick, red, children }) {
  return (
    <button onClick={onClick}
      style={{ background:"#f8fafc",border:`1px solid ${red?"#fecaca":"#e2e8f0"}`,
        color:red?"#ef4444":"#94a3b8",borderRadius:7,padding:"5px 9px",
        cursor:"pointer",fontSize:12,transition:"all .15s" }}
      onMouseEnter={e=>{ e.currentTarget.style.background=red?"#fee2e2":"#f1f5f9"; e.currentTarget.style.color=red?"#dc2626":"#475569"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.color=red?"#ef4444":"#94a3b8"; }}>
      {children}
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState([]);
  const [cases,    setCases]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [view,       setView]       = useState("overview");
  const [filterStat, setFilterStat] = useState("all");
  const [filterWar,  setFilterWar]  = useState("all");
  const [search,     setSearch]     = useState("");

  const [caseModal,    setCaseModal]    = useState(false);
  const [editCase,     setEditCase]     = useState(null);
  const [detailCase,   setDetailCase]   = useState(null);
  const [delCase,      setDelCase]      = useState(null);
  const [projModal,    setProjModal]    = useState(false);
  const [editProjId,   setEditProjId]   = useState(null);
  const [delProj,      setDelProj]      = useState(null);
  const [caseForm,     setCaseForm]     = useState(emptyCase);
  const [newProjName,  setNewProjName]  = useState("");
  const [newProjColor, setNewProjColor] = useState(COLOR_OPTS[0]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"projects"), snap => {
      setProjects(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db,"cases"), snap => {
      setCases(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return () => { u1(); u2(); };
  }, []);

  const activeProj = projects.find(p=>p.id===view)||null;

  const visibleCases = cases.filter(c => {
    if (view!=="overview" && c.projectId!==view) return false;
    if (filterStat!=="all" && c.status!==filterStat) return false;
    if (filterWar!=="all"  && c.warranty!==filterWar) return false;
    const q=search.toLowerCase();
    return !q||[c.title,c.type,c.tech,c.site,c.note].some(x=>x?.toLowerCase().includes(q));
  });

  function openAddCase() {
    const pid = view!=="overview" ? view : (projects[0]?.id||"");
    setCaseForm({...emptyCase, projectId:pid});
    setEditCase(null); setCaseModal(true);
  }
  function openEditCase(c) { setCaseForm({...c}); setEditCase(c.id); setCaseModal(true); }

  async function submitCase() {
    if (!caseForm.title||!caseForm.projectId) return;
    const w = WARRANTY_OPTS.find(x=>x.value===caseForm.warranty);
    const warrantyEnd = addYears(caseForm.date, w?.years||0);
    const payload = {...caseForm, warrantyEnd: warrantyEnd||null};
    await setDoc(doc(db,"cases", editCase||Date.now().toString()), payload);
    setCaseModal(false); setEditCase(null);
  }

  async function deleteCase(id) {
    await deleteDoc(doc(db,"cases",id));
    setDelCase(null); setDetailCase(null);
  }

  function openAddProj()   { setEditProjId(null); setNewProjName(""); setNewProjColor(COLOR_OPTS[0]); setProjModal(true); }
  function openEditProj(p) { setEditProjId(p.id); setNewProjName(p.name); setNewProjColor(p.color); setProjModal(true); }

  async function submitProj() {
    const name=newProjName.trim(); if(!name) return;
    const id=editProjId||Date.now().toString();
    await setDoc(doc(db,"projects",id),{name,color:newProjColor});
    setNewProjName(""); setEditProjId(null); setProjModal(false);
  }

  async function removeProj(pid) {
    const batch=writeBatch(db);
    batch.delete(doc(db,"projects",pid));
    cases.filter(c=>c.projectId===pid).forEach(c=>batch.delete(doc(db,"cases",c.id)));
    await batch.commit();
    if(view===pid) setView("overview");
    setDelProj(null);
  }

  const scopeCases = view==="overview" ? cases : cases.filter(c=>c.projectId===view);
  const stats = {
    total:       scopeCases.length,
    open:        scopeCases.filter(c=>c.status==="open").length,
    inprogress:  scopeCases.filter(c=>c.status==="inprogress").length,
    done:        scopeCases.filter(c=>c.status==="done").length,
    hold:        scopeCases.filter(c=>c.status==="hold").length,
    warranty:    scopeCases.filter(c=>c.warranty!=="none").length,
    expiringSoon:scopeCases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length,
  };

  if (loading) return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",display:"flex",
      alignItems:"center",justifyContent:"center",color:"#94a3b8",
      fontFamily:"'Noto Sans Thai',sans-serif",fontSize:14 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32,marginBottom:12,color:"#2563eb" }}>◈</div>
        กำลังโหลดข้อมูล...
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",
      fontFamily:"'Noto Sans Thai','Sora',sans-serif",color:"#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
        input::placeholder,textarea::placeholder{color:#cbd5e1}
        select option{background:#fff}
        input:focus,select:focus,textarea:focus{border-color:#93c5fd !important;box-shadow:0 0 0 3px #dbeafe}
        .rh:hover{background:#f8fafc !important}
        .case-card:hover{border-color:#93c5fd !important;box-shadow:0 4px 16px rgba(59,130,246,.08) !important}
      `}</style>

      <div style={{ display:"flex",minHeight:"100vh" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width:240,background:"#ffffff",borderRight:"1px solid #e2e8f0",
          display:"flex",flexDirection:"column",flexShrink:0 }}>

          {/* Logo */}
          <div style={{ padding:"20px 18px 14px",borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:10,
                background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:16,color:"#fff",fontWeight:700 }}>S</div>
              <div>
                <div style={{ fontSize:14,fontWeight:800,color:"#0f172a",letterSpacing:-.3 }}>ServiceLog</div>
                <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:.5 }}>PROJECT TRACKER</div>
              </div>
            </div>
          </div>

          <nav style={{ flex:1,overflowY:"auto",padding:"10px 10px" }}>
            <SideItem active={view==="overview"}
              onClick={()=>{ setView("overview"); setFilterStat("all"); setSearch(""); }}
              icon="▦" label="ภาพรวม" count={cases.length} color="#2563eb"/>

            <div style={{ margin:"14px 0 6px",padding:"0 6px",fontSize:10,color:"#94a3b8",
              letterSpacing:1.5,textTransform:"uppercase",fontWeight:700 }}>โครงการ</div>

            {projects.map(p=>(
              <div key={p.id} style={{ position:"relative" }}>
                <SideItem active={view===p.id}
                  onClick={()=>{ setView(p.id); setFilterStat("all"); setSearch(""); }}
                  icon="◆" label={p.name} count={cases.filter(c=>c.projectId===p.id).length} color={p.color}/>
                {view===p.id && (
                  <div style={{ position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",
                    display:"flex",gap:2 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>openEditProj(p)}
                      style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",
                        fontSize:12,padding:"2px 5px",borderRadius:5 }} title="แก้ไข">✎</button>
                    <button onClick={()=>setDelProj(p.id)}
                      style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",
                        fontSize:12,padding:"2px 5px",borderRadius:5 }} title="ลบ">✕</button>
                  </div>
                )}
              </div>
            ))}

            <button onClick={openAddProj}
              style={{ display:"flex",alignItems:"center",gap:7,width:"100%",background:"none",
                border:"1px dashed #cbd5e1",borderRadius:8,color:"#94a3b8",padding:"7px 10px",
                cursor:"pointer",fontSize:12,marginTop:8,fontFamily:"inherit",transition:"all .15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="#93c5fd"; e.currentTarget.style.color="#3b82f6"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#cbd5e1"; e.currentTarget.style.color="#94a3b8"; }}>
              <span style={{fontSize:16,lineHeight:1}}>+</span> เพิ่มโครงการ
            </button>
          </nav>

          {/* Bottom stats */}
          <div style={{ padding:"14px",borderTop:"1px solid #f1f5f9" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              {[
                { label:"เคสทั้งหมด",    val:cases.length, color:"#2563eb" },
                { label:"ใกล้หมดประกัน", val:cases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length, color:"#f59e0b" },
              ].map(x=>(
                <div key={x.label} style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",
                  border:`1px solid ${x.color}20` }}>
                  <div style={{ fontSize:22,fontWeight:800,color:x.color,lineHeight:1 }}>{x.val}</div>
                  <div style={{ fontSize:10,color:"#94a3b8",marginTop:3 }}>{x.label}</div>
                </div>
              ))}
            </div>
            <button onClick={openAddCase} style={{ width:"100%",background:"#2563eb",border:"none",
              color:"#fff",borderRadius:9,padding:"11px 0",fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",marginTop:10,transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="#1d4ed8"}
              onMouseLeave={e=>e.currentTarget.style.background="#2563eb"}>
              + บันทึกเคสใหม่
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex:1,display:"flex",flexDirection:"column",overflowY:"auto" }}>

          {/* Top bar */}
          <header style={{ background:"#ffffff",borderBottom:"1px solid #e2e8f0",
            padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:10 }}>
            <div>
              {view==="overview"
                ? <span style={{ fontSize:18,fontWeight:800,color:"#0f172a" }}>ภาพรวมทั้งหมด</span>
                : <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <button onClick={()=>setView("overview")} style={{ background:"none",border:"none",
                      color:"#94a3b8",cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0 }}>ภาพรวม</button>
                    <span style={{ color:"#cbd5e1" }}>›</span>
                    <span style={{ fontSize:15,fontWeight:700,color:activeProj?.color||"#0f172a" }}>{activeProj?.name}</span>
                  </div>}
            </div>
          </header>

          <div style={{ padding:"24px 28px 48px",flex:1 }}>

            {/* Stat bar */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10,marginBottom:24 }}>
              {[
                { label:"ทั้งหมด",        val:stats.total,        color:"#2563eb",  key:"all" },
                { label:"เปิดเคส",        val:stats.open,         color:"#f59e0b",  key:"open" },
                { label:"กำลังดำเนินการ", val:stats.inprogress,   color:"#3b82f6",  key:"inprogress" },
                { label:"เสร็จสิ้น",      val:stats.done,         color:"#10b981",  key:"done" },
                { label:"รอ",             val:stats.hold,         color:"#ef4444",  key:"hold" },
                { label:"มีประกัน",       val:stats.warranty,     color:"#8b5cf6",  key:"__war" },
                { label:"ใกล้หมดประกัน", val:stats.expiringSoon, color:"#f59e0b",  key:"__exp" },
              ].map(s=>(
                <div key={s.key}
                  onClick={()=>!s.key.startsWith("__")&&setFilterStat(filterStat===s.key?"all":s.key)}
                  style={{ background: filterStat===s.key?s.color+"10":"#ffffff",
                    border:`1.5px solid ${filterStat===s.key?s.color+"60":"#e2e8f0"}`,
                    borderRadius:12,padding:"14px 14px",
                    cursor:s.key.startsWith("__")?"default":"pointer",transition:"all .15s" }}>
                  <div style={{ fontSize:24,fontWeight:800,color:s.color,lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:10,color:"#94a3b8",marginTop:5,fontWeight:600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
              <div style={{ position:"relative",flex:"1 1 200px" }}>
                <span style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#cbd5e1",fontSize:15 }}>⌕</span>
                <input placeholder="ค้นหาชื่องาน, ไซต์, ประเภท, ช่าง..." value={search}
                  onChange={e=>setSearch(e.target.value)} style={IS({ paddingLeft:34,borderRadius:9 })}/>
              </div>
              <select value={filterStat} onChange={e=>setFilterStat(e.target.value)} style={IS({ width:"auto",cursor:"pointer",borderRadius:9 })}>
                <option value="all">สถานะทั้งหมด</option>
                {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={filterWar} onChange={e=>setFilterWar(e.target.value)} style={IS({ width:"auto",cursor:"pointer",borderRadius:9 })}>
                <option value="all">ประกันทั้งหมด</option>
                {WARRANTY_OPTS.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>

            {/* Project overview cards */}
            {view==="overview" && (
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:24 }}>
                {projects.map(p=>{
                  const pl=cases.filter(c=>c.projectId===p.id);
                  return (
                    <div key={p.id} className="case-card" onClick={()=>setView(p.id)}
                      style={{ background:"#ffffff",border:"1.5px solid #e2e8f0",borderRadius:14,
                        padding:"18px 20px",cursor:"pointer",transition:"all .2s",
                        borderLeft:`4px solid ${p.color}`,boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
                        <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",lineHeight:1.4,flex:1 }}>{p.name}</div>
                        <div style={{ display:"flex",gap:4,flexShrink:0,marginLeft:8 }} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>openEditProj(p)} style={{ background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:13,padding:"2px 5px" }}>✎</button>
                          <button onClick={()=>setDelProj(p.id)} style={{ background:"none",border:"none",color:"#fca5a5",cursor:"pointer",fontSize:13,padding:"2px 5px" }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:14 }}>
                        {[
                          { l:"ทั้งหมด",v:pl.length,                               c:p.color },
                          { l:"เสร็จ",  v:pl.filter(x=>x.status==="done").length,  c:"#10b981" },
                          { l:"รอ/เปิด",v:pl.filter(x=>x.status!=="done").length,  c:"#f59e0b" },
                          { l:"ประกัน", v:pl.filter(x=>x.warranty!=="none").length,c:"#8b5cf6" },
                        ].map(x=>(
                          <div key={x.l}>
                            <div style={{ fontSize:22,fontWeight:800,color:x.c,lineHeight:1 }}>{x.v}</div>
                            <div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>{x.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cases table */}
            <div style={{ background:"#ffffff",border:"1.5px solid #e2e8f0",borderRadius:14,
              overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1.2fr 1.1fr 110px 64px",
                padding:"11px 18px",borderBottom:"1.5px solid #f1f5f9",
                background:"#f8fafc",
                fontSize:10,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase",fontWeight:700 }}>
                <span>{view==="overview"?"งาน / โครงการ":"งาน / ประเภท"}</span>
                <span>ไซต์</span><span>ผู้ดำเนินการ</span>
                <span>ประกัน</span><span>วันหมดประกัน</span>
                <span>สถานะ</span><span style={{textAlign:"right"}}>จัดการ</span>
              </div>

              {visibleCases.length===0 ? (
                <div style={{ padding:"60px 0",textAlign:"center",color:"#cbd5e1",fontSize:14 }}>
                  ยังไม่มีเคส —{" "}
                  <span style={{ color:"#2563eb",cursor:"pointer",fontWeight:600 }} onClick={openAddCase}>+ เพิ่มเคสใหม่</span>
                </div>
              ) : visibleCases.map(c=>{
                const proj=projects.find(p=>p.id===c.projectId);
                const days=daysLeft(c.warrantyEnd);
                const daysCol=days===null?"#94a3b8":days<0?"#ef4444":days<=90?"#f59e0b":"#10b981";
                return (
                  <div key={c.id} className="rh" onClick={()=>setDetailCase(c)}
                    style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1.2fr 1.1fr 110px 64px",
                      padding:"13px 18px",borderBottom:"1px solid #f1f5f9",
                      alignItems:"center",cursor:"pointer",transition:"background .1s" }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>{c.title}</div>
                      <div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>
                        {view==="overview"
                          ? <span style={{ color:proj?.color||"#94a3b8",fontWeight:600 }}>{proj?.name}</span>
                          : c.type}
                      </div>
                    </div>
                    <div style={{ fontSize:12,color:"#475569" }}>{c.site||"—"}</div>
                    <div style={{ fontSize:12,color:"#475569" }}>{c.tech||"—"}</div>
                    <div><WarrantyPill warranty={c.warranty} warrantyEnd={c.warrantyEnd}/></div>
                    <div>
                      <div style={{ fontSize:12,color:daysCol,fontWeight:600 }}>
                        {c.warrantyEnd ? fmtDate(c.warrantyEnd) : "—"}
                      </div>
                      {days!==null&&days>=0&&days<=90 && <div style={{ fontSize:10,color:"#f59e0b",marginTop:1 }}>เหลือ {days} วัน</div>}
                      {days!==null&&days<0           && <div style={{ fontSize:10,color:"#ef4444",marginTop:1 }}>หมดแล้ว</div>}
                    </div>
                    <div><StatusPill value={c.status}/></div>
                    <div style={{ display:"flex",gap:4,justifyContent:"flex-end" }} onClick={e=>e.stopPropagation()}>
                      <MiniBtn onClick={()=>openEditCase(c)}>✎</MiniBtn>
                      <MiniBtn red onClick={()=>setDelCase(c.id)}>✕</MiniBtn>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:8,fontSize:11,color:"#cbd5e1",textAlign:"right" }}>
              {visibleCases.length} / {scopeCases.length} เคส
            </div>
          </div>
        </main>
      </div>

      {/* ── Case Form Modal ── */}
      <Modal open={caseModal} onClose={()=>setCaseModal(false)} title={editCase?"แก้ไขเคส":"บันทึกเคสใหม่"} wide>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
          <Field label="โครงการ *" span={2}>
            <select style={IS({ cursor:"pointer" })} value={caseForm.projectId}
              onChange={e=>setCaseForm(f=>({...f,projectId:e.target.value}))}>
              <option value="">— เลือกโครงการ —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="ชื่องาน / รายการเซอร์วิส *" span={2}>
            <input style={IS()} value={caseForm.title} placeholder="อธิบายงานที่ดำเนินการ..."
              onChange={e=>setCaseForm(f=>({...f,title:e.target.value}))}/>
          </Field>
          <Field label="ชื่อไซต์ / สถานที่" span={2}>
            <input style={IS()} value={caseForm.site} placeholder="เช่น สาขากรุงเทพ, อาคาร A ชั้น 3..."
              onChange={e=>setCaseForm(f=>({...f,site:e.target.value}))}/>
          </Field>
          <Field label="ประเภทงาน">
            <select style={IS({ cursor:"pointer" })} value={caseForm.type}
              onChange={e=>setCaseForm(f=>({...f,type:e.target.value}))}>
              {SERVICE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="ผู้ดำเนินการ">
            <input style={IS()} value={caseForm.tech} placeholder="ชื่อช่าง / ทีมงาน"
              onChange={e=>setCaseForm(f=>({...f,tech:e.target.value}))}/>
          </Field>
          <Field label="วันที่ดำเนินการ">
            <input type="date" style={IS()} value={caseForm.date}
              onChange={e=>setCaseForm(f=>({...f,date:e.target.value}))}/>
          </Field>
          <Field label="ระยะเวลาประกัน">
            <select style={IS({ cursor:"pointer" })} value={caseForm.warranty}
              onChange={e=>setCaseForm(f=>({...f,warranty:e.target.value}))}>
              {WARRANTY_OPTS.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
          {caseForm.warranty!=="none" && caseForm.date && (
            <Field label="วันสิ้นสุดประกัน (คำนวณอัตโนมัติ)" span={2}>
              <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,
                padding:"9px 13px",fontSize:13,color:"#2563eb",fontWeight:600 }}>
                {fmtDate(addYears(caseForm.date, WARRANTY_OPTS.find(w=>w.value===caseForm.warranty)?.years||0))}
              </div>
            </Field>
          )}
          <Field label="สถานะ">
            <select style={IS({ cursor:"pointer" })} value={caseForm.status}
              onChange={e=>setCaseForm(f=>({...f,status:e.target.value}))}>
              {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="หมายเหตุ / รายละเอียด" span={2}>
            <textarea style={IS({ resize:"vertical",minHeight:80,lineHeight:1.7 })}
              value={caseForm.note} placeholder="รายละเอียดงาน, อุปกรณ์ที่ใช้, ปัญหาที่พบ..."
              onChange={e=>setCaseForm(f=>({...f,note:e.target.value}))}/>
          </Field>
        </div>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:8 }}>
          <GhostBtn onClick={()=>setCaseModal(false)}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submitCase}>{editCase?"บันทึกการแก้ไข":"บันทึกเคส"}</PrimaryBtn>
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={!!detailCase} onClose={()=>setDetailCase(null)} title="รายละเอียดเคส" wide>
        {detailCase && (()=>{
          const proj=projects.find(p=>p.id===detailCase.projectId);
          const days=daysLeft(detailCase.warrantyEnd);
          return (
            <>
              <div style={{ marginBottom:16 }}>
                <span style={{ background:proj?.color+"15",color:proj?.color,
                  borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700 }}>{proj?.name}</span>
              </div>
              <div style={{ fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:20,lineHeight:1.4 }}>{detailCase.title}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"14px 20px",marginBottom:18 }}>
                {[
                  ["ไซต์ / สถานที่", detailCase.site||"—"],
                  ["ประเภทงาน",      detailCase.type],
                  ["ผู้ดำเนินการ",   detailCase.tech||"—"],
                  ["วันที่",         fmtDate(detailCase.date)],
                ].map(([k,v])=>(
                  <div key={k}>
                    <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>{k}</div>
                    <div style={{ fontSize:14,color:"#1e293b",fontWeight:500 }}>{v}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>ประกัน</div>
                  <WarrantyPill warranty={detailCase.warranty} warrantyEnd={detailCase.warrantyEnd}/>
                </div>
                {detailCase.warrantyEnd && (
                  <div>
                    <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>วันหมดประกัน</div>
                    <div style={{ fontSize:14,fontWeight:600,
                      color:days!==null&&days<0?"#ef4444":days!==null&&days<=90?"#f59e0b":"#1e293b" }}>
                      {fmtDate(detailCase.warrantyEnd)}
                      {days!==null && <span style={{ fontSize:11,marginLeft:6,opacity:.8 }}>
                        {days<0?"(หมดแล้ว)":`(เหลือ ${days} วัน)`}
                      </span>}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สถานะ</div>
                  <StatusPill value={detailCase.status}/>
                </div>
              </div>
              {detailCase.note && (
                <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,
                  padding:"14px 16px",marginBottom:20 }}>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:6,fontWeight:700 }}>หมายเหตุ</div>
                  <div style={{ fontSize:13,color:"#475569",lineHeight:1.8 }}>{detailCase.note}</div>
                </div>
              )}
              <div style={{ display:"flex",gap:10 }}>
                <GhostBtn onClick={()=>{ openEditCase(detailCase); setDetailCase(null); }}>✎ แก้ไข</GhostBtn>
                <button onClick={()=>{ setDelCase(detailCase.id); setDetailCase(null); }}
                  style={{ background:"none",border:"1px solid #fecaca",color:"#ef4444",
                    borderRadius:9,padding:"9px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>ลบเคส</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── Project Modal ── */}
      <Modal open={projModal} onClose={()=>setProjModal(false)} title={editProjId?"แก้ไขโครงการ":"เพิ่มโครงการใหม่"}>
        <Field label="ชื่อโครงการ *" span={2}>
          <input style={IS()} value={newProjName} placeholder="ชื่อโครงการ"
            onChange={e=>setNewProjName(e.target.value)}/>
        </Field>
        <Field label="สีโครงการ" span={2}>
          <div style={{ display:"flex",gap:8 }}>
            {COLOR_OPTS.map(c=>(
              <div key={c} onClick={()=>setNewProjColor(c)}
                style={{ width:30,height:30,borderRadius:8,background:c,cursor:"pointer",
                  border:newProjColor===c?"3px solid #0f172a":"3px solid transparent",
                  transition:"transform .15s",transform:newProjColor===c?"scale(1.15)":"scale(1)" }}/>
            ))}
          </div>
        </Field>
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:14 }}>
          <GhostBtn onClick={()=>setProjModal(false)}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submitProj}>{editProjId?"บันทึก":"สร้างโครงการ"}</PrimaryBtn>
        </div>
      </Modal>

      {/* ── Delete Confirms ── */}
      <Modal open={!!delCase} onClose={()=>setDelCase(null)} title="ลบเคส?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:20 }}>เคสนี้จะถูกลบถาวร ยืนยันหรือไม่?</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelCase(null)}>ยกเลิก</GhostBtn>
          <button onClick={()=>deleteCase(delCase)}
            style={{ background:"#ef4444",border:"none",color:"#fff",borderRadius:9,
              padding:"10px 22px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13 }}>ลบ</button>
        </div>
      </Modal>

      <Modal open={!!delProj} onClose={()=>setDelProj(null)} title="ลบโครงการ?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:4 }}>โครงการและเคสทั้งหมดจะถูกลบถาวร</p>
        <p style={{ color:"#ef4444",fontSize:13,marginBottom:20 }}>⚠ ไม่สามารถกู้คืนได้</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelProj(null)}>ยกเลิก</GhostBtn>
          <button onClick={()=>removeProj(delProj)}
            style={{ background:"#ef4444",border:"none",color:"#fff",borderRadius:9,
              padding:"10px 22px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13 }}>ลบโครงการ</button>
        </div>
      </Modal>
    </div>
  );
}
