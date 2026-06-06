import { useState } from "react";
import { STATUS_OPTS, today } from "./utils.js";

// ── Update Log Modal ──────────────────────────────────────────
function UpdateLogModal({ open, onClose, caseData, onSave, currentUser }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  if (!open || !caseData) return null;

  function submit() {
    if (!text.trim()) { setError("กรุณากรอกรายละเอียดความคืบหน้าก่อนบันทึก"); return; }
    setError("");
    const entry = {
      by:     currentUser?.name||"ไม่ระบุ",
      text:   text.trim(),
      status: status||caseData.status,
      date:   new Date().toISOString().slice(0,10),
      time:   new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}),
    };
    const log = [...(caseData.updateLog||[]), entry];
    onSave({ ...caseData, updateLog:log, status:status||caseData.status });
    setText(""); setStatus(""); setError(""); onClose();
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:"24px",width:"100%",maxWidth:480,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>📝 อัปเดตความคืบหน้า</h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14,
            display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {/* Case title */}
        <div style={{ background:"#f8fafc",borderRadius:10,padding:"10px 14px",marginBottom:16,
          border:"1px solid #e2e8f0",fontSize:13,fontWeight:600,color:"#0f172a" }}>
          {caseData.title}
        </div>

        {/* Status update */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>เปลี่ยนสถานะ (ถ้ามี)</div>
          <select value={status} onChange={e=>setStatus(e.target.value)}
            style={{ width:"100%",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"10px 13px",fontSize:14,outline:"none",
              fontFamily:"inherit",cursor:"pointer" }}>
            <option value="">— คงสถานะเดิม —</option>
            {[
              {value:"open",      label:"เปิดเคส"},
              {value:"inprogress",label:"กำลังดำเนินการ"},
              {value:"done",      label:"เสร็จสิ้น"},
              {value:"hold",      label:"รอดำเนินการ"},
            ].map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Update text */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>รายละเอียดความคืบหน้า *</div>
          <textarea value={text} onChange={e=>{ setText(e.target.value); if(e.target.value.trim()) setError(""); }}
            placeholder="อธิบายสิ่งที่ทำไปแล้ว, ปัญหาที่พบ, ขั้นตอนถัดไป..."
            style={{ width:"100%",background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
              color:"#1e293b",padding:"10px 13px",fontSize:14,outline:"none",resize:"vertical",
              minHeight:100,fontFamily:"inherit",boxSizing:"border-box",lineHeight:1.6,
              borderColor:error?"#ef4444":"#e2e8f0" }}/>
          {error && <div style={{ color:"#ef4444",fontSize:12,marginTop:5,fontWeight:500 }}>⚠ {error}</div>}
        </div>

        {/* Previous updates */}
        {(caseData.updateLog||[]).length>0&&(
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,
              textTransform:"uppercase",marginBottom:8 }}>
              อัปเดตก่อนหน้า ({caseData.updateLog.length})
            </div>
            <div style={{ maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6 }}>
              {[...(caseData.updateLog||[])].reverse().map((u,i)=>(
                <div key={i} style={{ background:"#f8fafc",borderRadius:8,padding:"10px 12px",
                  border:"1px solid #e2e8f0" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:"#475569" }}>👤 {u.by}</span>
                    <span style={{ fontSize:11,color:"#94a3b8" }}>{u.date} {u.time}</span>
                  </div>
                  {u.status&&u.status!==caseData.status&&(
                    <div style={{ fontSize:11,color:"#2563eb",marginBottom:3 }}>
                      → เปลี่ยนสถานะเป็น: {u.status}
                    </div>
                  )}
                  <div style={{ fontSize:13,color:"#1e293b",lineHeight:1.6 }}>{u.text}</div>
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
            cursor:"pointer",fontFamily:"inherit" }}>📝 บันทึกอัปเดต</button>
        </div>
      </div>
    </div>
  );
}

export default UpdateLogModal;
