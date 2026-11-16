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
      borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:500 }}>{emptyLabel}</span>
  ) : null;
  const days = daysLeft(end);
  const urgent = days < 0 ? c.danger : days <= 90 ? c.warn : null;
  const label = days < 0 ? "หมดแล้ว" : days === 0 ? "หมดวันนี้"
    : days <= 365 ? `เหลือ ${days} วัน`
    : `เหลือ ${Math.floor(days/365)} ปี ${Math.floor((days%365)/30)} เดือน`;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:5,border:`1px solid ${c.border}`,
      color:urgent||c.text500,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:500,whiteSpace:"nowrap" }}>
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
      color:col,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:500,whiteSpace:"nowrap" }}>
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
      style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,
        height:40,padding:"0 16px",fontSize:14,fontWeight:500,cursor:"pointer",
        fontFamily:"inherit",width:full?"100%":"auto",...style }}>
      {children}
    </button>
  );
}

export function GhostBtn({ onClick, children, full, style = {} }) {
  const { c } = useTheme();
  return (
    <button onClick={onClick}
      style={{ background:c.card,border:`1px solid ${c.border}`,color:c.text900,
        borderRadius:8,height:40,padding:"0 16px",fontSize:14,fontWeight:500,
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
    <div style={{ position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:c.card,borderRadius:12,width:"100%",maxWidth:560,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,.16)",
        border:`1px solid ${c.border}`,padding:24 }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:600,color:c.text900,letterSpacing:"-0.01em" }}>{title}</h2>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {headerRight}
            <button onClick={onClose}
              style={{ background:"transparent",border:"none",color:c.text500,cursor:"pointer",
                fontSize:14,width:32,height:32,borderRadius:8,display:"flex",
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
      <div style={{ fontSize:12,color:c.text500,fontWeight:500,marginBottom:8 }}>{label}</div>
      {children}
    </div>
  );
}

// ── ตัวโหลดเต็มหน้า (pixel grid + ข้อความ shimmer) ──────────────
export function FullLoader({ text = "กำลังโหลด", bg }) {
  return (
    <div style={{ minHeight:"100vh",background:bg||"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        <div className="sl-pixels" aria-hidden="true">
          {Array.from({length:9},(_,i)=><i key={i} style={{ animationDelay:`${i*0.1}s` }}/>)}
        </div>
        <span className="sl-shimmer" style={{ fontSize:14,fontWeight:500 }}>{text}</span>
      </div>
    </div>
  );
}
