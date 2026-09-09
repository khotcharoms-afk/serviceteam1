import { useState, useEffect } from "react";
import { ThemeContext, THEMES } from "./theme.js";
import { db, auth, registerPushSubscription } from "./firebase";
import { doc, setDoc, deleteDoc, writeBatch, collection, addDoc, onSnapshot } from "firebase/firestore";
import { today, fmtDate, daysLeft, emptyCase, COLOR_OPTS, STATUS_OPTS, IS } from "./utils.js";
import * as XLSX from "xlsx";
import { WarrantyPill, LeasePill, StatusPill, Modal, Field, PrimaryBtn, GhostBtn } from "./UI.jsx";
import CaseCard from "./CaseCard.jsx";
import HandoverModal from "./HandoverModal.jsx";
import LeavePage from "./LeavePage.jsx";
import UpdateLogModal from "./UpdateLogModal.jsx";
import AdminUsers from "./AdminUsers.jsx";
import { useFirestore } from "./hooks/useFirestore.js";
import CaseModal from "./components/CaseModal.jsx";
import ProjectModal from "./components/ProjectModal.jsx";
import DetailModal from "./components/DetailModal.jsx";
import Dashboard from "./Dashboard.jsx";
import ShiftCalendar from "./ShiftCalendar.jsx";
import OnsitePage from "./OnsitePage.jsx";
import Drawer from "./Drawer.jsx";
import ImportModal from "./ImportModal.jsx";
import NavBar from "./NavBar.jsx";
import OTPage from "./OTPage.jsx";
import RobotStatsPage from "./RobotStatsPage.jsx";
import KnowledgeHub from "./KnowledgeHub.jsx";
import ProfilePage from "./ProfilePage.jsx";
import TaskBoard from "./TaskBoard.jsx";

export default function App({ currentUser, onSignOut }) {
  const { projects, cases, users, notifications, deletedCases, shifts, shiftTypes, userSchedules, shiftMembers, onsiteRecords, tasks, loading, refreshProjects, refreshShifts, refreshSchedules, refreshShiftTypes, refreshShiftMembers } = useFirestore();

  const isAdminOrDev = ["admin","dev"].includes(currentUser?.role);

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
  const [taskPage,setTaskPage]     = useState(false);
  const [knowledgePage,setKnowledgePage] = useState(false);
  const [otPage,setOtPage]         = useState(false);
  const [robotStatsPage,setRobotStatsPage] = useState(false);
  const [profilePage,setProfilePage] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [globalQ, setGlobalQ]           = useState("");
  const [leavePage,setLeavePage]   = useState(false);
  const [onlineUsers,setOnlineUsers] = useState([]);
  const [darkMode,setDarkMode] = useState(false);
  const themeC = THEMES[darkMode ? "dark" : "light"];
  const [showOnlineUsers,setShowOnlineUsers] = useState(false);
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
  const [importCaseModal,setImportCaseModal] = useState(false);
  const [importCaseRows,setImportCaseRows]   = useState([]);
  const [importCaseSel,setImportCaseSel]     = useState({});
  const [importSelected,setImportSelected] = useState({});
  const [editProjId,setEditProjId]     = useState(null);
  const [delProj,setDelProj]           = useState(null);
  const [caseForm,setCaseForm]         = useState(emptyCase);
  const [newProjCode,setNewProjCode]   = useState("");
  const [newProjName,setNewProjName]   = useState("");
  const [newProjColor,setNewProjColor] = useState(COLOR_OPTS[0]);
  const [newProjWarranty,setNewProjWarranty] = useState("");
  const [newProjLease,setNewProjLease]       = useState("");
  const [newProjHirePurchase,setNewProjHirePurchase] = useState("");
  const [newProjCustomer,setNewProjCustomer]         = useState("");
  const [newProjContractType,setNewProjContractType] = useState("");
  const [newProjContractStart,setNewProjContractStart] = useState("");
  const [newProjProjectStatus,setNewProjProjectStatus] = useState("");
  const [newProjSites,setNewProjSites]       = useState([]);

  const [toast,setToast]   = useState(null);
  const [saving,setSaving] = useState(false);
  const [page,setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset pagination เมื่อ filter เปลี่ยน
  useEffect(()=>{ setPage(1); },[view,filterStat,filterTech,search,dateFrom,dateTo]);

  // ส่งสัญญาณ "ยังออนไลน์อยู่" ทุก 30 วิ ตราบใดที่เปิดแอปอยู่
  useEffect(()=>{
    if(!currentUser?.id) return;
    const beat = () => {
      setDoc(doc(db,"presence",currentUser.id), {
        name: currentUser.name||"", role: currentUser.role||"",
        lastSeen: new Date().toISOString(),
      }, { merge:true }).catch(()=>{});
    };
    beat();
    const interval = setInterval(beat, 30000);
    return ()=>clearInterval(interval);
  },[currentUser?.id]);

  // เฉพาะ dev เท่านั้นที่ subscribe รายชื่อคนออนไลน์ (คนอื่นไม่ต้องยิง request นี้)
  useEffect(()=>{
    if(currentUser?.role!=="dev") return;
    const unsub = onSnapshot(collection(db,"presence"), (snap)=>{
      const now = Date.now();
      const list = [];
      snap.forEach((d)=>{
        const data = d.data();
        const last = new Date(data.lastSeen).getTime();
        if(now - last < 2*60*1000) list.push({ id:d.id, name:data.name, role:data.role, lastSeen:data.lastSeen });
      });
      list.sort((a,b)=> new Date(b.lastSeen)-new Date(a.lastSeen));
      setOnlineUsers(list);
    });
    return ()=>unsub();
  },[currentUser?.role]);

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
    const proj = projects.find(p=>p.id===c.projectId);
    return !q||[c.title,c.type,c.tech,c.site,c.note,proj?.name].some(x=>x?.toLowerCase().includes(q));
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
    const now = new Date().toISOString();
    const payload = {
      ...rest, techs,
      tech: techs[0]||caseForm.tech||"",
      warrantyEnd: proj?.warrantyEnd||null,
      leaseEnd:    proj?.leaseEnd||null,
      site: caseForm.site==="__other__" ? "" : caseForm.site,
      updatedAt: now,
      // activityAt เฉพาะตอนสร้างเคสใหม่ ไม่ใช่แก้ไข
      ...(!editCase && { activityAt: now }),
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

  async function saveOnsite(data, recordId) {
    if (saving) return;
    setSaving(true);
    try {
      const isAdmin = currentUser?.role === "admin";
      const id = recordId || Date.now().toString();
      const payload = {
        ...data,
        createdBy: data.createdBy || currentUser?.name || "",
        createdByUid: currentUser?.id || "",
        updatedAt: new Date().toISOString(),
      };
      if (!recordId) payload.createdAt = new Date().toISOString();
      await setDoc(doc(db,"onsiteRecords",id), payload, { merge: true });

      // แจ้ง admin ถ้าเป็น user บันทึก (สถานะ pending)
      if (!isAdmin && payload.status === "pending") {
        const admins = users.filter(u => u.role === "admin");
        const batch = writeBatch(db);
        admins.forEach(a => {
          batch.set(doc(db,"notifications",Date.now().toString()+a.id.slice(0,4)), {
            type:"onsite", toUid:a.id, toName:a.name,
            fromName:currentUser?.name||"", onsiteId:id,
            message:`ขอ Onsite: ${data.projectName||""} (${(data.totalCost||0).toLocaleString()} บ.)`,
            createdAt:new Date().toISOString(), read:false,
          });
        });
        await batch.commit();
      }
      showToast(recordId ? "📍 แก้ไข Onsite แล้ว" : "📍 บันทึก Onsite แล้ว", "success");
    } catch(e) { console.error(e); showToast("บันทึกไม่สำเร็จ ลองใหม่"); }
    setSaving(false);
  }

  async function approveOnsite(recordId, status) {
    try {
      const rec = onsiteRecords.find(r => r.id === recordId);
      await setDoc(doc(db,"onsiteRecords",recordId), {
        status,
        approvedBy: currentUser?.name || "",
        approvedAt: new Date().toISOString(),
      }, { merge: true });
      // แจ้งเจ้าของกลับ
      if (rec?.createdByUid) {
        const statusText = status==="approved" ? "อนุมัติแล้ว ✅" : status==="rejected" ? "ไม่อนุมัติ ❌" : "คืนเป็นรออนุมัติ";
        await setDoc(doc(db,"notifications",Date.now().toString()), {
          type:"onsite", toUid:rec.createdByUid, toName:rec.createdBy||"",
          fromName:currentUser?.name||"", onsiteId:recordId,
          message:`Onsite ${rec.projectName||""} — ${statusText}`,
          createdAt:new Date().toISOString(), read:false,
        });
      }
      showToast(status==="approved"?"อนุมัติแล้ว":status==="rejected"?"ไม่อนุมัติแล้ว":"คืนสถานะแล้ว", "success");
    } catch(e) { console.error(e); showToast("ดำเนินการไม่สำเร็จ"); }
  }

  async function deleteOnsite(recordId) {
    try {
      await deleteDoc(doc(db,"onsiteRecords",recordId));
      showToast("ลบรายการ Onsite แล้ว", "success");
    } catch(e) { console.error(e); showToast("ลบไม่สำเร็จ ลองใหม่"); }
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
      // ลองอ่านแบบปกติก่อน ถ้าไม่เจอชื่อโครงการ ให้ข้าม header แถวแรก
      let rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
      const hasThai = rows.length>0 && rows[0]["ชื่อโครงการ"]!==undefined;
      const hasSkipHeader = rows.length>0 && rows[0]["ลำดับที่"]==="ลำดับที่";
      if (!hasThai || hasSkipHeader) {
        rows = XLSX.utils.sheet_to_json(ws, { defval:"", range:1 });
      }
      // map columns from PMA file
      const fmtDate = v => {
        if (!v) return null;
        if (typeof v === "number") {
          const d = new Date((v - 25569) * 86400000);
          return d.toISOString().slice(0,10);
        }
        const s = String(v).trim();
        if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
        return null;
      };
      const mapped = rows.map((r,i) => {
        // รองรับทั้งไฟล์ MA (ภาษาไทย) และไฟล์ NetSuite (ภาษาอังกฤษ)
        const isPMA = !!r["ชื่อโครงการ"];
        const contractRaw = String(r["ระบบขายขาด/เช่า"]||"").trim();
        const contractType = contractRaw.includes("เช่่า")||contractRaw.includes("เช่า") ? "เช่า"
          : contractRaw.includes("ขายขาด") ? "ขายขาด" : contractRaw||"";
        const warrantyEnd  = fmtDate(r["วันสิ้นสุดระยะประกันของโครงการ"]);
        const contractStart= fmtDate(r["วันเริ่มต้นระยะประกันของโครงการ"]);
        return {
          key: i,
          code:          String(isPMA ? (r["เลขที่โครงการ"]||"") : (r["Project ID"]||"")).trim(),
          name:          String(isPMA ? (r["ชื่อโครงการ"]||"") : (r["Project Full Name"]||r["Ref. Code"]||"")).trim(),
          customer:      String(isPMA ? (r["ลูกค้า"]||"") : "").trim(),
          contractType,
          contractStart,
          warrantyEnd,
          leaseEnd:      contractType==="เช่า" ? warrantyEnd : null,
          projectStatus: String(r["สถานะของโครงการ"]||"").trim(),
        };
      }).filter(r => r.name);
      setImportRows(mapped);
      const sel = {};
      mapped.forEach(r => { sel[r.key] = true; });
      setImportSelected(sel);
      setImportModal(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  function handleImportCaseFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type:"binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
      const statusMap = { "ปิด":"done","รอดำเนินการ":"hold","กำลังดำเนินการ":"inprogress","เปิดเคส":"open","เสร็จสิ้น":"done" };
      const mapped = rows.map((r,i) => ({
        key: i,
        id: String(r["เลขเคส/ID"]||"").trim() || Date.now().toString()+i,
        title: String(r["ชื่อเรื่อง"]||"").trim(),
        site: String(r["ลูกค้า/Site"]||"").trim(),
        projectName: String(r["Project"]||"").trim(),
        type: String(r["ประเภท"]||"อื่นๆ").trim(),
        status: statusMap[String(r["สถานะ"]||"").trim()] || "open",
        techs: String(r["ผู้ดำเนินการ"]||"").split(",").map(x=>x.trim()).filter(Boolean),
        date: String(r["วันที่เปิด"]||"").slice(0,10) || today(),
        note: String(r["หมายเหตุ"]||"").trim(),
      })).filter(r => r.title);
      setImportCaseRows(mapped);
      const sel = {};
      mapped.forEach(r => { sel[r.key] = true; });
      setImportCaseSel(sel);
      setImportCaseModal(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function doImportCases() {
    if (saving) return;
    setSaving(true);
    const toImport = importCaseRows.filter(r => importCaseSel[r.key]);
    const batch = writeBatch(db);
    toImport.forEach(r => {
      const proj = projects.find(p => p.name?.toLowerCase().includes(r.projectName?.toLowerCase()) || r.projectName?.toLowerCase().includes(p.name?.toLowerCase()));
      const now = new Date().toISOString();
      batch.set(doc(db,"cases",r.id), {
        title: r.title,
        site: r.site,
        projectId: proj?.id || "",
        type: r.type,
        status: r.status,
        techs: r.techs,
        tech: r.techs[0]||"",
        date: r.date,
        note: r.note,
        warrantyEnd: proj?.warrantyEnd||null,
        leaseEnd: proj?.leaseEnd||null,
        handoverLog: [],
        updateLog: [],
        updatedAt: now,
        activityAt: now,
      });
    });
    const ok = await commitWrite(batch.commit(), `Import ${toImport.length} เคสแล้ว`);
    if (ok) { setImportCaseModal(false); setImportCaseRows([]); setImportCaseSel({}); }
    setSaving(false);
  }

  async function doImport() {
    if (saving) return;
    setSaving(true);
    const toImport = importRows.filter(r => importSelected[r.key]);
    // กัน import ซ้ำ — เช็คชื่อกับโครงการที่มีอยู่แล้ว
    const existingNames = new Set(projects.map(p => (p.name||"").trim().toLowerCase()));
    const newOnly    = toImport.filter(r => !existingNames.has((r.name||"").trim().toLowerCase()));
    const dupCount   = toImport.length - newOnly.length;
    if (newOnly.length === 0) {
      showToast(`ทุกโครงการมีอยู่แล้วในระบบ (${dupCount} รายการซ้ำ)`, "error");
      setSaving(false); return;
    }
    const batch = writeBatch(db);
    newOnly.forEach((r, i) => {
      const pid = Date.now().toString() + i;
      const color = COLOR_OPTS[i % COLOR_OPTS.length];
      batch.set(doc(db,"projects",pid), {
        code: r.code, name: r.name, color,
        customer: r.customer||null,
        contractType: r.contractType||null,
        contractStart: r.contractStart||null,
        warrantyEnd: r.warrantyEnd||null,
        leaseEnd: r.leaseEnd||null,
        hirePurchaseEnd: null,
        projectStatus: r.projectStatus||null,
        sites: [],
      });
    });
    const msg = dupCount > 0
      ? `Import ${newOnly.length} โครงการแล้ว (ข้าม ${dupCount} รายการที่มีอยู่แล้ว)`
      : `Import ${newOnly.length} โครงการแล้ว`;
    const ok = await commitWrite(batch.commit(), msg);
    if (ok) { setImportModal(false); setImportRows([]); setImportSelected({}); refreshProjects(); }
    setSaving(false);
  }

  function openAddProj(){ setEditProjId(null); setNewProjCode(""); setNewProjName(""); setNewProjColor(COLOR_OPTS[0]); setNewProjWarranty(""); setNewProjLease(""); setNewProjSites([]); setProjModal(true); }
  function openEditProj(p){ setEditProjId(p.id); setNewProjCode(p.code||""); setNewProjName(p.name); setNewProjColor(p.color); setNewProjWarranty(p.warrantyEnd||""); setNewProjLease(p.leaseEnd||""); setNewProjHirePurchase(p.hirePurchaseEnd||""); setNewProjCustomer(p.customer||""); setNewProjContractType(p.contractType||""); setNewProjContractStart(p.contractStart||""); setNewProjProjectStatus(p.projectStatus||""); setNewProjSites((p.sites||[]).map(s=>typeof s==="object"?s:{name:s,refCode:"",travelRate:0})); setProjModal(true); }
  async function submitProj(){
    const name=newProjName.trim(); if(!name||saving) return;
    setSaving(true);
    const pid = editProjId||Date.now().toString();
    const warrantyEnd     = newProjWarranty||null;
    const leaseEnd        = newProjLease||null;
    const hirePurchaseEnd = newProjHirePurchase||null;
    const customer      = newProjCustomer.trim()||null;
    const contractType  = newProjContractType||null;
    const contractStart = newProjContractStart||null;
    const projectStatus = newProjProjectStatus||null;
    const batch = writeBatch(db);
    const code = newProjCode.trim();
    batch.set(doc(db,"projects",pid),{ code, name, color:newProjColor, warrantyEnd, leaseEnd, hirePurchaseEnd, customer, contractType, contractStart, projectStatus, sites:newProjSites });
    if(editProjId){
      cases.filter(c=>c.projectId===editProjId).forEach(c=>{
        batch.set(doc(db,"cases",c.id),{ warrantyEnd, leaseEnd, hirePurchaseEnd },{ merge:true });
      });
    }
    const ok = await commitWrite(batch.commit(), editProjId?"บันทึกโครงการแล้ว":"สร้างโครงการแล้ว");
    if(ok){ setNewProjCode(""); setNewProjName(""); setEditProjId(null); setProjModal(false); refreshProjects(); }
    setSaving(false);
  }
  async function removeProj(pid){
    const batch=writeBatch(db);
    batch.delete(doc(db,"projects",pid));
    cases.filter(c=>c.projectId===pid).forEach(c=>batch.delete(doc(db,"cases",c.id)));
    const ok = await commitWrite(batch.commit(), "ลบโครงการแล้ว");
    if(ok) refreshProjects();
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
    <div style={{ minHeight:"100vh",background:themeC.bg,display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:"'Noto Sans Thai',sans-serif",color:themeC.text400,fontSize:14 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32,color:"#2563eb",marginBottom:10 }}>◈</div>
        กำลังโหลด...
      </div>
    </div>
  );

  if(adminPage) return <AdminUsers onBack={()=>setAdminPage(false)} currentUser={currentUser} db={db} />;
  if(leavePage) return <LeavePage onBack={()=>setLeavePage(false)} currentUser={currentUser} users={users}/>;
  if(profilePage) return <ProfilePage onBack={()=>setProfilePage(false)} currentUser={currentUser} onSignOut={onSignOut}/>;
  if(otPage) return <OTPage onBack={()=>setOtPage(false)}
    projects={projects} users={users} currentUser={currentUser}/>;
  if(taskPage) return <TaskBoard onBack={()=>setTaskPage(false)}
    projects={projects} users={users} cases={cases} currentUser={currentUser}
    tasks={tasks} saving={saving}
    onSaveTask={async(data,id)=>{
      const docId = id||Date.now().toString();
      const isNew = !id;
      const prevTask = id ? (tasks||[]).find(t=>t.id===id) : null;
      await setDoc(doc(db,"tasks",docId),data,{merge:true});

      const STATUS_LABEL = { todo:"รอรับงาน", accepted:"รับแล้ว", inprogress:"กำลังทำ", done:"เสร็จแล้ว" };
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      if (isNew && (data.assignees||[]).length>0) {
        // แจ้งผู้รับผิดชอบเมื่อสร้างงานใหม่
        (data.assignees||[]).forEach(name => {
          const u = users.find(x=>x.name===name);
          if (!u || u.id===currentUser?.id) return;
          batch.set(doc(db,"notifications",Date.now().toString()+u.id.slice(0,4)),{
            type:"task", toUid:u.id, toName:name, fromName:currentUser?.name||"",
            message:`มีงานใหม่: "${data.title}"${data.projectName?` (${data.projectName})`:""}`,
            createdAt:now, read:false,
          });
        });
        await batch.commit();
        showToast("📋 สร้างงานและแจ้งเตือนแล้ว","success");
      } else if (!isNew && prevTask && data.status && prevTask.status !== data.status) {
        // แจ้ง admin เมื่อช่างเปลี่ยนสถานะ
        const admins = users.filter(u=>u.role==="admin"&&u.id!==currentUser?.id);
        admins.forEach(a=>{
          batch.set(doc(db,"notifications",Date.now().toString()+a.id.slice(0,4)),{
            type:"task", toUid:a.id, toName:a.name, fromName:currentUser?.name||"",
            message:`"${data.title}" → ${STATUS_LABEL[data.status]||data.status}`,
            createdAt:now, read:false,
          });
        });
        await batch.commit();
        showToast(`📋 ${STATUS_LABEL[data.status]||data.status}แล้ว`,"success");
      } else if (!isNew) {
        showToast("💾 บันทึกการแก้ไขแล้ว","success");
      }
    }}
    onDeleteTask={async(id)=>{
      await deleteDoc(doc(db,"tasks",id));
      showToast("ลบงานแล้ว","success");
    }}
    onConvertToCase={async(task)=>{
      const proj = projects.find(p=>p.id===task.projectId);
      const now = new Date().toISOString();
      const cid = Date.now().toString();
      await setDoc(doc(db,"cases",cid),{
        title:task.title, projectId:task.projectId,
        warrantyEnd:proj?.warrantyEnd||null, leaseEnd:proj?.leaseEnd||null,
        site:task.site||"", type:task.type||"อื่นๆ",
        techs:task.assignees||[], tech:(task.assignees||[])[0]||"",
        status:"open", note:task.note||"", date:today(),
        handoverLog:[], updateLog:[],
        fromTaskId:task.id,
        updatedAt:now, activityAt:now,
      });
      await setDoc(doc(db,"tasks",task.id),{caseId:cid,updatedAt:now},{merge:true});
      showToast("📁 สร้างเคสจากงานแล้ว","success");
    }}/>;
  if(onsitePage) return <OnsitePage onBack={()=>setOnsitePage(false)} projects={projects} users={users} currentUser={currentUser} onsiteRecords={onsiteRecords} onSaveOnsite={saveOnsite} onApproveOnsite={approveOnsite} onDeleteOnsite={deleteOnsite} saving={saving}/>;
  if(shiftPage) return <ShiftCalendar onBack={()=>setShiftPage(false)} currentUser={currentUser} users={users} shiftTypes={shiftTypes} shifts={shifts} userSchedules={userSchedules} shiftMembers={shiftMembers} refreshSchedules={refreshSchedules} refreshShiftTypes={refreshShiftTypes} refreshShiftMembers={refreshShiftMembers} refreshShifts={refreshShifts}/>;
  if(knowledgePage) return <KnowledgeHub onBack={()=>setKnowledgePage(false)} currentUser={currentUser}/>;
  if(robotStatsPage) return <RobotStatsPage onBack={()=>setRobotStatsPage(false)} projects={projects} currentUser={currentUser}/>;
  if(dashboardPage && isAdminOrDev) return <Dashboard onBack={()=>setDashboardPage(false)} cases={cases} projects={projects} users={users} deletedCases={deletedCases} onsiteRecords={onsiteRecords}/>;

  return (
    <ThemeContext.Provider value={{ dark: darkMode, c: themeC }}>
    <div style={{ minHeight:"100vh",background:themeC.bg,fontFamily:"'Noto Sans Thai','Sora',sans-serif",color:themeC.text900 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:4px;background:${themeC.borderSoft}}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
        input::placeholder,textarea::placeholder{color:#cbd5e1}
        select option{background:var(--select-bg,${themeC.card})}
        input:focus,select:focus,textarea:focus{border-color:#93c5fd !important;box-shadow:0 0 0 3px #dbeafe !important;outline:none}
        .notif-backdrop{ position:fixed; inset:0; z-index:500; }
        .notif-handle{ display:none; }
        @media (min-width: 768px){
          .notif-backdrop{ background:transparent; }
          .notif-panel{ position:absolute; top:64px; right:16px; width:360px; max-height:70vh;
            background:${themeC.card}; border:1px solid ${themeC.border}; border-radius:14px;
            box-shadow:0 12px 40px rgba(0,0,0,.15); display:flex; flex-direction:column; overflow:hidden; }
        }
        @media (max-width: 767px){
          .notif-backdrop{ background:rgba(15,23,42,.55); backdrop-filter:blur(4px);
            display:flex; align-items:flex-end; justify-content:center; }
          .notif-panel{ background:${themeC.card}; border-radius:20px 20px 0 0; width:100%;
            height:75vh; display:flex; flex-direction:column; box-shadow:0 -8px 40px rgba(0,0,0,.2); }
          .notif-handle{ display:block; width:40px; height:4px; background:${themeC.border};
            border-radius:2px; margin:12px auto 0; }
        }
      `}</style>

      {/* TOP NAV */}
      <NavBar
        onMenuOpen={()=>setMenuOpen(true)}
        view={view} activeProj={activeProj}
        onSearch={()=>{ setGlobalSearch(true); setGlobalQ(""); }}
        onOnsite={()=>setOnsitePage(true)}
        onTaskBoard={()=>setTaskPage(true)} tasks={tasks} currentUser={currentUser}
        onNotif={e=>{ e.stopPropagation(); setNotifOpen(v=>!v); }} unreadCount={unreadCount}
        onNewCase={openAddCase}
        onProfile={()=>setProfilePage(true)}
        isMobile={isMobile}
        darkMode={darkMode} onToggleDark={()=>setDarkMode(v=>!v)}
      />

      {/* DRAWER */}
      <Drawer
        open={menuOpen} onClose={()=>setMenuOpen(false)}
        currentUser={currentUser} onSignOut={onSignOut}
        isAdminOrDev={isAdminOrDev}
        view={view} setView={setView} setFilterStat={setFilterStat}
        cases={cases} projects={projects}
        setDashboardPage={setDashboardPage}
        setShiftPage={setShiftPage} setOnsitePage={setOnsitePage}
        setOtPage={setOtPage} setLeavePage={setLeavePage} setKnowledgePage={setKnowledgePage}
        setRobotStatsPage={setRobotStatsPage}
        isDev={currentUser?.role==="dev"}
        onlineCount={onlineUsers.length}
        setShowOnlineUsers={setShowOnlineUsers}
        setAdminPage={setAdminPage} setProfilePage={setProfilePage}
        openAddProj={openAddProj}
        handleImportFile={handleImportFile}
        handleImportCaseFile={handleImportCaseFile}
      />

      {/* MAIN CONTENT */}
      <div style={{ padding:"16px 16px 100px" }}>
        {view!=="overview" && (
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}>
            <button onClick={()=>setView("overview")} style={{ background:"none",border:"none",
              color:themeC.text400,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0 }}>ภาพรวม</button>
            <span style={{ color:themeC.text400 }}>›</span>
            <span style={{ fontSize:13,fontWeight:700,color:activeProj?.color||"#0f172a",flex:1,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{activeProj?.name}</span>
            {activeProj && (<>
              <button onClick={()=>openEditProj(activeProj)}
                style={{ background:themeC.borderSoft,border:"1px solid #e2e8f0",borderRadius:7,
                  padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  color:"#475569",fontWeight:600,whiteSpace:"nowrap" }}>✏️ แก้ไข</button>
              <button onClick={()=>setDelProj(activeProj.id)}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:7,
                  padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  color:"#ef4444",fontWeight:600,whiteSpace:"nowrap" }}>🗑 ลบ</button>
            </>)}
          </div>
        )}
        {view==="overview" && (()=>{
          // แจ้งเตือนสัญญาใกล้หมด (≤30 วัน) — คำนวณจาก cases ที่โหลดมาแล้ว ไม่เพิ่ม reads
          const warn = [];
          cases.forEach(c=>{
            const wd=daysLeft(c.warrantyEnd), ld=daysLeft(c.leaseEnd), hd=daysLeft(c.hirePurchaseEnd);
            if(wd!==null&&wd>=0&&wd<=30) warn.push({type:"ประกัน",days:wd,title:c.title,id:c.id});
            if(ld!==null&&ld>=0&&ld<=30) warn.push({type:"สัญญาเช่า",days:ld,title:c.title,id:c.id});
            if(hd!==null&&hd>=0&&hd<=30) warn.push({type:"เช่าซื้อ",days:hd,title:c.title,id:c.id});
          });
          if(warn.length===0) return null;
          warn.sort((a,b)=>a.days-b.days);
          const soonest = warn[0];
          return (
            <div onClick={()=>setFilterStat("__exp")}
              style={{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,
                padding:"12px 16px",marginBottom:14,cursor:"pointer",display:"flex",
                alignItems:"center",gap:12 }}>
              <div style={{ fontSize:24,flexShrink:0 }}>⚠️</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:700,color:"#92400e" }}>
                  มี {warn.length} รายการใกล้หมดภายใน 30 วัน
                </div>
                <div style={{ fontSize:12,color:"#b45309",marginTop:2,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  เร็วที่สุด: {soonest.type} "{soonest.title}" เหลือ {soonest.days} วัน
                </div>
              </div>
              <span style={{ fontSize:12,color:"#92400e",fontWeight:600,flexShrink:0 }}>ดูทั้งหมด →</span>
            </div>
          );
        })()}
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
                border:`1.5px solid ${filterStat===s.key?s.color+"50":themeC.border}`,
                borderRadius:12,padding:"12px 10px",cursor:"pointer",textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:9,color:themeC.text400,marginTop:4,fontWeight:600,letterSpacing:.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ position:"relative",marginBottom:14 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:themeC.text400,fontSize:16 }}>⌕</span>
          <input placeholder="ค้นหาเคส หรือโครงการ..." value={search} onChange={e=>setSearch(e.target.value)}
            style={IS({ paddingLeft:36,borderRadius:10,fontSize:14 })}/>
          {/* Dropdown ผลการค้นหาโครงการ */}
          {search.trim().length>=1 && (() => {
            const q = search.trim().toLowerCase();
            const matchProjs = projects.filter(p =>
              p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
            ).slice(0,6);
            if (matchProjs.length===0) return null;
            return (
              <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:50,
                background:themeC.card,border:`1px solid ${themeC.border}`,borderRadius:10,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)",marginTop:4,overflow:"hidden" }}>
                <div style={{ padding:"6px 12px",fontSize:10,color:themeC.text400,fontWeight:700,
                  textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid #f1f5f9" }}>
                  โครงการที่ตรงกัน
                </div>
                {matchProjs.map(p => (
                  <div key={p.id} onClick={()=>{ setView(p.id); setSearch(""); setFilterStat("all"); }}
                    style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                      borderBottom:"1px solid #f8fafc" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||"#94a3b8",flexShrink:0 }}/>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,color:themeC.text900,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                      {p.code&&<div style={{ fontSize:11,color:themeC.text400 }}>{p.code}</div>}
                    </div>
                    <span style={{ fontSize:11,color:themeC.text400,flexShrink:0 }}>
                      {cases.filter(c=>c.projectId===p.id).length} เคส
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:themeC.text400,fontWeight:600,whiteSpace:"nowrap" }}>📅 ช่วงวันที่:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ background:themeC.card,border:`1px solid ${themeC.border}`,borderRadius:8,color:themeC.text900,padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer" }}/>
          <span style={{ fontSize:12,color:themeC.text400 }}>ถึง</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ background:themeC.card,border:`1px solid ${themeC.border}`,borderRadius:8,color:themeC.text900,padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer" }}/>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {[
              { label:"วันนี้",    fn:()=>{ const t=today(); setDateFrom(t); setDateTo(t); },
                active:()=>{ const t=today(); return dateFrom===t&&dateTo===t; }},
              { label:"7 วัน",    fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-6); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); },
                active:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-6); return dateFrom===f.toISOString().slice(0,10)&&dateTo===t; }},
              { label:"30 วัน",   fn:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-29); setDateFrom(f.toISOString().slice(0,10)); setDateTo(t); },
                active:()=>{ const t=today(); const f=new Date(t); f.setDate(f.getDate()-29); return dateFrom===f.toISOString().slice(0,10)&&dateTo===t; }},
              { label:"เดือนนี้", fn:()=>{ const n=new Date(); setDateFrom(n.getFullYear()+"-"+(String(n.getMonth()+1).padStart(2,"0"))+"-01"); setDateTo(today()); },
                active:()=>{ const n=new Date(); return dateFrom===n.getFullYear()+"-"+(String(n.getMonth()+1).padStart(2,"0"))+"-01"&&dateTo===today(); }},
            ].map(p=>{
              const isActive = p.active();
              return (
                <button key={p.label} onClick={p.fn}
                  style={{ background:isActive?"#2563eb":"#f1f5f9",
                    border:`1px solid ${isActive?"#2563eb":themeC.border}`,
                    color:isActive?"#fff":"#475569",
                    borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>
                  {p.label}
                </button>
              );
            })}
            {(dateFrom||dateTo)&&(
              <button onClick={()=>{ setDateFrom(""); setDateTo(""); }}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>
            )}
          </div>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap" }}>
          <span style={{ fontSize:12,color:themeC.text400,fontWeight:600,whiteSpace:"nowrap" }}>👤 ผู้ดำเนินการ:</span>
          <select value={filterTech} onChange={e=>setFilterTech(e.target.value)}
            style={{ background:themeC.card,border:`1px solid ${themeC.border}`,borderRadius:8,color:themeC.text900,padding:"7px 11px",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer",minWidth:160 }}>
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
                border:`1.5px solid ${filterStat===s.value?s.color:themeC.border}`,
                color:filterStat===s.value?"#fff":"#64748b",
                borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0 }}>
              {s.label}
            </button>
          ))}
        </div>
        {view==="overview" && projects.length>0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11,color:themeC.text400,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10 }}>โครงการทั้งหมด</div>
            <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:4 }}>
              {projects.map(p=>{
                const pl=cases.filter(c=>c.projectId===p.id);
                return (
                  <div key={p.id} onClick={()=>setView(p.id)}
                    style={{ background:themeC.card,border:`1.5px solid ${p.color}30`,borderRadius:12,
                      padding:"14px 16px",cursor:"pointer",flexShrink:0,width:160,height:100,
                      borderLeft:`4px solid ${p.color}`,boxShadow:"0 1px 3px rgba(0,0,0,.04)",
                      display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
                    <div style={{ fontSize:13,fontWeight:700,color:themeC.text900,lineHeight:1.3,
                      overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{p.name}</div>
                    <div style={{ display:"flex",gap:12 }}>
                      {[{l:"ทั้งหมด",v:pl.length,c:p.color},{l:"เสร็จ",v:pl.filter(x=>x.status==="done").length,c:"#10b981"}].map(x=>(
                        <div key={x.l}>
                          <div style={{ fontSize:20,fontWeight:800,color:x.c,lineHeight:1 }}>{x.v}</div>
                          <div style={{ fontSize:9,color:themeC.text400,marginTop:1 }}>{x.l}</div>
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
          <div style={{ fontSize:11,color:themeC.text400,fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>
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
          <div style={{ background:themeC.card,border:`1.5px solid ${themeC.border}`,borderRadius:14,padding:"48px 20px",textAlign:"center",color:"#cbd5e1" }}>
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
                  onDel={()=>setDelCase(c.id)}
                  />
              );
            })}
            {totalPages > 1 && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:16,flexWrap:"wrap" }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{ background:themeC.card,border:`1.5px solid ${themeC.border}`,borderRadius:8,
                    padding:"8px 14px",fontSize:13,fontWeight:600,cursor:page===1?"default":"pointer",
                    color:page===1?themeC.text400:themeC.text500,fontFamily:"inherit" }}>←</button>
                {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                  <button key={p} onClick={()=>setPage(p)}
                    style={{ background:page===p?"#2563eb":"#fff",
                      border:`1.5px solid ${page===p?"#2563eb":themeC.border}`,
                      borderRadius:8,padding:"8px 13px",fontSize:13,fontWeight:600,
                      cursor:"pointer",color:page===p?"#fff":"#475569",fontFamily:"inherit",
                      minWidth:38 }}>{p}</button>
                ))}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ background:themeC.card,border:`1.5px solid ${themeC.border}`,borderRadius:8,
                    padding:"8px 14px",fontSize:13,fontWeight:600,cursor:page===totalPages?"default":"pointer",
                    color:page===totalPages?themeC.text400:themeC.text500,fontFamily:"inherit" }}>→</button>
                <span style={{ fontSize:12,color:themeC.text400,marginLeft:4 }}>หน้า {page}/{totalPages}</span>
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
        saving={saving}/>

      {globalSearch && (
        <div style={{ position:"fixed",inset:0,zIndex:800,background:"rgba(15,23,42,.6)",
          display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"60px 16px 16px" }}
          onClick={()=>setGlobalSearch(false)}>
          <div style={{ background:themeC.card,borderRadius:16,width:"100%",maxWidth:620,
            maxHeight:"80vh",display:"flex",flexDirection:"column",
            boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}
            onClick={e=>e.stopPropagation()}>
            {/* Search input */}
            <div style={{ padding:"14px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ fontSize:18,flexShrink:0 }}>🔍</span>
              <input autoFocus value={globalQ} onChange={e=>setGlobalQ(e.target.value)}
                placeholder="ค้นหาเคส งาน Onsite โครงการ..."
                style={{ flex:1,border:"none",outline:"none",fontSize:15,fontFamily:"inherit",
                  color:themeC.text900,background:"transparent" }}/>
              {globalQ && <button onClick={()=>setGlobalQ("")}
                style={{ background:"none",border:"none",color:themeC.text400,cursor:"pointer",fontSize:16 }}>✕</button>}
              <button onClick={()=>setGlobalSearch(false)}
                style={{ background:themeC.borderSoft,border:"none",color:themeC.text500,cursor:"pointer",
                  fontSize:12,padding:"4px 10px",borderRadius:6,fontFamily:"inherit" }}>Esc</button>
            </div>
            {/* Results */}
            <div style={{ overflowY:"auto",flex:1,padding:"8px 0" }}>
              {globalQ.trim().length < 2 ? (
                <div style={{ padding:"32px",textAlign:"center",color:themeC.text400,fontSize:13 }}>
                  พิมพ์อย่างน้อย 2 ตัวอักษร
                </div>
              ) : (()=>{
                const q = globalQ.trim().toLowerCase();
                const matchCases = cases.filter(c=>[c.title,c.site,c.note,c.type].some(x=>x?.toLowerCase().includes(q))).slice(0,5);
                const matchTasks = (tasks||[]).filter(t=>[t.title,t.site,t.note,t.projectName].some(x=>x?.toLowerCase().includes(q))).slice(0,5);
                const matchOnsite = (onsiteRecords||[]).filter(r=>[r.projectName,r.site,r.detail,r.scope].some(x=>x?.toLowerCase().includes(q))).slice(0,5);
                const matchProjs = projects.filter(p=>[p.name,p.code,p.customer].some(x=>x?.toLowerCase().includes(q))).slice(0,5);
                const total = matchCases.length+matchTasks.length+matchOnsite.length+matchProjs.length;
                if(total===0) return (
                  <div style={{ padding:"32px",textAlign:"center",color:themeC.text400,fontSize:13 }}>ไม่พบผลลัพธ์</div>
                );
                const Section = ({icon,label,items,render})=>items.length===0?null:(
                  <div>
                    <div style={{ padding:"8px 16px 4px",fontSize:10,color:themeC.text400,fontWeight:700,
                      textTransform:"uppercase",letterSpacing:.5 }}>{icon} {label} ({items.length})</div>
                    {items.map(render)}
                  </div>
                );
                return (
                  <div>
                    <Section icon="📁" label="โครงการ" items={matchProjs} render={p=>(
                      <div key={p.id} onClick={()=>{ setView(p.id); setFilterStat("all"); setGlobalSearch(false); setGlobalQ(""); }}
                        style={{ padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
                          borderBottom:"1px solid #f8fafc" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||"#94a3b8",flexShrink:0 }}/>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:themeC.text900 }}>{p.name}</div>
                          {p.customer&&<div style={{ fontSize:11,color:themeC.text500 }}>👤 {p.customer}</div>}
                        </div>
                      </div>
                    )}/>
                    <Section icon="📋" label="เคส" items={matchCases} render={c=>{
                      const proj=projects.find(p=>p.id===c.projectId);
                      return (
                      <div key={c.id} onClick={()=>{ setDetailCase(c); setGlobalSearch(false); setGlobalQ(""); }}
                        style={{ padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid #f8fafc" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ fontSize:13,fontWeight:600,color:themeC.text900 }}>{c.title}</div>
                        <div style={{ fontSize:11,color:themeC.text500,marginTop:2 }}>
                          {proj&&<><span style={{ color:proj.color,marginRight:4 }}>◆</span>{proj.name} · </>}{c.site||""} · {c.date||""}
                        </div>
                      </div>
                    );}}/>
                    <Section icon="📋" label="งาน (Board)" items={matchTasks} render={t=>{
                      const proj=projects.find(p=>p.id===t.projectId);
                      return (
                      <div key={t.id} onClick={()=>{ setTaskPage(true); setGlobalSearch(false); setGlobalQ(""); }}
                        style={{ padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid #f8fafc" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ fontSize:13,fontWeight:600,color:themeC.text900 }}>{t.title}</div>
                        <div style={{ fontSize:11,color:themeC.text500,marginTop:2 }}>
                          {proj&&<>{proj.name} · </>}{t.site||""} {t.dueDate&&`· ${t.dueDate}`}
                        </div>
                      </div>
                    );}}/>
                    <Section icon="📍" label="Onsite" items={matchOnsite} render={r=>(
                      <div key={r.id} onClick={()=>{ setOnsitePage(true); setGlobalSearch(false); setGlobalQ(""); }}
                        style={{ padding:"10px 16px",cursor:"pointer",borderBottom:"1px solid #f8fafc" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ fontSize:13,fontWeight:600,color:themeC.text900 }}>{r.projectName||r.projectId}</div>
                        <div style={{ fontSize:11,color:themeC.text500,marginTop:2 }}>
                          {r.site&&`📍 ${r.site} · `}{r.date||""} · {r.scope||""}
                        </div>
                      </div>
                    )}/>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ImportModal
        importModal={importModal} setImportModal={setImportModal}
        importRows={importRows} importSelected={importSelected} setImportSelected={setImportSelected}
        doImport={doImport} saving={saving} projects={projects}
        importCaseModal={importCaseModal} setImportCaseModal={setImportCaseModal}
        importCaseRows={importCaseRows} importCaseSel={importCaseSel} setImportCaseSel={setImportCaseSel}
        doImportCases={doImportCases} cases={cases}
      />
      <ProjectModal open={projModal} onClose={()=>setProjModal(false)}
        newProjCode={newProjCode} setNewProjCode={setNewProjCode}
        editProjId={editProjId}
        newProjName={newProjName} setNewProjName={setNewProjName}
        newProjColor={newProjColor} setNewProjColor={setNewProjColor}
        newProjWarranty={newProjWarranty} setNewProjWarranty={setNewProjWarranty}
        newProjLease={newProjLease} setNewProjLease={setNewProjLease}
        newProjHirePurchase={newProjHirePurchase} setNewProjHirePurchase={setNewProjHirePurchase}
        newProjCustomer={newProjCustomer} setNewProjCustomer={setNewProjCustomer}
        newProjContractType={newProjContractType} setNewProjContractType={setNewProjContractType}
        newProjContractStart={newProjContractStart} setNewProjContractStart={setNewProjContractStart}
        newProjProjectStatus={newProjProjectStatus} setNewProjProjectStatus={setNewProjProjectStatus}
        newProjSites={newProjSites} setNewProjSites={setNewProjSites}
        saving={saving} onSubmit={submitProj}/>

      {notifOpen&&(
        <div className="notif-backdrop" onClick={()=>setNotifOpen(false)}>
          <div className="notif-panel" onClick={e=>e.stopPropagation()}>
            <div className="notif-handle"/>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"14px 18px 12px",borderBottom:"1px solid #f1f5f9",flexShrink:0 }}>
              <span style={{ fontSize:15,fontWeight:700,color:themeC.text900 }}>🔔 การแจ้งเตือน
                {unreadCount>0&&<span style={{ background:"#ef4444",color:"#fff",borderRadius:20,
                  padding:"1px 7px",fontSize:11,fontWeight:700,marginLeft:8 }}>{unreadCount}</span>}
              </span>
              <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                {unreadCount>0&&(
                  <button onClick={markAllRead} style={{ background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>อ่านทั้งหมด</button>
                )}
                <button onClick={()=>setNotifOpen(false)}
                  style={{ background:themeC.borderSoft,border:"none",color:themeC.text500,cursor:"pointer",width:28,height:28,borderRadius:8,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY:"auto",flex:1 }}>
              {notifications.length===0?(
                <div style={{ padding:"48px 18px",textAlign:"center",color:themeC.text400,fontSize:14 }}>
                  <div style={{ fontSize:32,marginBottom:8 }}>🔔</div>ไม่มีการแจ้งเตือน
                </div>
              ):notifications.map(n=>(
                <div key={n.id} onClick={()=>{ markNotifRead(n.id); setNotifOpen(false); if(n.type==="leave"){ setLeavePage(true); } else if(n.type==="onsite"){ setOnsitePage(true); } else if(n.type==="task"){ setTaskPage(true); } else if(n.caseId){ const c=cases.find(x=>x.id===n.caseId); if(c){ setDetailCase(c); }}}}
                  style={{ padding:"14px 18px",borderBottom:"1px solid #f8fafc",background:n.read?"#fff":"#eff6ff",cursor:"pointer",transition:"background .15s" }}>
                  <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                    <div style={{ width:36,height:36,borderRadius:"50%",flexShrink:0,
                      background:n.type==="handover"?"#dbeafe":n.type==="leave"?"#f0fdf4":n.type==="onsite"?"#fff7ed":n.type==="task"?"#f5f3ff":"#f5f3ff",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>
                      {n.type==="handover"?"📤":n.type==="leave"?"📋":n.type==="onsite"?"📍":n.type==="task"?"📋":"👤"}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:n.read?400:700,color:themeC.text900,lineHeight:1.5 }}>
                        {n.type==="handover"
                          ? <>{n.fromName} ส่งงาน <span style={{ color:"#2563eb" }}>"{n.caseTitle}"</span> ให้คุณ</>
                          : n.type==="leave"
                          ? <>{n.message||`ใบลาของคุณได้รับการพิจารณาแล้ว`}</>
                          : n.type==="onsite"
                          ? <>{n.message||`รายการ Onsite อัปเดตแล้ว`}</>
                          : n.type==="task"
                          ? <>{n.message||`มีงานใหม่มอบหมายให้คุณ`}</>
                          : <>มีผู้ใช้ใหม่: <span style={{ color:"#7c3aed",fontWeight:700 }}>{n.toName}</span></>}
                      </div>
                      {n.note&&<div style={{ fontSize:12,color:themeC.text500,marginTop:3,background:themeC.bg,borderRadius:6,padding:"3px 8px",display:"inline-block" }}>"{n.note}"</div>}
                      <div style={{ fontSize:11,color:themeC.text400,marginTop:4 }}>
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
            <div style={{ fontSize:11,color:themeC.text400,marginBottom:3 }}>เคสที่จะลบ</div>
            <div style={{ fontSize:14,fontWeight:700,color:"#b91c1c" }}>"{c.title}"</div>
          </div>
        ); })()}
        <p style={{ color:themeC.text500,fontSize:14,marginBottom:20 }}>เคสนี้จะถูกลบถาวร ยืนยันหรือไม่?</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelCase(null)} style={{ flex:1 }}>ยกเลิก</GhostBtn>
          <button onClick={()=>deleteCase(delCase)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบ</button>
        </div>
      </Modal>

      <Modal open={!!delProj} onClose={()=>setDelProj(null)} title="ลบโครงการ?">
        <p style={{ color:themeC.text500,fontSize:14,marginBottom:4 }}>โครงการและเคสทั้งหมดจะถูกลบถาวร</p>
        <p style={{ color:"#ef4444",fontSize:13,marginBottom:20 }}>⚠ ไม่สามารถกู้คืนได้</p>
        <div style={{ display:"flex",gap:10 }}>
          <GhostBtn onClick={()=>setDelProj(null)} style={{ flex:1 }}>ยกเลิก</GhostBtn>
          <button onClick={()=>removeProj(delProj)} style={{ flex:1,background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14 }}>ลบโครงการ</button>
        </div>
      </Modal>

      <UpdateLogModal open={!!updateCase} onClose={()=>setUpdateCase(null)}
        caseData={updateCase} onSave={saveUpdate} currentUser={currentUser}/>
      <HandoverModal open={!!handoverCase} onClose={()=>setHandoverCase(null)}
        caseData={handoverCase} onSave={saveHandover} users={users} currentUser={currentUser}/>

      <Modal open={showOnlineUsers} onClose={()=>setShowOnlineUsers(false)} title="🟢 ใครออนไลน์อยู่บ้าง">
        {onlineUsers.length===0 ? (
          <p style={{ color:themeC.text400,fontSize:14,textAlign:"center",padding:"20px 0" }}>ไม่มีใครออนไลน์อยู่ตอนนี้</p>
        ) : onlineUsers.map((u)=>(
          <div key={u.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ width:8,height:8,borderRadius:"50%",background:"#16a34a",flexShrink:0 }}/>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:14,fontWeight:600,color:themeC.text900 }}>{u.name}</div>
              {u.role&&<div style={{ fontSize:11,color:themeC.text400 }}>{u.role==="admin"?"Admin":u.role==="dev"?"Dev":u.role}</div>}
            </div>
          </div>
        ))}
      </Modal>

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
    </ThemeContext.Provider>
  );
}

