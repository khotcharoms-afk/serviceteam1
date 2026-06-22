import ExcelJS from "exceljs";

const TEMPLATE_URL = "https://res.cloudinary.com/dxejx20ra/raw/upload/v1782153083/OT_template_clean_ojzym2.xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { profile, records, periodMonth } = req.body;
  try {
    const templateRes = await fetch(TEMPLATE_URL);
    const templateBuffer = await templateRes.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(templateBuffer));
    if (!wb.worksheets || wb.worksheets.length === 0) {
      throw new Error("No worksheets found in template");
    }
    const ws = wb.worksheets[0];
    console.log("ws name:", ws?.name, "worksheets:", wb.worksheets.length);
    const set = (addr, val) => { ws.getCell(addr).value = val; };

    const [py, pm] = (periodMonth || "-").split("-");
    const prevPm = parseInt(pm) - 1 || 12;
    const prevPy = prevPm === 12 ? parseInt(py) - 1 : parseInt(py);
    const periodStart = periodMonth ? `16/${String(prevPm).padStart(2,"0")}/${prevPy+543}` : "";
    const periodEnd   = periodMonth ? `15/${pm}/${parseInt(py)+543}` : "";
    const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const monthName = pm ? MONTH_TH[parseInt(pm)-1] : "";

    set("A3", `ชื่อพนักงานผู้ขอเบิก .................${profile.name||""}............................................  รหัสพนักงาน ........${profile.empId||""}...............  ตำแหน่ง .......${profile.position||""}..............................  แผนก ..................${profile.dept||""}..........................  ฝ่าย ................${profile.division||""}..............................`);
    set("A4", `การปฏิบัติงาน (ตามรอบวันที่ 16 เดือนก่อนหน้า ถึงวันที่ 15 เดือนปัจจุบัน) ตั้งแต่วันที่ ......................${periodStart}........................................ ถึงวันที่ ...............${periodEnd}........................................ เบิกประจำงวดเดือน ................${monthName}........................................ ปี ................${py?parseInt(py)+543:""}...........................`);

    for (let i = 0; i < 18; i++) {
      const r = records[i];
      const row = 9 + i;
      if (r) {
        set(`A${row}`, i+1);
        set(`B${row}`, `${r.dateIn||""} ${r.timeIn||""}`);
        set(`C${row}`, `${r.dateOut||r.dateIn||""} ${r.timeOut||""}`);
        set(`D${row}`, r.projectCode||"");
        set(`E${row}`, r.projectName||"");
        set(`F${row}`, r.desc||"");
        set(`G${row}`, r.location||"");
        set(`H${row}`, "PS");
        set(`I${row}`, "PS");
        set(`J${row}`, profile.position||"เจ้าหน้าที่บริการลูกค้า");
        set(`K${row}`, r.hours||0);
        set(`Q${row}`, profile.supervisor||"");
        set(`R${row}`, profile.staff||"");
        set(`S${row}`, r.remark||"");
      } else {
        ["A","B","C","D","E","F","G","H","I","J","K","L","Q","R","S"].forEach(c=>{ ws.getCell(`${c}${row}`).value = null; });
      }
    }

    const today = new Date();
    const todayTH = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()+543}`;
    set("A33", `( ...........${profile.name||""}............. )`);
    set("F33", `( ${profile.supervisor||""} )`);
    set("A34", `วันที่.............${todayTH}........................................`);
    set("F34", `วันที่.............${todayTH}........................................`);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = encodeURIComponent(`OT_${profile.name||"export"}_${periodMonth||"all"}.xlsx`);
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''${filename}`);
    res.send(Buffer.from(buffer));
  } catch(err) {
    console.error("generate-ot error:", err);
    res.status(500).json({ error: err.message });
  }
}
