import { daysLeft } from "./utils.js";

function DrawerItem({ active, onClick, icon, label, count, color }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      width:"100%", background: active ? color+"14" : "transparent",
      border:"none", borderRadius:10, padding:"9px 10px 9px 8px",
      cursor:"pointer", fontFamily:"inherit", marginBottom:2, textAlign:"left",
      position:"relative", overflow:"hidden",
    }}>
      {active && <span style={{ position:"absolute",left:0,top:"20%",bottom:"20%",width:3,
        borderRadius:"0 3px 3px 0", background:color }}/>}
      <span style={{ display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,paddingLeft:active?6:0 }}>
        <span style={{ width:30,height:30,borderRadius:8,flexShrink:0,
          background: active ? color+"20" : "#f1f5f9",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{icon}</span>
        <span style={{ fontSize:13,color:active?"#0f172a":"#475569",fontWeight:active?700:500,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
      </span>
      {count !== "" && count !== undefined && (
        <span style={{ fontSize:11,background:active?color+"20":"#f1f5f9",borderRadius:20,
          padding:"2px 9px",color:active?color:"#94a3b8",flexShrink:0,marginLeft:4,fontWeight:700 }}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function Drawer({
  open, onClose,
  currentUser, onSignOut,
  isAdminOrDev,
  view, setView, setFilterStat,
  cases, projects,
  setDashboardPage,
  setShiftPage, setOnsitePage, setOtPage, setLeavePage,
  setAdminPage, setProfilePage, setKnowledgePage,
  setRobotStatsPage,
  isDev, onlineCount, setShowOnlineUsers,
  openAddProj, handleImportFile, handleImportCaseFile,
}) {
  if (!open) return null;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200 }} onClick={onClose}>
      <div style={{ position:"absolute",inset:0,background:"rgba(15,23,42,.4)",backdropFilter:"blur(2px)" }}/>
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:280,background:"#fff",
        boxShadow:"4px 0 24px rgba(0,0,0,.12)",padding:"20px 12px",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,padding:"0 6px" }}>
          <div style={{ fontSize:15,fontWeight:800,color:"#0f172a" }}>เมนู</div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:18,color:"#94a3b8",cursor:"pointer" }}>✕</button>
        </div>

        {/* User card */}
        <div style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #e2e8f0" }}>
          <div style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>{currentUser?.name}</div>
          <div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>{currentUser?.email}</div>
          <div style={{ display:"flex",gap:6,marginTop:8,flexWrap:"wrap" }}>
            {isAdminOrDev && (
              <button onClick={()=>{ setAdminPage(true); onClose(); }}
                style={{ background:"#f5f3ff",border:"1px solid #ddd6fe",color:"#7c3aed",
                  borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                👥 จัดการ User
              </button>
            )}
            <button onClick={()=>{ setProfilePage(true); onClose(); }}
              style={{ background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",
                borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
              👤 โปรไฟล์
            </button>
            {isDev && (
              <button onClick={()=>{ setShowOnlineUsers(true); onClose(); }}
                style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
                  borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                🟢 Online{onlineCount > 0 ? ` (${onlineCount})` : ""}
              </button>
            )}
            <button onClick={onSignOut}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
              🚪 ออกจากระบบ
            </button>
          </div>
        </div>

        {/* หน้าหลัก */}
        <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,padding:"4px 8px 8px" }}>หน้าหลัก</div>
        <DrawerItem active={view==="overview"} color="#2563eb" icon="▦" label="ภาพรวม" count={cases.length}
          onClick={()=>{ setView("overview"); onClose(); setFilterStat("all"); }}/>
        {isAdminOrDev && (
          <DrawerItem active={false} color="#16a34a" icon="📊" label="Dashboard" count={""}
            onClick={()=>{ setDashboardPage(true); onClose(); }}/>
        )}

        {/* ปฏิบัติการ */}
        <div style={{ fontSize:10,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,padding:"14px 8px 8px" }}>ปฏิบัติการ</div>
        <DrawerItem active={false} color="#f97316" icon="📍" label="Onsite" count={""}
          onClick={()=>{ setOnsitePage(true); onClose(); }}/>
        <DrawerItem active={false} color="#f59e0b" icon="⏰" label="บันทึก OT" count={""}
          onClick={()=>{ setOtPage(true); onClose(); }}/>
        <DrawerItem active={false} color="#854d0e" icon="📅" label="ตารางกะ" count={""}
          onClick={()=>{ setShiftPage(true); onClose(); }}/>
        <DrawerItem active={false} color="#2563eb" icon="📋" label="ใบลา" count={""}
          onClick={()=>{ setLeavePage(true); onClose(); }}/>
        <DrawerItem active={false} color="#6B21A8" icon="💡" label="Knowledge Hub" count={""}
          onClick={()=>{ setKnowledgePage(true); onClose(); }}/>
        <DrawerItem active={false} color="#6B21A8" icon="📊" label="สถิติหุ่นยนต์" count={""}
          onClick={()=>{ setRobotStatsPage(true); onClose(); }}/>

        {/* โครงการ */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 8px 8px" }}>
          <span style={{ fontSize:10,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",fontWeight:700 }}>โครงการ</span>
          <span style={{ fontSize:11,background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"2px 8px",fontWeight:700 }}>{projects.length}</span>
        </div>
        <div style={{ overflowY:"auto",maxHeight:320,marginRight:-8,paddingRight:8 }}>
          {projects.map(p=>(
            <div key={p.id}>
              <DrawerItem active={view===p.id} color={p.color} icon="◆" label={p.name}
                count={cases.filter(c=>c.projectId===p.id).length}
                onClick={()=>{ setView(p.id); onClose(); setFilterStat("all"); }}/>
            </div>
          ))}
        </div>

        {/* ปุ่มเพิ่ม/import */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6 }}>
          <button onClick={()=>{ openAddProj(); onClose(); }}
            style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
              border:"1.5px dashed #e2e8f0",borderRadius:8,padding:"10px 8px",cursor:"pointer",
              fontFamily:"inherit",color:"#94a3b8",fontSize:12 }}>
            <span style={{ fontSize:15,lineHeight:1 }}>+</span> เพิ่มโครงการ
          </button>
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
            border:"1.5px dashed #e2e8f0",borderRadius:8,padding:"10px 8px",cursor:"pointer",
            fontFamily:"inherit",color:"#94a3b8",fontSize:12 }}>
            <span style={{ fontSize:14 }}>📥</span> Import โครงการ
            <input type="file" accept=".xlsx,.xls" style={{ display:"none" }}
              onChange={e=>{ onClose(); handleImportFile(e); }}/>
          </label>
        </div>
        <div style={{ marginTop:6 }}>
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
            border:"1.5px dashed #e2e8f0",borderRadius:8,padding:"10px 8px",cursor:"pointer",
            fontFamily:"inherit",color:"#94a3b8",fontSize:12,width:"100%" }}>
            <span style={{ fontSize:14 }}>📋</span> Import เคส
            <input type="file" accept=".xlsx,.xls" style={{ display:"none" }}
              onChange={e=>{ onClose(); handleImportCaseFile(e); }}/>
          </label>
        </div>

        {/* Stats */}
        <div style={{ margin:"20px 0 10px",borderTop:"1px solid #f1f5f9",paddingTop:16 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            {[
              { label:"เคสทั้งหมด", val:cases.length, color:"#2563eb" },
              { label:"ใกล้หมดประกัน", val:cases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length, color:"#f59e0b" },
            ].map(x=>(
              <div key={x.label} style={{ background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${x.color}20` }}>
                <div style={{ fontSize:22,fontWeight:800,color:x.color }}>{x.val}</div>
                <div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>{x.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
