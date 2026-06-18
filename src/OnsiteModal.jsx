import { useState } from "react";

function calcTravel(km) {
  const k = parseFloat(km) || 0;
  if (k <= 0) return 0;
  const rate = k > 20 ? 8 : k > 10 ? 7 : 6;
  return Math.max(200, Math.round(k * rate));
}

export default function OnsiteModal({ onClose, onSave, saving, projects, users, currentUser, editRecord }) {

  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!editRecord;

  const [date, setDate]         = useState(editRecord?.date || today);
  const [projId, setProjId]     = useState(editRecord?.projectId || "");
  const [projSearch, setProjSearch] = useState("");
  const [projDropdown, setProjDropdown] = useState(false);
  const [siteIndex, setSiteIndex] = useState("");
  const [scope, setScope]       = useState(editRecord?.scope || "Maintenance");
  const [detail, setDetail]     = useState(editRecord?.detail || "");
  const [robotSerial, setRobotSerial] = useState(editRecord?.robotSerial || "");
  const [techs, setTechs]       = useState(
    editRecord?.techs?.length ? editRecord.techs : [currentUser?.name || ""]
  );
  const [km, setKm]             = useState(editRecord?.km ? String(editRecord.km) : "");
  const [shipping, setShipping] = useState(editRecord?.shippingCost ? String(editRecord.shippingCost) : "0");
  const [partsCost, setPartsCost] = useState(editRecord?.partsCost ? String(editRecord.partsCost) : "0");

  const proj = (projects||[]).find(p => p.id === projId);
  const sites = (proj?.sites || []).map(s => typeof s === "object" ? s : { name: s, refCode: "", travelRate: 0 });
  const selSite = siteIndex !== "" ? sites[parseInt(siteIndex)] :
    sites.find(s => s.name === editRecord?.site) || null;

  const travelCost = km ? calcTravel(km) : (selSite?.travelRate || 0);
  const laborCost = techs.reduce((sum, name) => {
    const u = (users||[]).find(u => u.name === name);
    return sum + (u?.onsiteRate || 0);
  }, 0);
  const totalCost = travelCost + parseFloat(shipping || 0) + parseFloat(partsCost || 0) + laborCost;
  const approvedUsers = (users||[]).filter(u => u.role !== "pending");

  function toggleTech(name) {
    setTechs(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function handleSave() {
    if (!projId) return;
    if (techs.length === 0) return;
    const isAdmin = currentUser?.role === "admin";
    onSave({
      date,
      projectId: proj?.id || projId || "",
      projectName: proj?.name || "",
      site: selSite?.name || editRecord?.site || "",
      refCode: selSite?.refCode || "",
      scope,
      detail,
      robotSerial,
      techs,
      km: parseFloat(km) || 0,
      travelCost,
      shippingCost: parseFloat(shipping) || 0,
      partsCost: parseFloat(partsCost) || 0,
      laborCost,
      totalCost,
      // admin บันทึกเอง → อนุมัติทันที, user → รออนุมัติ
      // ถ้าแก้ไข record เดิม → กลับเป็น pending (ยกเว้น admin)
      status: isAdmin ? "approved" : "pending",
      ...(isAdmin && { approvedBy: currentUser?.name || "", approvedAt: new Date().toISOString() }),
    }, editRecord?.id || null);
  }

  const inputStyle = {
    width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 12px", fontSize:13, fontFamily:"inherit",
    outline:"none", background:"#f8fafc", boxSizing:"border-box",
  };
  const labelStyle = {
    fontSize:11, color:"#94a3b8", fontWeight:700,
    textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block",
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:540,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
        padding:"24px" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
            📍 {isEdit ? "แก้ไข Onsite" : "บันทึก Onsite"}
          </h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {currentUser?.role !== "admin" && (
          <div style={{ background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,
            padding:"10px 14px",marginBottom:14,fontSize:12,color:"#92400e" }}>
            ℹ️ รายการนี้จะส่งให้ admin อนุมัติก่อนนับเข้ารายงาน
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>โครงการ *</label>
          {(()=>{
            const selProj = (projects||[]).find(p=>p.id===projId);
            const filteredProjs = (projects||[]).filter(p=>p.id).filter(p=>
              !projSearch || p.name?.toLowerCase().includes(projSearch.toLowerCase()) ||
              p.code?.toLowerCase().includes(projSearch.toLowerCase())
            );
            return (
              <div style={{ position:"relative" }}>
                <div style={{ display:"flex",alignItems:"center",border:"1px solid #e2e8f0",
                  borderRadius:8,background:"#f8fafc",overflow:"hidden" }}>
                  <input
                    style={{ flex:1,border:"none",background:"transparent",padding:"8px 12px",
                      fontSize:13,fontFamily:"inherit",outline:"none",color:"#1e293b" }}
                    placeholder="ค้นหาโครงการ..."
                    value={projDropdown ? projSearch : (selProj?.name||"")}
                    onFocus={()=>{ setProjDropdown(true); setProjSearch(""); }}
                    onChange={e=>{ setProjSearch(e.target.value); setProjDropdown(true); }}
                  />
                  {selProj && !projDropdown && (
                    <button type="button" onClick={()=>{ setProjId(""); setProjSearch(""); setSiteIndex(""); }}
                      style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",
                        padding:"0 10px",fontSize:14 }}>✕</button>
                  )}
                </div>
                {projDropdown && (
                  <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:100,
                    background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
                    boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto",marginTop:4 }}>
                    {filteredProjs.length===0 ? (
                      <div style={{ padding:"12px 14px",fontSize:13,color:"#94a3b8",textAlign:"center" }}>ไม่พบโครงการ</div>
                    ) : filteredProjs.map(p=>(
                      <div key={p.id}
                        onMouseDown={()=>{ setProjId(p.id); setProjDropdown(false); setProjSearch(""); setSiteIndex(""); }}
                        style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                          background:projId===p.id?"#fff7ed":"transparent",borderBottom:"1px solid #f8fafc" }}
                        onMouseEnter={e=>{ if(projId!==p.id) e.currentTarget.style.background="#f8fafc"; }}
                        onMouseLeave={e=>{ if(projId!==p.id) e.currentTarget.style.background="transparent"; }}>
                        <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||"#94a3b8",flexShrink:0 }}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:600,color:"#0f172a",
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                          {p.code&&<div style={{ fontSize:11,color:"#94a3b8" }}>{p.code}</div>}
                        </div>
                        {projId===p.id && <span style={{ color:"#f97316",fontSize:14 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
                {projDropdown && (
                  <div style={{ position:"fixed",inset:0,zIndex:99 }}
                    onMouseDown={()=>setProjDropdown(false)}/>
                )}
              </div>
            );
          })()}
        </div>

        {sites.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>ไซต์งาน</label>
            <select value={siteIndex} onChange={e => setSiteIndex(e.target.value)} style={inputStyle}>
              <option value="">— เลือกไซต์ —</option>
              {sites.map((s, i) => (
                <option key={i} value={i}>{s.name}{s.refCode ? ` (${s.refCode})` : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>พนักงาน *</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {approvedUsers.map(u => (
              <label key={u.id} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                background: techs.includes(u.name) ? "#f0fdf4" : "#f8fafc",
                border:`1px solid ${techs.includes(u.name) ? "#bbf7d0" : "#e2e8f0"}`,
                borderRadius:8,padding:"5px 10px",fontSize:12 }}>
                <input type="checkbox" checked={techs.includes(u.name)}
                  onChange={() => toggleTech(u.name)} style={{ accentColor:"#16a34a" }}/>
                {u.name}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>ขอบเขตงาน</label>
          <select value={scope} onChange={e => setScope(e.target.value)} style={inputStyle}>
            {[{v:"Maintenance",l:"บำรุงรักษา (Maintenance)"},{v:"Installation",l:"ติดตั้ง (Installation)"},{v:"Inspection",l:"ตรวจสอบ (Inspection)"},{v:"Troubleshooting",l:"แก้ไขปัญหา (Troubleshooting)"},{v:"Other",l:"อื่นๆ (Other)"}].map(s => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>รายละเอียด</label>
          <textarea value={detail} onChange={e => setDetail(e.target.value)}
            placeholder="อธิบายงานที่ทำ..." rows={3}
            style={{ ...inputStyle, resize:"vertical" }}/>
        </div>

        {proj && (proj?.name||"").toLowerCase().includes("robot") && (
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Serial / หุ่นยนต์ (ถ้ามี)</label>
            <input value={robotSerial} onChange={e => setRobotSerial(e.target.value)}
              placeholder="เช่น SC50-0012" style={inputStyle}/>
          </div>
        )}

        <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px",marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:12 }}>💰 ค่าใช้จ่าย</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <label style={labelStyle}>ค่าเดินทาง</label>
              {(selSite?.travelRate || 0) > 0 ? (
                <div style={{ padding:"8px 12px",background:"#fff7ed",border:"1px solid #fed7aa",
                  borderRadius:8,fontSize:13,color:"#f97316",fontWeight:700,display:"flex",
                  alignItems:"center",justifyContent:"space-between" }}>
                  <span>{travelCost.toLocaleString()} บาท</span>
                  <span style={{ fontSize:10,background:"#fff",border:"1px solid #fed7aa",
                    color:"#f97316",borderRadius:4,padding:"1px 6px" }}>อัตโนมัติ</span>
                </div>
              ) : (
                <>
                  <input type="number" min="0" value={km} onChange={e => setKm(e.target.value)}
                    placeholder="ระยะทาง (กม.)" style={inputStyle}/>
                  {km && <div style={{ fontSize:11,color:"#f97316",marginTop:3,fontWeight:600 }}>
                    = {travelCost.toLocaleString()} บาท
                  </div>}
                </>
              )}
            </div>
            <div>
              <label style={labelStyle}>ค่าขนส่ง (บาท)</label>
              <input type="number" min="0" value={shipping} onChange={e => setShipping(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>ค่าอุปกรณ์ (บาท)</label>
              <input type="number" min="0" value={partsCost} onChange={e => setPartsCost(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>ค่าแรงรวม</label>
              <div style={{ padding:"8px 12px",background:"#fff",border:"1px solid #e2e8f0",
                borderRadius:8,fontSize:13,color:"#16a34a",fontWeight:700 }}>
                {laborCost.toLocaleString()} บาท
              </div>
            </div>
          </div>
          <div style={{ marginTop:12,padding:"10px 14px",background:"#fff7ed",
            border:"1px solid #fed7aa",borderRadius:10,display:"flex",justifyContent:"space-between" }}>
            <span style={{ fontSize:14,fontWeight:700,color:"#7c2d12" }}>รวมทั้งสิ้น</span>
            <span style={{ fontSize:18,fontWeight:800,color:"#f97316" }}>
              {totalCost.toLocaleString()} บาท
            </span>
          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose}
            style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
              borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || !projId || techs.length === 0}
            style={{ background:"#f97316",border:"none",color:"#fff",borderRadius:10,
              padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity: saving ? 0.7 : 1 }}>
            {saving ? "กำลังบันทึก..." : (isEdit ? "💾 บันทึกการแก้ไข" : "💾 บันทึก Onsite")}
          </button>
        </div>
      </div>
    </div>
  );
}
