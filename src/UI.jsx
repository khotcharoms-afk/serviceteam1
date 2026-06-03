import { daysLeft, fmtDate, STATUS_OPTS } from "./utils.js";

// ── Pills ─────────────────────────────────────────────────────
export function WarrantyPill({ warrantyEnd }) {
  if (!warrantyEnd) return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:"#f1f5f9",color:"#94a3b8",borderRadius:20,
      padding:"3px 9px",fontSize:11,fontWeight:700 }}>ไม่มีประกัน</span>
  );
  const days = daysLeft(warrantyEnd);
  const col = days < 0 ? "#ef4444" : days <= 90 ? "#f59e0b" : days <= 365 ? "#3b82f6" : "#10b981";
  const label = days < 0 ? "หมดแล้ว" : days === 0 ? "หมดวันนี้"
    : days <= 365 ? `เหลือ ${days} วัน`
    : `เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:col+"18",color:col,border:`1px solid ${col}40`,
      borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col,flexShrink:0 }}/>
      🛡 {label}
    </span>
  );
}

export function LeasePill({ leaseEnd }) {
  if (!leaseEnd) return null;
  const days = daysLeft(leaseEnd);
  const col = days < 0 ? "#ef4444" : days <= 90 ? "#f59e0b" : days <= 365 ? "#f97316" : "#8b5cf6";
  const label = days < 0 ? "หมดแล้ว" : days === 0 ? "หมดวันนี้"
    : days <= 365 ? `เหลือ ${days} วัน`
    : `เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:col+"18",color:col,border:`1px solid ${col}40`,
      borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col,flexShrink:0 }}/>
      📋 {label}
    </span>
  );
}

export function StatusPill({ value }) {
  const s = STATUS_OPTS.find(x => x.value === value) || STATUS_OPTS[0];
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700 }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:s.color,flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

// ── Buttons ───────────────────────────────────────────────────
export function PrimaryBtn({ onClick, children, full, style = {} }) {
  return (
    <button onClick={onClick}
      style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:10,
        padding:"12px 22px",fontSize:14,fontWeight:600,cursor:"pointer",
        fontFamily:"inherit",width:full?"100%":"auto",transition:"background .15s",...style }}
      onMouseEnter={e=>e.currentTarget.style.background="#1d4ed8"}
      onMouseLeave={e=>e.currentTarget.style.background="#2563eb"}>
      {children}
    </button>
  );
}

export function GhostBtn({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
        borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit" }}
      onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
      onMouseLeave={e=>e.currentTarget.style.background="#f8fafc"}>
      {children}
    </button>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,.5)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:560,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
        padding:"24px 24px 28px" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>{title}</h2>
          <button onClick={onClose}
            style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
              fontSize:14,width:30,height:30,borderRadius:8,display:"flex",
              alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}
