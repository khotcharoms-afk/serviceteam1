import { useState } from "react";
import { IS, SERVICE_TYPES, today } from "./utils.js";

const PRIORITY_OPTS = [
  { value:"urgent_high", label:"ด่วนมาก", color:"#dc2626", bg:"#fef2f2" },
  { value:"urgent",      label:"ด่วน",    color:"#f59e0b", bg:"#fffbeb" },
  { value:"normal",      label:"ปกติ",    color:"#16a34a", bg:"#f0fdf4" },
];

export default function TaskModal({ onClose, onSave, saving, projects, users, currentUser, editTask }) {
  const isEdit = !!editTask;
  const [title,    setTitle]    = useState(editTask?.title    || "");
  const [projId,   setProjId]   = useState(editTask?.projectId|| "");
  const [site,     setSite]     = useState(editTask?.site     || "");
  const [type,     setType]     = useState(editTask?.type     || SERVICE_TYPES[0]);
  const [dueDate,  setDueDate]  = useState(editTask?.dueDate  || "");
  const [priority, setPriority] = useState(editTask?.priority || "normal");
  const [assignees,setAssignees]= useState(editTask?.assignees|| []);
  const [note,     setNote]     = useState(editTask?.note     || "");
  const [projSearch, setProjSearch] = useState("");
  const [projDropdown, setProjDropdown] = useState(false);

  const selProj = (projects||[]).find(p => p.id === projId);
  const sites = (selProj?.sites||[]).map(s => typeof s==="object" ? s.name : s);
  const filteredProjs = (projects||[]).filter(p => p.id).filter(p =>
    !projSearch || p.name?.toLowerCase().includes(projSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(projSearch.toLowerCase())
  );
  const approvedUsers = (users||[]).filter(u => u.role !== "pending");

  function toggleAssignee(name) {
    setAssignees(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev, name]);
  }

  function handleSave() {
    if (!title.trim() || !projId || assignees.length===0) return;
    onSave({
      title: title.trim(), projectId: projId,
      projectName: selProj?.name || "",
      projectColor: selProj?.color || "#94a3b8",
      site, type, dueDate, priority, assignees,
      note: note.trim(),
      status: editTask?.status || "todo",
      createdBy: currentUser?.name || "",
      createdByUid: currentUser?.id || "",
      createdAt: editTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, editTask?.id || null);
  }

  const IS2 = { width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 12px", fontSize:13, fontFamily:"inherit",
    outline:"none", background:"#f8fafc", boxSizing:"border-box" };
  const LB = { fontSize:11, color:"#94a3b8", fontWeight:700,
    textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:520,
        maxHeight:"92vh",overflowY:"auto",padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
            📋 {isEdit?"แก้ไขงาน":"สร้างงานใหม่"}
          </h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",
            color:"#64748b",cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* ชื่องาน */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ชื่องาน *</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="อธิบายงานที่ต้องทำ..." style={IS2}/>
        </div>

        {/* โครงการ — searchable */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>โครงการ *</label>
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex",alignItems:"center",border:"1px solid #e2e8f0",
              borderRadius:8,background:"#f8fafc",overflow:"hidden" }}>
              <input style={{ flex:1,border:"none",background:"transparent",padding:"8px 12px",
                fontSize:13,fontFamily:"inherit",outline:"none",color:"#1e293b" }}
                placeholder="ค้นหาโครงการ..."
                value={projDropdown ? projSearch : (selProj?.name||"")}
                onFocus={()=>{ setProjDropdown(true); setProjSearch(""); }}
                onChange={e=>{ setProjSearch(e.target.value); setProjDropdown(true); }}/>
              {selProj && !projDropdown && (
                <button type="button" onClick={()=>{ setProjId(""); setProjSearch(""); setSite(""); }}
                  style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",padding:"0 10px",fontSize:14 }}>✕</button>
              )}
            </div>
            {projDropdown && (
              <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:100,
                background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:200,overflowY:"auto",marginTop:4 }}>
                {filteredProjs.length===0 ? (
                  <div style={{ padding:"12px",fontSize:13,color:"#94a3b8",textAlign:"center" }}>ไม่พบโครงการ</div>
                ) : filteredProjs.map(p=>(
                  <div key={p.id} onMouseDown={()=>{ setProjId(p.id); setProjDropdown(false); setProjSearch(""); setSite(""); }}
                    style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                      background:projId===p.id?"#fff7ed":"transparent",borderBottom:"1px solid #f8fafc" }}
                    onMouseEnter={e=>{ if(projId!==p.id) e.currentTarget.style.background="#f8fafc"; }}
                    onMouseLeave={e=>{ if(projId!==p.id) e.currentTarget.style.background="transparent"; }}>
                    <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||"#94a3b8",flexShrink:0 }}/>
                    <span style={{ fontSize:13,fontWeight:600,color:"#0f172a",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</span>
                    {projId===p.id && <span style={{ color:"#f97316" }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
            {projDropdown && <div style={{ position:"fixed",inset:0,zIndex:99 }} onMouseDown={()=>setProjDropdown(false)}/>}
          </div>
        </div>

        {/* ไซต์ */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ไซต์ / สถานที่</label>
          {sites.length>0 ? (
            <select value={site} onChange={e=>setSite(e.target.value)} style={IS2}>
              <option value="">— เลือกไซต์ —</option>
              {sites.map(s=><option key={s} value={s}>{s}</option>)}
              <option value="__other">อื่นๆ (พิมพ์เอง)</option>
            </select>
          ) : (
            <input value={site} onChange={e=>setSite(e.target.value)}
              placeholder="เช่น อาคาร A, สาขากรุงเทพ" style={IS2}/>
          )}
          {site==="__other" && (
            <input value={site==="__other"?"":site} onChange={e=>setSite(e.target.value)}
              placeholder="พิมพ์ชื่อไซต์..." style={{ ...IS2,marginTop:8 }}/>
          )}
        </div>

        {/* grid: ประเภท + กำหนดเสร็จ */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
          <div>
            <label style={LB}>ประเภทงาน</label>
            <select value={type} onChange={e=>setType(e.target.value)} style={IS2}>
              {SERVICE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={LB}>กำหนดเสร็จ</label>
            <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={IS2}/>
          </div>
        </div>

        {/* priority */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ความเร่งด่วน</label>
          <div style={{ display:"flex",gap:8 }}>
            {PRIORITY_OPTS.map(p=>(
              <button key={p.value} type="button" onClick={()=>setPriority(p.value)}
                style={{ flex:1,padding:"7px",borderRadius:8,fontSize:12,fontWeight:700,
                  fontFamily:"inherit",cursor:"pointer",
                  background:priority===p.value?p.bg:"#f8fafc",
                  border:`1px solid ${priority===p.value?p.color:"#e2e8f0"}`,
                  color:priority===p.value?p.color:"#94a3b8" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ผู้รับผิดชอบ */}
        <div style={{ marginBottom:14 }}>
          <label style={LB}>ผู้รับผิดชอบ *</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {approvedUsers.map(u=>(
              <label key={u.id} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                background:assignees.includes(u.name)?"#f0fdf4":"#f8fafc",
                border:`1px solid ${assignees.includes(u.name)?"#bbf7d0":"#e2e8f0"}`,
                borderRadius:8,padding:"5px 10px",fontSize:12 }}>
                <input type="checkbox" checked={assignees.includes(u.name)}
                  onChange={()=>toggleAssignee(u.name)} style={{ accentColor:"#16a34a" }}/>
                {u.name}
              </label>
            ))}
          </div>
        </div>

        {/* หมายเหตุ */}
        <div style={{ marginBottom:18 }}>
          <label style={LB}>หมายเหตุ</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม..." rows={3}
            style={{ ...IS2,resize:"vertical" }}/>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:12,fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={handleSave}
            disabled={saving||!title.trim()||!projId||assignees.length===0}
            style={{ background:"#6B21A8",border:"none",color:"#fff",borderRadius:10,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:saving||!title.trim()||!projId||assignees.length===0?0.5:1 }}>
            {saving?"กำลังบันทึก...":(isEdit?"💾 บันทึก":"➕ สร้างงาน")}
          </button>
        </div>
      </div>
    </div>
  );
}
