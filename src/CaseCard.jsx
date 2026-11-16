import { daysLeft, fmtDate } from "./utils.js";
import { WarrantyPill, LeasePill, StatusPill } from "./UI.jsx";
import { useTheme } from "./theme.js";

function CaseCard({ c, proj, onClick, onEdit, onDel, onHandover, onUpdate }) {
  const { c: theme } = useTheme();
  const days = daysLeft(c.warrantyEnd);
  const leaseDays = c.leaseEnd ? daysLeft(c.leaseEnd) : null;
  const names = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);
  const note = (txt, color) => <div style={{ marginTop:4,fontSize:12,color,fontWeight:500 }}>{txt}</div>;
  const btn = (danger) => ({ background:"transparent",border:`1px solid ${theme.border}`,color:danger?theme.danger:theme.text900,
    borderRadius:6,height:28,padding:"0 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500 });
  return (
    <div onClick={onClick} style={{
      background:theme.card,
      border:`1px solid ${theme.border}`,
      borderRadius:8,padding:16,marginBottom:8,cursor:"pointer" }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=theme.text400}
      onMouseLeave={e=>e.currentTarget.style.borderColor=theme.border}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
        <div style={{ flex:1,paddingRight:8 }}>
          <div style={{ fontSize:14,fontWeight:600,color:theme.text900,lineHeight:1.4 }}>{c.title}</div>
          {(c.site || proj) && <div style={{ fontSize:12,color:theme.text500,marginTop:4,display:"flex",alignItems:"center",gap:6 }}>
            {proj && <span style={{ width:6,height:6,borderRadius:"50%",background:proj.color||theme.text400,flexShrink:0 }}/>}
            {[c.site, proj?.name].filter(Boolean).join(" · ")}</div>}
        </div>
        <StatusPill value={c.status}/>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",fontSize:12,color:theme.text500 }}>
        {names.length>0 && <span style={{ color:theme.text900,fontWeight:500 }}>{names.join(", ")}</span>}
        {c.date && <span>{fmtDate(c.date)}</span>}
        <WarrantyPill warrantyEnd={c.warrantyEnd}/>
        {c.leaseEnd && <LeasePill leaseEnd={c.leaseEnd}/>}
      </div>
      {days!==null&&days>=0&&days<=90 && note(`ประกันเหลือ ${days} วัน`, theme.warn)}
      {days!==null&&days<0 && note("ประกันหมดแล้ว", theme.danger)}
      {leaseDays!==null&&leaseDays<0 && note("สัญญาเช่าหมดแล้ว", theme.danger)}
      {leaseDays!==null&&leaseDays>=0&&leaseDays<=90 && note(`สัญญาเช่าเหลือ ${leaseDays} วัน`, theme.warn)}
      {((c.updateLog||[]).length>0 || (c.handoverLog||[]).length>0) && (
        <div style={{ marginTop:5,fontSize:12,color:theme.text400 }}>
          {[(c.updateLog||[]).length>0 && `อัปเดต ${c.updateLog.length} ครั้ง`,
            (c.handoverLog||[]).length>0 && `ส่งต่อ ${c.handoverLog.length} ครั้ง`].filter(Boolean).join(" · ")}
        </div>
      )}
      <div style={{ display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${theme.borderSoft}` }}
        onClick={e=>e.stopPropagation()}>
        <button onClick={onUpdate} style={btn()}>อัปเดต</button>
        <button onClick={onHandover} style={btn()}>ส่งต่อ</button>
        <button onClick={onEdit} style={btn()}>แก้ไข</button>
        <button onClick={onDel} style={{ ...btn(true),marginLeft:"auto",border:"none" }}>ลบ</button>
      </div>
    </div>
  );
}

export default CaseCard;
