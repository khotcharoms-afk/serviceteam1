import { useState } from "react";
import { db } from "./firebase.js";
import { doc, setDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { daysLeft, fmtDate, SERVICE_TYPES, today } from "./utils.js";
import TaskModal from "./TaskModal.jsx";

const COLUMNS = [
  { key:"todo",       label:"📥 รอรับงาน",   color:"#64748b", bg:"#f1f5f9" },
  { key:"accepted",   label:"✋ รับแล้ว",     color:"#2563eb", bg:"#eff6ff" },
  { key:"inprogress", label:"🔧 กำลังทำ",    color:"#f59e0b", bg:"#fffbeb" },
  { key:"done",       label:"✅ เสร็จ",       color:"#16a34a", bg:"#f0fdf4" },
];

const PRIORITY_STYLE = {
  urgent_high: { label:"ด่วนมาก", color:"#fff",     bg:"#dc2626" },
  urgent:      { label:"ด่วน",    color:"#92400e",  bg:"#fef3c7" },
  normal:      { label:"ปกติ",    color:"#15803d",  bg:"#dcfce7" },
};

export default function TaskBoard({ onBack, projects, users, cases, currentUser, tasks, saving, onSaveTask, onDeleteTask, onConvertToCase }) {
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [myOnly,   setMyOnly]     = useState(false);
  const [isMobile] = useState(typeof window!=="undefined" && window.innerWidth < 640);

  const isAdmin    = currentUser?.role === "admin";
  const canCreate  = isAdmin; // admin + หัวหน้าทีม (role:"leader" ถ้ามีในอนาคต)

  const filteredTasks = (tasks||[]).filter(t =>
    !myOnly || (t.assignees||[]).includes(currentUser?.name)
  );

  const byStatus = {};
  COLUMNS.forEach(c => { byStatus[c.key] = []; });
  filteredTasks.forEach(t => {
    const col = byStatus[t.status];
    if (col) col.push(t);
  });
  Object.keys(byStatus).forEach(k => {
    byStatus[k].sort((a,b)=>{
      const pri = { urgent_high:0, urgent:1, normal:2 };
      const pa = pri[a.priority]??2, pb = pri[b.priority]??2;
      if (pa!==pb) return pa-pb;
      return (a.dueDate||"").localeCompare(b.dueDate||"");
    });
  });

  async function moveTask(task, newStatus) {
    await onSaveTask({ ...task, status:newStatus }, task.id);
  }

  function openEdit(t) { setEditTask(t); setShowModal(true); }

  const pendingCount = (tasks||[]).filter(t =>
    t.status==="todo" && (t.assignees||[]).includes(currentUser?.name)
  ).length;

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
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>📋 บอร์ดงาน</div>
        {pendingCount>0 && (
          <span style={{ background:"#fef3c7",color:"#92400e",borderRadius:20,
            padding:"3px 10px",fontSize:12,fontWeight:700 }}>
            {pendingCount} งานรอคุณรับ
          </span>
        )}
        <div style={{ marginLeft:"auto",display:"flex",gap:8,alignItems:"center" }}>
          <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,
            color:"#475569",cursor:"pointer",fontWeight:600 }}>
            <input type="checkbox" checked={myOnly} onChange={e=>setMyOnly(e.target.checked)}
              style={{ accentColor:"#6B21A8" }}/>
            งานของฉัน
          </label>
          {canCreate && (
            <button onClick={()=>{ setEditTask(null); setShowModal(true); }}
              style={{ background:"#6B21A8",border:"none",color:"#fff",borderRadius:8,
                padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              + สร้างงาน
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div style={{ padding:"16px",overflowX:"auto" }}>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${COLUMNS.length},minmax(260px,1fr))`,
          gap:12,minWidth:isMobile?"unset":1040 }}>
          {COLUMNS.map(col => {
            const colTasks = byStatus[col.key]||[];
            return (
              <div key={col.key} style={{ background:"#e2e8f0",borderRadius:12,padding:10,minHeight:200 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"4px 8px 10px" }}>
                  <span style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>{col.label}</span>
                  <span style={{ background:"#fff",borderRadius:20,padding:"1px 8px",
                    fontSize:11,fontWeight:700,color:"#64748b" }}>{colTasks.length}</span>
                </div>
                {colTasks.map(t => (
                  <TaskCard key={t.id} task={t} col={col} projects={projects}
                    currentUser={currentUser} isAdmin={isAdmin}
                    onMove={moveTask} onEdit={openEdit}
                    onDelete={onDeleteTask} onConvert={onConvertToCase}/>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <TaskModal onClose={()=>{ setShowModal(false); setEditTask(null); }}
          onSave={(data,id)=>{ onSaveTask(data,id); setShowModal(false); setEditTask(null); }}
          saving={saving} projects={projects} users={users}
          currentUser={currentUser} editTask={editTask}/>
      )}
    </div>
  );
}

function TaskCard({ task, col, projects, currentUser, isAdmin, onMove, onEdit, onDelete, onConvert }) {
  const proj = projects.find(p=>p.id===task.projectId);
  const pri  = PRIORITY_STYLE[task.priority]||PRIORITY_STYLE.normal;
  const due  = daysLeft(task.dueDate);
  const dueColor = due===null?"#94a3b8":due<0?"#dc2626":due<=3?"#f59e0b":"#64748b";
  const isAssigned = (task.assignees||[]).includes(currentUser?.name);
  const isMine = isAssigned || isAdmin;

  const NEXT = { todo:"accepted", accepted:"inprogress", inprogress:"done" };
  const NEXT_LABEL = { todo:"✋ รับงาน", accepted:"🔧 เริ่มทำ", inprogress:"✅ ทำเสร็จ" };
  const nextStatus = NEXT[task.status];

  return (
    <div style={{ background:"#fff",borderRadius:10,padding:12,marginBottom:8,
      boxShadow:"0 1px 2px rgba(0,0,0,.06)",
      borderLeft:`3px solid ${proj?.color||col.color}` }}>
      <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",lineHeight:1.35,marginBottom:6 }}>
        {task.title}
      </div>
      <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:8 }}>
        <span style={{ fontSize:10,padding:"2px 7px",borderRadius:12,fontWeight:600,
          background:"#f1f5f9",color:"#475569" }}>{task.type}</span>
        <span style={{ fontSize:10,padding:"2px 7px",borderRadius:12,fontWeight:600,
          background:pri.bg,color:pri.color }}>{pri.label}</span>
        {task.status==="done" && task.caseId && (
          <span style={{ fontSize:10,padding:"2px 7px",borderRadius:12,fontWeight:600,
            background:"#dcfce7",color:"#15803d" }}>→ สร้างเคสแล้ว</span>
        )}
      </div>
      <div style={{ fontSize:11,color:"#64748b",display:"flex",alignItems:"center",gap:4,marginBottom:3 }}>
        <span style={{ width:8,height:8,borderRadius:"50%",background:proj?.color||"#94a3b8",flexShrink:0 }}/>
        <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj?.name||task.projectName}</span>
      </div>
      {task.site && <div style={{ fontSize:11,color:"#64748b",marginBottom:3 }}>📍 {task.site}</div>}
      <div style={{ display:"flex",gap:4,marginBottom:6,flexWrap:"wrap" }}>
        {(task.assignees||[]).map(name=>(
          <span key={name} style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:22,height:22,borderRadius:"50%",fontSize:11,fontWeight:700,color:"#fff",
            background:`hsl(${name.charCodeAt(0)*7%360},60%,65%)`,
            title:name }}>
            {name.charAt(0)}
          </span>
        ))}
      </div>
      {task.dueDate && (
        <div style={{ fontSize:11,fontWeight:600,color:dueColor,marginBottom:6 }}>
          📅 {fmtDate(task.dueDate)} {due!==null&&(due<0?`(เกิน ${Math.abs(due)} วัน)`:due===0?"(วันนี้!)":due<=3?`(เหลือ ${due} วัน)`:"")}
        </div>
      )}
      {isMine && (
        <div style={{ display:"flex",gap:5,paddingTop:8,borderTop:"1px solid #f1f5f9",flexWrap:"wrap" }}>
          {nextStatus && (
            <button onClick={()=>onMove(task,nextStatus)}
              style={{ flex:1,background:nextStatus==="done"?"#f0fdf4":nextStatus==="inprogress"?"#fffbeb":"#eff6ff",
                border:`1px solid ${nextStatus==="done"?"#bbf7d0":nextStatus==="inprogress"?"#fde68a":"#bfdbfe"}`,
                color:nextStatus==="done"?"#16a34a":nextStatus==="inprogress"?"#92400e":"#2563eb",
                borderRadius:7,padding:"5px 8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
              {NEXT_LABEL[task.status]}
            </button>
          )}
          {task.status==="done" && !task.caseId && isAdmin && (
            <button onClick={()=>onConvert(task)}
              style={{ flex:1,background:"#f5f3ff",border:"1px solid #ddd6fe",color:"#6B21A8",
                borderRadius:7,padding:"5px 8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
              📁 สร้างเคส
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={()=>onEdit(task)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:7,padding:"5px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>✏️</button>
              <button onClick={()=>onDelete(task.id)}
                style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                  borderRadius:7,padding:"5px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>🗑</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
