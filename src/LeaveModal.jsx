import { useState } from "react";

const LEAVE_TYPES = [
  { id:"vacation", label:"ลาพักผ่อน" },
  { id:"personal", label:"ลากิจ" },
  { id:"sick",     label:"ลาป่วย" },
  { id:"other",    label:"อื่นๆ" },
];
const DAYS_TH = ["จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์","อาทิตย์"];

export default function LeaveModal({ onClose, onSave, saving, currentUser }) {
  const today = new Date().toISOString().slice(0,10);
  const [leaveType, setLeaveType] = useState("vacation");
  const [otherType, setOtherType] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [manager, setManager] = useState("");
  const [department, setDepartment] = useState("");
  const [empLevel, setEmpLevel] = useState("");
  const [position, setPosition] = useState("");
  const [empId, setEmpId] = useState("");
  const [offDays, setOffDays] = useState([]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [error, setError] = useState("");

  function toggleDay(d) {
    setOffDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d]);
  }

  function handleSave() {
    if (!reason.trim()) { setError("กรุณากรอกเหตุผลการลา"); return; }
    if (!days || isNaN(days) || parseFloat(days) <= 0) { setError("กรุณากรอกจำนวนวัน"); return; }
    setError("");
    onSave({
      leaveType, otherType, workLocation, phone,
      manager, department, empLevel, position, empId,
      offDays, reason, days: parseFloat(days),
      dateFrom, dateTo,
      name: currentUser?.name || "",
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.id || currentUser?.uid || "",
    });
  }

  const IS = (extra={}) => ({
    width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 12px", fontSize:13, fontFamily:"inherit",
    outline:"none", background:"#f8fafc", boxSizing:"border-box", ...extra,
  });
  const LB = { fontSize:11, color:"#94a3b8", fontWeight:700,
    textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:520,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:24 }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>📋 ยื่นใบลา</h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* ประเภทการลา */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ประเภทการลา *</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
            {LEAVE_TYPES.map(t => (
              <label key={t.id} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                background: leaveType===t.id ? "#eff6ff" : "#f8fafc",
                border:`1px solid ${leaveType===t.id ? "#bfdbfe" : "#e2e8f0"}`,
                borderRadius:8, padding:"6px 12px", fontSize:13 }}>
                <input type="radio" name="leaveType" value={t.id}
                  checked={leaveType===t.id} onChange={()=>setLeaveType(t.id)}
                  style={{ accentColor:"#2563eb" }}/>
                {t.label}
              </label>
            ))}
          </div>
          {leaveType==="other" && (
            <input style={{ ...IS(), marginTop:8 }} value={otherType}
              onChange={e=>setOtherType(e.target.value)} placeholder="ระบุประเภทการลา"/>
          )}
        </div>

        {/* สถานที่ + โทร */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>สถานที่ปฏิบัติงาน</label>
            <input style={IS()} value={workLocation} onChange={e=>setWorkLocation(e.target.value)}/>
          </div>
          <div>
            <label style={LB}>โทรศัพท์</label>
            <input style={IS()} value={phone} onChange={e=>setPhone(e.target.value)}/>
          </div>
        </div>

        {/* เรียน */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>เรียน ผู้จัดการแผนก</label>
            <input style={IS()} value={manager} onChange={e=>setManager(e.target.value)}/>
          </div>
          <div>
            <label style={LB}>สำนัก/ฝ่าย</label>
            <input style={IS()} value={department} onChange={e=>setDepartment(e.target.value)}/>
          </div>
        </div>

        {/* ข้อมูลพนักงาน */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>พนักงานระดับ</label>
            <input style={IS()} value={empLevel} onChange={e=>setEmpLevel(e.target.value)}/>
          </div>
          <div>
            <label style={LB}>ตำแหน่ง</label>
            <input style={IS()} value={position} onChange={e=>setPosition(e.target.value)}/>
          </div>
          <div>
            <label style={LB}>เลขบัตรพนักงาน</label>
            <input style={IS()} value={empId} onChange={e=>setEmpId(e.target.value)}/>
          </div>
        </div>

        {/* วันหยุดประจำสัปดาห์ */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>วันหยุดประจำสัปดาห์</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {DAYS_TH.map(d => (
              <label key={d} style={{ display:"flex",alignItems:"center",gap:4,cursor:"pointer",
                background: offDays.includes(d) ? "#f0fdf4" : "#f8fafc",
                border:`1px solid ${offDays.includes(d) ? "#bbf7d0" : "#e2e8f0"}`,
                borderRadius:8, padding:"4px 10px", fontSize:12 }}>
                <input type="checkbox" checked={offDays.includes(d)}
                  onChange={()=>toggleDay(d)} style={{ accentColor:"#16a34a" }}/>
                {d}
              </label>
            ))}
          </div>
        </div>

        {/* เหตุผล */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>เหตุผลการลา *</label>
          <textarea value={reason} onChange={e=>{ setReason(e.target.value); setError(""); }}
            rows={2} style={{ ...IS(), resize:"vertical" }}
            placeholder="ระบุเหตุผลการลา"/>
        </div>

        {/* จำนวนวัน + วันที่ */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16 }}>
          <div>
            <label style={LB}>จำนวนวัน *</label>
            <input type="number" min="0.5" step="0.5" style={IS()} value={days}
              onChange={e=>{ setDays(e.target.value); setError(""); }}/>
          </div>
          <div>
            <label style={LB}>ตั้งแต่วันที่</label>
            <input type="date" style={IS()} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
          </div>
          <div>
            <label style={LB}>ถึงวันที่</label>
            <input type="date" style={IS()} value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>
        </div>

        {error && <div style={{ color:"#ef4444",fontSize:12,marginBottom:12,fontWeight:500 }}>⚠ {error}</div>}

        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose}
            style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
              borderRadius:10,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:10,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:saving?0.7:1 }}>
            {saving ? "กำลังบันทึก..." : "📋 ยื่นใบลา"}
          </button>
        </div>
      </div>
    </div>
  );
}
