import { daysLeft, fmtDate } from "./utils.js";
import { WarrantyPill, LeasePill, StatusPill } from "./UI.jsx";
import { useTheme } from "./theme.js";

function CaseCard({ c, proj, onClick, onEdit, onDel, onHandover, onUpdate }) {
  const { c: theme } = useTheme();
  const days = daysLeft(c.warrantyEnd);
  return (
    <div onClick={onClick} style={{
      background:theme.card,
      border:`1.5px solid ${theme.border}`,
      borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",
      borderLeft:`4px solid ${proj?.color||theme.border}`,
      boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
        <div style={{ flex:1,paddingRight:8 }}>
          <div style={{ fontSize:14,fontWeight:700,color:theme.text900,lineHeight:1.3 }}>{c.title}</div>
          {c.site && <div style={{ fontSize:12,color:theme.blue,marginTop:3 }}>📍 {c.site}</div>}
        </div>
        <StatusPill value={c.status}/>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:6,alignItems:"center" }}>
        {(()=>{ 
          const names = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);
          return names.length>0 && (
            <span style={{ fontSize:11,color:theme.text500,background:theme.bg,
              borderRadius:6,padding:"2px 8px",border:`1px solid ${theme.border}` }}>
              👤 {names.join(", ")}
            </span>
          );
        })()}
        {c.date && <span style={{ fontSize:11,color:theme.text500 }}>📅 {fmtDate(c.date)}</span>}
        <WarrantyPill warrantyEnd={c.warrantyEnd}/>
        {c.leaseEnd && <LeasePill leaseEnd={c.leaseEnd}/>}
      </div>
      {days!==null&&days>=0&&days<=90 && (
        <div style={{ marginTop:6,fontSize:11,color:"#f59e0b",fontWeight:600 }}>⚠ ประกันเหลือ {days} วัน</div>
      )}
      {days!==null&&days<0 && (
        <div style={{ marginTop:6,fontSize:11,color:"#ef4444",fontWeight:600 }}>⚠ ประกันหมดแล้ว</div>
      )}
      {c.leaseEnd&&(()=>{ const d=daysLeft(c.leaseEnd); return d!==null&&d<0?(
        <div style={{ marginTop:4,fontSize:11,color:"#ef4444",fontWeight:600 }}>⚠ สัญญาเช่าหมดแล้ว</div>
      ):d!==null&&d<=90?(
        <div style={{ marginTop:4,fontSize:11,color:"#f59e0b",fontWeight:600 }}>⚠ สัญญาเช่าเหลือ {d} วัน</div>
      ):null; })()}
      {(c.updateLog||[]).length>0&&(
        <div style={{ marginTop:4,fontSize:11,color:"#16a34a",fontWeight:600 }}>
          📝 อัปเดตแล้ว {c.updateLog.length} ครั้ง
        </div>
      )}
      {(c.handoverLog||[]).length>0 && (
        <div style={{ marginTop:4,fontSize:11,color:"#8b5cf6",fontWeight:600 }}>
          🔁 ส่งต่อแล้ว {c.handoverLog.length} ครั้ง • ปัจจุบัน: {(c.techs?.length?c.techs:[c.tech]).join(", ")}
        </div>
      )}
      <div style={{ display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:`1px solid ${theme.borderSoft}` }}
        onClick={e=>e.stopPropagation()}>
        <button onClick={onEdit} style={{ background:theme.bg,border:`1px solid ${theme.border}`,
          color:theme.text500,borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✎ แก้ไข</button>
        <button onClick={onUpdate} style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",
          color:"#16a34a",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>📝 อัปเดต</button>
        <button onClick={onHandover} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
          color:"#2563eb",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>📤 ส่งต่อ</button>
        <button onClick={onDel} style={{ background:"#fff5f5",border:"1px solid #fecaca",
          color:"#ef4444",borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>✕ ลบ</button>
      </div>
    </div>
  );
}

export default CaseCard;
