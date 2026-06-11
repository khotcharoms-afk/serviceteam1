import { useState } from "react";
import { Modal, GhostBtn, WarrantyPill, LeasePill, StatusPill } from "../UI.jsx";
import { fmtDate, daysLeft } from "../utils.js";
import WorkOrderModal from "./WorkOrderModal.jsx";
import ChecklistModal from "./ChecklistModal.jsx";
import OnsiteModal from "../OnsiteModal.jsx";

export default function DetailModal({
  detailCase, onClose, projects, users,
  onEdit, onUpdate, onHandover, onDelete, onChecklist, onOnsite
}) {
  const [showWorkOrder, setShowWorkOrder] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showOnsite, setShowOnsite] = useState(false);
  if (!detailCase) return null;
  const proj = projects.find(p => p.id === detailCase.projectId);
  const days = daysLeft(detailCase.warrantyEnd);

  return (
    <Modal open={!!detailCase} onClose={onClose} title="รายละเอียดเคส"
      headerRight={
        <button onClick={()=>setShowWorkOrder(true)}
          style={{ background:"#fdf4ff",border:"1px solid #e9d5ff",color:"#6B21A8",
            borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",
            fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4 }}>
          🖨 ใบงาน
        </button>
      }>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap" }}>
        <span style={{ background:proj?.color+"15",color:proj?.color,borderRadius:20,
          padding:"3px 12px",fontSize:12,fontWeight:700 }}>
          {proj?.name}
        </span>
        {detailCase.checklist && (
          <span style={{ background: detailCase.checklist.confirmed?"#f0fdf4":"#fff7ed",
            color: detailCase.checklist.confirmed?"#16a34a":"#f97316",
            border:`1px solid ${detailCase.checklist.confirmed?"#bbf7d0":"#fed7aa"}`,
            borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700 }}>
            {detailCase.checklist.confirmed ? "✅ พร้อมแล้ว" : "📋 กรอกแล้ว (ยังไม่ยืนยัน)"}
          </span>
        )}
      </div>
      <div style={{ fontSize:17,fontWeight:800,color:"#0f172a",marginBottom:16,lineHeight:1.4 }}>
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
            <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:3,fontWeight:700 }}>{k}</div>
            <div style={{ fontSize:14,color:"#1e293b",fontWeight:500 }}>{v}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>ประกัน</div>
          {detailCase.warrantyEnd ? (
            <>
              <WarrantyPill warrantyEnd={detailCase.warrantyEnd}/>
              <div style={{ fontSize:11,color:days!==null&&days<0?"#ef4444":days!==null&&days<=90?"#f59e0b":"#94a3b8",marginTop:3,fontWeight:600 }}>
                {fmtDate(detailCase.warrantyEnd)} {days!==null&&(days<0?"(หมดแล้ว)":`(เหลือ ${days} วัน)`)}
              </div>
            </>
          ) : <span style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มีประกัน</span>}
        </div>
        <div>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สัญญาเช่า</div>
          {detailCase.leaseEnd ? (()=>{
            const ld = daysLeft(detailCase.leaseEnd);
            return (
              <>
                <LeasePill leaseEnd={detailCase.leaseEnd}/>
                <div style={{ fontSize:11,color:ld!==null&&ld<0?"#ef4444":ld!==null&&ld<=90?"#f59e0b":"#94a3b8",marginTop:3,fontWeight:600 }}>
                  {fmtDate(detailCase.leaseEnd)} {ld!==null&&(ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`)}
                </div>
              </>
            );
          })() : <span style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มีสัญญาเช่า</span>}
        </div>
        <div>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:4,fontWeight:700 }}>สถานะ</div>
          <StatusPill value={detailCase.status}/>
        </div>
      </div>

      {detailCase.note && (
        <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:5,fontWeight:700 }}>หมายเหตุ</div>
          <div style={{ fontSize:13,color:"#475569",lineHeight:1.8 }}>{detailCase.note}</div>
        </div>
      )}

      {(detailCase.updateLog||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:700 }}>
            📝 ประวัติการอัปเดต ({detailCase.updateLog.length})
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {[...(detailCase.updateLog||[])].reverse().map((u,i) => (
              <div key={i} style={{ background:"#f0fdf4",borderRadius:8,padding:"10px 12px",border:"1px solid #bbf7d0" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#16a34a" }}>👤 {u.by}</span>
                  <span style={{ fontSize:11,color:"#94a3b8" }}>{u.date} {u.time}</span>
                </div>
                {u.status && <div style={{ fontSize:11,color:"#2563eb",marginBottom:2 }}>→ {u.status}</div>}
                <div style={{ fontSize:13,color:"#1e293b",lineHeight:1.6 }}>{u.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(detailCase.handoverLog||[]).length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontWeight:700 }}>
            🔁 ประวัติการส่งต่อ ({detailCase.handoverLog.length} ครั้ง)
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {[...(detailCase.handoverLog||[])].reverse().map((h,i) => (
              <div key={i} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:h.note?4:0 }}>
                  <span style={{ fontSize:13,fontWeight:700,color:"#475569" }}>{h.from}</span>
                  <span style={{ color:"#93c5fd",fontSize:14 }}>→</span>
                  <span style={{ fontSize:13,fontWeight:700,color:"#2563eb" }}>{h.to}</span>
                  <span style={{ fontSize:11,color:"#94a3b8",marginLeft:"auto" }}>{h.date} {h.time}</span>
                </div>
                {h.note && <div style={{ fontSize:12,color:"#64748b",lineHeight:1.6,
                  background:"#fff",borderRadius:6,padding:"5px 8px",border:"1px solid #f1f5f9" }}>
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
          style={{ background: detailCase.checklist?.confirmed?"#f0fdf4":detailCase.checklist?"#fff7ed":"#f8fafc",
            border:`1px solid ${detailCase.checklist?.confirmed?"#bbf7d0":detailCase.checklist?"#fed7aa":"#e2e8f0"}`,
            color: detailCase.checklist?.confirmed?"#16a34a":detailCase.checklist?"#f97316":"#64748b",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          {detailCase.checklist?.confirmed?"✅ Checklist":detailCase.checklist?"📋 Checklist*":"📋 Checklist"}
        </button>
        <button onClick={onUpdate}
          style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          📝 อัปเดต
        </button>
        <button onClick={onHandover}
          style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          📤 ส่งต่องาน
        </button>
        <button onClick={()=>setShowOnsite(true)}
          style={{ background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",
            borderRadius:10,padding:"12px",cursor:"pointer",
            fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          📍 Onsite
        </button>
        <button onClick={onDelete}
          style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
            borderRadius:10,padding:"12px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600 }}>
          ลบ
        </button>
      </div>
      {showOnsite && (
        <OnsiteModal
          detailCase={detailCase}
          proj={proj}
          users={users}
          onClose={()=>setShowOnsite(false)}
          onSave={(data)=>{ onOnsite({ ...data, caseId: detailCase.id }); setShowOnsite(false); }}
          saving={false}
        />
      )}
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
