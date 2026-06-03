import { useState } from "react";
import { fmtDate } from "./utils.js";

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
function CaseCard({ c, proj, onClick, onEdit, onDel, onHandover, onUpdate }) {
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
      {(c.updateLog||[]).length>0&&(
        <div style={{ marginTop:4,fontSize:11,color:"#16a34a",fontWeight:600 }}>
          📝 อัปเดตแล้ว {c.updateLog.length} ครั้ง
        </div>
      )}
      {(c.handoverLog||[]).length>0 && (
        <div style={{ marginTop:4,fontSize:11,color:"#8b5cf6",fontWeight:600 }}>
          🔁 ส่งต่อแล้ว {c.handoverLog.length} ครั้ง • ปัจจุบัน: {c.tech}
        </div>
      )}
      <div style={{ display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #f1f5f9" }}
        onClick={e=>e.stopPropagation()}>
        <button onClick={onEdit} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
          color:"#475569",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✎ แก้ไข</button>
        <button onClick={onUpdate} style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",
          color:"#16a34a",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>📝 อัปเดต</button>
        <button onClick={onHandover} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
          color:"#2563eb",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>📤 ส่งต่อ</button>
        <button onClick={onDel} style={{ background:"#fff5f5",border:"1px solid #fecaca",
          color:"#ef4444",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✕ ลบ</button>
      </div>
    </div>
  );
}

export default HandoverModal;
