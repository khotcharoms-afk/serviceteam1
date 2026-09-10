import { useState } from "react";
import { IS } from "./utils.js";
import { useTheme } from "./theme.js";

// ── Handover Modal ────────────────────────────────────────────
function HandoverModal({ open, onClose, caseData, onSave, users, currentUser }) {
  const { c } = useTheme();
  const [toId, setToId]   = useState("");
  const [note, setNote]   = useState("");
  if (!open || !caseData) return null;
  const toUser = users.find(u=>u.id===toId);
  function submit() {
    if (!toId) return;
    const entry = {
      from: currentUser?.name||caseData.tech||"ไม่ระบุ",
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
      <div style={{ background:c.card,borderRadius:16,padding:"24px",width:"100%",maxWidth:460,
        maxHeight:"calc(100vh - 32px)",overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,.35)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:c.text900 }}>📤 ส่งต่องาน</h2>
          <button onClick={onClose} style={{ background:c.borderSoft,border:"none",color:c.text500,
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14,display:"flex",
            alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {/* Current assignee */}
        <div style={{ background:c.bg,borderRadius:10,padding:'12px 14px',marginBottom:16,
          border:`1px solid ${c.border}` }}>
          <div style={{ fontSize:10,color:c.text400,fontWeight:700,letterSpacing:1,marginBottom:4 }}>ผู้รับผิดชอบปัจจุบัน</div>
          <div style={{ fontSize:14,fontWeight:600,color:c.text900 }}>{caseData.tech||"ไม่ระบุ"}</div>
        </div>

        {/* To */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,color:c.text500,fontWeight:600,marginBottom:5 }}>ส่งต่อให้ *</div>
          <select value={toId} onChange={e=>setToId(e.target.value)}
            style={IS({ cursor:"pointer" })}>
            <option value="">— เลือกผู้รับงาน —</option>
            {users.filter(u=>u.role!=="pending"&&u.name!==caseData.tech).map(u=>(
              <option key={u.id} value={u.id}>{u.name} {u.role==="admin"?"(Admin)":""}</option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11,color:c.text500,fontWeight:600,marginBottom:5 }}>หมายเหตุ / ทำไปถึงไหนแล้ว</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="เช่น ติดตั้งเสร็จแล้ว รอ config เพิ่ม..."
            style={IS({ resize:"vertical", minHeight:80, lineHeight:1.6 })}/>
        </div>

        {/* Handover log */}
        {(caseData.handoverLog||[]).length>0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:c.text400,fontWeight:700,letterSpacing:1,marginBottom:8 }}>ประวัติการส่งต่อ</div>
            <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:160,overflowY:"auto" }}>
              {[...(caseData.handoverLog||[])].reverse().map((h,i)=>(
                <div key={i} style={{ background:c.bg,borderRadius:8,padding:"8px 12px",
                  border:`1px solid ${c.border}`,fontSize:12 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                    <span style={{ color:c.text500,fontWeight:600 }}>{h.from}</span>
                    <span style={{ color:c.text400 }}>→</span>
                    <span style={{ color:c.blue,fontWeight:600 }}>{h.to}</span>
                    <span style={{ color:c.text400,marginLeft:"auto",fontSize:11 }}>{h.date} {h.time}</span>
                  </div>
                  {h.note && <div style={{ color:c.text500,fontSize:11,marginTop:2 }}>"{h.note}"</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ background:c.bg,border:`1px solid ${c.border}`,
            color:c.text500,borderRadius:10,padding:"11px 18px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={submit} style={{ flex:1,background:c.blue,border:"none",color:"#fff",
            borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>📤 ส่งต่องาน</button>
        </div>
      </div>
    </div>
  );
}

export default HandoverModal;
