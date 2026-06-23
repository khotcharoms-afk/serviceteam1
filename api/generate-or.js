import JSZip from "jszip";

const TEMPLATE_URL = "https://res.cloudinary.com/dxejx20ra/raw/upload/v1782150809/OR_v3_template_tt54kf.docx";

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
    const escaped = escapeXml(val);
    const parts = `{{${key}}}`.split("").map(c =>
      c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const pattern = new RegExp(parts.join("(?:<[^>]*>)*"), "g");
    result = result.replace(pattern, escaped);
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

function buildData(record, profile) {
  return {
    date:           fmtDateTH(record.dateIn),
    projectName:    record.projectName || "",
    location:       record.location || "",
    timeIn:         record.timeIn || "",
    timeOut:        record.timeOut || "",
    description:    record.desc || "",
    employeeName:   record.name || profile.name || "",
    supervisorName: record.examiner || profile.supervisor || "",
  };
}

// Extract body content between <w:body> tags
function extractBody(xml) {
  const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  return bodyMatch ? bodyMatch[1] : "";
}

// Page break XML
const PAGE_BREAK = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { record, records, profile } = req.body;

  // Support both single record and multiple records
  const allRecords = records || (record ? [record] : []);
  if (allRecords.length === 0) return res.status(400).json({ error: "No records" });

  try {
    const templateRes = await fetch(TEMPLATE_URL);
    if (!templateRes.ok) throw new Error("Cloudinary fetch failed");
    const templateBuffer = Buffer.from(await templateRes.arrayBuffer());

    if (allRecords.length === 1) {
      // Single record — original behavior
      const zip = await JSZip.loadAsync(templateBuffer);
      const docXmlFile = zip.file("word/document.xml");
      let docXml = await docXmlFile.async("string");
      docXml = replacePlaceholders(docXml, buildData(allRecords[0], profile));
      zip.file("word/document.xml", docXml);
      const outBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const filename = encodeURIComponent(`OR_${allRecords[0].dateIn || "date"}.docx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      return res.send(outBuffer);
    }

    // Multiple records — merge into one document with page breaks
    const zip = await JSZip.loadAsync(templateBuffer);
    const docXmlFile = zip.file("word/document.xml");
    const templateXml = await docXmlFile.async("string");

    // Get body of each record
    const bodies = allRecords.map(r => {
      const injected = replacePlaceholders(templateXml, buildData(r, profile));
      return extractBody(injected);
    });

    // Build merged body: page1 + pagebreak + page2 + ...
    const mergedBody = bodies.join(PAGE_BREAK);

    // Replace body in template
    const mergedXml = templateXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${mergedBody}</w:body>`
    );

    zip.file("word/document.xml", mergedXml);
    const outBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = encodeURIComponent(`OR_${profile.name||"export"}_all.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.send(outBuffer);

  } catch (err) {
    console.error("generate-or error:", err);
    res.status(500).json({ error: err.message });
  }
}
