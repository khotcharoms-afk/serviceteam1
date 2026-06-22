import JSZip from "jszip";
const TEMPLATE_URL = "https://res.cloudinary.com/dxejx20ra/raw/upload/v1782130242/OR_with_placeholders_tczf7z.docx";

// Fallback: ถ้าไม่มี Cloudinary ใช้ local template
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function replacePlaceholders(xml, data) {
  let result = xml;
  for (const [key, val] of Object.entries(data)) {
    // placeholder อาจถูก split ใน XML runs ด้วย — ใช้ global replace
    result = result.split(`{{${key}}}`).join(escapeXml(val));
  }
  return result;
}

const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmtDateTH(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTH_TH[parseInt(m)-1]} ${parseInt(y)+543}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { record, profile } = req.body;
  // record: { dateIn, timeIn, timeOut, projectName, location, status, desc, orNumber, sessionNo, serviceId }
  // profile: { name, supervisor }

  try {
    // โหลด template
    let templateBuffer;
    try {
      const templateRes = await fetch(TEMPLATE_URL);
      if (!templateRes.ok) throw new Error("Cloudinary fetch failed");
      templateBuffer = Buffer.from(await templateRes.arrayBuffer());
    } catch {
      // fallback: ถ้า Cloudinary ไม่ได้ใช้ไฟล์ใน project (ต้องวางไว้ใน public/)
      throw new Error("ไม่สามารถโหลด template ได้ กรุณาตรวจสอบ Cloudinary");
    }

    // unzip docx
    const zip = await JSZip.loadAsync(templateBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) throw new Error("word/document.xml not found in template");
    let docXml = await docXmlFile.async("string");

    // inject data
    const data = {
      orNumber:      record.orNumber || "",
      date:          fmtDateTH(record.dateIn),
      sessionNo:     record.sessionNo || "",
      projectName:   record.projectName || "",
      location:      record.location || "",
      timeIn:        record.timeIn || "",
      timeOut:       record.timeOut || "",
      description:   record.desc || "",
      employeeName:  profile.name || "",
      supervisorName: profile.supervisor || "",
      signature:     "",
    };

    docXml = replacePlaceholders(docXml, data);
    zip.file("word/document.xml", docXml);

    const outBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const filename = encodeURIComponent(`OR_${record.orNumber || "export"}_${record.dateIn || "date"}.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send(outBuffer);

  } catch (err) {
    console.error("generate-or error:", err);
    res.status(500).json({ error: err.message });
  }
}
