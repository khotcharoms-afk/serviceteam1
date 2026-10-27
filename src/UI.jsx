import { daysLeft, fmtDate, STATUS_OPTS } from "./utils.js";
import { useTheme } from "./theme.js";

// ── Pills ─────────────────────────────────────────────────────
// โทนเรียบ: กรอบเทา + จุดสี — ใส่สีที่ตัวอักษรเฉพาะเมื่อต้องเตือน (หมดแล้ว / ใกล้หมด)
const STATUS_DARK = { open: "#fbbf24", inprogress: "#93c5fd", done: "#86efac", hold: "#fca5a5" };
export function statusColor(value, dark) {
  const s = STATUS_OPTS.find(x => x.value === value) || STATUS_OPTS[0];
  return dark ? (STATUS_DARK[s.value] || s.color) : s.color;
}

function DatePill({ end, emptyLabel, prefix }) {
  const { c } = useTheme();
  if (!end) return emptyLabel ? (
    <span style={{ display:"inline-flex",alignItems:"center",border:`1px solid ${c.border}`,color:c.text400,
      borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600 }}>{emptyLabel}</span>
  ) : null;
  const days = daysLeft(end);
  const urgent = days < 0 ? c.danger : days <= 90 ? c.warn : null;
  const label = days < 0 ? "หมดแล้ว" : days === 0 ? "หมดวันนี้"
    : days <= 365 ? `เหลือ ${days} วัน`
    : `เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${c.border}`,
      color:urgent||c.text500,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:urgent||c.text400,flexShrink:0 }}/>
      {prefix} {label}
    </span>
  );
}

export function WarrantyPill({ warrantyEnd }) {
  return <DatePill end={warrantyEnd} emptyLabel="ไม่มีประกัน" prefix="ประกัน"/>;
}

export function LeasePill({ leaseEnd }) {
  return <DatePill end={leaseEnd} prefix="เช่า"/>;
}

export function HirePurchasePill({ hirePurchaseEnd }) {
  return <DatePill end={hirePurchaseEnd} prefix="เช่าซื้อ"/>;
}

export function StatusPill({ value }) {
  const { c, dark } = useTheme();
  const s = STATUS_OPTS.find(x => x.value === value) || STATUS_OPTS[0];
  const col = statusColor(value, dark);
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${c.border}`,
      color:col,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      <span style={{ width:6,height:6,borderRadius:"50%",background:col,flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

// ── Buttons ───────────────────────────────────────────────────
export function PrimaryBtn({ onClick, children, full, style = {} }) {
  const { c } = useTheme();
  return (
    <button onClick={onClick}
      style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:10,
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
