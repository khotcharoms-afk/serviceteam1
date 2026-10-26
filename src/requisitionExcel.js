// สร้างไฟล์ Excel ใบขอเบิกสินค้า จากแม่แบบ public/templates/requisition.xlsx
// แก้เฉพาะค่าในช่องของ sheet1.xml ตรงๆ (ผ่าน JSZip) ส่วนอื่นของไฟล์ — โลโก้ เส้นตาราง ช่องเซ็นชื่อ
// การตั้งค่าหน้ากระดาษ — คงไว้ตามต้นฉบับทุกไบต์ (ExcelJS เขียนโลโก้ใหม่ผิดขนาด Excel จึงไม่แสดงโลโก้)
export const MAX_ITEMS = 28; // แถว 14–41 ในฟอร์ม
const FIRST_ITEM_ROW = 14;
const SHEET = "xl/worksheets/sheet1.xml";

// YYYY-MM-DD → d/m/พ.ศ.
export function thaiDate(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${Number(d)}/${Number(m)}/${Number(y) + 543}`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ตั้งค่าช่องเดียวใน XML ของชีต (ช่องต้องมีอยู่แล้วในแม่แบบ — ทุกช่องในฟอร์มมีสไตล์เส้นตารางอยู่แล้ว)
function setCell(xml, ref, value) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml;
  const attrs = m[1].replace(/\s+t="[^"]*"/, "");
  let cell;
  if (value === null || value === undefined || value === "") cell = `<c r="${ref}"${attrs}/>`;
  else if (typeof value === "number" && isFinite(value)) cell = `<c r="${ref}"${attrs}><v>${value}</v></c>`;
  else cell = `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  return xml.replace(re, cell);
}

// ค่าทุกช่องของฟอร์ม (ช่องที่ไม่มีข้อมูล = ล้างค่าในแม่แบบ)
// ใบเก่าเก็บ "สถานที่" ไว้ในช่อง site — แยกเป็น site (SITE) กับ location (สถานที่) แล้ว
export function normalizeReq(r = {}) {
  return r.location === undefined ? { ...r, location: r.site || "", site: "" } : r;
}

export function requisitionCells(r) {
  r = normalizeReq(r);
  const cells = {
    B8: r.jobNo || "", B9: String(r.project || "").replace(/^(โครงการ\s*)+/, "โครงการ ").trim(), J9: thaiDate(r.date),
    B10: r.site || "", J10: r.location || "", B11: r.sales || "", J11: "",
  };
  const items = (r.items || []).filter((it) => (it.name || "").trim()).slice(0, MAX_ITEMS);
  for (let i = 0; i < MAX_ITEMS; i++) {
    const row = FIRST_ITEM_ROW + i, it = items[i];
    const qty = it ? Number(it.qty) : null;
    Object.assign(cells, {
      [`A${row}`]: it ? i + 1 : "",
      [`B${row}`]: it ? (it.serial || "") : "",
      [`C${row}`]: it ? it.name : "",
      [`I${row}`]: it ? (isFinite(qty) && String(it.qty).trim() !== "" ? qty : (it.qty || "")) : "",
      [`J${row}`]: it ? (it.unit || "") : "",
      [`K${row}`]: it ? (it.note || "") : "",
    });
  }
  return cells;
}

// zip = JSZip ที่โหลดแม่แบบแล้ว → เติมข้อมูลในที่เดิม
export async function fillRequisitionZip(zip, r) {
  let xml = await zip.file(SHEET).async("string");
  for (const [ref, v] of Object.entries(requisitionCells(r))) xml = setCell(xml, ref, v);
  zip.file(SHEET, xml);
  return zip;
}

// ชื่อไฟล์เป็นตัวอักษรอังกฤษ — Chrome บางเครื่องตัดชื่อไฟล์ภาษาไทยทิ้งเหลือแค่ "download" (ไม่มีนามสกุล)
export function requisitionFileName(r) {
  const job = (r.jobNo || "").replace(/[^A-Za-z0-9-]+/g, "").slice(0, 20);
  return `Requisition_${r.date || "draft"}${job ? `_${job}` : ""}.xlsx`;
}

export async function downloadRequisition(r) {
  const [{ default: JSZip }, res] = await Promise.all([
    import("jszip"),
    fetch("/templates/requisition.xlsx", { cache: "no-cache" }),
  ]);
  if (!res.ok) throw new Error("โหลดแม่แบบใบเบิกไม่สำเร็จ");
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  await fillRequisitionZip(zip, r);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = requisitionFileName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
