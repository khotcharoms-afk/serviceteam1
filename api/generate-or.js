import JSZip from "jszip";
import { OR_TEMPLATE_B64 } from "./_orTemplate.js";

// ใบ OR (.docx) — 1 รายการ = 1 หน้า A4, layout จาก OR_sayan.docx
// ค่าทั้งหมดอ่านจาก record ที่บันทึกไว้ (ไม่คำนวณค่าเริ่มต้นใหม่ตอน export)

const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const DOTS = "...............";

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ค่าว่าง / "undefined" / "null" / "-" → ""
export function clean(v) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (!s || s === "undefined" || s === "null" || s === "-") return "";
  return s;
}

export function fmtDateTH(dateStr) {
  const s = clean(dateStr);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${parseInt(m[3])} ${MONTH_TH[parseInt(m[2]) - 1]} ${parseInt(m[1]) + 543}`;
}

// "13:00" → "13.00"
export function fmtTime(t) {
  const s = clean(t);
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : s;
}

// ตัด "โครงการ :" / "โครงการ " ข้างหน้า และรวมช่องว่างซ้อน
export function cleanProjectName(name) {
  return clean(name).replace(/^โครงการ\s*:?\s*/, "").replace(/\s+/g, " ").trim();
}

// "รวมถึง SAT-1" → non-breaking space + non-breaking hyphen
// + zero-width space ระหว่างคำไทย ให้ Word ตัดบรรทัดตรงขอบคำ (ไม่ตัดกลางคำ)
// + ไม่แตกบรรทัดในช่วง 2 คำสุดท้าย (กันคำเดียวตกบรรทัด)
function protectText(s) {
  s = s.replace(/รวมถึง SAT-1/g, "รวมถึง SAT‑1");
  let segs;
  try { segs = [...new Intl.Segmenter("th", { granularity: "word" }).segment(s)].map(x => x.segment); }
  catch { return s; }
  const endsThai = t => /[฀-๿]$/.test(t);
  const startsThai = t => /^[฀-๿]/.test(t);
  // ช่วงท้ายอย่างน้อย ~15 ตัวอักษร / 2 คำ ห้ามแตกบรรทัด
  let noBreakFrom = segs.length, tailLen = 0, tailWords = 0;
  while (noBreakFrom > 0 && (tailLen < 15 || tailWords < 2)) {
    const t = segs[--noBreakFrom];
    tailLen += t.length;
    if (/[\u0E00-\u0E7FA-Za-z0-9]{2,}/.test(t)) tailWords++;
  }
  let out = "";
  segs.forEach((t, i) => {
    if (i > 0 && i < noBreakFrom && endsThai(segs[i - 1]) && startsThai(t)) out += "​";
    if (i >= noBreakFrom && t === " ") t = " ";
    out += t;
  });
  return out;
}

function buildData(r, profile) {
  return {
    serviceId: clean(r.serviceId),
    sidLead:   clean(r.serviceId) ? "....." : "",
    date:      fmtDateTH(r.dateIn),
    count:     clean(r.count),
    cntLead:   clean(r.count) ? "....." : "",
    project:   clean(r.orProjectName) || cleanProjectName(r.projectName),
    location:  clean(r.location),
    // สถานะ: เว้นช่องว่างทั้ง 2 ช่องเสมอ (ไม่ติ๊ก)
    sitC:      "☐",
    sitS:      "☐",
    timeIn:    fmtTime(r.timeIn),
    timeOut:   fmtTime(r.timeOut),
    desc:      protectText(clean(r.desc).replace(/\s*\n\s*/g, " ")),
    name:      clean(profile?.nameTH) || clean(r.name) || DOTS,
    examiner:  clean(r.examiner) || DOTS,
  };
}

function fill(xml, data) {
  return xml.replace(/\{\{(\w+)\}\}/g, (_, k) => escapeXml(data[k] ?? ""));
}

// PNG size from IHDR
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const EMU_PT = 12700;
const SIG_H = 36 * EMU_PT;      // สูง 36pt
const SIG_MAX_W = 130 * EMU_PT;

function parseSignatures(list) {
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    const src = typeof s === "string" ? s : s?.data;
    const m = String(src || "").match(/^data:image\/png;base64,(.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1], "base64");
    const sz = pngSize(buf);
    if (!sz || !sz.w || !sz.h) continue;
    let cx = Math.round(SIG_H * sz.w / sz.h), cy = SIG_H;
    if (cx > SIG_MAX_W) { cy = Math.round(cy * SIG_MAX_W / cx); cx = SIG_MAX_W; }
    out.push({ buf, cx, cy });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { record, records, profile = {} } = req.body || {};
  const all = (records || (record ? [record] : [])).slice()
    .sort((a, b) => `${a.dateIn || ""} ${a.timeIn || ""}`.localeCompare(`${b.dateIn || ""} ${b.timeIn || ""}`));
  if (!all.length) return res.status(400).json({ error: "No records" });

  try {
    const zip = await JSZip.loadAsync(Buffer.from(OR_TEMPLATE_B64, "base64"));
    const docXml = await zip.file("word/document.xml").async("string");
    const bodyStart = docXml.indexOf("<w:body>") + "<w:body>".length;
    const sectIdx = docXml.lastIndexOf("<w:sectPr");
    const pageTpl = docXml.slice(bodyStart, sectIdx);
    const tail = docXml.slice(sectIdx);

    // signatures → media + rels
    const sigs = parseSignatures(profile.signatures);
    let rels = await zip.file("word/_rels/document.xml.rels").async("string");
    let relAdd = "";
    sigs.forEach((s, i) => {
      zip.file(`word/media/orsig${i + 1}.png`, s.buf);
      relAdd += `<Relationship Id="rIdOrSig${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/orsig${i + 1}.png"/>`;
    });
    rels = rels.replace("</Relationships>", relAdd + "</Relationships>");
    zip.file("word/_rels/document.xml.rels", rels);

    let docPrId = 1000;
    const pages = all.map((r, i) => {
      let x = fill(pageTpl, buildData(r, profile));
      if (sigs.length) {
        const s = sigs[i % sigs.length];
        x = x.replace('r:embed="rIdSIGX"', `r:embed="rIdOrSig${(i % sigs.length) + 1}"`)
             .replace(/(<wp:extent cx=")\d+(" cy=")\d+("\/><wp:effectExtent[^>]*\/><wp:wrapNone\/><wp:docPr id="\d+" name="OR_SIGNATURE")/,
                      `$1${s.cx}$2${s.cy}$3`)
             .replace(/(name="OR_SIGNATURE"[\s\S]*?<a:ext cx=")\d+(" cy=")\d+/, `$1${s.cx}$2${s.cy}`);
      }
      // unique drawing ids per page
      x = x.replace(/(<wp:docPr id=")\d+/g, (_, p) => p + (++docPrId))
           .replace(/(<pic:cNvPr id=")\d+/g, (_, p) => p + docPrId);
      // page break before every page except the first (no empty paragraph at page top)
      if (i > 0) x = x.replace(/<w:p\b([^>]*)><w:pPr>/, "<w:p$1><w:pPr><w:pageBreakBefore/>");
      // tiny paragraph after the table (Word needs one; keeps last page from spilling)
      return x + `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
    });

    const out = docXml.slice(0, bodyStart) + pages.join("") + tail;
    zip.file("word/document.xml", out);
    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const who = clean(profile.nameTH) || clean(profile.name) || "export";
    const filename = encodeURIComponent(`OR_${who}_${all[0].dateIn || "date"}.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send(buf);
  } catch (err) {
    console.error("generate-or error:", err);
    res.status(500).json({ error: err.message });
  }
}
