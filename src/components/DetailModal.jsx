import { useState } from "react";
import { Modal, GhostBtn, WarrantyPill, LeasePill, HirePurchasePill, StatusPill } from "../UI.jsx";
import { fmtDate, daysLeft } from "../utils.js";
import WorkOrderModal from "./WorkOrderModal.jsx";
import ChecklistModal from "./ChecklistModal.jsx";
import { useTheme } from "../theme.js";

const tint = (hex, alpha = "22") => `${hex}${alpha}`;

export default function DetailModal({
  detailCase, onClose, projects, users,
  onEdit, onUpdate, onHandover, onDelete, onChecklist, saving
}) {
  const { c } = useTheme();
  const [showWorkOrder, setShowWorkOrder] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  if (!detailCase) return null;
  const proj = projects.find(p => p.id === detailCase.projectId);
  const days = daysLeft(detailCase.warrantyEnd);

  return (
    <Modal open={!!detailCase} onClose={onClose} title="รายละเอียดเคส"
      headerRight={
        <button onClick={()=>setShowWorkOrder(true)}
          style={{ background:tint(c.purple,"14"),border:`1px solid ${tint(c.purple,"55")}`,color:c.purple,
            borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",
            fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4 }}>
          🖨 ใบงาน
        </button>
      }>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap" }}>
        <span style={{ background:(proj?.color||c.text400)+"15",color:proj?.color||c.text500,borderRadius:20,
          padding:"3px 12px",fontSize:12,fontWeight:700 }}>
          {proj?.name}
        </span>
        {detailCase.checklist && (
          <span style={{ background: detailCase.checklist.confirmed?tint(c.green,"14"):tint(c.orange,"14"),
            color: detailCase.checklist.confirmed?c.green:c.orange,
            border:`1px solid ${detailCase.checklist.confirmed?tint(c.green,"55"):tint(c.orange,"55")}`,
            borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700 }}>
            {detailCase.checklist.confirmed ? "✅ พร้อมแล้ว" : "📋 กรอกแล้ว (ยังไม่ยืนยัน)"}
          </span>
        )}
      </div>
      <div style={{ fontSize:17,fontWeight:800,color:c.text900,marginBottom:16,lineHeight:1.4 }}>
        {detailCase.title}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
        {[
          ["ไซต์", detailCase.site||"—"],
          ["ประเภทงาน", detailCase.type],
          ["ผู้ดำเนินการ", (detailCase.techs?.length ? detailCase.techs : detailCase.tech ? [detailCase.tech] : []).join(", ")||"—"],
          ["วันที่", fmtDate(detailCase.date)]
        ].map(([k,v]) => (
          <div key={k}>
            <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontWeight:700 }}>{k}</div>
            <div style={{ fontSize:14,color:c.text900,fontWeight:500 }}>{v}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>ประกัน</div>
          {detailCase.warrantyEnd ? (
            <>
              <WarrantyPill warrantyEnd={detailCase.warrantyEnd}/>
              <div style={{ fontSize:11,color:days!==null&&days<0?c.red:days!==null&&days<=90?c.amber:c.text400,marginTop:3,fontWeight:600 }}>
                {fmtDate(detailCase.warrantyEnd)} {days!==null&&(days<0?"(หมดแล้ว)":`(เหลือ ${days} วัน)`)}
              </div>
            </>
          ) : <span style={{ fontSize:12,color:c.text400 }}>ไม่มีประกัน</span>}
        </div>
        <div>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สัญญาเช่า</div>
          {detailCase.leaseEnd ? (()=>{
            const ld = daysLeft(detailCase.leaseEnd);
            return (
              <>
                <LeasePill leaseEnd={detailCase.leaseEnd}/>
                <div style={{ fontSize:11,color:ld!==null&&ld<0?c.red:ld!==null&&ld<=90?c.amber:c.text400,marginTop:3,fontWeight:600 }}>
                  {fmtDate(detailCase.leaseEnd)} {ld!==null&&(ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`)}
                </div>
              </>
            );
          })() : <span style={{ fontSize:12,color:c.text400 }}>ไม่มีสัญญาเช่า</span>}
        </div>
        <div>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สัญญาเช่าซื้อ</div>
          {detailCase.hirePurchaseEnd ? (()=>{
            const hd = daysLeft(detailCase.hirePurchaseEnd);
            return (
              <>
                <HirePurchasePill hirePurchaseEnd={detailCase.hirePurchaseEnd}/>
                <div style={{ fontSize:11,color:hd!==null&&hd<0?c.red:hd!==null&&hd<=90?c.amber:c.text400,marginTop:3,fontWeight:600 }}>
                  {fmtDate(detailCase.hirePurchaseEnd)} {hd!==null&&(hd<0?"(หมดแล้ว)":`(เหลือ ${hd} วัน)`)}
                </div>
              </>
            );
          })() : <span style={{ fontSize:12,color:c.text400 }}>ไม่มีสัญญาเช่าซื้อ</span>}
        </div>
        <div>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สถานะ</div>
          <StatusPill value={detailCase.status}/>
        </div>
      </div>

      {detailCase.note && (
        <div style={{ background:c.borderSoft,border:`1px solid ${c.border}`,borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:700 }}>หมายเหตุ</div>
          <div style={{ fontSize:13,color:c.text500,lineHeight:1.8 }}>{detailCase.note}</div>
        </div>
      )}

      {(detailCase.updateLog||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:700 }}>
            📝 ประวัติการอัปเดต ({detailCase.updateLog.length})
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {[...(detailCase.updateLog||[])].reverse().map((u,i) => (
              <div key={i} style={{ background:tint(c.green,"14"),borderRadius:8,padding:"10px 12px",border:`1px solid ${tint(c.green,"55")}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:c.green }}>👤 {u.by}</span>
                  <span style={{ fontSize:11,color:c.text400 }}>{u.date} {u.time}</span>
                </div>
                {u.status && <div style={{ fontSize:11,color:c.blue,marginBottom:2 }}>→ {u.status}</div>}
                <div style={{ fontSize:13,color:c.text900,lineHeight:1.6 }}>{u.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(detailCase.handoverLog||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10,color:c.text400,textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:700 }}>
            🔁 ประวัติการส่งต่อ ({detailCase.handoverLog.length} ครั้ง)
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {[...(detailCase.handoverLog||[])].reverse().map((h,i) => (
              <div key={i} style={{ background:c.borderSoft,border:`1px solid ${c.border}`,borderRadius:10,padding:"10px 14px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:h.note?4:0 }}>
                  <span style={{ fontSize:13,fontWeight:700,color:c.text500 }}>{h.from}</span>
                  <span style={{ color:c.blue,fontSize:14 }}>→</span>
                  <span style={{ fontSize:13,fontWeight:700,color:c.blue }}>{h.to}</span>
                  <span style={{ fontSize:11,color:c.text400,marginLeft:"auto" }}>{h.date} {h.time}</span>
                </div>
                {h.note && <div style={{ fontSize:12,color:c.text500,lineHeight:1.6,
                  background:c.card,borderRadius:6,padding:"5px 8px",border:`1px solid ${c.borderSoft}` }}>
                  "{h.note}"
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
        <GhostBtn onClick={onEdit}>✎ แก้ไข</GhostBtn>
        <button onClick={()=>setShowChecklist(true)}
          style={{ background: detailCase.checklist?.confirmed?tint(c.green,"14"):detailCase.checklist?tint(c.orange,"14"):c.borderSoft,
            border:`1px solid ${detailCase.checklist?.confirmed?tint(c.green,"55"):detailCase.checklist?tint(c.orange,"55"):c.border}`,
            color: detailCase.checklist?.confirmed?c.green:detailCase.checklist?c.orange:c.text500,
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          {detailCase.checklist?.confirmed?"✅ Checklist":detailCase.checklist?"📋 Checklist*":"📋 Checklist"}
        </button>
        <button onClick={onUpdate}
          style={{ background:tint(c.green,"14"),border:`1px solid ${tint(c.green,"55")}`,color:c.green,
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          📝 อัปเดต
        </button>
        <button onClick={onHandover}
          style={{ background:tint(c.blue,"14"),border:`1px solid ${tint(c.blue,"55")}`,color:c.blue,
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          📤 ส่งต่องาน
        </button>
        <button onClick={onDelete}
          style={{ background:tint(c.red,"14"),border:`1px solid ${tint(c.red,"55")}`,color:c.red,
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          ลบ
        </button>
      </div>
      {showChecklist && (
        <ChecklistModal
          c={detailCase}
          proj={proj}
          onClose={()=>setShowChecklist(false)}
          onSave={(updated)=>{ onChecklist(updated); setShowChecklist(false); }}
        />
      )}
      {showWorkOrder && (
        <WorkOrderModal
          c={detailCase}
          proj={proj}
          onClose={()=>setShowWorkOrder(false)}
        />
      )}
    </Modal>
  );
}
