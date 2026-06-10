import { useState, useEffect } from "react";
import { db, auth, registerPushSubscription } from "./firebase";
import { doc, setDoc, deleteDoc, writeBatch, collection, addDoc } from "firebase/firestore";
import { today, fmtDate, daysLeft, emptyCase, COLOR_OPTS, STATUS_OPTS, IS } from "./utils.js";
import * as XLSX from "xlsx";
import { WarrantyPill, LeasePill, StatusPill, Modal, Field, PrimaryBtn, GhostBtn } from "./UI.jsx";
import CaseCard from "./CaseCard.jsx";
import HandoverModal from "./HandoverModal.jsx";
import UpdateLogModal from "./UpdateLogModal.jsx";
import AdminUsers from "./AdminUsers.jsx";
import { useFirestore } from "./hooks/useFirestore.js";
import CaseModal from "./components/CaseModal.jsx";
import ProjectModal from "./components/ProjectModal.jsx";
import DetailModal from "./components/DetailModal.jsx";
import Dashboard from "./Dashboard.jsx";
import ShiftCalendar from "./ShiftCalendar.jsx";
import OnsitePage from "./OnsitePage.jsx";

export default function App({ currentUser, onSignOut }) {
  const { projects, cases, users, notifications, deletedCases, shifts, shiftTypes, userSchedules, shiftMembers, loading, refreshSchedules, refreshShiftTypes, refreshShiftMembers } = useFirestore();

  const [view,setView]             = useState("overview");
  const [filterStat,setFilterStat] = useState("all");
  const [dateFrom,setDateFrom]     = useState("");
  const [dateTo,setDateTo]         = useState("");
  const [filterTech,setFilterTech] = useState("all");
  const [search,setSearch]         = useState("");
  const [menuOpen,setMenuOpen]     = useState(false);
  const isMobile = window.innerWidth < 640;
  const [adminPage,setAdminPage]   = useState(false);
  const [dashboardPage,setDashboardPage] = useState(false);
  const [shiftPage,setShiftPage] = useState(false);
  const [onsitePage,setOnsitePage] = useState(false);
  const [notifOpen,setNotifOpen]   = useState(false);
  const [lastSeen,setLastSeen]     = useState(()=>localStorage.getItem("notif-seen")||"");

  const [caseModal,setCaseModal]       = useState(false);
  const [editCase,setEditCase]         = useState(null);
  const [detailCase,setDetailCase]     = useState(null);
  const [delCase,setDelCase]           = useState(null);
  const [handoverCase,setHandoverCase] = useState(null);
  const [updateCase,setUpdateCase]     = useState(null);
  const [projModal,setProjModal]       = useState(false);
  const [importModal,setImportModal]   = useState(false);
  const [importRows,setImportRows]     = useState([]);
  const [importSelected,setImportSelected] = useState({});
  const [editProjId,setEditProjId]     = useState(null);
  const [delProj,setDelProj]           = useState(null);
  const [caseForm,setCaseForm]         = useState(emptyCase);
  const [newProjCode,setNewProjCode]   = useState("");
  const [newProjName,setNewProjName]   = useState("");
  const [newProjColor,setNewProjColor] = useState(COLOR_OPTS[0]);
  const [newProjWarranty,setNewProjWarranty] = useState("");
  const [newProjLease,setNewProjLease]       = useState("");
  const [newProjSites,setNewProjSites]       = useState([]);

  const [toast,setToast]   = useState(null);
  const [saving,setSaving] = useState(false);
  const [page,setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset pagination เมื่อ filter เปลี่ยน
  useEffect(()=>{ setPage(1); },[view,filterStat,filterTech,search,dateFrom,dateTo]);

  // Re-register push subscription เมื่อ user กลับมาเปิดแอป (แก้ปัญหา iOS/Android kill subscription)
  useEffect(()=>{
    if(!currentUser) return;
    const onVisible = ()=>{
      if(document.visibilityState==="visible") registerFcm(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return ()=>document.removeEventListener("visibilitychange", onVisible);
  },[currentUser]);

  // Close notif on outside click
  useEffect(()=>{
    if(!notifOpen) return;
    const handler = ()=>setNotifOpen(false);
    document.addEventListener("click", handler);
    return ()=>document.removeEventListener("click", handler);
  },[notifOpen]);

  // FCM Push
  async function registerFcm(notify=false){
    try{
      const uid = auth.currentUser?.uid;
      if(!uid || !("Notification" in window)) return;
      if(Notification.permission==="default"){
        const perm = await Notification.requestPermission();
        if(perm!=="granted") return;
      } else if(Notification.permission!=="granted") return;
      const reg = await navigator.serviceWorker.ready;
      const ok = await registerPushSubscription(reg, uid, currentUser?.name||"");
      if(!ok) return;
      if(notify) showToast("เปิดการแจ้งเตือนแล้ว","success");
    }catch(e){ console.error("registerFcm error:", e); }
  }
  useEffect(()=>{
    if(!currentUser) return;
    if(!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if(Notification.permission==="granted"){ registerFcm(false); return; }
    if(Notification.permission==="default"){
      const h=()=>{ document.removeEventListener("click",h); registerFcm(true); };
      document.addEventListener("click",h,{ once:true });
      return ()=>document.removeEventListener("click",h);
    }
  },[currentUser]);

  // Toast
  useEffect(()=>{
    if(!toast) return;
    const t=setTimeout(()=>setToast(null), toast.type==="error"?4500:2500);
    return ()=>clearTimeout(t);
  },[toast]);
  function showToast(msg, type="error"){ setToast({ msg, type }); }

  async function commitWrite(promise, successMsg) {
    let timer;
    const settled = promise.then(()=>"ok", (e)=>{ console.error("write error:", e); return "err"; });
    const timeout = new Promise(res=>{ timer=setTimeout(()=>res("queued"), 4000); });
    const r = await Promise.race([settled, timeout]);
    clearTimeout(timer);
    if(r==="ok"){ showToast(successMsg, "success"); return true; }
    if(r==="err"){ showToast("ทำรายการไม่สำเร็จ ตรวจสอบแล้วลองใหม่"); return false; }
    showToast("บันทึกในเครื่องแล้ว จะ sync อัตโนมัติเมื่อต่อเน็ต", "success");
    settled.then(res=>{ if(res==="err") showToast("บางรายการ sync ไม่สำเร็จ ลองเปิดแอปใหม่"); });
    return true;
  }

  const activeProj = projects.find(p=>p.id===view)||null;
  // ── Export Excel ──
  function exportToExcel() {
    const STATUS_LABEL = { open:"เปิด", done:"ปิด", hold:"รอดำเนินการ", pending:"รอ" };
    const rows = visibleCases.map(c => {
      const proj = projects.find(p=>p.id===c.projectId);
      return {
        "เลขเคส/ID":   c.caseNo||c.id,
        "ชื่อเรื่อง":   c.title||"",
        "ลูกค้า/Site": c.site||"",
        "Project":     proj?.name||"",
        "ประเภท":      c.type||"",
        "สถานะ":       STATUS_LABEL[c.status]||c.status||"",
        "ผู้ดำเนินการ": (c.techs?.length?c.techs.join(", "):c.tech)||"",
        "วันที่เปิด":   c.date||"",
        "วันที่อัปเดต": c.updatedAt?c.updatedAt.slice(0,10):"",
        "หมายเหตุ":    c.note||"",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [14,30,20,16,14,14,20,12,12,30];
    ws["!cols"] = colWidths.map(w=>({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "เคส");
    const now = new Date();
    const fname = `ServiceLog_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.xlsx`;
    XLSX.writeFile(wb, fname);
  }

  const visibleCases = cases.filter(c=>{
    if(view!=="overview"&&c.projectId!==view) return false;
    if(filterStat==="__exp"){
      const wd=daysLeft(c.warrantyEnd), ld=daysLeft(c.leaseEnd);
      const wExp=(wd!==null&&wd>=0&&wd<=90), lExp=(ld!==null&&ld>=0&&ld<=90);
      if(!wExp&&!lExp) return false;
    } else if(filterStat!=="all"&&c.status!==filterStat) return false;
    if(dateFrom && c.date && c.date < dateFrom) return false;
    if(dateTo   && c.date && c.date > dateTo)   return false;
    if(filterTech!=="all" && c.tech!==filterTech) return false;
    const q=search.toLowerCase();
    return !q||[c.title,c.type,c.tech,c.site,c.note].some(x=>x?.toLowerCase().includes(q));
  }).sort((a,b)=>{
    if(filterStat==="__exp"){
      const da = Math.min(...[daysLeft(a.warrantyEnd),daysLeft(a.leaseEnd)].filter(x=>x!==null&&x>=0).concat([9999]));
      const db = Math.min(...[daysLeft(b.warrantyEnd),daysLeft(b.leaseEnd)].filter(x=>x!==null&&x>=0).concat([9999]));
      return da - db;
    }
    const ta = b.activityAt||b.updatedAt||b.id;
    const tb = a.activityAt||a.updatedAt||a.id;
    return ta.localeCompare(tb);
  });
  const totalPages = Math.max(1, Math.ceil(visibleCases.length / PAGE_SIZE));
  const pagedCases = visibleCases.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // ── Case actions ──
  function openAddCase(){
    const pid=view!=="overview"?view:(projects[0]?.id||"");
    setCaseForm({...emptyCase,projectId:pid,tech:currentUser?.name||"",techs:[currentUser?.name||""]});
    setEditCase(null); setCaseModal(true);
  }
  function openEditCase(c){
    const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);
    setCaseForm({...c, techs}); setEditCase(c.id); setCaseModal(true);
  }
  async function submitCase(){
    if(!caseForm.title||!caseForm.projectId) return;
    if(saving) return;
    setSaving(true);
    const proj = projects.find(p=>p.id===caseForm.projectId);
    const { siteOther, ...rest } = caseForm;
    const techs = caseForm.techs?.length ? caseForm.techs : (caseForm.tech ? [caseForm.tech] : []);
    const payload = {
      ...rest, techs,
      tech: techs[0]||caseForm.tech||"",
      warrantyEnd: proj?.warrantyEnd||null,
      leaseEnd:    proj?.leaseEnd||null,
      site: caseForm.site==="__other__" ? "" : caseForm.site,
      updatedAt: new Date().toISOString(),
    };
    const ok = await commitWrite(
      setDoc(doc(db,"cases",editCase||Date.now().toString()), payload),
      editCase?"แก้ไขเคสเรียบร้อย":"บันทึกเคสเรียบร้อย"
    );
    if(ok){ setCaseModal(false); setEditCase(null); }
    setSaving(false);
  }
  async function deleteCase(id){
    const c = cases.find(x=>x.id===id);
    const proj = projects.find(p=>p.id===c?.projectId);
    // บันทึก log ก่อนลบ
    try {
      await addDoc(collection(db,"deletedCases"), {
        caseTitle:   c?.title||"ไม่ระบุ",
        projectName: proj?.name||"ไม่ระบุ",
        projectId:   c?.projectId||null,
        deletedBy:   currentUser?.name||"ไม่ระบุ",
        deletedAt:   new Date().toISOString(),
      });
    } catch(e){ console.error("log delete failed", e); }
    const ok = await commitWrite(deleteDoc(doc(db,"cases",id)), "ลบเคสแล้ว");
    if(ok){ setDelCase(null); setDetailCase(null); }
  }

  // ── Notification actions ──
  const unreadCount = notifications.filter(n=>!n.read).length;
  async function markNotifRead(nid){
    try { await setDoc(doc(db,"notifications",nid),{ read:true },{ merge:true }); }
    catch(e){ console.error("markNotifRead error:",e); }
  }
  async function markAllRead(){
    try {
      const batch = writeBatch(db);
      notifications.filter(x=>!x.read).forEach(n=>{
        batch.set(doc(db,"notifications",n.id),{ read:true },{ merge:true });
      });
      await batch.commit();
    } catch(e){ console.error("markAllRead error:",e); showToast("อ่านทั้งหมดไม่สำเร็จ ลองใหม่"); }
  }

  // ── Case log actions ──
  async function saveUpdate(updated){
    if(saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const ok = await commitWrite(setDoc(doc(db,"cases",updated.id), {...updated, updatedAt: now, activityAt: now}), "อัปเดตความคืบหน้าแล้ว");
    if(ok) setUpdateCase(null);
    setSaving(false);
  }
  async function saveChecklist(updated){
    if(saving) return;
    setSaving(true);
    const ok = await commitWrite(setDoc(doc(db,"cases",updated.id), {...updated, updatedAt: new Date().toISOString()}), "บันทึก Checklist แล้ว");
    if(ok) setDetailCase(updated);
    setSaving(false);
  }

  async function saveOnsite(data) {
    if (saving) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db,"onsiteLog"), data);
      if (data.caseId) {
        await setDoc(doc(db,"cases",data.caseId), { onsiteId: ref.id }, { merge:true });
        setDetailCase(prev => prev ? { ...prev, onsiteId: ref.id } : prev);
      }
      setToast({ msg:"📍 บันทึก Onsite แล้ว", type:"ok" });
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function saveHandover(updated){
    if(saving) return;
    setSaving(true);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    batch.set(doc(db,"cases",updated.id), {...updated, updatedAt: now, activityAt: now});
    const log = updated.handoverLog||[];
    const latest = log[log.length-1];
    let toUser = null;
    if(latest){
      toUser = users.find(u=>u.name===latest.to)||null;
      if(toUser){
        batch.set(doc(db,"notifications",Date.now().toString()), {
          type:"handover", toUid:toUser.id, toName:toUser.name,
          fromName:latest.from, caseTitle:updated.title, caseId:updated.id,
          note:latest.note||"", createdAt:new Date().toISOString(), read:false,
        });
      }
    }
    const ok = await commitWrite(batch.commit(), "ส่งต่องานเรียบร้อย");
    if(ok){
      setHandoverCase(null);
      if(toUser && latest){
        fetch("/api/send-notification",{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ toUid:toUser.id, title:`งานใหม่จาก ${latest.from}`, body:updated.title, caseId:updated.id }),
        }).catch(e=>console.warn("send-notification fetch error:", e));
      }
    }
    setSaving(false);
  }

  // ── Project actions ──
  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type:"binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
      // map columns: Project ID, Ref. Code, Project Full Name, Status
      const mapped = rows.map((r,i) => ({
        key: i,
        code: String(r["Project ID"]||"").trim(),
        name: String(r["Ref. Code"]||r["Project Full Name"]||"").trim(),
        fullName: String(r["Project Full Name"]||"").trim(),
        status: String(r["Status"]||"").trim(),
      })).filter(r => r.name);
      setImportRows(mapped);
      const sel = {};
      mapped.forEach(r => { sel[r.key] = true; });
      setImportSelected(sel);
      setImportModal(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function doImport() {
    if (saving) return;
    setSaving(true);
    const toImport = importRows.filter(r => importSelected[r.key]);
    const batch = writeBatch(db);
    toImport.forEach((r, i) => {
      const pid = Date.now().toString() + i;
      const color = COLOR_OPTS[i % COLOR_OPTS.length];
      batch.set(doc(db,"projects",pid), {
        code: r.code, name: r.name, color,
        warrantyEnd: null, leaseEnd: null, sites: [],
      });
    });
    const ok = await commitWrite(batch.commit(), `Import ${toImport.length} โครงการแล้ว`);
    if (ok) { setImportModal(false); setImportRows([]); setImportSelected({}); }
    setSaving(false);
  }

  function openAddProj(){ setEditProjId(null); setNewProjCode(""); setNewProjName(""); setNewProjColor(COLOR_OPTS[0]); setNewProjWarranty(""); setNewProjLease(""); setNewProjSites([]); setProjModal(true); }
  function openEditProj(p){ setEditProjId(p.id); setNewProjCode(p.code||""); setNewProjName(p.name); setNewProjColor(p.color); setNewProjWarranty(p.warrantyEnd||""); setNewProjLease(p.leaseEnd||""); setNewProjSites((p.sites||[]).map(s=>typeof s==="object"?s:{name:s,refCode:"",travelRate:0})); setProjModal(true); }
  async function submitProj(){
    const name=newProjName.trim(); if(!name||saving) return;
    setSaving(true);
    const pid = editProjId||Date.now().toString();
    const warrantyEnd = newProjWarranty||null;
    const leaseEnd    = newProjLease||null;
    const batch = writeBatch(db);
    const code = newProjCode.trim();
    batch.set(doc(db,"projects",pid),{ code, name, color:newProjColor, warrantyEnd, leaseEnd, sites:newProjSites });
    if(editProjId){
      cases.filter(c=>c.projectId===editProjId).forEach(c=>{
        batch.set(doc(db,"cases",c.id),{ warrantyEnd, leaseEnd },{ merge:true });
      });
    }
    const ok = await commitWrite(batch.commit(), editProjId?"บันทึกโครงการแล้ว":"สร้างโครงการแล้ว");
    if(ok){ setNewProjCode(""); setNewProjName(""); setEditProjId(null); setProjModal(false); }
    setSaving(false);
  }
  async function removeProj(pid){
    const batch=writeBatch(db);
    batch.delete(doc(db,"projects",pid));
    cases.filter(c=>c.projectId===pid).forEach(c=>batch.delete(doc(db,"cases",c.id)));
    const ok = await commitWrite(batch.commit(), "ลบโครงการแล้ว");
    if(ok){ if(view===pid) setView("overview"); setDelProj(null); }
  }

  const scopeCases = view==="overview"?cases:cases.filter(c=>c.projectId===view);
  const stats = {
    total:scopeCases.length,
    open:scopeCases.filter(c=>c.status==="open").length,
    done:scopeCases.filter(c=>c.status==="done").length,
    hold:scopeCases.filter(c=>c.status==="hold").length,
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
  if(onsitePage) return <OnsitePage onBack={()=>setOnsitePage(false)} projects={projects} users={users} currentUser={currentUser}/>;
  if(shiftPage) return <ShiftCalendar onBack={()=>setShiftPage(false)} currentUser={currentUser} users={users} shiftTypes={shiftTypes} shifts={shifts} userSchedules={userSchedules} shiftMembers={shiftMembers} refreshSchedules={refreshSchedules} refreshShiftTypes={refreshShiftTypes} refreshShiftMembers={refreshShiftMembers}/>;
  if(dashboardPage && currentUser?.role==="admin") return <Dashboard onBack={()=>setDashboardPage(false)} cases={cases} projects={projects} users={users} deletedCases={deletedCases}/>;

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
        .notif-backdrop{ position:fixed; inset:0; z-index:500; }
        .notif-handle{ display:none; }
        @media (min-width: 768px){
          .notif-backdrop{ background:transparent; }
          .notif-panel{ position:absolute; top:64px; right:16px; width:360px; max-height:70vh;
            background:#fff; border:1px solid #e2e8f0; border-radius:14px;
            box-shadow:0 12px 40px rgba(0,0,0,.15); display:flex; flex-direction:column; overflow:hidden; }
        }
        @media (max-width: 767px){
          .notif-backdrop{ background:rgba(15,23,42,.55); backdrop-filter:blur(4px);
            display:flex; align-items:flex-end; justify-content:center; }
          .notif-panel{ background:#fff; border-radius:20px 20px 0 0; width:100%;
            height:75vh; display:flex; flex-direction:column; box-shadow:0 -8px 40px rgba(0,0,0,.2); }
          .notif-handle{ display:block; width:40px; height:4px; background:#e2e8f0;
            border-radius:2px; margin:12px auto 0; }
        }
      `}</style>

      {/* TOP NAV */}
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
          {!isMobile && currentUser?.role==="admin" && (
            <button onClick={()=>setAdminPage(true)} style={{ background:"#f5f3ff",border:"1px solid #ddd6fe",
              color:"#7c3aed",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>👥</button>
          )}
          {!isMobile && currentUser?.role==="admin" && (
            <button onClick={()=>setDashboardPage(true)} style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",
              color:"#16a34a",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>📊</button>
          )}
          {!isMobile && (
            <button onClick={()=>setShiftPage(true)} style={{ background:"#fefce8",border:"1px solid #fde68a",
              color:"#854d0e",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>📅</button>
          )}
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
          {!isMobile && (
            <button onClick={onSignOut} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
              color:"#64748b",borderRadius:8,padding:"8px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit" }}
              title="ออกจากระบบ">🚪</button>
          )}
        </div>
      </header>

      {/* DRAWER */}
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
            <div style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #e2e8f0" }}>
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
            {currentUser?.role==="admin" && (
              <DrawerItem active={false} color="#16a34a" icon="📊" label="Dashboard" count={""}
                onClick={()=>{ setDashboardPage(true); setMenuOpen(false); }}/>
            )}
            <DrawerItem active={false} color="#854d0e" icon="📅" label="ตารางกะ" count={""}
              onClick={()=>{ setShiftPage(true); setMenuOpen(false); }}/>
            <DrawerItem active={false} color="#f97316" icon="📍" label="Onsite" count={""}
              onClick={()=>{ setOnsitePage(true); setMenuOpen(false); }}/>
            <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,padding:"14px 8px 6px" }}>โครงการ</div>
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
                  {currentUser?.role==="admin"&&(
                    <button onClick={()=>{ setDelProj(p.id); setMenuOpen(false); }}
                      style={{ background:"none",border:"none",color:"#fca5a5",cursor:"pointer",padding:"6px",fontSize:13 }}>✕</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6 }}>
              <button onClick={()=>{ openAddProj(); setMenuOpen(false); }}
                style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
                  border:"1.5px dashed #e2e8f0",borderRadius:8,padding:"10px 8px",cursor:"pointer",
                  fontFamily:"inherit",color:"#94a3b8",fontSize:12 }}>
                <span style={{ fontSize:15,lineHeight:1 }}>+</span> เพิ่มโครงการ
              </button>
              <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
                border:"1.5px dashed #e2e8f0",borderRadius:8,padding:"10px 8px",cursor:"pointer",
                fontFamily:"inherit",color:"#94a3b8",fontSize:12 }}>
                <span style={{ fontSize:14 }}>📥</span> Import Excel
                <input type="file" accept=".xlsx,.xls" style={{ display:"none" }}
                  onChange={e=>{ setMenuOpen(false); handleImportFile(e); }}/>
              </label>
            </div>
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

      {/* MAIN CONTENT */}
      <div style={{ padding:"16px 16px 100px" }}>
        {view!=="overview" && (
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}>
            <button onClick={()=>setView("overview")} style={{ background:"none",border:"none",
              color:"#94a3b8",cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0 }}>ภาพรวม</button>
            <span style={{ color:"#cbd5e1" }}>›</span>
            <span style={{ fontSize:13,fontWeight:700,color:activeProj?.color||"#0f172a" }}>{activeProj?.name}</span>
          </div>
        )}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16 }}>
          {[
            {label:"ทั้งหมด",      val:stats.total,        color:"#2563eb", key:"all"},
            {label:"เปิดเคส",      val:stats.open,         color:"#f59e0b", key:"open"},
            {label:"เสร็จ",        val:stats.done,         color:"#10b981", key:"done"},
            {label:"รอดำเนินการ",  val:stats.hold,         color:"#ef4444", key:"hold"},
            {label:"ใกล้หมด",     val:stats.expiringSoon, color:"#f59e0b", key:"__exp"},
          ].map(s=>(
            <div key={s.key} onClick={()=>setFilterStat(filterStat===s.key?"all":s.key)}
              style={{ background:filterStat===s.key?s.color+"12":"#fff",
                border:`1.5px solid ${filterStat===s.key?s.color+"50":"#e2e8f0"}`,
                borderRadius:12,padding:"12px 10px",cursor:"pointer",textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:600,letterSpacing:.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ position:"relative",marginBottom:14 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#cbd5e1",fontSize:16 }}>⌕</span>
          <input placeholder="ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)}
            style={IS({ paddingLeft:36,borderRadius:10,fontSize:14 })}/>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap" }}>📅 ช่วงวันที่:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer" }}/>
          <span style={{ fontSize:12,color:"#94a3b8" }}>ถึง</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer" }}/>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {[
              { label:"วันนี้",    fn:()=>{ const t=today(); setDateFrom(t); setDateTo(t); }},
              { label:"7 วัน",    fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-6); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); }},
              { label:"30 วัน",   fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-29); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); }},
              { label:"เดือนนี้", fn:()=>{ const n=new Date(); setDateFrom(n.getFullYear()+"-"+(String(n.getMonth()+1).padStart(2,"0"))+"-01"); setDateTo(today()); }},
            ].map(p=>(
              <button key={p.label} onClick={p.fn}
                style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>
                {p.label}
              </button>
            ))}
            {(dateFrom||dateTo)&&(
              <button onClick={()=>{ setDateFrom(""); setDateTo(""); }}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>
            )}
          </div>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap" }}>
          <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap" }}>👤 ผู้ดำเนินการ:</span>
          <select value={filterTech} onChange={e=>setFilterTech(e.target.value)}
            style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,color:"#1e293b",padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer",minWidth:160 }}>
            <option value="all">ทั้งหมด</option>
            {users.filter(u=>u.role!=="pending").sort((a,b)=>a.name.localeCompare(b.name)).map(u=>(
              <option key={u.id} value={u.name}>{u.name}{u.role==="admin"?" (Admin)":""}</option>
            ))}
          </select>
          {filterTech!=="all"&&(
            <span style={{ background:"#dbeafe",color:"#2563eb",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6 }}>
              {filterTech}
              <button onClick={()=>setFilterTech("all")} style={{ background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:13,padding:0,lineHeight:1 }}>×</button>
            </span>
          )}
        </div>
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
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>
            เคส ({visibleCases.length})
          </div>
          {visibleCases.length>0&&(
            <button onClick={exportToExcel}
              style={{ background:"#f0fdf4",border:"1.5px solid #86efac",color:"#16a34a",
                borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
              📥 Export Excel
            </button>
          )}
        </div>
        {visibleCases.length===0 ? (
          <div style={{ background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,padding:"48px 20px",textAlign:"center",color:"#cbd5e1" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📋</div>
            <div style={{ fontSize:14,marginBottom:12 }}>ยังไม่มีเคส</div>
            <button onClick={openAddCase} style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>+ บันทึกเคสแรก</button>
          </div>
        ) : (
          <>
            {pagedCases.map(c=>{
              const proj=projects.find(p=>p.id===c.projectId);
              return (
                <CaseCard key={c.id} c={c} proj={proj}
                  showExpiry={filterStat==="__exp"}
                  onClick={()=>setDetailCase(c)}
                  onEdit={()=>openEditCase(c)}
                  onUpdate={()=>setUpdateCase(c)}
                  onHandover={()=>setHandoverCase(c)}
                  onDel={()=>setDelCase(c.id)}/>
              );
            })}
            {totalPages > 1 && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:16,flexWrap:"wrap" }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{ background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:8,
                    padding:"8px 14px",fontSize:13,fontWeight:600,cursor:page===1?"default":"pointer",
                    color:page===1?"#cbd5e1":"#475569",fontFamily:"inherit" }}>←</button>
                {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                  <button key={p} onClick={()=>setPage(p)}
                    style={{ background:page===p?"#2563eb":"#fff",
                      border:`1.5px solid ${page===p?"#2563eb":"#e2e8f0"}`,
                      borderRadius:8,padding:"8px 13px",fontSize:13,fontWeight:600,
                      cursor:"pointer",color:page===p?"#fff":"#475569",fontFamily:"inherit",
                      minWidth:38 }}>{p}</button>
                ))}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:8,
                    padding:"8px 14px",fontSize:13,fontWeight:600,cursor:page===totalPages?"default":"pointer",
                    color:page===totalPages?"#cbd5e1":"#475569",fontFamily:"inherit" }}>→</button>
                <span style={{ fontSize:12,color:"#94a3b8",marginLeft:4 }}>หน้า {page}/{totalPages}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAddCase} style={{ position:"fixed",bottom:24,right:20,
        background:"linear-gradient(135deg,#2563eb,#7c3aed)",border:"none",color:"#fff",
        width:56,height:56,borderRadius:"50%",fontSize:26,cursor:"pointer",
        boxShadow:"0 6px 20px rgba(37,99,235,.4)",zIndex:40,display:"flex",
        alignItems:"center",justifyContent:"center",lineHeight:1 }}>+</button>

      {/* MODALS */}
      <CaseModal open={caseModal} onClose={()=>setCaseModal(false)}
        editCase={editCase} caseForm={caseForm} setCaseForm={setCaseForm}
        projects={projects} users={users} currentUser={currentUser}
        saving={saving} onSubmit={submitCase}/>

      <DetailModal detailCase={detailCase} onClose={()=>setDetailCase(null)}
        users={users}
        projects={projects}
        onEdit={()=>{ openEditCase(detailCase); setDetailCase(null); }}
        onUpdate={()=>{ setUpdateCase(detailCase); setDetailCase(null); }}
        onHandover={()=>{ setHandoverCase(detailCase); setDetailCase(null); }}
        onDelete={()=>{ setDelCase(detailCase.id); setDetailCase(null); }}
        onChecklist={saveChecklist}
        onOnsite={saveOnsite}/>

      {importModal && (
        <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={()=>setImportModal(false)}>
          <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:600,
            maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
            padding:"24px" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
                📥 Import โครงการ ({importRows.length} รายการ)
              </h2>
              <button onClick={()=>setImportModal(false)}
                style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
                  fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
            </div>
            <div style={{ fontSize:12,color:"#64748b",marginBottom:12 }}>
              เลือกโครงการที่ต้องการ import — กดเลือกทั้งหมดหรือเลือกทีละรายการ
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <button onClick={()=>{ const s={}; importRows.forEach(r=>s[r.key]=true); setImportSelected(s); }}
                style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                  borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                เลือกทั้งหมด
              </button>
              <button onClick={()=>setImportSelected({})}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
                  borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิกทั้งหมด
              </button>
              <span style={{ marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"center" }}>
                เลือกแล้ว {Object.values(importSelected).filter(Boolean).length} รายการ
              </span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:16 }}>
              {importRows.map(r => (
                <label key={r.key} style={{ display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
                  padding:"8px 10px",borderRadius:8,
                  background:importSelected[r.key]?"#f0fdf4":"#f8fafc",
                  border:`1px solid ${importSelected[r.key]?"#bbf7d0":"#e2e8f0"}` }}>
                  <input type="checkbox" checked={!!importSelected[r.key]}
                    onChange={e=>setImportSelected(p=>({...p,[r.key]:e.target.checked}))}
                    style={{ marginTop:2,accentColor:"#16a34a",flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>{r.name}</div>
                    {r.code && <div style={{ fontSize:11,color:"#64748b" }}>{r.code}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
              <button onClick={()=>setImportModal(false)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={doImport} disabled={saving||Object.values(importSelected).filter(Boolean).length===0}
                style={{ background:"#16a34a",border:"none",color:"#fff",borderRadius:10,
                  padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  opacity:saving?0.7:1 }}>
                {saving?"กำลัง import...":` Import ${Object.values(importSelected).filter(Boolean).length} โครงการ`}
              </button>
            </div>
          </div>
        </div>
      )}
      <ProjectModal open={projModal} onClose={()=>setProjModal(false)}
        newProjCode={newProjCode} setNewProjCode={setNewProjCode}
        editProjId={editProjId}
        newProjName={newProjName} setNewProjName={setNewProjName}
        newProjColor={newProjColor} setNewProjColor={setNewProjColor}
        newProjWarranty={newProjWarranty} setNewProjWarranty={setNewProjWarranty}
        newProjLease={newProjLease} setNewProjLease={setNewProjLease}
        newProjSites={newProjSites} setNewProjSites={setNewProjSites}
        saving={saving} onSubmit={submitProj}/>

      {notifOpen&&(
        <div className="notif-backdrop" onClick={()=>setNotifOpen(false)}>
          <div className="notif-panel" onClick={e=>e.stopPropagation()}>
            <div className="notif-handle"/>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"14px 18px 12px",borderBottom:"1px solid #f1f5f9",flexShrink:0 }}>
              <span style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>🔔 การแจ้งเตือน
                {unreadCount>0&&<span style={{ background:"#ef4444",color:"#fff",borderRadius:20,
                  padding:"1px 7px",fontSize:11,fontWeight:700,marginLeft:8 }}>{unreadCount}</span>}
              </span>
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                {unreadCount>0&&(
                  <button onClick={markAllRead} style={{ background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>อ่านทั้งหมด</button>
                )}
                <button onClick={()=>setNotifOpen(false)}
                  style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",width:28,height:28,borderRadius:8,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY:"auto",flex:1 }}>
              {notifications.length===0?(
                <div style={{ padding:"48px 18px",textAlign:"center",color:"#cbd5e1",fontSize:14 }}>
                  <div style={{ fontSize:32,marginBottom:8 }}>🔔</div>ไม่มีการแจ้งเตือน
                </div>
              ):notifications.map(n=>(
                <div key={n.id} onClick={()=>{ markNotifRead(n.id); setNotifOpen(false); if(n.caseId){ const c=cases.find(x=>x.id===n.caseId); if(c){ setDetailCase(c); }}}}
                  style={{ padding:"14px 18px",borderBottom:"1px solid #f8fafc",background:n.read?"#fff":"#eff6ff",cursor:"pointer",transition:"background .15s" }}>
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
                          : <>มีผู้ใช้ใหม่: <span style={{ color:"#7c3aed",fontWeight:700 }}>{n.toName}</span></>}
                      </div>
                      {n.note&&<div style={{ fontSize:12,color:"#64748b",marginTop:3,background:"#f8fafc",borderRadius:6,padding:"3px 8px",display:"inline-block" }}>"{n.note}"</div>}
                      <div style={{ fontSize:11,color:"#94a3b8",marginTop:4 }}>
                        {n.createdAt?new Date(n.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"}):""}
                      </div>
                    </div>
                    {!n.read&&<span style={{ width:8,height:8,borderRadius:"50%",background:"#2563eb",flexShrink:0,marginTop:6 }}/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!delCase} onClose={()=>setDelCase(null)} title="ลบเคส?">
        {delCase&&(()=>{ const c=cases.find(x=>x.id===delCase); return c&&(
          <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:10,
            padding:"10px 14px",marginBottom:14 }}>
            <div style={{ fontSize:11,color:"#94a3b8",marginBottom:3 }}>เคสที่จะลบ</div>
            <div style={{ fontSize:14,fontWeight:700,color:"#b91c1c" }}>"{c.title}"</div>
          </div>
        ); })()}
        <p style={{ color:"#64748b",fontSize:14,marginBottom:20 }}>เคสนี้จะถูกลบถาวร ยืนยันหรือไม่?</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelCase(null)} style={{ flex:1 }}>ยกเลิก</GhostBtn>
          <button onClick={()=>deleteCase(delCase)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบ</button>
        </div>
      </Modal>

      <Modal open={!!delProj} onClose={()=>setDelProj(null)} title="ลบโครงการ?">
        <p style={{ color:"#64748b",fontSize:14,marginBottom:4 }}>โครงการและเคสทั้งหมดจะถูกลบถาวร</p>
        <p style={{ color:"#ef4444",fontSize:13,marginBottom:20 }}>⚠ ไม่สามารถกู้คืนได้</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelProj(null)} style={{ flex:1 }}>ยกเลิก</GhostBtn>
          <button onClick={()=>removeProj(delProj)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบโครงการ</button>
        </div>
      </Modal>

      <UpdateLogModal open={!!updateCase} onClose={()=>setUpdateCase(null)}
        caseData={updateCase} onSave={saveUpdate} currentUser={currentUser}/>
      <HandoverModal open={!!handoverCase} onClose={()=>setHandoverCase(null)}
        caseData={handoverCase} onSave={saveHandover} users={users}/>

      {toast&&(
        <div style={{ position:"fixed",left:"50%",top:64,transform:"translateX(-50%)",zIndex:9999,maxWidth:"90vw",pointerEvents:"none" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,
            background:toast.type==="error"?"#fef2f2":"#f0fdf4",
            border:`1px solid ${toast.type==="error"?"#fecaca":"#bbf7d0"}`,
            color:toast.type==="error"?"#b91c1c":"#15803d",
            borderRadius:12,padding:"12px 18px",fontSize:14,fontWeight:600,
            boxShadow:"0 8px 24px rgba(0,0,0,.12)",fontFamily:"inherit" }}>
            <span style={{ fontSize:16 }}>{toast.type==="error"?"⚠️":"✅"}</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerItem({ active, onClick, icon, label, count, color }) {
  return (
    <button onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
      width:"100%",background:active?color+"12":"transparent",
      border:active?`1px solid ${color}25`:"1px solid transparent",
      borderRadius:8,padding:"10px 10px",cursor:"pointer",fontFamily:"inherit",marginBottom:2,textAlign:"left" }}>
      <span style={{ display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0 }}>
        <span style={{ fontSize:9,color:active?color:"#cbd5e1" }}>{icon}</span>
        <span style={{ fontSize:13,color:active?"#0f172a":"#64748b",fontWeight:active?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
      </span>
      <span style={{ fontSize:11,background:active?color+"15":"#f1f5f9",borderRadius:20,padding:"2px 8px",color:active?color:"#94a3b8",flexShrink:0,marginLeft:4,fontWeight:600 }}>{count}</span>
    </button>
  );
}
