import { fmtDate, today } from "../utils.js";
import { useTheme } from "../theme.js";

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

function buildWorkOrderHTML(c, proj) {
  const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : []);
  const updateLog = c.updateLog || [];
  const handoverLog = c.handoverLog || [];

  const updateRows = updateLog.length === 0
    ? `<tr><td colspan="4" style="padding:8px;border:0.5px solid #e2e8f0;color:#94a3b8;text-align:center">—</td></tr>`
    : updateLog.map((u, i) => `
      <tr style="background:${i%2===0?'#fff':'#f8fafc'}">
        <td style="padding:4px 8px;border:0.5px solid #e2e8f0;color:#64748b">${u.date||''} ${u.time||''}</td>
        <td style="padding:4px 8px;border:0.5px solid #e2e8f0;color:#0f172a">${u.by||''}</td>
        <td style="padding:4px 8px;border:0.5px solid #e2e8f0;color:#0f172a">${u.text||''}</td>
        <td style="padding:4px 8px;border:0.5px solid #e2e8f0;color:#0f172a">${STATUS_LABEL[u.status]||u.status||'—'}</td>
      </tr>`).join('') + (updateLog.length < 3
        ? Array(3 - updateLog.length).fill('<tr><td colspan="4" style="padding:10px 8px;border:0.5px solid #e2e8f0"> </td></tr>').join('')
        : '');



  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ใบงาน WO-${(c.id||'').toString().slice(-6)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:'Noto Sans Thai',sans-serif; background:#fff; padding:14mm 14mm 60mm 14mm; font-size:11pt; color:#0f172a; min-height:297mm; position:relative; }
  @page { size:A4; margin:0; }
  @media print { body { padding:10mm 12mm; } .no-print { display:none !important; } }
  table { width:100%; border-collapse:collapse; }
  th, td { font-family:'Noto Sans Thai',sans-serif; }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#f8fafc;padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #e2e8f0;z-index:99">
  <button onclick="window.close()" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;font-family:inherit">← ปิด</button>
  <button onclick="window.print()" style="background:${PURPLE};border:none;border-radius:8px;padding:6px 18px;cursor:pointer;font-size:13px;font-family:inherit;color:#fff;margin-left:auto">🖨 พิมพ์ / Export PDF</button>
</div>

<div style="margin-top:48px">

  <!-- Header -->
  <div style="border-bottom:3px solid ${ORANGE};padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:18pt;font-weight:700;color:${PURPLE};margin-bottom:3px">บริษัท เมทเธียร์ จำกัด</div>
      <div style="font-size:9pt;color:#64748b;line-height:1.6">
        สำนักงานใหญ่ศูนย์ปฏิบัติการ
        ซอยรามคำแหง 21 แยก 3 แขวงพลับพลา เขตวังทองหลาง กรุงเทพมหานคร 10312<br/>
        โทร 02 091 5599
      </div>
    </div>
    <div style="text-align:right">
      <div style="background:${PURPLE};color:#fff;font-size:12pt;font-weight:700;padding:4px 14px;border-radius:6px;margin-bottom:6px;display:inline-block">ใบงาน (Work Order)</div>
      <div style="font-size:9pt;color:#64748b">เลขที่: WO-${(c.id||'').toString().slice(-6)}</div>
      <div style="font-size:9pt;color:#64748b">วันที่พิมพ์: ${fmtDate(today())}</div>
    </div>
  </div>

  <!-- Info -->
  <table style="margin-bottom:14px;font-size:10pt">
    <tr>
      <td style="padding:5px 8px;background:${ORANGE};color:#fff;font-weight:600;width:22%;border:0.5px solid ${ORANGE}">โครงการ</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0;width:28%">${proj?.name||'—'}</td>
      <td style="padding:5px 8px;background:${ORANGE};color:#fff;font-weight:600;width:20%;border:0.5px solid ${ORANGE}">ไซต์/สถานที่</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0">${c.site||'—'}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:${ORANGE_LIGHT};color:#7C2D12;font-weight:600;border:0.5px solid ${ORANGE_BORDER}">ชื่องาน</td>
      <td colspan="3" style="padding:5px 8px;border:0.5px solid #e2e8f0">${c.title||'—'}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:${ORANGE};color:#fff;font-weight:600;border:0.5px solid ${ORANGE}">ประเภทงาน</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0">${c.type||'—'}</td>
      <td style="padding:5px 8px;background:${ORANGE};color:#fff;font-weight:600;border:0.5px solid ${ORANGE}">วันที่ดำเนินการ</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0">${fmtDate(c.date)}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:${ORANGE_LIGHT};color:#7C2D12;font-weight:600;border:0.5px solid ${ORANGE_BORDER}">ผู้ดำเนินการ</td>
      <td colspan="3" style="padding:5px 8px;border:0.5px solid #e2e8f0">${techs.join(', ')||'—'}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:${ORANGE_LIGHT};color:#7C2D12;font-weight:600;border:0.5px solid ${ORANGE_BORDER}">สถานะ</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0">${STATUS_LABEL[c.status]||c.status||'—'}</td>
      <td style="padding:5px 8px;background:${ORANGE_LIGHT};color:#7C2D12;font-weight:600;border:0.5px solid ${ORANGE_BORDER}">หมายเหตุ</td>
      <td style="padding:5px 8px;border:0.5px solid #e2e8f0">${c.note||''}</td>
    </tr>
  </table>

  <!-- Update Log -->
  <div style="font-size:11pt;font-weight:700;color:${PURPLE};margin-bottom:5px;padding-bottom:3px;border-bottom:1.5px solid ${ORANGE}">ประวัติการอัปเดต</div>
  <table style="font-size:9pt;margin-bottom:14px">
    <thead>
      <tr style="background:${PURPLE}">
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE};width:20%">วันที่/เวลา</th>
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE};width:18%">โดย</th>
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE}">รายละเอียด</th>
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE};width:18%">สถานะ</th>
      </tr>
    </thead>
    <tbody>${updateRows}</tbody>
  </table>



  <!-- อะไหล่/วัสดุ -->
  <div style="font-size:11pt;font-weight:700;color:${PURPLE};margin-bottom:5px;padding-bottom:3px;border-bottom:1.5px solid ${ORANGE}">รายการอะไหล่/วัสดุที่ใช้</div>
  <table style="font-size:9pt;margin-bottom:14px">
    <thead>
      <tr style="background:${PURPLE}">
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE}">รายการ</th>
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:center;border:0.5px solid ${PURPLE};width:15%">จำนวน</th>
        <th style="padding:4px 8px;color:#fff;font-weight:600;text-align:left;border:0.5px solid ${PURPLE};width:15%">หน่วย</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td></tr>
      <tr style="background:#f8fafc"><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td></tr>
      <tr><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td><td style="padding:14px 8px;border:0.5px solid #e2e8f0"> </td></tr>
    </tbody>
  </table>

  <!-- สรุปผลการดำเนินงาน -->
  <div style="font-size:11pt;font-weight:700;color:${PURPLE};margin-bottom:8px;padding-bottom:3px;border-bottom:1.5px solid ${ORANGE}">สรุปผลการดำเนินงาน</div>
  <div style="margin-bottom:14px">
    ${Array(6).fill('<div style="border-bottom:1px dashed #cbd5e1;margin-bottom:18px;height:18px"> </div>').join('')}
  </div>

  <!-- Signature -->
  <div style="position:absolute;bottom:14mm;left:14mm;right:14mm;display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div style="border:1.5px solid ${ORANGE};border-radius:6px;padding:10px 12px">
      <div style="font-size:10pt;color:#7C2D12;font-weight:600;margin-bottom:36px">ผู้ดำเนินการ / Technician</div>
      <div style="border-top:0.5px solid #e2e8f0;padding-top:6px;font-size:9pt;color:#94a3b8">ลายเซ็น / วันที่</div>
    </div>
    <div style="border:1.5px solid ${PURPLE};border-radius:6px;padding:10px 12px">
      <div style="font-size:10pt;color:${PURPLE};font-weight:600;margin-bottom:36px">ผู้รับงาน / Customer</div>
      <div style="border-top:0.5px solid #e2e8f0;padding-top:6px;font-size:9pt;color:#94a3b8">ลายเซ็น / วันที่</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

export default function WorkOrderModal({ c, proj, onClose }) {
  const { c: t } = useTheme();   // c ถูกใช้เป็นชื่อ prop ของเคสแล้ว จึงรับ theme เป็น t
  if (!c) return null;

  function openWorkOrder() {
    const html = buildWorkOrderHTML(c, proj);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    onClose();
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,.6)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}
      onClick={onClose}>
      <div style={{ background:t.card,borderRadius:16,padding:24,maxWidth:360,width:"100%",
        boxShadow:"0 20px 60px rgba(0,0,0,.35)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:15,fontWeight:700,color:t.text900,marginBottom:8 }}>🖨 พิมพ์ใบงาน</div>
        <div style={{ fontSize:13,color:t.text500,marginBottom:20,lineHeight:1.6 }}>
          ระบบจะเปิดแท็บใหม่แสดงใบงาน กดพิมพ์หรือ Save PDF ได้เลย
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:t.bg,border:`1px solid ${t.border}`,
            color:t.text500,borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={openWorkOrder} style={{ flex:2,background:t.purple,border:"none",
            color:"#fff",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
            เปิดใบงาน →
          </button>
        </div>
      </div>
    </div>
  );
}
