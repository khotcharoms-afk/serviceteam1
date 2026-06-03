import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection, doc, onSnapshot,
  setDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import { today, fmtDate, daysLeft, emptyCase, COLOR_OPTS, SERVICE_TYPES, STATUS_OPTS, IS } from "./utils.js";
import { WarrantyPill, LeasePill, StatusPill, Modal, Field, PrimaryBtn, GhostBtn } from "./UI.jsx";
import CaseCard from "./CaseCard.jsx";
import HandoverModal from "./HandoverModal.jsx";
import UpdateLogModal from "./UpdateLogModal.jsx";
import AdminUsers from "./AdminUsers.jsx";

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
  const [menuOpen,setMenuOpen]       = useState(false);
  const [adminPage,setAdminPage]     = useState(false);
  const [notifOpen,setNotifOpen]     = useState(false);
  const [notifications,setNotifs]    = useState([]);
  const [lastSeen,setLastSeen]       = useState(()=>localStorage.getItem("notif-seen")||"");

  const [caseModal,setCaseModal]   = useState(false);
  const [editCase,setEditCase]     = useState(null);
  const [detailCase,setDetailCase] = useState(null);
  const [delCase,setDelCase]       = useState(null);
  const [handoverCase,setHandoverCase] = useState(null);
  const [updateCase,setUpdateCase]     = useState(null);
  const [projModal,setProjModal]   = useState(false);
  const [editProjId,setEditProjId] = useState(null);
  const [delProj,setDelProj]       = useState(null);
  const [caseForm,setCaseForm]     = useState(emptyCase);
  const [newProjName,setNewProjName] = useState("");
  const [newProjColor,setNewProjColor] = useState(COLOR_OPTS[0]);
  const [newProjWarranty,setNewProjWarranty] = useState("");
  const [newProjLease,setNewProjLease] = useState("");
  const [newProjSites,setNewProjSites] = useState([]);
  const [newSiteInput,setNewSiteInput] = useState("");

  useEffect(()=>{
    const errHandler = (e)=>{ console.error("Firestore listener error:", e); setLoading(false); };
    const u1=onSnapshot(collection(db,"projects"),snap=>{ setProjects(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, errHandler);
    const u2=onSnapshot(collection(db,"cases"),snap=>{ setCases(snap.docs.map(d=>({id:d.id,...d.data()}))); }, errHandler);
    const u3=onSnapshot(collection(db,"users"),snap=>{ setUsers(snap.docs.map(d=>({id:d.id,...d.data()}))); }, errHandler);
    const u4=onSnapshot(collection(db,"notifications"),snap=>{
      const all = snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(n=> n.toUid===auth.currentUser?.uid || (n.type==="new_user" && currentUser?.role==="admin"))
        .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setNotifs(all);
    }, errHandler);
    return()=>{u1();u2();u3();u4();};
  },[]);

  // Close notif dropdown on outside click
  useEffect(()=>{
    if(!notifOpen) return;
    const handler = ()=>setNotifOpen(false);
    document.addEventListener("click", handler);
    return ()=>document.removeEventListener("click", handler);
  },[notifOpen]);

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
    const proj = projects.find(p=>p.id===caseForm.projectId);
    const { siteOther, ...rest } = caseForm;
    const payload = {
      ...rest,
      warrantyEnd: proj?.warrantyEnd||null,
      leaseEnd:    proj?.leaseEnd||null,
      site: caseForm.site==="__other__" ? "" : caseForm.site,
    };
    await setDoc(doc(db,"cases",editCase||Date.now().toString()),payload);
    setCaseModal(false); setEditCase(null);
  }
  async function deleteCase(id){ await deleteDoc(doc(db,"cases",id)); setDelCase(null); setDetailCase(null); }

  async function markNotifRead(nid) {
    await setDoc(doc(db,"notifications",nid),{ read:true },{ merge:true });
  }

  async function markAllRead() {
    for(const n of notifications.filter(x=>!x.read)) {
      await setDoc(doc(db,"notifications",n.id),{ read:true },{ merge:true });
    }
  }

  async function saveUpdate(updated) {
    await setDoc(doc(db,"cases",updated.id), updated);
    setUpdateCase(null);
  }

  async function saveHandover(updated) {
    await setDoc(doc(db,"cases",updated.id), updated);
    // Create notification for the recipient
    const log = updated.handoverLog||[];
    const latest = log[log.length-1];
    if(latest) {
      const toUser = users.find(u=>u.name===latest.to);
      if(toUser) {
        await setDoc(doc(db,"notifications",Date.now().toString()), {
          type:      "handover",
          toUid:     toUser.id,
          toName:    toUser.name,
          fromName:  latest.from,
          caseTitle: updated.title,
          caseId:    updated.id,
          note:      latest.note||"",
          createdAt: new Date().toISOString(),
          read:      false,
        });
      }
    }
    setHandoverCase(null);
  }

  function openAddProj(){ setEditProjId(null); setNewProjName(""); setNewProjColor(COLOR_OPTS[0]); setNewProjWarranty(""); setNewProjLease(""); setNewProjSites([]); setNewSiteInput(""); setProjModal(true); }
  function openEditProj(p){ setEditProjId(p.id); setNewProjName(p.name); setNewProjColor(p.color); setNewProjWarranty(p.warrantyEnd||""); setNewProjLease(p.leaseEnd||""); setNewProjSites(p.sites||[]); setNewSiteInput(""); setProjModal(true); }
  async function submitProj(){
    const name=newProjName.trim(); if(!name) return;
    await setDoc(doc(db,"projects",editProjId||Date.now().toString()),{
      name, color:newProjColor,
      warrantyEnd:newProjWarranty||null,
      leaseEnd:newProjLease||null,
      sites:newProjSites
    });
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

  if(adminPage) return <AdminUsers onBack={()=>setAdminPage(false)} currentUser={currentUser} db={db} />;
  const unreadCount = notifications.filter(n=>!n.read).length;




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

        /* Notification — desktop: dropdown top-right, mobile: bottom sheet */
        .notif-backdrop{ position:fixed; inset:0; z-index:500; }
        .notif-handle{ display:none; }
        @media (min-width: 768px){
          .notif-backdrop{ background:transparent; }
          .notif-panel{
            position:absolute; top:64px; right:16px; width:360px; max-height:70vh;
            background:#fff; border:1px solid #e2e8f0; border-radius:14px;
            box-shadow:0 12px 40px rgba(0,0,0,.15); display:flex; flex-direction:column;
            overflow:hidden;
          }
        }
        @media (max-width: 767px){
          .notif-backdrop{
            background:rgba(15,23,42,.55); backdrop-filter:blur(4px);
            display:flex; align-items:flex-end; justify-content:center;
          }
          .notif-panel{
            background:#fff; border-radius:20px 20px 0 0; width:100%;
            height:75vh; display:flex; flex-direction:column;
            box-shadow:0 -8px 40px rgba(0,0,0,.2);
          }
          .notif-handle{
            display:block; width:40px; height:4px; background:#e2e8f0;
            border-radius:2px; margin:12px auto 0;
          }
        }
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
          {/* Bell notification */}
          <div style={{ position:"relative" }}>
            <button onClick={e=>{ e.stopPropagation(); setNotifOpen(v=>!v); }}
              style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,
                padding:"8px 10px",fontSize:18,cursor:"pointer",lineHeight:1,position:"relative" }}>
              🔔
              {unreadCount>0&&(
                <span style={{ position:"absolute",top:-4,right:-4,background:"#ef4444",
                  color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,
                  fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {unreadCount>9?"9+":unreadCount}
                </span>
              )}
            </button>

          </div>
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
              onUpdate={()=>setUpdateCase(c)}
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
        <Field label="ไซต์ / สถานที่">
          {(()=>{
            const proj = projects.find(p=>p.id===caseForm.projectId);
            const sites = proj?.sites||[];
            // siteMode tracks whether user picked a preset or "other"
            const isPreset = sites.includes(caseForm.site);
            const showOther = caseForm.siteOther || (caseForm.site && !isPreset);
            if (sites.length===0) {
              return <input style={IS()} value={caseForm.site} placeholder="เช่น สาขากรุงเทพ, อาคาร A..."
                onChange={e=>setCaseForm(f=>({...f,site:e.target.value}))}/>;
            }
            return (
              <>
                <select style={IS({ cursor:"pointer" })}
                  value={showOther ? "__other__" : caseForm.site}
                  onChange={e=>{
                    if(e.target.value==="__other__"){
                      setCaseForm(f=>({...f,site:"",siteOther:true}));
                    } else {
                      setCaseForm(f=>({...f,site:e.target.value,siteOther:false}));
                    }
                  }}>
                  <option value="">— เลือกไซต์ —</option>
                  {sites.map(s=><option key={s} value={s}>{s}</option>)}
                  <option value="__other__">อื่นๆ (พิมพ์เอง)</option>
                </select>
                {showOther&&(
                  <input style={IS({ marginTop:8 })} value={caseForm.site}
                    placeholder="พิมพ์ชื่อไซต์..." autoFocus
                    onChange={e=>setCaseForm(f=>({...f,site:e.target.value,siteOther:true}))}/>
                )}
              </>
            );
          })()}
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
        {/* Auto-fill warranty & lease from selected project */}
        {(()=>{
          const proj = projects.find(p=>p.id===caseForm.projectId);
          if(!proj) return null;
          const wd = daysLeft(proj.warrantyEnd);
          const ld = daysLeft(proj.leaseEnd);
          return (
            <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,
              padding:"12px 14px",marginBottom:14 }}>
              <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,
                textTransform:"uppercase",marginBottom:8 }}>ข้อมูลจากโครงการ (อัตโนมัติ)</div>
              <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",marginBottom:2 }}>🛡 ประกัน</div>
                  {proj.warrantyEnd ? (
                    <div style={{ fontSize:12,fontWeight:600,
                      color:wd<0?"#ef4444":wd<=90?"#f59e0b":"#3b82f6" }}>
                      {fmtDate(proj.warrantyEnd)} {wd<0?"(หมดแล้ว)":`(เหลือ ${wd} วัน)`}
                    </div>
                  ) : <div style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มี</div>}
                </div>
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",marginBottom:2 }}>📋 สัญญาเช่า</div>
                  {proj.leaseEnd ? (
                    <div style={{ fontSize:12,fontWeight:600,
                      color:ld<0?"#ef4444":ld<=90?"#f59e0b":"#8b5cf6" }}>
                      {fmtDate(proj.leaseEnd)} {ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`}
                    </div>
                  ) : <div style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มี</div>}
                </div>
              </div>
            </div>
          );
        })()}
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
                  {detailCase.warrantyEnd ? (
                    <>
                      <WarrantyPill warrantyEnd={detailCase.warrantyEnd}/>
                      <div style={{ fontSize:11,color:days!==null&&days<0?"#ef4444":days!==null&&days<=90?"#f59e0b":"#94a3b8",marginTop:3,fontWeight:600 }}>
                        {fmtDate(detailCase.warrantyEnd)} {days!==null&&(days<0?"(หมดแล้ว)":`(เหลือ ${days} วัน)`)}
                      </div>
                    </>
                  ) : <span style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มีประกัน</span>}
                </div>
                <div>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สัญญาเช่า</div>
                  {detailCase.leaseEnd ? (()=>{
                    const ld=daysLeft(detailCase.leaseEnd);
                    return (
                      <>
                        <LeasePill leaseEnd={detailCase.leaseEnd}/>
                        <div style={{ fontSize:11,color:ld!==null&&ld<0?"#ef4444":ld!==null&&ld<=90?"#f59e0b":"#94a3b8",marginTop:3,fontWeight:600 }}>
                          {fmtDate(detailCase.leaseEnd)} {ld!==null&&(ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`)}
                        </div>
                      </>
                    );
                  })() : <span style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มีสัญญาเช่า</span>}
                </div>
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
              {(detailCase.updateLog||[]).length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",
                    letterSpacing:1,marginBottom:8,fontWeight:700 }}>
                    📝 ประวัติการอัปเดต ({detailCase.updateLog.length})
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {[...(detailCase.updateLog||[])].reverse().map((u,i)=>(
                      <div key={i} style={{ background:"#f0fdf4",borderRadius:8,
                        padding:"10px 12px",border:"1px solid #bbf7d0" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                          <span style={{ fontSize:12,fontWeight:700,color:"#16a34a" }}>👤 {u.by}</span>
                          <span style={{ fontSize:11,color:"#94a3b8" }}>{u.date} {u.time}</span>
                        </div>
                        {u.status&&<div style={{ fontSize:11,color:"#2563eb",marginBottom:2 }}>→ {u.status}</div>}
                        <div style={{ fontSize:13,color:"#1e293b",lineHeight:1.6 }}>{u.text}</div>
                      </div>
                    ))}
                  </div>
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
                <button onClick={()=>{ setUpdateCase(detailCase); setDetailCase(null); }}
                  style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
                    borderRadius:10,padding:"12px 18px",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600 }}>📝 อัปเดต</button>
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

        {/* Warranty */}
        <Field label="วันหมดประกัน (ถ้ามี)">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
            <input type="date" style={IS({ flex:1,minWidth:140 })} value={newProjWarranty}
              onChange={e=>setNewProjWarranty(e.target.value)}/>
            {[{l:"+1ปี",y:1},{l:"+3ปี",y:3},{l:"+5ปี",y:5}].map(b=>{
              const d=new Date(); d.setFullYear(d.getFullYear()+b.y);
              const v=d.toISOString().slice(0,10);
              return <button key={b.l} type="button" onClick={()=>setNewProjWarranty(v)}
                style={{ background:newProjWarranty===v?"#3b82f6":"#f1f5f9",
                  border:"1px solid #e2e8f0",color:newProjWarranty===v?"#fff":"#475569",
                  borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>{b.l}</button>;
            })}
            {newProjWarranty&&<button type="button" onClick={()=>setNewProjWarranty("")}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                borderRadius:7,padding:"6px 8px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>}
          </div>
          {newProjWarranty&&<div style={{ fontSize:11,color:"#3b82f6",marginTop:4,fontWeight:600 }}>
            🛡 {fmtDate(newProjWarranty)} (เหลือ {daysLeft(newProjWarranty)} วัน)
          </div>}
        </Field>

        {/* Lease */}
        <Field label="วันหมดสัญญาเช่า (ถ้ามี)">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
            <input type="date" style={IS({ flex:1,minWidth:140 })} value={newProjLease}
              onChange={e=>setNewProjLease(e.target.value)}/>
            {[{l:"+1ปี",y:1},{l:"+3ปี",y:3},{l:"+5ปี",y:5}].map(b=>{
              const d=new Date(); d.setFullYear(d.getFullYear()+b.y);
              const v=d.toISOString().slice(0,10);
              return <button key={b.l} type="button" onClick={()=>setNewProjLease(v)}
                style={{ background:newProjLease===v?"#8b5cf6":"#f1f5f9",
                  border:"1px solid #e2e8f0",color:newProjLease===v?"#fff":"#475569",
                  borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>{b.l}</button>;
            })}
            {newProjLease&&<button type="button" onClick={()=>setNewProjLease("")}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                borderRadius:7,padding:"6px 8px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>}
          </div>
          {newProjLease&&<div style={{ fontSize:11,color:"#8b5cf6",marginTop:4,fontWeight:600 }}>
            📋 {fmtDate(newProjLease)} (เหลือ {daysLeft(newProjLease)} วัน)
          </div>}
        </Field>

        {/* Sites */}
        <Field label="ไซต์ย่อย">
          <div style={{ display:"flex",gap:8,marginBottom:8 }}>
            <input style={IS({ flex:1 })} value={newSiteInput} placeholder="ชื่อไซต์ เช่น อาคาร A, สาขานนทบุรี"
              onChange={e=>setNewSiteInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); if(newSiteInput.trim()){ setNewProjSites(s=>[...s,newSiteInput.trim()]); setNewSiteInput(""); }}}}/>
            <button type="button" onClick={()=>{ if(newSiteInput.trim()){ setNewProjSites(s=>[...s,newSiteInput.trim()]); setNewSiteInput(""); }}}
              style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,
                padding:"0 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap" }}>+ เพิ่ม</button>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {newProjSites.map((s,i)=>(
              <span key={i} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
                color:"#2563eb",borderRadius:20,padding:"3px 10px",fontSize:12,
                fontWeight:600,display:"inline-flex",alignItems:"center",gap:6 }}>
                📍 {s}
                <button type="button" onClick={()=>setNewProjSites(p=>p.filter((_,j)=>j!==i))}
                  style={{ background:"none",border:"none",color:"#93c5fd",cursor:"pointer",
                    fontSize:13,padding:0,lineHeight:1 }}>×</button>
              </span>
            ))}
            {newProjSites.length===0&&<span style={{ fontSize:12,color:"#cbd5e1" }}>ยังไม่มีไซต์</span>}
          </div>
        </Field>

        <div style={{ display:"flex",gap:10,marginTop:4 }}>
          <GhostBtn onClick={()=>setProjModal(false)}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submitProj} full>{editProjId?"บันทึก":"สร้างโครงการ"}</PrimaryBtn>
        </div>
      </Modal>

      {/* ── Delete Confirms ── */}
      {/* ── Notification Modal ── */}
      {notifOpen&&(
        <div className="notif-backdrop" onClick={()=>setNotifOpen(false)}>
          <div className="notif-panel" onClick={e=>e.stopPropagation()}>
            {/* Handle (mobile only) */}
            <div className="notif-handle"/>
            {/* Header */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"14px 18px 12px",borderBottom:"1px solid #f1f5f9",flexShrink:0 }}>
              <span style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>🔔 การแจ้งเตือน
                {unreadCount>0&&<span style={{ background:"#ef4444",color:"#fff",borderRadius:20,
                  padding:"1px 7px",fontSize:11,fontWeight:700,marginLeft:8 }}>{unreadCount}</span>}
              </span>
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                {unreadCount>0&&(
                  <button onClick={markAllRead}
                    style={{ background:"none",border:"none",color:"#2563eb",fontSize:12,
                      cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>
                    อ่านทั้งหมด
                  </button>
                )}
                <button onClick={()=>setNotifOpen(false)}
                  style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
                    width:28,height:28,borderRadius:8,fontSize:13,display:"flex",
                    alignItems:"center",justifyContent:"center" }}>✕</button>
              </div>
            </div>
            {/* List */}
            <div style={{ overflowY:"auto",flex:1 }}>
              {notifications.length===0?(
                <div style={{ padding:"48px 18px",textAlign:"center",color:"#cbd5e1",fontSize:14 }}>
                  <div style={{ fontSize:32,marginBottom:8 }}>🔔</div>
                  ไม่มีการแจ้งเตือน
                </div>
              ):notifications.map(n=>(
                <div key={n.id} onClick={()=>{
                    markNotifRead(n.id);
                    setNotifOpen(false);
                    if(n.caseId){ const c=cases.find(x=>x.id===n.caseId); if(c){ setDetailCase(c); }}
                  }}
                  style={{ padding:"14px 18px",borderBottom:"1px solid #f8fafc",
                    background:n.read?"#fff":"#eff6ff",cursor:"pointer",
                    transition:"background .15s" }}>
                  <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                    <div style={{ width:36,height:36,borderRadius:"50%",flexShrink:0,
                      background:n.type==="handover"?"#dbeafe":"#f5f3ff",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>
                      {n.type==="handover"?"📤":"👤"}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:n.read?400:700,color:"#0f172a",lineHeight:1.5 }}>
                        {n.type==="handover"
                          ? <>{n.fromName} ส่งงาน <span style={{ color:"#2563eb" }}>"{n.caseTitle}"</span> ให้คุณ</>
                          : <>มีผู้ใช้ใหม่: <span style={{ color:"#7c3aed",fontWeight:700 }}>{n.toName}</span></>
                        }
                      </div>
                      {n.note&&<div style={{ fontSize:12,color:"#64748b",marginTop:3,
                        background:"#f8fafc",borderRadius:6,padding:"3px 8px",
                        display:"inline-block" }}>"{n.note}"</div>}
                      <div style={{ fontSize:11,color:"#94a3b8",marginTop:4 }}>
                        {n.createdAt?new Date(n.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"}):""}
                      </div>
                    </div>
                    {!n.read&&<span style={{ width:8,height:8,borderRadius:"50%",
                      background:"#2563eb",flexShrink:0,marginTop:6 }}/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!delCase} onClose={()=>setDelCase(null)} title="ลบเคส?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:20 }}>เคสนี้จะถูกลบถาวร ยืนยันหรือไม่?</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelCase(null)}>ยกเลิก</GhostBtn>
          <button onClick={()=>deleteCase(delCase)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบ</button>
        </div>
      </Modal>

      <UpdateLogModal open={!!updateCase} onClose={()=>setUpdateCase(null)}
        caseData={updateCase} onSave={saveUpdate} currentUser={currentUser}/>

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
