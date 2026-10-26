// สร้างไฟล์ Excel ใบขอเบิกสินค้า จากแม่แบบ public/templates/requisition.xlsx
// แม่แบบคือฟอร์มเดิมของบริษัท (โลโก้ เส้นตาราง ช่องเซ็นชื่อ) — เราแค่เติมค่าลงช่อง
export const MAX_ITEMS = 28; // แถว 14–41 ในฟอร์ม
const FIRST_ITEM_ROW = 14;

// YYYY-MM-DD → d/m/พ.ศ.
export function thaiDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${Number(d)}/${Number(m)}/${Number(y) + 543}`;
}

// เติมข้อมูลลง worksheet (แยกออกมาเพื่อทดสอบใน Node ได้)
export function fillRequisition(ws, r) {
  ws.getCell("B8").value = r.jobNo || "";
  ws.getCell("B9").value = r.project || "";
  ws.getCell("J9").value = thaiDate(r.date);
  ws.getCell("J10").value = r.site || "";
  ws.getCell("B11").value = r.sales || "";
  const items = (r.items || []).filter((it) => (it.name || "").trim()).slice(0, MAX_ITEMS);
  for (let i = 0; i < MAX_ITEMS; i++) {
    const row = FIRST_ITEM_ROW + i;
    const it = items[i];
    ws.getCell(`A${row}`).value = it ? i + 1 : null;
    ws.getCell(`B${row}`).value = it ? (it.serial || "") : null;
    ws.getCell(`C${row}`).value = it ? it.name : null;
    ws.getCell(`I${row}`).value = it ? (Number(it.qty) || it.qty || "") : null;
    ws.getCell(`J${row}`).value = it ? (it.unit || "") : null;
    ws.getCell(`K${row}`).value = it ? (it.note || "") : null;
  }
}

export function requisitionFileName(r) {
  const safe = (s) => (s || "").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 40);
  return `ใบขอเบิกสินค้า ${r.date || ""} ${safe(r.site) || safe(r.project)}`.trim() + ".xlsx";
}

export async function downloadRequisition(r) {
  const [{ default: ExcelJS }, res] = await Promise.all([
    import("exceljs"),
    fetch("/templates/requisition.xlsx", { cache: "no-cache" }),
  ]);
  if (!res.ok) throw new Error("โหลดแม่แบบใบเบิกไม่สำเร็จ");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  fillRequisition(wb.worksheets[0], r);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = requisitionFileName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
