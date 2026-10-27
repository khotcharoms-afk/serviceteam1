import { daysLeft, FEATURE_SHIFT } from "./utils.js";
import { useTheme } from "./theme.js";

// รายการเมนู: ไม่มีอีโมจิ — โครงการแสดงจุดสีประจำโครงการ (dot)
function DrawerItem({ active, onClick, label, count, dot }) {
  const { c } = useTheme();
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      width:"100%", background: active ? c.borderSoft : "transparent",
      border:"none", borderRadius:8, padding:"8px 10px",
      cursor:"pointer", fontFamily:"inherit", marginBottom:1, textAlign:"left",
      position:"relative", overflow:"hidden",
    }}>
      {active && <span style={{ position:"absolute",left:0,top:"22%",bottom:"22%",width:3,
        borderRadius:"0 3px 3px 0", background:c.ink }}/>}
      <span style={{ display:"flex",alignItems:"center",gap:9,flex:1,minWidth:0 }}>
        {dot && <span style={{ width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0 }}/>}
        <span style={{ fontSize:13.5,color:active?c.text900:c.text500,fontWeight:active?700:500,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
      </span>
      {count !== "" && count !== undefined && (
        <span style={{ fontSize:11.5,color:c.text400,flexShrink:0,marginLeft:4,fontWeight:600 }}>{count}</span>
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
  setRobotIssuesPage,
  setDevicesPage,
  setRequisitionPage,
  setAssistantPage,
  setCaseLogPage,
  isDev, onlineCount, setShowOnlineUsers,
  openAddProj, handleImportFile, handleImportCaseFile,
}) {
  const { c } = useTheme();
  if (!open) return null;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200 }} onClick={onClose}>
      <div style={{ position:"absolute",inset:0,background:"rgba(15,23,42,.4)",backdropFilter:"blur(2px)" }}/>
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:280,background:c.card,
        boxShadow:"4px 0 24px rgba(0,0,0,.12)",padding:"20px 12px",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,padding:"0 6px" }}>
          <div style={{ fontSize:15,fontWeight:800,color:c.text900 }}>เมนู</div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:18,color:c.text400,cursor:"pointer" }}>✕</button>
        </div>

        {/* User card */}
        <div style={{ background:c.bg,borderRadius:10,padding:"10px 12px",marginBottom:12,border:`1px solid ${c.border}` }}>
          <div style={{ fontSize:13,fontWeight:700,color:c.text900 }}>{currentUser?.name}</div>
          <div style={{ fontSize:11,color:c.text400,marginTop:2 }}>{currentUser?.email}</div>
          <div style={{ display:"flex",gap:6,marginTop:8,flexWrap:"wrap" }}>
            {isAdminOrDev && (
              <button onClick={()=>{ setAdminPage(true); onClose(); }}
                style={{ background:"transparent",border:`1px solid ${c.border}`,color:c.text900,
                  borderRadius:7,padding:"5px 10px",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                จัดการ User
              </button>
            )}
            <button onClick={()=>{ setProfilePage(true); onClose(); }}
              style={{ background:"transparent",border:`1px solid ${c.border}`,color:c.text900,
                  borderRadius:7,padding:"5px 10px",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              โปรไฟล์
            </button>
            {isDev && (
              <button onClick={()=>{ setShowOnlineUsers(true); onClose(); }}
                style={{ background:"transparent",border:`1px solid ${c.border}`,color:c.text900,
                  borderRadius:7,padding:"5px 10px",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                Online{onlineCount > 0 ? ` (${onlineCount})` : ""}
              </button>
            )}
            <button onClick={onSignOut}
              style={{ background:"transparent",border:"none",color:c.danger,
                borderRadius:7,padding:"5px 6px",fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* หน้าหลัก */}
        <div style={{ fontSize:10,color:c.text400,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,padding:"4px 8px 8px" }}>หน้าหลัก</div>
        <DrawerItem active={view==="overview"} label="ภาพรวม" count={cases.length}
          onClick={()=>{ setView("overview"); onClose(); setFilterStat("all"); }}/>
        {isAdminOrDev && (
          <DrawerItem active={false} label="Dashboard" count={""}
            onClick={()=>{ setDashboardPage(true); onClose(); }}/>
        )}

        {/* ปฏิบัติการ */}
        <div style={{ fontSize:10,color:c.text400,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700,padding:"14px 8px 8px" }}>ปฏิบัติการ</div>
        <DrawerItem active={false} label="บันทึกการรับเคส" count={""}
          onClick={()=>{ setCaseLogPage(true); onClose(); }}/>
        <DrawerItem active={false} label="Onsite" count={""}
          onClick={()=>{ setOnsitePage(true); onClose(); }}/>
        <DrawerItem active={false} label="บันทึก OT" count={""}
          onClick={()=>{ setOtPage(true); onClose(); }}/>
        {FEATURE_SHIFT && (
          <DrawerItem active={false} label="ตารางกะ" count={""}
            onClick={()=>{ setShiftPage(true); onClose(); }}/>
        )}
        <DrawerItem active={false} label="ใบลา" count={""}
          onClick={()=>{ setLeavePage(true); onClose(); }}/>
        <DrawerItem active={false} label="Knowledge Hub" count={""}
          onClick={()=>{ setKnowledgePage(true); onClose(); }}/>
        <DrawerItem active={false} label="สถิติหุ่นยนต์" count={""}
          onClick={()=>{ setRobotStatsPage(true); onClose(); }}/>
        <DrawerItem active={false} label="แจ้งเหตุ/แจ้งซ่อม" count={""}
          onClick={()=>{ setRobotIssuesPage(true); onClose(); }}/>
        <DrawerItem active={false} label="อุปกรณ์/รีโมท" count={""}
          onClick={()=>{ setDevicesPage(true); onClose(); }}/>
        <DrawerItem active={false} label="ใบเบิกของ" count={""}
          onClick={()=>{ setRequisitionPage(true); onClose(); }}/>
        <DrawerItem active={false} label="ผู้ช่วย AI" count={""}
          onClick={()=>{ setAssistantPage(true); onClose(); }}/>

        {/* โครงการ */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 8px 8px" }}>
          <span style={{ fontSize:10,color:c.text400,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700 }}>โครงการ</span>
          <span style={{ fontSize:11,background:c.borderSoft,color:c.text500,borderRadius:20,padding:"2px 8px",fontWeight:700 }}>{projects.length}</span>
        </div>
        <div style={{ overflowY:"auto",maxHeight:320,marginRight:-8,paddingRight:8 }}>
          {projects.map(p=>(
            <div key={p.id}>
              <DrawerItem active={view===p.id} dot={p.color||c.text400} label={p.name}
                count={cases.filter(c=>c.projectId===p.id).length}
                onClick={()=>{ setView(p.id); onClose(); setFilterStat("all"); }}/>
            </div>
          ))}
        </div>

        {/* ปุ่มเพิ่ม/import */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6 }}>
          <button onClick={()=>{ openAddProj(); onClose(); }}
            style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
              border:`1.5px dashed ${c.border}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",
              fontFamily:"inherit",color:c.text400,fontSize:12 }}>
            <span style={{ fontSize:15,lineHeight:1 }}>+</span> เพิ่มโครงการ
          </button>
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
            border:`1.5px dashed ${c.border}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",
            fontFamily:"inherit",color:c.text400,fontSize:12 }}>
            Import โครงการ
            <input type="file" accept=".xlsx,.xls" style={{ display:"none" }}
              onChange={e=>{ onClose(); handleImportFile(e); }}/>
          </label>
        </div>
        <div style={{ marginTop:6 }}>
          <label style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",
            border:`1.5px dashed ${c.border}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",
            fontFamily:"inherit",color:c.text400,fontSize:12,width:"100%" }}>
            Import เคส
            <input type="file" accept=".xlsx,.xls" style={{ display:"none" }}
              onChange={e=>{ onClose(); handleImportCaseFile(e); }}/>
          </label>
        </div>

        {/* Stats */}
        <div style={{ margin:"20px 0 10px",borderTop:`1px solid ${c.borderSoft}`,paddingTop:16 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            {[
              { label:"เคสทั้งหมด", val:cases.length, color:"#2563eb" },
              { label:"ใกล้หมดประกัน", val:cases.filter(c=>{ const d=daysLeft(c.warrantyEnd); return d!==null&&d>=0&&d<=90; }).length, color:"#f59e0b" },
            ].map(x=>(
              <div key={x.label} style={{ background:c.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${x.color}20` }}>
                <div style={{ fontSize:22,fontWeight:800,color:x.color }}>{x.val}</div>
                <div style={{ fontSize:10,color:c.text400,marginTop:2 }}>{x.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
