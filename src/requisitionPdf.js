// ออกใบขอเบิกสินค้าเป็น PDF (A4) — วาดฟอร์มเป็น HTML หน้าตาเดียวกับไฟล์ Excel แล้วแปลงเป็นรูปลง PDF
// ใช้ฟอนต์ Noto Sans Thai ที่หน้าเว็บโหลดอยู่แล้ว ภาษาไทยจึงแสดงถูกต้อง
import { MAX_ITEMS, thaiDate, requisitionFileName } from "./requisitionExcel.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function requisitionHtml(r) {
  const items = (r.items || []).filter((it) => (it.name || "").trim()).slice(0, MAX_ITEMS);
  const rows = Array.from({ length: MAX_ITEMS }, (_, i) => {
    const it = items[i];
    return `<tr>
      <td class="c">${it ? i + 1 : ""}</td><td class="c">${it ? esc(it.serial) : ""}</td>
      <td class="n">${it ? esc(it.name) : ""}</td><td class="c">${it ? esc(it.qty) : ""}</td>
      <td class="c">${it ? esc(it.unit) : ""}</td><td>${it ? esc(it.note) : ""}</td></tr>`;
  }).join("");
  const field = (label, value) => `<div class="f"><span class="fl">${label}</span><span class="fv">${esc(value)}</span></div>`;
  const sign = (role) => `<div class="s"><div>(............................................)</div><div class="sr">${role}</div><div>(………./………./……….)</div></div>`;
  return `
<style>
  .rq{width:794px;padding:34px 40px 30px;box-sizing:border-box;background:#fff;color:#000;font-family:'Noto Sans Thai','Sora',sans-serif;font-size:12px;line-height:1.35}
  .rq .hd{display:flex;gap:18px;align-items:center}
  .rq .hd img{width:170px;height:auto}
  .rq .co b{display:block;font-size:16px}
  .rq .co div{font-size:10.5px}
  .rq h1{text-align:center;font-size:19px;margin:14px 0 10px;text-decoration:underline;text-underline-offset:4px}
  .rq .fs{display:flex;justify-content:space-between;gap:20px}
  .rq .f{display:flex;align-items:flex-end;margin:3px 0}
  .rq .fl{font-weight:700;white-space:nowrap;margin-right:6px}
  .rq .fv{border-bottom:1px solid #000;min-width:120px;flex:1;padding:0 4px;min-height:16px}
  .rq .l{flex:1}.rq .r{width:230px}
  .rq table{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}
  .rq th,.rq td{border:1px solid #000;padding:2px 5px;height:19px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .rq td.n{white-space:normal;word-break:break-word}
  .rq th{font-weight:700;background:#f2f2f2;height:24px}
  .rq .c{text-align:center}
  .rq .nt{margin-top:10px;font-size:11px}
  .rq .ss{display:flex;justify-content:space-between;margin-top:34px;text-align:center;font-size:11.5px}
  .rq .s{width:30%}.rq .sr{font-weight:700;margin:6px 0}
</style>
<div class="rq">
  <div class="hd">
    <img src="/templates/metthier-logo.png" alt="">
    <div class="co">
      <b>บริษัท เมทเธียร์ จำกัด</b><b>Metthier Co., Ltd.</b>
      <div>55/5 อาคาร เอ.เอ.แคปปิตอล รัชดา ชั้นที่ 7 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400</div>
      <div>55/5, A.A.Capital Ratchada Building, 7 Floor, Ratchadapisek Road, Dindaeng, Dindaeng, Bangkok 10400 Thailand</div>
      <div>โทร.0-2029-7877</div>
    </div>
  </div>
  <h1>ใบขอเบิกสินค้า</h1>
  <div class="fs">
    <div class="l">${field("JOB NO :", r.jobNo)}${field("PROJECT :", r.project)}${field("SITE :", "")}${field("SALES", r.sales)}</div>
    <div class="r">${field("", "")}${field("วันที่", thaiDate(r.date))}${field("สถานที่", r.site)}</div>
  </div>
  <table>
    <colgroup><col style="width:8%"><col style="width:16%"><col style="width:44%"><col style="width:9%"><col style="width:9%"><col style="width:14%"></colgroup>
    <thead><tr><th>ลำดับที่</th><th>serial number</th><th>รายการสินค้า</th><th>จำนวน</th><th>หน่วย</th><th>หมายเหตุ</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="nt">หมายเหตุ : หากผู้ที่ทำการเบิกสินค้าเซ็นรับทราบแล้ว จะถือว่าอุปกรณ์ทั้งหมดตามรายการข้างต้นจะอยู่ในความดูแลของผู้ที่เบิกสินค้า หากเกิดความเสียหายของอุปกรณ์<br>ผู้ที่ทำการเบิกสินค้าจะต้องเป็นผู้รับผิดชอบทั้งหมด</div>
  <div class="ss">${sign("ผู้รับเหมาขอเบิกสินค้า")}${sign("ผู้ดูแลโครงการ")}${sign("ผู้จ่ายสินค้า")}</div>
</div>`;
}

export async function downloadRequisitionPdf(r) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1";
  host.innerHTML = requisitionHtml(r);
  document.body.appendChild(host);
  try {
    const img = host.querySelector("img");
    if (img && !img.complete) await new Promise((ok) => { img.onload = ok; img.onerror = ok; });
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(host.querySelector(".rq"), { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    // ย่อให้พอดีหน้า A4 โดยไม่บิดสัดส่วน (กรณีชื่อรายการยาวจนแถวสูงขึ้น)
    let w = 210, h = (canvas.height * w) / canvas.width;
    if (h > 297) { w = (w * 297) / h; h = 297; }
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (210 - w) / 2, 0, w, h);
    const url = URL.createObjectURL(pdf.output("blob"));
    const a = document.createElement("a");
    a.href = url;
    a.download = requisitionFileName(r).replace(/\.xlsx$/, ".pdf");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    host.remove();
  }
}
