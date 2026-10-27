import { useTheme } from "./theme.js";
import Icon from "./components/Icon.jsx";

export default function NavBar({
  onMenuOpen,
  view, activeProj,
  onSearch,
  onOnsite,
  onTaskBoard, tasks, currentUser,
  onNotif, unreadCount,
  onNewCase,
  onProfile,
  isMobile,
  darkMode, onToggleDark,
}) {
  const { c } = useTheme();
  const iconBtn = { background:"transparent", border:`1px solid ${c.border}`, color:c.text500, flexShrink:0,
    borderRadius:8, width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, cursor:"pointer", fontFamily:"inherit",
    display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0, position:"relative" };
  const badge = (n) => (
    <span style={{ position:"absolute", top:-5, right:-5, background:c.danger, color:"#fff", borderRadius:9, minWidth:16, height:16,
      padding:"0 4px", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{n}</span>
  );
  const taskBadge = (tasks||[]).filter(t =>
    (t.status === "todo" || t.status === "accepted") && (t.assignees||[]).includes(currentUser?.name)
  ).length;

  return (
    <header style={{ background:c.card, borderBottom:`1px solid ${c.border}`, padding: isMobile ? "0 8px" : "0 16px",
      display:"flex", alignItems:"center", justifyContent:"space-between", height:56,
      position:"sticky", top:0, zIndex:50, overflow:"hidden" }}>

      {/* Left */}
      <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 6 : 10, flexShrink:0 }}>
        <button onClick={onMenuOpen} style={{ background:"none", border:"none",
          cursor:"pointer", padding:"6px", color:c.text500, lineHeight:1, flexShrink:0 }}><Icon name="menu" size={20}/></button>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, flexShrink:0,
            background:c.ink,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:c.onInk, fontSize:13, fontWeight:700 }}>S</div>
          {!isMobile && (
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:c.text900, lineHeight:1 }}>ServiceLog</div>
              {view !== "overview" && (
                <div style={{ fontSize:10, color:c.text400, fontWeight:600, lineHeight:1.2 }}>
                  {activeProj?.name}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 4 : 8, overflowX:"auto", flexWrap:"nowrap" }}>
        {onToggleDark && (
          <button onClick={onToggleDark} title="สลับโหมดมืด/สว่าง" style={iconBtn}><Icon name={darkMode ? "sun" : "moon"}/></button>
        )}

        <button onClick={onSearch} title="ค้นหา" style={iconBtn}><Icon name="search"/></button>

        {!isMobile && (
          <button onClick={onOnsite} title="Onsite" style={iconBtn}><Icon name="pin"/></button>
        )}

        <div style={{ position:"relative", display:"inline-flex", flexShrink:0 }}>
          <button onClick={onTaskBoard} title="บอร์ดงาน" style={iconBtn}><Icon name="board"/></button>
          {taskBadge > 0 && badge(taskBadge)}
        </div>

        <div style={{ position:"relative", flexShrink:0 }}>
          <button onClick={onNotif} title="แจ้งเตือน" style={iconBtn}>
            <Icon name="bell"/>
            {unreadCount > 0 && badge(unreadCount > 9 ? "9+" : unreadCount)}
          </button>
        </div>

        <button onClick={onNewCase}
          style={{ background:c.ink, border:"none", color:c.onInk, flexShrink:0,
            borderRadius:8, padding: isMobile ? "8px 11px" : "8px 14px", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
          {isMobile ? "+" : "+ เคสใหม่"}
        </button>

        {!isMobile && (
          <button onClick={onProfile}
            style={{ width:34, height:34, borderRadius:"50%", border:`1px solid ${c.border}`, flexShrink:0,
              background:c.borderSoft,
              color:c.text900, fontSize:12, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}
            title={currentUser?.name}>
            {(currentUser?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
          </button>
        )}
      </div>
    </header>
  );
}
