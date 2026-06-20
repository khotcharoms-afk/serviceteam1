import { useState } from "react";
import { db } from "./firebase.js";
import { doc, setDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { daysLeft, fmtDate, SERVICE_TYPES, today } from "./utils.js";
import TaskModal from "./TaskModal.jsx";

const COLUMNS = [
  { key:"todo",       label:"📥 รอรับงาน",   color:"#64748b", bg:"#f8fafc", border:"#cbd5e1" },
  { key:"accepted",   label:"✋ รับแล้ว",     color:"#1d4ed8", bg:"#eff6ff", border:"#93c5fd" },
  { key:"inprogress", label:"🔧 กำลังทำ",    color:"#92400e", bg:"#fffbeb", border:"#fcd34d" },
  { key:"done",       label:"✅ เสร็จ",       color:"#15803d", bg:"#f0fdf4", border:"#86efac" },
];

const PRIORITY_STYLE = {
  urgent_high: { label:"ด่วนมาก", color:"#fff",     bg:"#dc2626" },
  urgent:      { label:"ด่วน",    color:"#92400e",  bg:"#fef3c7" },
  normal:      { label:"ปกติ",    color:"#15803d",  bg:"#dcfce7" },
};

export default function TaskBoard({ onBack, projects, users, cases, currentUser, tasks, saving, onSaveTask, onDeleteTask, onConvertToCase }) {
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [myOnly,     setMyOnly]     = useState(false);
  const [confirmId,      setConfirmId]      = useState(null);
  const [confirmConvert, setConfirmConvert] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const detailTask = (tasks||[]).find(t=>t.id===detailTaskId) || null;
  const [comment,    setComment]    = useState("");
  const [sending,    setSending]    = useState(false);
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
          gap:0,minWidth:isMobile?"unset":1040,borderRadius:12,overflow:"hidden",border:"0.5px solid #e2e8f0" }}>
          {COLUMNS.map(col => {
            const colTasks = byStatus[col.key]||[];
            return (
              <div key={col.key} style={{ background:col.bg,borderRadius:12,padding:10,minHeight:200 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"4px 8px 10px",marginBottom:2,borderBottom:`2px solid ${col.border}` }}>
                  <span style={{ fontSize:12,fontWeight:700,color:col.color }}>{col.label}</span>
                  <span style={{ background:"rgba(0,0,0,.06)",borderRadius:20,padding:"1px 8px",
                    fontSize:11,fontWeight:700,color:col.color }}>{colTasks.length}</span>
                </div>
                {colTasks.map(t => (
                  <TaskCard key={t.id} task={t} col={col} projects={projects}
                    currentUser={currentUser} isAdmin={isAdmin}
                    onMove={moveTask} onEdit={openEdit}
                    onDelete={setConfirmId} onConvert={setConfirmConvert}
                    onCardClick={(t)=>setDetailTaskId(t.id)}/>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {detailTask && (
        <div style={{ position:"fixed",inset:0,zIndex:650,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={()=>{ setDetailTaskId(null); setComment(""); }}>
          <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:540,
            maxHeight:"92vh",display:"flex",flexDirection:"column",
            boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
            onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:"18px 20px",borderBottom:"1px solid #f1f5f9",flexShrink:0 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:15,fontWeight:800,color:"#0f172a",lineHeight:1.3 }}>{detailTask.title}</div>
                  <div style={{ fontSize:12,color:"#64748b",marginTop:4,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                    {(()=>{ const proj=projects.find(p=>p.id===detailTask.projectId);
                      return proj?<><span style={{ width:8,height:8,borderRadius:"50%",background:proj.color }}/>
                        <span>{proj.name}</span></>:null; })()}
                    {detailTask.site && <><span>·</span><span>📍 {detailTask.site}</span></>}
                  </div>
                </div>
                <button onClick={()=>{ setDetailTask(null); setComment(""); }}
                  style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
                    fontSize:14,width:30,height:30,borderRadius:8,flexShrink:0 }} onClick={()=>{ setDetailTaskId(null); setComment(""); }}>✕</button>
              </div>
              {/* meta row */}
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:10 }}>
                {(()=>{ const pri=PRIORITY_STYLE[detailTask.priority]||PRIORITY_STYLE.normal;
                  return <span style={{ fontSize:11,padding:"2px 8px",borderRadius:12,fontWeight:700,
                    background:pri.bg,color:pri.color }}>{pri.label}</span>; })()}
                <span style={{ fontSize:11,padding:"2px 8px",borderRadius:12,fontWeight:600,
                  background:"#f1f5f9",color:"#475569" }}>{detailTask.type}</span>
                {detailTask.dueDate && <span style={{ fontSize:11,padding:"2px 8px",borderRadius:12,fontWeight:600,
                  background:"#f8fafc",color:"#64748b" }}>📅 {detailTask.dueDate}</span>}
              </div>
              {/* assignees */}
              <div style={{ display:"flex",gap:4,marginTop:8,alignItems:"center" }}>
                <span style={{ fontSize:11,color:"#94a3b8" }}>ผู้รับผิดชอบ:</span>
                {(detailTask.assignees||[]).map(name=>(
                  <span key={name} style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",
                    width:24,height:24,borderRadius:"50%",fontSize:11,fontWeight:700,color:"#fff",
                    background:`hsl(${name.charCodeAt(0)*7%360},60%,65%)` }}>{name.charAt(0)}</span>
                ))}
                {(detailTask.assignees||[]).map(name=>(
                  <span key={name+"n"} style={{ fontSize:12,color:"#475569" }}>{name}</span>
                ))}
              </div>
              {detailTask.note && (
                <div style={{ marginTop:10,background:"#f8fafc",borderRadius:8,
                  padding:"8px 12px",fontSize:12,color:"#475569" }}>{detailTask.note}</div>
              )}
            </div>
            {/* Comments */}
            <div style={{ flex:1,overflowY:"auto",padding:"14px 20px" }}>
              <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",
                letterSpacing:.5,marginBottom:10 }}>
                💬 ความคิดเห็น ({(detailTask.comments||[]).length})
              </div>
              {(detailTask.comments||[]).length===0 ? (
                <div style={{ textAlign:"center",color:"#cbd5e1",padding:"24px 0",fontSize:13 }}>
                  ยังไม่มีความคิดเห็น
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {(detailTask.comments||[]).map((c,i)=>{
                    const isMe = c.by===currentUser?.name;
                    return (
                      <div key={i} style={{ display:"flex",gap:8,
                        flexDirection:isMe?"row-reverse":"row" }}>
                        <div style={{ width:28,height:28,borderRadius:"50%",flexShrink:0,
                          background:`hsl(${(c.by||"").charCodeAt(0)*7%360},60%,65%)`,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:12,fontWeight:700,color:"#fff" }}>
                          {(c.by||"?").charAt(0)}
                        </div>
                        <div style={{ maxWidth:"75%" }}>
                          <div style={{ fontSize:10,color:"#94a3b8",marginBottom:3,
                            textAlign:isMe?"right":"left" }}>
                            {c.by} · {c.at?.slice(0,10)||""}
                          </div>
                          <div style={{ background:isMe?"#f0fdf4":"#f8fafc",
                            border:`1px solid ${isMe?"#bbf7d0":"#e2e8f0"}`,
                            borderRadius:isMe?"12px 4px 12px 12px":"4px 12px 12px 12px",
                            padding:"8px 12px",fontSize:13,color:"#1e293b",lineHeight:1.6 }}>
                            {c.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Input */}
            <div style={{ padding:"12px 16px",borderTop:"1px solid #f1f5f9",flexShrink:0,
              display:"flex",gap:8,alignItems:"flex-end" }}>
              <textarea value={comment} onChange={e=>setComment(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault();
                  if(!comment.trim()||sending) return;
                  setSending(true);
                  const newComment={ text:comment.trim(), by:currentUser?.name||"", at:new Date().toISOString() };
                  const updated={ ...detailTask, comments:[...(detailTask.comments||[]),newComment] };
                  onSaveTask(updated, detailTask.id);
                  setComment(""); setSending(false);
                }}}
                placeholder="พิมพ์ข้อความ... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                rows={2}
                style={{ flex:1,border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px",
                  fontSize:13,fontFamily:"inherit",resize:"none",outline:"none",
                  background:"#f8fafc",lineHeight:1.5 }}/>
              <button onClick={async()=>{
                  if(!comment.trim()||sending) return;
                  setSending(true);
                  const newComment={ text:comment.trim(), by:currentUser?.name||"", at:new Date().toISOString() };
                  const updated={ ...detailTask, comments:[...(detailTask.comments||[]),newComment] };
                  await onSaveTask(updated, detailTask.id);
                  setComment(""); setSending(false);
                }}
                disabled={!comment.trim()||sending}
                style={{ background:"#6B21A8",border:"none",color:"#fff",borderRadius:10,
                  padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",
                  fontFamily:"inherit",flexShrink:0,opacity:!comment.trim()||sending?0.5:1 }}>
                ส่ง
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmConvert && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:16,padding:24,maxWidth:340,width:"100%",
            boxShadow:"0 20px 60px rgba(0,0,0,.2)",textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:12 }}>📁</div>
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:6 }}>สร้างเคสจากงานนี้?</div>
            <div style={{ fontSize:13,color:"#64748b",marginBottom:4 }}>"{confirmConvert.title}"</div>
            <div style={{ fontSize:12,color:"#94a3b8",marginBottom:20 }}>ระบบจะสร้างเคสในระบบให้อัตโนมัติ</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <button onClick={()=>setConfirmConvert(null)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={()=>{ onConvertToCase(confirmConvert); setConfirmConvert(null); }}
                style={{ background:"#6B21A8",border:"none",color:"#fff",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                สร้างเคส
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:16,padding:24,maxWidth:320,width:"100%",
            boxShadow:"0 20px 60px rgba(0,0,0,.2)",textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:12 }}>🗑</div>
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:8 }}>ลบงานนี้?</div>
            <div style={{ fontSize:13,color:"#64748b",marginBottom:20 }}>ไม่สามารถกู้คืนได้</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <button onClick={()=>setConfirmId(null)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={()=>{ onDeleteTask(confirmId); setConfirmId(null); }}
                style={{ background:"#ef4444",border:"none",color:"#fff",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <TaskModal onClose={()=>{ setShowModal(false); setEditTask(null); }}
          onSave={(data,id)=>{ onSaveTask(data,id); setShowModal(false); setEditTask(null); }}
          saving={saving} projects={projects} users={users}
          currentUser={currentUser} editTask={editTask}/>
      )}
    </div>
  );
}

function TaskCard({ task, col, projects, currentUser, isAdmin, onMove, onEdit, onDelete, onConvert, onCardClick }) {
  const proj = projects.find(p=>p.id===task.projectId);
  const pri  = PRIORITY_STYLE[task.priority]||PRIORITY_STYLE.normal;
  const due  = daysLeft(task.dueDate);
  const dueColor = due===null?"#94a3b8":due<0?"#dc2626":due<=3?"#f59e0b":"#64748b";
  const isAssigned = (task.assignees||[]).includes(currentUser?.name);
  const isMine = isAssigned || isAdmin;

  const NEXT = { todo:"accepted", accepted:"inprogress", inprogress:"done" };
  const NEXT_LABEL = { todo:"✋ รับงาน", accepted:"🔧 เริ่มทำ", inprogress:"✅ ทำเสร็จ" };
  const NEXT_STYLE = { todo:{ bg:"#e0f2fe",color:"#0369a1" }, accepted:{ bg:"#fef3c7",color:"#92400e" }, inprogress:{ bg:"#dcfce7",color:"#15803d" } };
  const nextStatus = NEXT[task.status];
  const nextStyle = NEXT_STYLE[task.status]||{ bg:"#f1f5f9", color:"#475569" };

  return (
    <div onClick={()=>onCardClick(task)} style={{ background:"#fff",borderRadius:10,padding:12,marginBottom:8,
      boxShadow:"0 1px 2px rgba(0,0,0,.06)",cursor:"pointer",
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
      {(task.comments||[]).length>0 && (
        <div style={{ fontSize:11,color:"#64748b",marginBottom:4 }}>
          💬 {task.comments.length} ความคิดเห็น
        </div>
      )}
      {task.dueDate && (
        <div style={{ fontSize:11,fontWeight:600,color:dueColor,marginBottom:6 }}>
          📅 {fmtDate(task.dueDate)} {due!==null&&(due<0?`(เกิน ${Math.abs(due)} วัน)`:due===0?"(วันนี้!)":due<=3?`(เหลือ ${due} วัน)`:"")}
        </div>
      )}
      {isMine && (
        <div onClick={e=>e.stopPropagation()} style={{ display:"flex",gap:5,paddingTop:8,borderTop:"1px solid #f1f5f9",flexWrap:"wrap" }}>
          {nextStatus && (
            <button onClick={()=>onMove(task,nextStatus)}
              style={{ flex:1,background:nextStyle.bg,border:"none",color:nextStyle.color,
                borderRadius:7,padding:"6px 8px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
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
