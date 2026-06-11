import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from "firebase/firestore";
import LeaveModal from "./LeaveModal.jsx";

const LEAVE_LABEL = { vacation:"ลาพักผ่อน", personal:"ลากิจ", sick:"ลาป่วย", other:"อื่นๆ" };
const STATUS_STYLE = {
  pending:  { bg:"#fef9c3", color:"#854d0e", label:"รออนุมัติ" },
  approved: { bg:"#f0fdf4", color:"#15803d", label:"อนุมัติแล้ว" },
  rejected: { bg:"#fff1f2", color:"#be123c", label:"ไม่อนุมัติ" },
};

function printLeave(leave, logoData) {
  const typeLabel = leave.leaveType==="other"
    ? (leave.otherType||"อื่นๆ")
    : LEAVE_LABEL[leave.leaveType]||leave.leaveType;
  const offDaysStr = (leave.offDays||[]).join("  ");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>ใบลา - ${leave.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 14px; padding: 30px 40px; color: #000; }
  h1 { text-align: center; font-size: 20px; font-weight: 700; margin-bottom: 20px; }
  .row { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-end; }
  .field { flex: 1; }
  .label { font-size: 12px; color: #555; margin-bottom: 2px; }
  .line { border-bottom: 1px solid #000; min-width: 80px; padding: 2px 4px; min-height: 22px; }
  .checkbox-row { display: flex; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
  .cb { display: flex; align-items: center; gap: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
  th, td { border: 1px solid #000; padding: 5px 8px; text-align: center; }
  th { font-weight: 700; background: #f0f0f0; }
  .sig-row { display: flex; gap: 20px; margin-top: 16px; }
  .sig { flex: 1; text-align: center; }
  .sig-line { border-bottom: 1px solid #000; margin: 24px 16px 4px; }
  @media print { body { padding: 15px 20px; } @page { margin: 10mm; size: A4 landscape; } }
</style>
</head><body>
${logoData ? `<div style="text-align:left;margin-bottom:8px"><img src="${logoData}" style="max-height:60px;max-width:180px;object-fit:contain"/></div>` : ""}
<h1>ใบลา</h1>

<div class="row">
  <div class="label">ประเภทการลา:</div>
  <div class="checkbox-row">
    ${["vacation","personal","sick","other"].map(t=>`
      <div class="cb"><span style="display:inline-block;width:14px;height:14px;border:1px solid #000;text-align:center;line-height:14px;font-size:11px">${leave.leaveType===t?"✓":""}</span> ${LEAVE_LABEL[t]||"อื่นๆ"}</div>
    `).join("")}
    ${leave.leaveType==="other" ? `<span>_${leave.otherType||"__________"}_</span>` : ""}
  </div>
</div>

<div class="row">
  <div class="field"><div class="label">สถานที่ปฏิบัติงาน</div><div class="line">${leave.workLocation||""}</div></div>
  <div class="field"><div class="label">โทรศัพท์</div><div class="line">${leave.phone||""}</div></div>
</div>

<div class="row">
  <div class="field"><div class="label">เรียน ผู้จัดการแผนก</div><div class="line">${leave.manager||""}</div></div>
  <div class="field"><div class="label">สำนัก/ฝ่าย</div><div class="line">${leave.department||""}</div></div>
</div>

<div class="row">
  <div class="label">ข้าพเจ้า</div>
  <div class="line" style="flex:2">${leave.name||""}</div>
  <div class="label">พนักงานระดับ</div>
  <div class="line" style="flex:1">${leave.empLevel||""}</div>
  <div class="label">ตำแหน่ง</div>
  <div class="line" style="flex:2">${leave.position||""}</div>
  <div class="label">เลขบัตรพนักงาน</div>
  <div class="line" style="flex:1">${leave.empId||""}</div>
</div>

<div class="row" style="margin-top:8px">
  <div class="label">วันหยุดประจำสัปดาห์:</div>
  <div class="checkbox-row">
    ${["จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์","อาทิตย์"].map(d=>`
      <div class="cb"><span style="display:inline-block;width:14px;height:14px;border:1px solid #000;text-align:center;line-height:14px;font-size:11px">${(leave.offDays||[]).includes(d)?"✓":""}</span> ${d}</div>
    `).join("")}
  </div>
</div>

<div class="row">
  <div class="label">มีความประสงค์ขออนุญาตลาหยุดเนื่องจาก</div>
  <div class="line" style="flex:3">${leave.reason||""}</div>
  <div class="label">มีกำหนด</div>
  <div class="line" style="width:50px">${leave.days||""}</div>
  <div class="label">วัน</div>
</div>

<div class="row">
  <div class="label">นับตั้งแต่วันที่</div>
  <div class="line" style="flex:2">${leave.dateFrom||""}</div>
  <div class="label">ถึงวันที่</div>
  <div class="line" style="flex:2">${leave.dateTo||""}</div>
</div>

<div class="sig-row">
  <div class="sig"><div class="sig-line"></div><div>ผู้ขอลา</div></div>
  <div class="sig"><div class="sig-line"></div><div>พนักงานที่ควบคุม</div></div>
  <div class="sig"><div class="sig-line"></div><div>ผู้อนุมัติ</div></div>
</div>

<table>
  <tr><th colspan="7">สำหรับเจ้าหน้าที่ระเบียนวันลาประจำฝ่าย</th></tr>
  <tr>
    <th rowspan="2">รายการ</th>
    <th colspan="5">นับเป็นวันลา</th>
    <th rowspan="2">ไม่นับวันลา<br/>ลาพิเศษ 1</th>
  </tr>
  <tr><th>ลาพักผ่อน</th><th>ลากิจ</th><th>ลาป่วย</th><th>ลาพิเศษ</th><th>อื่นๆ</th></tr>
  <tr><td>ลามาแล้ว</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>ลาครั้งนี้</td>
    <td>${leave.leaveType==="vacation"?leave.days:""}</td>
    <td>${leave.leaveType==="personal"?leave.days:""}</td>
    <td>${leave.leaveType==="sick"?leave.days:""}</td>
    <td></td>
    <td>${leave.leaveType==="other"?leave.days:""}</td>
    <td></td>
  </tr>
  <tr><td>รวม</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table>

<script>window.onload=()=>{ window.print(); }</script>
</body></html>`;

  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
}

export default function LeavePage({ onBack, currentUser }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoData = '/logo.png';
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterName, setFilterName] = useState("all");

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const q = query(collection(db,"leaves"), orderBy("createdAt","desc"));
    const u = onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    });
    return u;
  }, []);

  async function saveLeave(data) {
    setSaving(true);
    try {
      await addDoc(collection(db,"leaves"), data);
      setShowModal(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function updateStatus(id, status) {
    try {
      await updateDoc(doc(db,"leaves",id), {
        status,
        approvedBy: currentUser?.name||"",
        approvedAt: new Date().toISOString(),
      });
    } catch(e) { console.error(e); }
  }

  // filter
  const myRecords = isAdmin ? records : records.filter(r => r.createdBy === currentUser?.uid);
  const filtered = myRecords.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterName !== "all" && r.name !== filterName) return false;
    return true;
  });

  // summary
  const names = [...new Set(records.map(r=>r.name).filter(Boolean))].sort();
  const summary = {};
  filtered.forEach(r => {
    if (!summary[r.name]) summary[r.name] = { vacation:0, personal:0, sick:0, other:0 };
    summary[r.name][r.leaveType] = (summary[r.name][r.leaveType]||0) + (r.days||0);
  });

  const inputStyle = {
    border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px",
    fontSize:12, fontFamily:"inherit", background:"#f8fafc", outline:"none",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"14px 20px",
        display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9", border:"none", borderRadius:8,
          padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit", color:"#475569", fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>📋 ใบลา</div>
        <button onClick={()=>setShowModal(true)} style={{ marginLeft:"auto",
          background:"#2563eb", border:"none", color:"#fff", borderRadius:8,
          padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          + ยื่นใบลา
        </button>
      </div>

      <div style={{ padding:"16px 20px 48px", maxWidth:900, margin:"0 auto" }}>

        {/* Summary cards */}
        {Object.keys(summary).length > 0 && (
          <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0",
            padding:"14px 16px", marginBottom:16 }}>
            <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:10,
              textTransform:"uppercase", letterSpacing:1 }}>สรุปวันลา</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    {["ชื่อ","ลาพักผ่อน","ลากิจ","ลาป่วย","อื่นๆ"].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11,
                        color:"#64748b", fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary).map(([name, s]) => (
                    <tr key={name} style={{ borderBottom:"1px solid #f1f5f9" }}>
                      <td style={{ padding:"8px 12px", fontWeight:600, color:"#0f172a" }}>{name}</td>
                      <td style={{ padding:"8px 12px", color:"#2563eb" }}>{s.vacation||0} วัน</td>
                      <td style={{ padding:"8px 12px", color:"#7c3aed" }}>{s.personal||0} วัน</td>
                      <td style={{ padding:"8px 12px", color:"#dc2626" }}>{s.sick||0} วัน</td>
                      <td style={{ padding:"8px 12px", color:"#475569" }}>{s.other||0} วัน</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ background:"#fff", borderRadius:12, padding:"12px 16px",
          border:"1px solid #e2e8f0", marginBottom:16,
          display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ไม่อนุมัติ</option>
          </select>
          {isAdmin && (
            <select value={filterName} onChange={e=>setFilterName(e.target.value)} style={inputStyle}>
              <option value="all">ทุกคน</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <span style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto" }}>{filtered.length} รายการ</span>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign:"center", color:"#94a3b8", padding:48 }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", color:"#cbd5e1", padding:48, fontSize:14 }}>
            ยังไม่มีใบลา
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(r => {
              const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
              const typeLabel = r.leaveType==="other" ? (r.otherType||"อื่นๆ") : LEAVE_LABEL[r.leaveType]||r.leaveType;
              return (
                <div key={r.id} style={{ background:"#fff", borderRadius:12,
                  border:"1px solid #e2e8f0", padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>{r.name}</div>
                      <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
                        {typeLabel} · {r.days} วัน · {r.dateFrom} ถึง {r.dateTo}
                      </div>
                      {r.reason && <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>เหตุผล: {r.reason}</div>}
                    </div>
                    <span style={{ background:st.bg, color:st.color, borderRadius:20,
                      padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={()=>printLeave(r, logoData)}
                      style={{ background:"#f8fafc", border:"1px solid #e2e8f0", color:"#475569",
                        borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer",
                        fontFamily:"inherit", fontWeight:600 }}>
                      🖨 Export PDF
                    </button>
                    {isAdmin && r.status === "pending" && r.createdBy !== currentUser?.uid && (<>
                      <button onClick={()=>updateStatus(r.id,"approved")}
                        style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#15803d",
                          borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer",
                          fontFamily:"inherit", fontWeight:600 }}>
                        ✅ อนุมัติ
                      </button>
                      <button onClick={()=>updateStatus(r.id,"rejected")}
                        style={{ background:"#fff1f2", border:"1px solid #fecdd3", color:"#be123c",
                          borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer",
                          fontFamily:"inherit", fontWeight:600 }}>
                        ❌ ไม่อนุมัติ
                      </button>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <LeaveModal
          onClose={()=>setShowModal(false)}
          onSave={saveLeave}
          saving={saving}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
