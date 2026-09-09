import { daysLeft, fmtDate, STATUS_OPTS } from "./utils.js";
import { useTheme } from "./theme.js";

// ── Pills ─────────────────────────────────────────────────────
// สถานะเร่งด่วน (สีของ pill พวกนี้มีความหมายอยู่แล้ว เช่น แดง=หมดแล้ว) เลยคงสีเดิมไว้ไม่ผูกกับธีม
// แต่ปรับพื้นหลัง "ไม่มีข้อมูล" ให้ผูกกับธีมแทน
export function WarrantyPill({ warrantyEnd }) {
  const { c } = useTheme();
  if (!warrantyEnd) return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:c.borderSoft,color:c.text400,borderRadius:20,
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

export function HirePurchasePill({ hirePurchaseEnd }) {
  if (!hirePurchaseEnd) return null;
  const days = daysLeft(hirePurchaseEnd);
  const col = days < 0 ? "#ef4444" : days <= 90 ? "#f59e0b" : days <= 365 ? "#0891b2" : "#0891b2";
  const label = days < 0 ? "หมดแล้ว" : days === 0 ? "หมดวันนี้"
    : days <= 365 ? `เหลือ ${days} วัน`
    : `เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,
      background:col+"18",color:col,border:`1px solid ${col}40`,
      borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:col,flexShrink:0 }}/>
      🤝 {label}
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
  const { c } = useTheme();
  return (
    <button onClick={onClick}
      style={{ background:c.blue,border:"none",color:"#fff",borderRadius:10,
        padding:"12px 22px",fontSize:14,fontWeight:600,cursor:"pointer",
        fontFamily:"inherit",width:full?"100%":"auto",transition:"background .15s",...style }}>
      {children}
    </button>
  );
}

export function GhostBtn({ onClick, children, full, style = {} }) {
  const { c } = useTheme();
  return (
    <button onClick={onClick}
      style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
        borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit",width:full?"100%":"auto",...style }}>
      {children}
    </button>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────
export function Modal({ open, onClose, title, headerRight, children }) {
  const { c } = useTheme();
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(15,23,42,.5)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:c.card,borderRadius:16,width:"100%",maxWidth:560,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
        padding:"24px 24px 28px" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:c.text900 }}>{title}</h2>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {headerRight}
            <button onClick={onClose}
              style={{ background:c.bg,border:"none",color:c.text500,cursor:"pointer",
                fontSize:14,width:30,height:30,borderRadius:8,display:"flex",
                alignItems:"center",justifyContent:"center" }}>✕</button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
export function Field({ label, children }) {
  const { c } = useTheme();
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11,color:c.text500,fontWeight:600,marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}
