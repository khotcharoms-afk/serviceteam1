import { useTheme } from "./theme.js";

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
  const taskBadge = (tasks||[]).filter(t =>
    t.status === "todo" && (t.assignees||[]).includes(currentUser?.name)
  ).length;

  return (
    <header style={{ background:c.card, borderBottom:`1px solid ${c.border}`, padding:"0 16px",
      display:"flex", alignItems:"center", justifyContent:"space-between", height:56,
      position:"sticky", top:0, zIndex:50 }}>

      {/* Left */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onMenuOpen} style={{ background:"none", border:"none",
          cursor:"pointer", padding:"6px", fontSize:18, color:c.text500, lineHeight:1 }}>☰</button>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8,
            background:"linear-gradient(135deg,#2563eb,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:13, fontWeight:700 }}>S</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:c.text900, lineHeight:1 }}>ServiceLog</div>
            {view !== "overview" && (
              <div style={{ fontSize:10, color:activeProj?.color||c.text400, fontWeight:600, lineHeight:1.2 }}>
                {activeProj?.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {onToggleDark && (
          <button onClick={onToggleDark} title="สลับโหมดมืด/สว่าง"
            style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text500,
              borderRadius:8, padding:"7px 10px", fontSize:14,
              cursor:"pointer", fontFamily:"inherit" }}>{darkMode ? "☀️" : "🌙"}</button>
        )}

        <button onClick={onSearch}
          style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text500,
            borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>🔍</button>

        <button onClick={onOnsite}
          style={{ background:"#fff7ed", border:"1px solid #fed7aa", color:"#ea580c",
            borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>📍</button>

        <div style={{ position:"relative", display:"inline-flex" }}>
          <button onClick={onTaskBoard}
            style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", color:"#6B21A8",
              borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>📋</button>
          {taskBadge > 0 && (
            <span style={{ position:"absolute", top:-4, right:-4, background:"#dc2626",
              color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10,
              fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {taskBadge}
            </span>
          )}
        </div>

        <div style={{ position:"relative" }}>
          <button onClick={onNotif}
            style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8,
              padding:"8px 10px", fontSize:18, cursor:"pointer", lineHeight:1, position:"relative" }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position:"absolute", top:-4, right:-4, background:"#ef4444",
                color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:10,
                fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        <button onClick={onNewCase}
          style={{ background:c.blue, border:"none", color:"#fff",
            borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>
          + เคสใหม่
        </button>

        {!isMobile && (
          <button onClick={onProfile}
            style={{ width:34, height:34, borderRadius:"50%", border:`2px solid ${c.border}`,
              background:"linear-gradient(135deg,#F97316,#6B21A8)",
              color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}
            title={currentUser?.name}>
            {(currentUser?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
          </button>
        )}
      </div>
    </header>
  );
}
