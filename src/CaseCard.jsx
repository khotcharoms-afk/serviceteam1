import { daysLeft, fmtDate } from "./utils.js";
import { WarrantyPill, LeasePill, StatusPill } from "./UI.jsx";
import { useTheme } from "./theme.js";

function CaseCard({ c, proj, onClick, onEdit, onDel, onHandover, onUpdate }) {
  const { c: theme } = useTheme();
  const days = daysLeft(c.warrantyEnd);
  const leaseDays = c.leaseEnd ? daysLeft(c.leaseEnd) : null;
  const names = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);
  const note = (txt, color) => <div style={{ marginTop:5,fontSize:11.5,color,fontWeight:600 }}>{txt}</div>;
  const btn = (danger) => ({ background:"transparent",border:`1px solid ${theme.border}`,color:danger?theme.danger:theme.text900,
    borderRadius:7,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 });
  return (
    <div onClick={onClick} style={{
      background:theme.card,
      // ใช้ longhand เท่านั้น — ถ้าผสม border กับ borderLeft React จะทำเส้นซ้ายหายตอนสลับธีม
      borderStyle:"solid",borderWidth:"1px 1px 1px 3px",
      borderColor:`${theme.border} ${theme.border} ${theme.border} ${proj?.color||theme.border}`,
      borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
        <div style={{ flex:1,paddingRight:8 }}>
          <div style={{ fontSize:14,fontWeight:700,color:theme.text900,lineHeight:1.3 }}>{c.title}</div>
          {(c.site || proj) && <div style={{ fontSize:12,color:theme.text500,marginTop:3 }}>
            {[c.site, proj?.name].filter(Boolean).join(" · ")}</div>}
        </div>
        <StatusPill value={c.status}/>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",fontSize:11.5,color:theme.text500 }}>
        {names.length>0 && <span style={{ color:theme.text900,fontWeight:600 }}>{names.join(", ")}</span>}
        {c.date && <span>{fmtDate(c.date)}</span>}
        <WarrantyPill warrantyEnd={c.warrantyEnd}/>
        {c.leaseEnd && <LeasePill leaseEnd={c.leaseEnd}/>}
      </div>
      {days!==null&&days>=0&&days<=90 && note(`ประกันเหลือ ${days} วัน`, theme.warn)}
      {days!==null&&days<0 && note("ประกันหมดแล้ว", theme.danger)}
      {leaseDays!==null&&leaseDays<0 && note("สัญญาเช่าหมดแล้ว", theme.danger)}
      {leaseDays!==null&&leaseDays>=0&&leaseDays<=90 && note(`สัญญาเช่าเหลือ ${leaseDays} วัน`, theme.warn)}
      {((c.updateLog||[]).length>0 || (c.handoverLog||[]).length>0) && (
        <div style={{ marginTop:5,fontSize:11.5,color:theme.text400 }}>
          {[(c.updateLog||[]).length>0 && `อัปเดต ${c.updateLog.length} ครั้ง`,
            (c.handoverLog||[]).length>0 && `ส่งต่อ ${c.handoverLog.length} ครั้ง`].filter(Boolean).join(" · ")}
        </div>
      )}
      <div style={{ display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:`1px solid ${theme.borderSoft}` }}
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
