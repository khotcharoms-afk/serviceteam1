import { useState } from "react";

const SITUATION_OPTS = ["Support", "Commissioning"];

function calcHours(timeIn, timeOut, dateIn, dateOut) {
  if (!timeIn || !timeOut || !dateIn) return "";
  const d1 = new Date(`${dateIn}T${timeIn}`);
  const d2 = new Date(`${dateOut||dateIn}T${timeOut}`);
  if (d2 <= d1) return "";
  return Math.round((d2-d1)/3600000*2)/2;
}

export default function OTModal({ onClose, onSave, saving, projects, users, currentUser, editRecord }) {
  const today = new Date().toISOString().slice(0,10);
  const thaiName = (users||[]).find(u=>u.id===(currentUser?.id||currentUser?.uid))?.name || currentUser?.name || "";

  const [serviceId,  setServiceId]  = useState(editRecord?.serviceId  || "");
  const [dateIn,     setDateIn]     = useState(editRecord?.dateIn     || today);
  const [dateOut,    setDateOut]    = useState(editRecord?.dateOut     || today);
  const [timeIn,     setTimeIn]     = useState(editRecord?.timeIn     || "");
  const [timeOut,    setTimeOut]    = useState(editRecord?.timeOut    || "");
  const [count,      setCount]      = useState(editRecord?.count      || "");
  const [projId,     setProjId]     = useState(editRecord?.projectId  || "");
  const [location,   setLocation]   = useState(editRecord?.location   || "");
  const [situation,  setSituation]  = useState(editRecord?.situation  || "Support");
  const [desc,       setDesc]       = useState(editRecord?.desc       || "");
  const [name,       setName]       = useState(editRecord?.name       || thaiName);
  const [hours,      setHours]      = useState(editRecord?.hours?.toString() || "");
  const [manualHours,setManualHours]= useState(false);
  const [remark,     setRemark]     = useState(editRecord?.remark     || "ปฏิบัติงานในวันหยุดประจำสัปดาห์");
  const [projSearch, setProjSearch] = useState("");
  const [projDropdown, setProjDropdown] = useState(false);

  const selProj = (projects||[]).find(p=>p.id===projId);
  const filteredProjs = (projects||[]).filter(p=>p.id).filter(p=>
    !projSearch || p.name?.toLowerCase().includes(projSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(projSearch.toLowerCase())
  );

  function onTimeChange(tIn, tOut, dIn, dOut) {
    if (!manualHours) {
      const h = calcHours(tIn||timeIn, tOut||timeOut, dIn||dateIn, dOut||dateOut);
      if (h !== "") setHours(String(h));
    }
  }

  function handleSave() {
    if (!dateIn || !timeIn || !timeOut || !desc.trim() || !name.trim()) return;
    const h = parseFloat(hours) || calcHours(timeIn,timeOut,dateIn,dateOut) || 0;
    onSave({
      serviceId: serviceId.trim(),
      dateIn, dateOut: dateOut||dateIn,
      timeIn, timeOut,
      count: count.trim(),
      projectId: projId||"",
      projectName: selProj?.name||"",
      projectCode: selProj?.code||"",
      location: location.trim(),
      situation,
      desc: desc.trim(),
      name: name.trim(),
      hours: h,
      remark,
      createdBy: currentUser?.id||"",
      createdAt: editRecord?.createdAt||new Date().toISOString(),
    }, editRecord?.id||null);
  }

  const IS = { width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none", background:"#f8fafc" };
  const LB = { fontSize:11, color:"#94a3b8", fontWeight:700, textTransform:"uppercase",
    letterSpacing:.5, marginBottom:4, display:"block" };
  const canSave = !saving && dateIn && timeIn && timeOut && desc.trim() && name.trim();

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:540,
        maxHeight:"92vh",overflowY:"auto",padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>⏰ ใบ OR - บันทึก OT</h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* Service ID + ครั้งที่ */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>เลขที่บริการ / Service ID</label>
            <input value={serviceId} onChange={e=>setServiceId(e.target.value)}
              placeholder="เช่น SV-001" style={IS}/>
          </div>
          <div>
            <label style={LB}>ครั้งที่</label>
            <input value={count} onChange={e=>setCount(e.target.value)}
              placeholder="เช่น 1" style={IS}/>
          </div>
        </div>

        {/* วันที่ */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>ลงวันที่ *</label>
            <input type="date" value={dateIn} style={IS}
              onChange={e=>{ setDateIn(e.target.value); onTimeChange(null,null,e.target.value,null); }}/>
          </div>
          <div>
            <label style={LB}>ถึงวันที่</label>
            <input type="date" value={dateOut} style={IS}
              onChange={e=>{ setDateOut(e.target.value); onTimeChange(null,null,null,e.target.value); }}/>
          </div>
        </div>

        {/* เวลา */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>เวลาเข้า *</label>
            <input type="time" value={timeIn} style={IS}
              onChange={e=>{ setTimeIn(e.target.value); onTimeChange(e.target.value,null,null,null); }}/>
          </div>
          <div>
            <label style={LB}>เวลาออก *</label>
            <input type="time" value={timeOut} style={IS}
              onChange={e=>{ setTimeOut(e.target.value); onTimeChange(null,e.target.value,null,null); }}/>
          </div>
        </div>

        {/* ชั่วโมง OT */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
            <label style={{ ...LB,marginBottom:0 }}>ชั่วโมง OT</label>
            <label style={{ fontSize:11,color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",gap:4 }}>
              <input type="checkbox" checked={manualHours} onChange={e=>setManualHours(e.target.checked)}
                style={{ accentColor:"#F97316" }}/>
              กรอกเอง
            </label>
          </div>
          <input type="number" step="0.5" min="0" value={hours}
            onChange={e=>{ setHours(e.target.value); setManualHours(true); }}
            placeholder="คำนวณอัตโนมัติจากเวลาเข้า-ออก" style={IS}/>
          {hours && !manualHours && (
            <div style={{ fontSize:11,color:"#F97316",marginTop:3 }}>⚡ {hours} ชั่วโมง</div>
          )}
        </div>

        {/* โครงการ */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ชื่อโครงการ / Project Name</label>
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex",alignItems:"center",border:"1px solid #e2e8f0",
              borderRadius:8,background:"#f8fafc",overflow:"hidden" }}>
              <input style={{ flex:1,border:"none",background:"transparent",padding:"8px 12px",
                fontSize:13,fontFamily:"inherit",outline:"none",color:"#1e293b" }}
                placeholder="ค้นหาโครงการ..."
                value={projDropdown?projSearch:(selProj?.name||"")}
                onFocus={()=>{ setProjDropdown(true); setProjSearch(""); }}
                onChange={e=>{ setProjSearch(e.target.value); setProjDropdown(true); }}/>
              {selProj && !projDropdown && (
                <button type="button" onClick={()=>{ setProjId(""); setProjSearch(""); }}
                  style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",padding:"0 10px",fontSize:14 }}>✕</button>
              )}
            </div>
            {projDropdown && (
              <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:100,
                background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:200,overflowY:"auto",marginTop:4 }}>
                {filteredProjs.length===0
                  ? <div style={{ padding:"12px",fontSize:13,color:"#94a3b8",textAlign:"center" }}>ไม่พบโครงการ</div>
                  : filteredProjs.map(p=>(
                    <div key={p.id} onMouseDown={()=>{ setProjId(p.id); setProjDropdown(false); setProjSearch(""); }}
                      style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                        background:projId===p.id?"#fff7ed":"transparent",borderBottom:"1px solid #f8fafc" }}
                      onMouseEnter={e=>{ if(projId!==p.id) e.currentTarget.style.background="#f8fafc"; }}
                      onMouseLeave={e=>{ if(projId!==p.id) e.currentTarget.style.background="transparent"; }}>
                      <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||"#94a3b8",flexShrink:0 }}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                        {p.code&&<div style={{ fontSize:11,color:"#94a3b8" }}>{p.code}</div>}
                      </div>
                      {projId===p.id&&<span style={{ color:"#f97316" }}>✓</span>}
                    </div>
                  ))
                }
              </div>
            )}
            {projDropdown && <div style={{ position:"fixed",inset:0,zIndex:99 }} onMouseDown={()=>setProjDropdown(false)}/>}
          </div>
        </div>

        {/* สถานที่ + สถานะ */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>สถานที่ปฏิบัติงาน / Address</label>
            <input value={location} onChange={e=>setLocation(e.target.value)}
              placeholder="เช่น ศูนย์ราชการ" style={IS}/>
          </div>
          <div>
            <label style={LB}>สถานะ / Situation</label>
            <div style={{ display:"flex",gap:6 }}>
              {SITUATION_OPTS.map(s=>(
                <button key={s} type="button" onClick={()=>setSituation(s)}
                  style={{ flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:700,
                    fontFamily:"inherit",cursor:"pointer",
                    background:situation===s?"#F97316":"#f8fafc",
                    border:`1px solid ${situation===s?"#F97316":"#e2e8f0"}`,
                    color:situation===s?"#fff":"#64748b" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* รายละเอียด */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>Description / รายละเอียด *</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)}
            placeholder="อธิบายงานที่ทำในช่วง OT..." rows={4}
            style={{ ...IS,resize:"vertical" }}/>
        </div>

        {/* ลายเซ็น */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:14 }}>
          <div>
            <label style={LB}>ผู้เข้าทำงาน / Service *</label>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล" style={IS}/>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div style={{ marginBottom:20 }}>
          <label style={LB}>หมายเหตุ (สำหรับหน้าปก)</label>
          <select value={remark} onChange={e=>setRemark(e.target.value)} style={IS}>
            <option value="ปฏิบัติงานในวันหยุดประจำสัปดาห์">ปฏิบัติงานในวันหยุดประจำสัปดาห์</option>
            <option value="ปฏิบัติงานในวันธรรมดา">ปฏิบัติงานในวันธรรมดา</option>
            <option value="ปฏิบัติงานในวันหยุดนักขัตฤกษ์">ปฏิบัติงานในวันหยุดนักขัตฤกษ์</option>
          </select>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
            borderRadius:10,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ background:"#F97316",border:"none",color:"#fff",borderRadius:10,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:canSave?1:0.5 }}>
            {saving?"กำลังบันทึก...":(editRecord?"💾 บันทึก":"➕ บันทึก OT")}
          </button>
        </div>
      </div>
    </div>
  );
}
