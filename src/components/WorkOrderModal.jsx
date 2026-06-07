import { fmtDate } from "../utils.js";

const ORANGE = "#F97316";
const PURPLE = "#6B21A8";
const ORANGE_LIGHT = "#FFF7ED";
const ORANGE_BORDER = "#FED7AA";

const STATUS_LABEL = {
  open:       "เปิดเคส",
  inprogress: "กำลังดำเนินการ",
  done:       "เสร็จสิ้น",
  hold:       "รอดำเนินการ",
};

export default function WorkOrderModal({ c, proj, onClose }) {
  if (!c) return null;

  const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);

  function printWorkOrder() {
    window.print();
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,.6)",
      display:"flex",alignItems:"flex-start",justifyContent:"center",
      padding:"20px",overflowY:"auto" }}
      onClick={onClose}>
      <div style={{ background:"#fff",width:"210mm",minHeight:"297mm",
        fontFamily:"'Noto Sans Thai',sans-serif",position:"relative" }}
        onClick={e=>e.stopPropagation()}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');
          @media print {
            body * { visibility: hidden !important; }
            .work-order-print, .work-order-print * { visibility: visible !important; }
            .work-order-print { position: fixed !important; inset: 0 !important; margin: 0 !important;
              width: 210mm !important; min-height: 297mm !important;
              background: #fff !important; z-index: 9999 !important; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 0; }
          }
        `}</style>

        {/* Action buttons — hidden on print */}
        <div className="no-print" style={{ display:"flex",gap:10,padding:"12px 16px",
          background:"#f8fafc",borderBottom:"1px solid #e2e8f0" }}>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",
            borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,
            fontFamily:"inherit",color:"#475569",fontWeight:600 }}>← กลับ</button>
          <button onClick={printWorkOrder} style={{ background:PURPLE,border:"none",
            borderRadius:8,padding:"7px 18px",cursor:"pointer",fontSize:13,
            fontFamily:"inherit",color:"#fff",fontWeight:600,marginLeft:"auto" }}>
            🖨 พิมพ์ / Export PDF
          </button>
        </div>

        {/* Work Order Content */}
        <div className="work-order-print" style={{ padding:"16mm 14mm" }}>

          {/* Header */}
          <div style={{ borderBottom:`3px solid ${ORANGE}`,paddingBottom:10,marginBottom:14,
            display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:18,fontWeight:700,color:PURPLE,marginBottom:3 }}>
                บริษัท เมทเธียร์ จำกัด
              </div>
              <div style={{ fontSize:10,color:"#64748b",lineHeight:1.6 }}>
                ชั้น 7 อาคาร เอ.เอ.แคปิตอล 55/5 ถ.รัชดาภิเษก แขวงดินแดง กทม 10400<br/>
                โทร 02 029 7877
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ background:PURPLE,color:"#fff",fontSize:13,fontWeight:700,
                padding:"4px 14px",borderRadius:6,marginBottom:6,display:"inline-block" }}>
                ใบงาน (Work Order)
              </div>
              <div style={{ fontSize:10,color:"#64748b" }}>เลขที่: WO-{c.id?.toString().slice(-6)||"000000"}</div>
              <div style={{ fontSize:10,color:"#64748b" }}>วันที่พิมพ์: {fmtDate(new Date().toISOString().slice(0,10))}</div>
            </div>
          </div>

          {/* Info Table */}
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:12 }}>
            <tbody>
              <tr>
                <td style={{ padding:"5px 8px",background:ORANGE,color:"#fff",fontWeight:600,width:"22%",border:`0.5px solid ${ORANGE}` }}>โครงการ</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a",width:"28%" }}>{proj?.name||"—"}</td>
                <td style={{ padding:"5px 8px",background:ORANGE,color:"#fff",fontWeight:600,width:"20%",border:`0.5px solid ${ORANGE}` }}>ไซต์/สถานที่</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{c.site||"—"}</td>
              </tr>
              <tr>
                <td style={{ padding:"5px 8px",background:ORANGE_LIGHT,color:"#7C2D12",fontWeight:600,border:`0.5px solid ${ORANGE_BORDER}` }}>ชื่องาน</td>
                <td colSpan={3} style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{c.title}</td>
              </tr>
              <tr>
                <td style={{ padding:"5px 8px",background:ORANGE,color:"#fff",fontWeight:600,border:`0.5px solid ${ORANGE}` }}>ประเภทงาน</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{c.type||"—"}</td>
                <td style={{ padding:"5px 8px",background:ORANGE,color:"#fff",fontWeight:600,border:`0.5px solid ${ORANGE}` }}>วันที่ดำเนินการ</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{fmtDate(c.date)}</td>
              </tr>
              <tr>
                <td style={{ padding:"5px 8px",background:ORANGE_LIGHT,color:"#7C2D12",fontWeight:600,border:`0.5px solid ${ORANGE_BORDER}` }}>ผู้ดำเนินการ</td>
                <td colSpan={3} style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{techs.join(", ")||"—"}</td>
              </tr>
              <tr>
                <td style={{ padding:"5px 8px",background:ORANGE_LIGHT,color:"#7C2D12",fontWeight:600,border:`0.5px solid ${ORANGE_BORDER}` }}>สถานะ</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{STATUS_LABEL[c.status]||c.status}</td>
                <td style={{ padding:"5px 8px",background:ORANGE_LIGHT,color:"#7C2D12",fontWeight:600,border:`0.5px solid ${ORANGE_BORDER}` }}>หมายเหตุ</td>
                <td style={{ padding:"5px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{c.note||""}</td>
              </tr>
            </tbody>
          </table>

          {/* Update Log */}
          <div style={{ fontSize:11,fontWeight:700,color:PURPLE,marginBottom:5,
            paddingBottom:3,borderBottom:`1.5px solid ${ORANGE}` }}>ประวัติการอัปเดต</div>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:12 }}>
            <thead>
              <tr style={{ background:PURPLE }}>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}`,width:"20%" }}>วันที่/เวลา</th>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}`,width:"18%" }}>โดย</th>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}` }}>รายละเอียด</th>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}`,width:"18%" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {(c.updateLog||[]).length === 0 ? (
                <tr><td colSpan={4} style={{ padding:"8px",border:"0.5px solid #e2e8f0",color:"#94a3b8",textAlign:"center" }}>—</td></tr>
              ) : (c.updateLog||[]).map((u,i)=>(
                <tr key={i} style={{ background:i%2===0?"#fff":"#f8fafc" }}>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#64748b" }}>{u.date} {u.time}</td>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{u.by}</td>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{u.text}</td>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{STATUS_LABEL[u.status]||u.status||"—"}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 3-(c.updateLog||[]).length))].map((_,i)=>(
                <tr key={`empty-u-${i}`}><td colSpan={4} style={{ padding:"10px 8px",border:"0.5px solid #e2e8f0" }}> </td></tr>
              ))}
            </tbody>
          </table>

          {/* Handover Log */}
          <div style={{ fontSize:11,fontWeight:700,color:PURPLE,marginBottom:5,
            paddingBottom:3,borderBottom:`1.5px solid ${ORANGE}` }}>ประวัติการส่งต่องาน</div>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10,marginBottom:16 }}>
            <thead>
              <tr style={{ background:PURPLE }}>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}`,width:"20%" }}>วันที่/เวลา</th>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}`,width:"28%" }}>จาก → ถึง</th>
                <th style={{ padding:"4px 8px",color:"#fff",fontWeight:600,textAlign:"left",border:`0.5px solid ${PURPLE}` }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {(c.handoverLog||[]).length === 0 ? (
                <tr><td colSpan={3} style={{ padding:"8px",border:"0.5px solid #e2e8f0",color:"#94a3b8",textAlign:"center" }}>—</td></tr>
              ) : (c.handoverLog||[]).map((h,i)=>(
                <tr key={i} style={{ background:i%2===0?"#fff":"#f8fafc" }}>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#64748b" }}>{h.date} {h.time}</td>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{h.from} → {h.to}</td>
                  <td style={{ padding:"4px 8px",border:"0.5px solid #e2e8f0",color:"#0f172a" }}>{h.note||"—"}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 2-(c.handoverLog||[]).length))].map((_,i)=>(
                <tr key={`empty-h-${i}`}><td colSpan={3} style={{ padding:"10px 8px",border:"0.5px solid #e2e8f0" }}> </td></tr>
              ))}
            </tbody>
          </table>

          {/* Signature */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <div style={{ border:`1.5px solid ${ORANGE}`,borderRadius:6,padding:"10px 12px" }}>
              <div style={{ fontSize:11,color:"#7C2D12",fontWeight:600,marginBottom:36 }}>ผู้ดำเนินการ / Technician</div>
              <div style={{ borderTop:"0.5px solid #e2e8f0",paddingTop:6,fontSize:10,color:"#94a3b8" }}>ลายเซ็น / วันที่</div>
            </div>
            <div style={{ border:`1.5px solid ${PURPLE}`,borderRadius:6,padding:"10px 12px" }}>
              <div style={{ fontSize:11,color:PURPLE,fontWeight:600,marginBottom:36 }}>ผู้รับงาน / Customer</div>
              <div style={{ borderTop:"0.5px solid #e2e8f0",paddingTop:6,fontSize:10,color:"#94a3b8" }}>ลายเซ็น / วันที่</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
