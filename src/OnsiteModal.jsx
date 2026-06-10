import { useState } from "react";

// ── ค่าเดินทางตามสูตร ────────────────────────────────────────
function calcTravel(km) {
  const k = parseFloat(km) || 0;
  if (k <= 0) return 0;
  const rate = k > 20 ? 8 : 6;
  return Math.max(200, Math.round(k * rate));
}

export default function OnsiteModal({ onClose, onSave, saving, projects, users, currentUser }) {

  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]           = useState(today);
  const [projId, setProjId]       = useState("");
  const [siteIndex, setSiteIndex] = useState("");
  const [scope, setScope]         = useState("Maintenance");
  const [detail, setDetail]       = useState("");
  const [robotSerial, setRobotSerial] = useState("");
  const [techs, setTechs]         = useState([currentUser?.name || ""]);
  const [km, setKm]               = useState("");
  const [shipping, setShipping]   = useState("0");
  const [partsCost, setPartsCost] = useState("0");

  const proj = projects.find(p => p.id === projId);
  const sites = (proj?.sites || []).map(s => typeof s === "object" ? s : { name: s, refCode: "", travelRate: 0 });
  const selSite = siteIndex !== "" ? sites[parseInt(siteIndex)] : null;

  // ค่าเดินทาง: ถ้ากรอก km ใช้สูตร ถ้าไม่กรอกใช้ travelRate ของไซต์
  const travelCost = km ? calcTravel(km) : (selSite?.travelRate || 0);

  // ค่าแรง: รวมทุกคนที่เลือก
  const laborCost = techs.reduce((sum, name) => {
    const u = users.find(u => u.name === name);
    return sum + (u?.dailyRate || 0);
  }, 0);

  const totalCost = travelCost + parseFloat(shipping || 0) + parseFloat(partsCost || 0) + laborCost;

  const approvedUsers = users.filter(u => u.role !== "pending");

  function toggleTech(name) {
    setTechs(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function handleSave() {
    if (!projId || !date || techs.length === 0) return;
    onSave({
      date,
      projectId: projId,
      projectName: proj?.name || "",
      site: selSite?.name || "",
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
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || "",
    });
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
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:540,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
        padding:"24px" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>📍 บันทึก Onsite</h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* วันที่ */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
        </div>

        {/* โครงการ */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>โครงการ *</label>
          <select value={projId} onChange={e => { setProjId(e.target.value); setSiteIndex(""); }} style={inputStyle}>
            <option value="">— เลือกโครงการ —</option>
            {projects.filter(p => p.id).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* ไซต์งาน */}
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

        {/* ขอบเขตงาน */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>ขอบเขตงาน</label>
          <select value={scope} onChange={e => setScope(e.target.value)} style={inputStyle}>
            {["Maintenance","Installation","Inspection","Troubleshooting","Other"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* รายละเอียด */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>รายละเอียด</label>
          <textarea value={detail} onChange={e => setDetail(e.target.value)}
            placeholder="อธิบายงานที่ทำ..." rows={3}
            style={{ ...inputStyle, resize:"vertical" }}/>
        </div>

        {/* Serial Robot */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Serial / หุ่นยนต์ (ถ้ามี)</label>
          <input value={robotSerial} onChange={e => setRobotSerial(e.target.value)}
            placeholder="เช่น SC50-0012" style={inputStyle}/>
        </div>

        {/* พนักงาน */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>พนักงาน * ({techs.length} คน)</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {approvedUsers.map(u => (
              <label key={u.id} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                background: techs.includes(u.name) ? "#f0fdf4" : "#f8fafc",
                border:`1px solid ${techs.includes(u.name) ? "#bbf7d0" : "#e2e8f0"}`,
                borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:500 }}>
                <input type="checkbox" checked={techs.includes(u.name)}
                  onChange={() => toggleTech(u.name)}
                  style={{ accentColor:"#16a34a" }}/>
                {u.name}
                {u.dailyRate ? <span style={{ color:"#16a34a",fontSize:11 }}>({u.dailyRate.toLocaleString()}฿)</span> : ""}
              </label>
            ))}
          </div>
        </div>

        {/* ค่าใช้จ่าย */}
        <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px",marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:12 }}>💰 ค่าใช้จ่าย</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <label style={labelStyle}>ระยะทาง (กม.)</label>
              <input type="number" min="0" value={km} onChange={e => setKm(e.target.value)}
                placeholder={selSite?.travelRate ? `ค่าเดิน ${selSite.travelRate} บ. (ไซต์)` : "0"}
                style={inputStyle}/>
              {km && <div style={{ fontSize:11,color:"#f97316",marginTop:3,fontWeight:600 }}>
                = {travelCost.toLocaleString()} บาท
              </div>}
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

          {/* รวม */}
          <div style={{ marginTop:12,padding:"10px 14px",background:"#fff7ed",
            border:"1px solid #fed7aa",borderRadius:10,display:"flex",justifyContent:"space-between" }}>
            <span style={{ fontSize:14,fontWeight:700,color:"#7c2d12" }}>รวมทั้งสิ้น</span>
            <span style={{ fontSize:18,fontWeight:800,color:"#f97316" }}>
              {totalCost.toLocaleString()} บาท
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose}
            style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
              borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || !projId || techs.length === 0}
            style={{ background:"#f97316",border:"none",color:"#fff",borderRadius:10,
              padding:"12px",fontSize:14,fontWeight:600,
              cursor: saving || !projId || techs.length === 0 ? "not-allowed" : "pointer",
              fontFamily:"inherit", opacity: saving || !projId ? 0.7 : 1 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึก Onsite"}
          </button>
        </div>
      </div>
    </div>
  );
}
