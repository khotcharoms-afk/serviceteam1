import { useState, useEffect } from "react";
import AdminUsers from "./AdminUsers.jsx";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, writeBatch
} from "firebase/firestore";

// warranty stored as warrantyEnd date string or null
const STATUS_OPTS = [
  { value: "open",       label: "เปิดเคส",        color: "#f59e0b", bg: "#fef3c7" },
  { value: "inprogress", label: "กำลังดำเนินการ",  color: "#3b82f6", bg: "#dbeafe" },
  { value: "done",       label: "เสร็จสิ้น",       color: "#10b981", bg: "#d1fae5" },
  { value: "hold",       label: "รอดำเนินการ",     color: "#ef4444", bg: "#fee2e2" },
];
const SERVICE_TYPES = ["ติดตั้งอุปกรณ์","เปลี่ยนอุปกรณ์","ซ่อมบำรุง","ตรวจสอบระบบ","Config / Setup","อัปเกรด","เดินสาย","ทดสอบระบบ","อบรม","อื่นๆ"];
const COLOR_OPTS = ["#3b82f6","#8b5cf6","#10b981","#f97316","#ec4899","#f59e0b"];

const today = () => new Date().toISOString().slice(0,10);

const daysLeft = (s) => { if(!s) return null; return Math.ceil((new Date(s)-new Date())/86400000); };
const fmtDate = (s) => { if(!s) return "—"; const [y,m,d]=s.split("-"); return `${d}/${m}/${y}`; };
const emptyCase = { projectId:"",site:"",title:"",type:SERVICE_TYPES[0],tech:"",date:today(),warrantyEnd:"",leaseEnd:"",status:"open",note:"",handoverLog:[] };

const IS = (x={}) => ({
  width:"100%", background:"#ffffff", border:"1px solid #e2e8f0",
  borderRadius:8, color:"#1e293b", padding:"10px 13px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  width:"100%", background:"#fff", border:"1px solid #e2e8f0",
  borderRadius:8, color:"#1e293b", padding:"10px 13px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box", ...x,
});

function LeasePill({ leaseEnd }) {
  if (!leaseEnd) return null;
  const days = daysLeft(leaseEnd);
  const col = days<0?"#ef4444":days<=90?"#f59e0b":days<=365?"#f97316":"#8b5cf6";
  const label = days<0?"สัญญาหมดแล้ว":days===0?"หมดวันนี้":days<=90?`เหลือ ${days} วัน`:days<=365?`เหลือ ${days} วัน`:`เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:col+"18",color:col,border:`1px solid ${col}40`,
      borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col,flexShrink:0 }}/>
      📋 {label}
    </span>
  );
}

function WarrantyPill({ warrantyEnd }) {
  if (!warrantyEnd) return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:"#f1f5f9",color:"#94a3b8",borderRadius:20,
      padding:"3px 9px",fontSize:11,fontWeight:700 }}>ไม่มีประกัน</span>
  );
  const days = daysLeft(warrantyEnd);
  const col = days<0?"#ef4444":days<=90?"#f59e0b":days<=365?"#3b82f6":"#10b981";
  const label = days<0?"หมดแล้ว":days===0?"หมดวันนี้":days<=90?`เหลือ ${days} วัน`:days<=365?`เหลือ ${days} วัน`:`เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:col+"18",color:col,border:`1px solid ${col}40`,
      borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col,flexShrink:0 }}/>
      🛡 {label}
    </span>
  );
}

function StatusPill({ value }) {
  const s = STATUS_OPTS.find(x=>x.value===value)||STATUS_OPTS[0];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700 }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:s.color,flexShrink:0 }}/>
      {s.label}
    </span>
  );
}


// ── Handover Modal ────────────────────────────────────────────
function HandoverModal({ open, onClose, caseData, onSave, users }) {
  const [toId, setToId]   = useState("");
  const [note, setNote]   = useState("");
  if (!open || !caseData) return null;
  const toUser = users.find(u=>u.id===toId);
  function submit() {
    if (!toId) return;
    const entry = {
      from: caseData.tech||"ไม่ระบุ",
      to:   toUser?.name||toId,
      note: note.trim(),
      date: new Date().toISOString().slice(0,10),
      time: new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}),
    };
    const log = [...(caseData.handoverLog||[]), entry];
    onSave({ ...caseData, tech: toUser?.name||toId, handoverLog: log, status:"inprogress" });
    setToId(""); setNote(""); onClose();
  }
  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,transition:"background .2s" }}
      onClick={onClose}>
      <div style={{ background:"#ffffff",borderRadius:16,padding:"24px",width:"100%",maxWidth:460,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>📤 ส่งต่องาน</h2>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14,display:"flex",
            alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {/* Current assignee */}
        <div style={{ background:"#f8fafc",borderRadius:10,padding:'12px 14px',marginBottom:16,
          border:`1px solid ${"#e2e8f0"}` }}>
          <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,marginBottom:4 }}>ผู้รับผิดชอบปัจจุบัน</div>
          <div style={{ fontSize:14,fontWeight:600,color:"#1e293b" }}>{caseData.tech||"ไม่ระบุ"}</div>
        </div>

        {/* To */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>ส่งต่อให้ *</div>
          <select value={toId} onChange={e=>setToId(e.target.value)}
            style={{ width:"100%",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"10px 13px",fontSize:14,outline:"none",
              fontFamily:"inherit",boxSizing:"border-box",cursor:"pointer" }}>
            <option value="">— เลือกผู้รับงาน —</option>
            {users.filter(u=>u.role!=="pending"&&u.name!==caseData.tech).map(u=>(
              <option key={u.id} value={u.id}>{u.name} {u.role==="admin"?"(Admin)":""}</option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>หมายเหตุ / ทำไปถึงไหนแล้ว</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="เช่น ติดตั้งเสร็จแล้ว รอ config เพิ่ม..."
            style={{ width:"100%",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"10px 13px",fontSize:14,outline:"none",resize:"vertical",
              minHeight:80,fontFamily:"inherit",boxSizing:"border-box",lineHeight:1.6 }}/>
        </div>

        {/* Handover log */}
        {(caseData.handoverLog||[]).length>0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,marginBottom:8 }}>ประวัติการส่งต่อ</div>
            <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:160,overflowY:"auto" }}>
              {[...(caseData.handoverLog||[])].reverse().map((h,i)=>(
                <div key={i} style={{ background:"#f8fafc",borderRadius:8,padding:"8px 12px",
                  border:"1px solid #e2e8f0",fontSize:12 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                    <span style={{ color:"#475569",fontWeight:600 }}>{h.from}</span>
                    <span style={{ color:"#94a3b8" }}>→</span>
                    <span style={{ color:"#2563eb",fontWeight:600 }}>{h.to}</span>
                    <span style={{ color:"#cbd5e1",marginLeft:"auto",fontSize:11 }}>{h.date} {h.time}</span>
                  </div>
                  {h.note && <div style={{ color:"#64748b",fontSize:11,marginTop:2 }}>"{h.note}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"11px 18px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={submit} style={{ flex:1,background:"#2563eb",border:"none",color:"#fff",
            borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>📤 ส่งต่องาน</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,.5)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",
      padding:"16px" }}
      onClick={onClose}>
      <div style={{ background:"#ffffff",borderRadius:16,
        width:"100%",maxWidth:560,maxHeight:"92vh",overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:"24px 24px 28px" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, children, full, small }) {
  return (
    <button onClick={onClick} style={{ background:"#2563eb",border:"none",color:"#fff",
      borderRadius:10,padding:small?"9px 18px":"12px 22px",fontSize:small?13:14,fontWeight:600,
      cursor:"pointer",fontFamily:"inherit",width:full?"100%":"auto",transition:"background .15s" }}
      onMouseEnter={e=>e.currentTarget.style.background="#1d4ed8"}
      onMouseLeave={e=>e.currentTarget.style.background="#2563eb"}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
      color:"#475569",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,
      cursor:"pointer",fontFamily:"inherit" }}>
      {children}
    </button>
  );
}

// ── Case Card (mobile) ──────────────────────────────────────
function CaseCard({ c, proj, onClick, onEdit, onDel, onHandover }) {
  const days = daysLeft(c.warrantyEnd);
  return (
    <div onClick={onClick} style={{
      background:"#fff",
      border:`1.5px solid ${"#e2e8f0"}`,
      borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",
      borderLeft:`4px solid ${proj?.color||"#e2e8f0"}`,
      boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
        <div style={{ flex:1,paddingRight:8 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",lineHeight:1.3 }}>{c.title}</div>
          {c.site && <div style={{ fontSize:12,color:"#3b82f6",marginTop:3 }}>📍 {c.site}</div>}
        </div>
        <StatusPill value={c.status}/>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:6,alignItems:"center" }}>
        {c.tech && <span style={{ fontSize:11,color:"#64748b",background:"#f8fafc",
          borderRadius:6,padding:"2px 8px",border:"1px solid #e2e8f0" }}>👤 {c.tech}</span>}
        {c.date && <span style={{ fontSize:11,color:"#64748b" }}>📅 {fmtDate(c.date)}</span>}
        <WarrantyPill warrantyEnd={c.warrantyEnd}/>
        {c.leaseEnd && <LeasePill leaseEnd={c.leaseEnd}/>}
      </div>
      {days!==null&&days>=0&&days<=90 && (
        <div style={{ marginTop:6,fontSize:11,color:"#f59e0b",fontWeight:600 }}>⚠ ประกันเหลือ {days} วัน</div>
      )}
      {days!==null&&days<0 && (
        <div style={{ marginTop:6,fontSize:11,color:"#ef4444",fontWeight:600 }}>⚠ ประกันหมดแล้ว</div>
      )}
      {c.leaseEnd&&(()=>{ const d=daysLeft(c.leaseEnd); return d!==null&&d<0?(
        <div style={{ marginTop:4,fontSize:11,color:"#ef4444",fontWeight:600 }}>⚠ สัญญาเช่าหมดแล้ว</div>
      ):d!==null&&d<=90?(
        <div style={{ marginTop:4,fontSize:11,color:"#f59e0b",fontWeight:600 }}>⚠ สัญญาเช่าเหลือ {d} วัน</div>
      ):null; })()}
      {(c.handoverLog||[]).length>0 && (
        <div style={{ marginTop:4,fontSize:11,color:"#8b5cf6",fontWeight:600 }}>
          🔁 ส่งต่อแล้ว {c.handoverLog.length} ครั้ง • ปัจจุบัน: {c.tech}
        </div>
      )}
      <div style={{ display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9" }}
        onClick={e=>e.stopPropagation()}>
        <button onClick={onEdit} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
          color:"#475569",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✎ แก้ไข</button>
        <button onClick={onHandover} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
          color:"#2563eb",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>📤 ส่งต่อ</button>
        <button onClick={onDel} style={{ background:"#fff5f5",border:"1px solid #fecaca",
          color:"#ef4444",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✕ ลบ</button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function App({ currentUser, onSignOut }) {
  const [projects,setProjects] = useState([]);
  const [cases,setCases]       = useState([]);
  const [users,setUsers]       = useState([]);
  const [loading,setLoading]   = useState(true);

  const [view,setView]             = useState("overview");
  const [filterStat,setFilterStat] = useState("all");
  const [dateFrom,setDateFrom]     = useState("");
  const [dateTo,setDateTo]         = useState("");
  const [filterTech,setFilterTech] = useState("all");
  const [search,setSearch]         = useState("");
  const [menuOpen,setMenuOpen]     = useState(false);
  const [adminPage,setAdminPage]   = useState(false);

  const [caseModal,setCaseModal]   = useState(false);
  const [editCase,setEditCase]     = useState(null);
  const [detailCase,setDetailCase] = useState(null);
  const [delCase,setDelCase]       = useState(null);
  const [handoverCase,setHandoverCase] = useState(null);
  const [projModal,setProjModal]   = useState(false);
  const [editProjId,setEditProjId] = useState(null);
  const [delProj,setDelProj]       = useState(null);
  const [caseForm,setCaseForm]     = useState(emptyCase);
  const [newProjName,setNewProjName] = useState("");
  const [newProjColor,setNewProjColor] = useState(COLOR_OPTS[0]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"projects"),snap=>{ setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    const u2=onSnapshot(collection(db,"cases"),snap=>{ setCases(snap.docs.map(d=>({id:d.id,...d.data()}))); });
    const u3=onSnapshot(collection(db,"users"),snap=>{ setUsers(snap.docs.map(d=>({id:d.id,...d.data()}))); });
    return()=>{u1();u2();u3();};
  },[]);

  const activeProj = projects.find(p=>p.id===view)||null;

  const visibleCases = cases.filter(c=>{
    if(view!=="overview"&&c.projectId!==view) return false;
    if(filterStat!=="all"&&c.status!==filterStat) return false;
    if(dateFrom && c.date && c.date < dateFrom) return false;
    if(dateTo   && c.date && c.date > dateTo)   return false;
    if(filterTech!=="all" && c.tech!==filterTech) return false;
    const q=search.toLowerCase();
    return !q||[c.title,c.type,c.tech,c.site,c.note].some(x=>x?.toLowerCase().includes(q));
  });

  function openAddCase(){ const pid=view!=="overview"?view:(projects[0]?.id||""); setCaseForm({...emptyCase,projectId:pid,tech:currentUser?.name||""}); setEditCase(null); setCaseModal(true); }
  function openEditCase(c){ setCaseForm({...c}); setEditCase(c.id); setCaseModal(true); }
  async function submitCase(){
    if(!caseForm.title||!caseForm.projectId) return;
    const payload = {...caseForm, warrantyEnd: caseForm.warrantyEnd||null};
    await setDoc(doc(db,"cases",editCase||Date.now().toString()),payload);
    setCaseModal(false); setEditCase(null);
  }
  async function deleteCase(id){ await deleteDoc(doc(db,"cases",id)); setDelCase(null); setDetailCase(null); }

  async function saveHandover(updated) {
    await setDoc(doc(db,"cases",updated.id), updated);
    setHandoverCase(null);
  }

  function openAddProj(){ setEditProjId(null); setNewProjName(""); setNewProjColor(COLOR_OPTS[0]); setProjModal(true); }
  function openEditProj(p){ setEditProjId(p.id); setNewProjName(p.name); setNewProjColor(p.color); setProjModal(true); }
  async function submitProj(){
    const name=newProjName.trim(); if(!name) return;
    await setDoc(doc(db,"projects",editProjId||Date.now().toString()),{name,color:newProjColor});
    setNewProjName(""); setEditProjId(null); setProjModal(false);
  }
  async function removeProj(pid){
    const batch=writeBatch(db);
    batch.delete(doc(db,"projects",pid));
    cases.filter(c=>c.projectId===pid).forEach(c=>batch.delete(doc(db,"cases",c.id)));
    await batch.commit();
    if(view===pid) setView("overview");
    setDelProj(null);
  }

  const scopeCases = view==="overview"?cases:cases.filter(c=>c.projectId===view);
  const stats = {
    total:scopeCases.length,
    open:scopeCases.filter(c=>c.status==="open").length,
    done:scopeCases.filter(c=>c.status==="done").length,
    expiringSoon:scopeCases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length,
  };

  if(loading) return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:"'Noto Sans Thai',sans-serif",color:"#94a3b8",fontSize:14 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32,color:"#2563eb",marginBottom:10 }}>◈</div>
        กำลังโหลด...
      </div>
    </div>
  );

  if(adminPage) return <AdminUsers onBack={()=>setAdminPage(false)}/>;


  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai','Sora',sans-serif",color:"#1e293b" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:4px;background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
        input::placeholder,textarea::placeholder{color:#cbd5e1}
        select option{background:var(--select-bg,#fff)}
        input:focus,select:focus,textarea:focus{border-color:#93c5fd !important;box-shadow:0 0 0 3px #dbeafe !important;outline:none}
      `}</style>

      {/* ── TOP NAV (mobile) ── */}
      <header style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",height:56,
        position:"sticky",top:0,zIndex:50 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={()=>setMenuOpen(true)} style={{ background:"none",border:"none",
            cursor:"pointer",padding:"6px",fontSize:18,color:"#475569",lineHeight:1 }}>☰</button>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#2563eb,#7c3aed)",
              display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700 }}>S</div>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:"#0f172a",lineHeight:1 }}>ServiceLog</div>
              {view!=="overview" && <div style={{ fontSize:10,color:activeProj?.color||"#94a3b8",fontWeight:600,lineHeight:1.2 }}>{activeProj?.name}</div>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          {currentUser?.role==="admin" && (
            <button onClick={()=>setAdminPage(true)} style={{ background:"#f5f3ff",border:"1px solid #ddd6fe",
              color:"#7c3aed",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit" }}>
              👥
            </button>
          )}
          <button onClick={openAddCase} style={{ background:"#2563eb",border:"none",color:"#fff",
            borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            + เคสใหม่
          </button>
          <button onClick={onSignOut} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#64748b",borderRadius:8,padding:"8px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit" }}
            title="ออกจากระบบ">
            🚪
          </button>
        </div>
      </header>

      {/* ── DRAWER MENU ── */}
      {menuOpen && (
        <div style={{ position:"fixed",inset:0,zIndex:200 }} onClick={()=>setMenuOpen(false)}>
          <div style={{ position:"absolute",inset:0,background:"rgba(15,23,42,.4)",backdropFilter:"blur(2px)" }}/>
          <div style={{ position:"absolute",left:0,top:0,bottom:0,width:280,background:"#fff",
            boxShadow:"4px 0 24px rgba(0,0,0,.12)",padding:"20px 12px",overflowY:"auto" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,padding:"0 6px" }}>
              <div style={{ fontSize:15,fontWeight:800,color:"#0f172a" }}>เมนู</div>
              <button onClick={()=>setMenuOpen(false)} style={{ background:"none",border:"none",fontSize:18,color:"#94a3b8",cursor:"pointer" }}>✕</button>
            </div>

            {/* User info */}
            <div style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",
              marginBottom:12,border:"1px solid #e2e8f0" }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>{currentUser?.name}</div>
              <div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>{currentUser?.email}</div>
              <div style={{ display:"flex",gap:6,marginTop:8 }}>
                {currentUser?.role==="admin" && (
                  <button onClick={()=>{ setAdminPage(true); setMenuOpen(false); }}
                    style={{ background:"#f5f3ff",border:"1px solid #ddd6fe",color:"#7c3aed",
                      borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                    👥 จัดการ User
                  </button>
                )}
                <button onClick={onSignOut}
                  style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                    borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                  🚪 ออกจากระบบ
                </button>
              </div>
            </div>

            <DrawerItem active={view==="overview"} color="#2563eb" icon="▦" label="ภาพรวม" count={cases.length}
              onClick={()=>{ setView("overview"); setMenuOpen(false); setFilterStat("all"); }}/>

            <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",
              fontWeight:700,padding:"14px 8px 6px" }}>โครงการ</div>

            {projects.map(p=>(
              <div key={p.id} style={{ display:"flex",alignItems:"center",gap:0 }}>
                <div style={{ flex:1 }}>
                  <DrawerItem active={view===p.id} color={p.color} icon="◆" label={p.name}
                    count={cases.filter(c=>c.projectId===p.id).length}
                    onClick={()=>{ setView(p.id); setMenuOpen(false); setFilterStat("all"); }}/>
                </div>
                <div style={{ display:"flex",gap:2,flexShrink:0 }}>
                  <button onClick={()=>{ openEditProj(p); setMenuOpen(false); }}
                    style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",padding:"6px",fontSize:13 }}>✎</button>
                  <button onClick={()=>{ setDelProj(p.id); setMenuOpen(false); }}
                    style={{ background:"none",border:"none",color:"#fca5a5",cursor:"pointer",padding:"6px",fontSize:13 }}>✕</button>
                </div>
              </div>
            ))}

            <button onClick={()=>{ openAddProj(); setMenuOpen(false); }}
              style={{ display:"flex",alignItems:"center",gap:7,width:"100%",background:"none",
                border:"1px dashed #cbd5e1",borderRadius:8,color:"#94a3b8",padding:"9px 10px",
                cursor:"pointer",fontSize:13,marginTop:8,fontFamily:"inherit" }}>
              <span style={{fontSize:16}}>+</span> เพิ่มโครงการ
            </button>

            <div style={{ margin:"20px 0 10px",borderTop:"1px solid #f1f5f9",paddingTop:16 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                {[
                  {label:"เคสทั้งหมด",val:cases.length,color:"#2563eb"},
                  {label:"ใกล้หมดประกัน",val:cases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length,color:"#f59e0b"},
                ].map(x=>(
                  <div key={x.label} style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${x.color}20` }}>
                    <div style={{ fontSize:22,fontWeight:800,color:x.color }}>{x.val}</div>
                    <div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>{x.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ padding:"16px 16px 100px" }}>

        {/* Breadcrumb */}
        {view!=="overview" && (
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}>
            <button onClick={()=>setView("overview")} style={{ background:"none",border:"none",
              color:"#94a3b8",cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0 }}>ภาพรวม</button>
            <span style={{ color:"#cbd5e1" }}>›</span>
            <span style={{ fontSize:13,fontWeight:700,color:activeProj?.color||"#0f172a" }}>{activeProj?.name}</span>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16 }}>
          {[
            {label:"ทั้งหมด",   val:stats.total,        color:"#2563eb", key:"all"},
            {label:"เปิดเคส",   val:stats.open,         color:"#f59e0b", key:"open"},
            {label:"เสร็จ",     val:stats.done,         color:"#10b981", key:"done"},
            {label:"ใกล้หมด",  val:stats.expiringSoon, color:"#f59e0b", key:"__exp"},
          ].map(s=>(
            <div key={s.key} onClick={()=>!s.key.startsWith("__")&&setFilterStat(filterStat===s.key?"all":s.key)}
              style={{ background:filterStat===s.key?s.color+"12":"#fff",
                border:`1.5px solid ${filterStat===s.key?s.color+"50":"#e2e8f0"}`,
                borderRadius:12,padding:"12px 10px",cursor:"pointer",textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:600,letterSpacing:.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position:"relative",marginBottom:14 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#cbd5e1",fontSize:16 }}>⌕</span>
          <input placeholder="ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)}
            style={IS({ paddingLeft:36,borderRadius:10,fontSize:14 })}/>
        </div>

        {/* Date filter */}
        <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap" }}>📅 ช่วงวันที่:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",
              fontFamily:"inherit",cursor:"pointer" }}/>
          <span style={{ fontSize:12,color:"#94a3b8" }}>ถึง</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",
              fontFamily:"inherit",cursor:"pointer" }}/>
          {/* Quick presets */}
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {[
              { label:"วันนี้",    fn:()=>{ const t=today(); setDateFrom(t); setDateTo(t); }},
              { label:"7 วัน",    fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-6); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); }},
              { label:"30 วัน",   fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-29); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); }},
              { label:"เดือนนี้", fn:()=>{ const n=new Date(); setDateFrom(n.getFullYear()+"-"+(String(n.getMonth()+1).padStart(2,"0"))+"-01"); setDateTo(today()); }},
            ].map(p=>(
              <button key={p.label} onClick={p.fn}
                style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",
                  fontFamily:"inherit",fontWeight:600 }}>
                {p.label}
              </button>
            ))}
            {(dateFrom||dateTo)&&(
              <button onClick={()=>{ setDateFrom(""); setDateTo(""); }}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* Tech filter */}
        <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap" }}>
          <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap" }}>👤 ผู้ดำเนินการ:</span>
          <select value={filterTech} onChange={e=>setFilterTech(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",
              fontFamily:"inherit",cursor:"pointer",minWidth:160 }}>
            <option value="all">ทั้งหมด</option>
            {users.filter(u=>u.role!=="pending").sort((a,b)=>a.name.localeCompare(b.name)).map(u=>(
              <option key={u.id} value={u.name}>{u.name}{u.role==="admin"?" (Admin)":""}</option>
            ))}
          </select>
          {filterTech!=="all"&&(
            <span style={{ background:"#dbeafe",color:"#2563eb",borderRadius:20,
              padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-flex",
              alignItems:"center",gap:6 }}>
              {filterTech}
              <button onClick={()=>setFilterTech("all")}
                style={{ background:"none",border:"none",color:"#2563eb",cursor:"pointer",
                  fontSize:13,padding:0,lineHeight:1 }}>×</button>
            </span>
          )}
        </div>

        {/* Status filter pills */}
        <div style={{ display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4 }}>
          {[{value:"all",label:"ทั้งหมด",color:"#2563eb"},...STATUS_OPTS].map(s=>(
            <button key={s.value} onClick={()=>setFilterStat(s.value)}
              style={{ background:filterStat===s.value?s.color:"#fff",
                border:`1.5px solid ${filterStat===s.value?s.color:"#e2e8f0"}`,
                color:filterStat===s.value?"#fff":"#64748b",
                borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0 }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Project cards on overview */}
        {view==="overview" && projects.length>0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>โครงการทั้งหมด</div>
            <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:4 }}>
              {projects.map(p=>{
                const pl=cases.filter(c=>c.projectId===p.id);
                return (
                  <div key={p.id} onClick={()=>setView(p.id)}
                    style={{ background:"#fff",border:`1.5px solid ${p.color}30`,borderRadius:12,
                      padding:"14px 16px",cursor:"pointer",flexShrink:0,minWidth:160,
                      borderLeft:`4px solid ${p.color}`,boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10,lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ display:"flex",gap:12 }}>
                      {[{l:"ทั้งหมด",v:pl.length,c:p.color},{l:"เสร็จ",v:pl.filter(x=>x.status==="done").length,c:"#10b981"}].map(x=>(
                        <div key={x.l}>
                          <div style={{ fontSize:20,fontWeight:800,color:x.c,lineHeight:1 }}>{x.v}</div>
                          <div style={{ fontSize:9,color:"#94a3b8",marginTop:1 }}>{x.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Case list */}
        <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>
          เคส ({visibleCases.length})
        </div>

        {visibleCases.length===0 ? (
          <div style={{ background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,
            padding:"48px 20px",textAlign:"center",color:"#cbd5e1" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📋</div>
            <div style={{ fontSize:14,marginBottom:12 }}>ยังไม่มีเคส</div>
            <button onClick={openAddCase} style={{ background:"#2563eb",border:"none",color:"#fff",
              borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              + บันทึกเคสแรก
            </button>
          </div>
        ) : visibleCases.map(c=>{
          const proj=projects.find(p=>p.id===c.projectId);
          return (
            <CaseCard key={c.id} c={c} proj={proj}
              onClick={()=>setDetailCase(c)}
              onEdit={()=>openEditCase(c)}
              onHandover={()=>setHandoverCase(c)}
              onDel={()=>setDelCase(c.id)}/>
          );
        })}
      </div>

      {/* ── FAB (floating add button) ── */}
      <button onClick={openAddCase} style={{ position:"fixed",bottom:24,right:20,
        background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"none",color:"#fff",
        width:56,height:56,borderRadius:"50%",fontSize:26,cursor:"pointer",
        boxShadow:"0 6px 20px rgba(37,99,235,.4)",zIndex:40,display:"flex",
        alignItems:"center",justifyContent:"center",lineHeight:1 }}>
        +
      </button>

      {/* ── Case Form Modal ── */}
      <Modal open={caseModal} onClose={()=>setCaseModal(false)} title={editCase?"แก้ไขเคส":"บันทึกเคสใหม่"}>
        <Field label="โครงการ *">
          <select style={IS({ cursor:"pointer" })} value={caseForm.projectId}
            onChange={e=>setCaseForm(f=>({...f,projectId:e.target.value}))}>
            <option value="">— เลือกโครงการ —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="ชื่องาน / รายการเซอร์วิส *">
          <input style={IS()} value={caseForm.title} placeholder="อธิบายงานที่ดำเนินการ..."
            onChange={e=>setCaseForm(f=>({...f,title:e.target.value}))}/>
        </Field>
        <Field label="ชื่อไซต์ / สถานที่">
          <input style={IS()} value={caseForm.site} placeholder="เช่น สาขากรุงเทพ, อาคาร A..."
            onChange={e=>setCaseForm(f=>({...f,site:e.target.value}))}/>
        </Field>
        <Field label="ประเภทงาน">
          <select style={IS({ cursor:"pointer" })} value={caseForm.type}
            onChange={e=>setCaseForm(f=>({...f,type:e.target.value}))}>
            {SERVICE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="ผู้ดำเนินการ">
          <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,
            padding:"10px 13px",fontSize:14,color:"#475569",display:"flex",
            alignItems:"center",gap:8 }}>
            <span style={{ fontSize:16 }}>👤</span>
            <span style={{ fontWeight:600,color:"#1e293b" }}>{caseForm.tech||currentUser?.name||"—"}</span>
            <span style={{ fontSize:11,color:"#94a3b8",marginLeft:"auto" }}>ผู้เปิดเคส</span>
          </div>
        </Field>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="วันที่ดำเนินการ">
            <input type="date" style={IS()} value={caseForm.date}
              onChange={e=>setCaseForm(f=>({...f,date:e.target.value}))}/>
          </Field>
          </div>
        <Field label="วันหมดประกัน (ถ้ามี)">
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <input type="date" style={IS({ flex:1,minWidth:160 })} value={caseForm.warrantyEnd||""}
              onChange={e=>setCaseForm(f=>({...f,warrantyEnd:e.target.value}))}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {[
                {label:"+1 ปี", y:1},{label:"+2 ปี", y:2},
                {label:"+3 ปี", y:3},{label:"+5 ปี", y:5},
              ].map(btn=>{
                const base = caseForm.date||today();
                const d = new Date(base); d.setFullYear(d.getFullYear()+btn.y);
                const val = d.toISOString().slice(0,10);
                const active = caseForm.warrantyEnd===val;
                return (
                  <button key={btn.label} type="button"
                    onClick={()=>setCaseForm(f=>({...f,warrantyEnd:val}))}
                    style={{ background:active?"#2563eb":"#f1f5f9",
                      border:`1px solid ${active?"#2563eb":"#e2e8f0"}`,
                      color:active?"#fff":"#475569",borderRadius:7,
                      padding:"6px 12px",fontSize:12,cursor:"pointer",
                      fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap" }}>
                    {btn.label}
                  </button>
                );
              })}
              <button type="button" onClick={()=>setCaseForm(f=>({...f,warrantyEnd:""}))}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
                ล้าง
              </button>
            </div>
          </div>
          {caseForm.warrantyEnd && (()=>{
            const days=daysLeft(caseForm.warrantyEnd);
            const col=days<0?"#ef4444":days<=90?"#f59e0b":"#10b981";
            return <div style={{ marginTop:6,fontSize:12,color:col,fontWeight:600 }}>
              📅 {fmtDate(caseForm.warrantyEnd)} • {days<0?`หมดไปแล้ว ${Math.abs(days)} วัน`:days===0?"หมดวันนี้":`เหลือ ${days} วัน (${(days/365).toFixed(1)} ปี)`}
            </div>;
          })()}
        </Field>
        <Field label="วันหมดสัญญาเช่า (ถ้ามี)">
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <input type="date" style={IS({ flex:1,minWidth:160 })} value={caseForm.leaseEnd||""}
              onChange={e=>setCaseForm(f=>({...f,leaseEnd:e.target.value}))}/>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {[{label:"+1 ปี",y:1},{label:"+2 ปี",y:2},{label:"+3 ปี",y:3},{label:"+5 ปี",y:5}].map(btn=>{
                const base=caseForm.date||today();
                const d=new Date(base); d.setFullYear(d.getFullYear()+btn.y);
                const val=d.toISOString().slice(0,10);
                const active=caseForm.leaseEnd===val;
                return (
                  <button key={btn.label} type="button"
                    onClick={()=>setCaseForm(f=>({...f,leaseEnd:val}))}
                    style={{ background:active?"#8b5cf6":"#f1f5f9",
                      border:`1px solid ${active?"#8b5cf6":"#e2e8f0"}`,
                      color:active?"#fff":"#475569",borderRadius:7,
                      padding:"6px 12px",fontSize:12,cursor:"pointer",
                      fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap" }}>
                    {btn.label}
                  </button>
                );
              })}
              <button type="button" onClick={()=>setCaseForm(f=>({...f,leaseEnd:""}))}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
                ล้าง
              </button>
            </div>
          </div>
          {caseForm.leaseEnd&&(()=>{
            const days=daysLeft(caseForm.leaseEnd);
            const col=days<0?"#ef4444":days<=90?"#f59e0b":"#8b5cf6";
            return <div style={{ marginTop:6,fontSize:12,color:col,fontWeight:600 }}>
              📋 {fmtDate(caseForm.leaseEnd)} • {days<0?`หมดไปแล้ว ${Math.abs(days)} วัน`:days===0?"หมดวันนี้":`เหลือ ${days} วัน (${(days/365).toFixed(1)} ปี)`}
            </div>;
          })()}
        </Field>
        <Field label="สถานะ">
          <select style={IS({ cursor:"pointer" })} value={caseForm.status}
            onChange={e=>setCaseForm(f=>({...f,status:e.target.value}))}>
            {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="หมายเหตุ / รายละเอียด">
          <textarea style={IS({ resize:"vertical",minHeight:80,lineHeight:1.7 })}
            value={caseForm.note} placeholder="รายละเอียดงาน, อุปกรณ์ที่ใช้..."
            onChange={e=>setCaseForm(f=>({...f,note:e.target.value}))}/>
        </Field>
        <div style={{ display:"flex",gap:10,marginTop:4 }}>
          <GhostBtn onClick={()=>setCaseModal(false)}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submitCase} full>{editCase?"บันทึกการแก้ไข":"บันทึกเคส"}</PrimaryBtn>
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={!!detailCase} onClose={()=>setDetailCase(null)} title="รายละเอียดเคส">
        {detailCase&&(()=>{
          const proj=projects.find(p=>p.id===detailCase.projectId);
          const days=daysLeft(detailCase.warrantyEnd);
          return (
            <>
              <span style={{ background:proj?.color+"15",color:proj?.color,borderRadius:20,
                padding:"3px 12px",fontSize:12,fontWeight:700,display:"inline-block",marginBottom:12 }}>{proj?.name}</span>
              <div style={{ fontSize:17,fontWeight:800,color:"#0f172a",marginBottom:16,lineHeight:1.4 }}>{detailCase.title}</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                {[["ไซต์",detailCase.site||"—"],["ประเภทงาน",detailCase.type],
                  ["ผู้ดำเนินการ",detailCase.tech||"—"],["วันที่",fmtDate(detailCase.date)]]
                  .map(([k,v])=>(
                    <div key={k}>
                      <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontWeight:700 }}>{k}</div>
                      <div style={{ fontSize:14,color:"#1e293b",fontWeight:500 }}>{v}</div>
                    </div>
                  ))}
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>ประกัน</div>
                  <WarrantyPill warrantyEnd={detailCase.warrantyEnd}/>
                </div>
                {detailCase.warrantyEnd&&(
                  <div>
                    <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontWeight:700 }}>วันหมดประกัน</div>
                    <div style={{ fontSize:14,fontWeight:600,color:days!==null&&days<0?"#ef4444":days!==null&&days<=90?"#f59e0b":"#1e293b" }}>
                      {fmtDate(detailCase.warrantyEnd)}
                      {days!==null&&<span style={{ fontSize:11,marginLeft:4 }}>{days<0?"(หมดแล้ว)":`(เหลือ ${days} วัน)`}</span>}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สถานะ</div>
                  <StatusPill value={detailCase.status}/>
                </div>
              </div>
              {detailCase.note&&(
                <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:700 }}>หมายเหตุ</div>
                  <div style={{ fontSize:13,color:"#475569",lineHeight:1.8 }}>{detailCase.note}</div>
                </div>
              )}
              {(detailCase.handoverLog||[]).length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:700 }}>
                    🔁 ประวัติการส่งต่อ ({detailCase.handoverLog.length} ครั้ง)
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {[...(detailCase.handoverLog||[])].reverse().map((h,i)=>(
                      <div key={i} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
                        borderRadius:10,padding:"10px 14px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:h.note?4:0 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:"#475569" }}>{h.from}</span>
                          <span style={{ color:"#93c5fd",fontSize:14 }}>→</span>
                          <span style={{ fontSize:13,fontWeight:700,color:"#2563eb" }}>{h.to}</span>
                          <span style={{ fontSize:11,color:"#94a3b8",marginLeft:"auto" }}>{h.date} {h.time}</span>
                        </div>
                        {h.note&&<div style={{ fontSize:12,color:"#64748b",lineHeight:1.6,
                          background:"#fff",borderRadius:6,padding:"5px 8px",border:"1px solid #f1f5f9" }}>
                          "{h.note}"
                        </div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                <GhostBtn onClick={()=>{ openEditCase(detailCase); setDetailCase(null); }}>✎ แก้ไข</GhostBtn>
                <button onClick={()=>{ setHandoverCase(detailCase); setDetailCase(null); }}
                  style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                    borderRadius:10,padding:"12px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600 }}>📤 ส่งต่องาน</button>
                <button onClick={()=>{ setDelCase(detailCase.id); setDetailCase(null); }}
                  style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                    borderRadius:10,padding:"12px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600 }}>ลบ</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── Project Modal ── */}
      <Modal open={projModal} onClose={()=>setProjModal(false)} title={editProjId?"แก้ไขโครงการ":"เพิ่มโครงการใหม่"}>
        <Field label="ชื่อโครงการ *">
          <input style={IS()} value={newProjName} placeholder="ชื่อโครงการ"
            onChange={e=>setNewProjName(e.target.value)}/>
        </Field>
        <Field label="สีโครงการ">
          <div style={{ display:"flex",gap:10 }}>
            {COLOR_OPTS.map(c=>(
              <div key={c} onClick={()=>setNewProjColor(c)}
                style={{ width:32,height:32,borderRadius:8,background:c,cursor:"pointer",
                  border:newProjColor===c?"3px solid #0f172a":"3px solid transparent",
                  transform:newProjColor===c?"scale(1.15)":"scale(1)",transition:"transform .15s" }}/>
            ))}
          </div>
        </Field>
        <div style={{ display:"flex",gap:10,marginTop:4 }}>
          <GhostBtn onClick={()=>setProjModal(false)}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submitProj} full>{editProjId?"บันทึก":"สร้างโครงการ"}</PrimaryBtn>
        </div>
      </Modal>

      {/* ── Delete Confirms ── */}
      <Modal open={!!delCase} onClose={()=>setDelCase(null)} title="ลบเคส?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:20 }}>เคสนี้จะถูกลบถาวร ยืนยันหรือไม่?</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelCase(null)}>ยกเลิก</GhostBtn>
          <button onClick={()=>deleteCase(delCase)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบ</button>
        </div>
      </Modal>

      <HandoverModal open={!!handoverCase} onClose={()=>setHandoverCase(null)}
        caseData={handoverCase} onSave={saveHandover} users={users}/>

      <Modal open={!!delProj} onClose={()=>setDelProj(null)} title="ลบโครงการ?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:4 }}>โครงการและเคสทั้งหมดจะถูกลบถาวร</p>
        <p style={{ color:"#ef4444",fontSize:13,marginBottom:20 }}>⚠ ไม่สามารถกู้คืนได้</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelProj(null)}>ยกเลิก</GhostBtn>
          <button onClick={()=>removeProj(delProj)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบโครงการ</button>
        </div>
      </Modal>
    </div>
  );
}

function DrawerItem({ active, onClick, icon, label, count, color }) {
  return (
    <button onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
      width:"100%",background:active?color+"12":"transparent",
      border:active?`1px solid ${color}25`:"1px solid transparent",
      borderRadius:8,padding:"10px 10px",cursor:"pointer",fontFamily:"inherit",
      marginBottom:2,textAlign:"left" }}>
      <span style={{ display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0 }}>
        <span style={{ fontSize:9,color:active?color:"#cbd5e1" }}>{icon}</span>
        <span style={{ fontSize:13,color:active?"#0f172a":"#64748b",fontWeight:active?700:400,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
      </span>
      <span style={{ fontSize:11,background:active?color+"15":"#f1f5f9",borderRadius:20,
        padding:"2px 8px",color:active?color:"#94a3b8",flexShrink:0,marginLeft:4,fontWeight:600 }}>{count}</span>
    </button>
  );
}
