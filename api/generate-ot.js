import ExcelJS from "exceljs";

const TEMPLATE_URL = "https://res.cloudinary.com/dxejx20ra/raw/upload/v1782126968/%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2%E0%B8%9B%E0%B8%81_OT_ggbqbw.xlsx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { profile, records, periodMonth } = req.body;
  try {
    const templateRes = await fetch(TEMPLATE_URL);
    const templateBuffer = await templateRes.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(templateBuffer));
    const ws = wb.worksheets[0];
    const set = (addr, val) => { ws.getCell(addr).value = val; };

    const [py, pm] = (periodMonth || "-").split("-");
    const prevPm = parseInt(pm) - 1 || 12;
    const prevPy = prevPm === 12 ? parseInt(py) - 1 : parseInt(py);
    function fmtDate(d) {
      if (!d) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y,m,dd] = d.split("-");
        return `${dd}/${m}/${parseInt(y)+543}`;
      }
      return d;
    }
    const periodStart = fmtDate(profile.periodStart) || (periodMonth ? `16/${String(prevPm).padStart(2,"0")}/${prevPy+543}` : "");
    const periodEnd   = fmtDate(profile.periodEnd)   || (periodMonth ? `15/${pm}/${parseInt(py)+543}` : "");
    const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const monthName = profile.periodMonth || (pm ? MONTH_TH[parseInt(pm)-1] : "");

    set("A3", `ชื่อพนักงานผู้ขอเบิก .................${profile.nameTH||""}............................................  รหัสพนักงาน ........${profile.empId||""}...............  ตำแหน่ง .......${profile.position||""}..............................  แผนก ..................${profile.dept||""}..........................  ฝ่าย ................${profile.division||""}..............................`);
    set("A4", `การปฏิบัติงาน (ตามรอบวันที่ 16 เดือนก่อนหน้า ถึงวันที่ 15 เดือนปัจจุบัน) ตั้งแต่วันที่ ......................${periodStart}........................................ ถึงวันที่ ...............${periodEnd}........................................ เบิกประจำงวดเดือน ................${monthName}........................................ ปี ................${py?parseInt(py)+543:""}...........................`);

    function fmtDateShort(d) {
      if (!d) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y,m,dd] = d.split("-");
        return `${dd}/${m}/${String(parseInt(y)+543).slice(-2)}`;
      }
      return d;
    }
    const sortedRecords = [...records].sort((a,b) => (a.dateIn||"").localeCompare(b.dateIn||""));
    for (let i = 0; i < 18; i++) {
      const r = sortedRecords[i];
      const row = 9 + i;
      if (r) {
        set(`A${row}`, i+1);
        set(`B${row}`, `${fmtDateShort(r.dateIn)} ${r.timeIn||""}`);
        set(`C${row}`, `${fmtDateShort(r.dateOut||r.dateIn)} ${r.timeOut||""}`);
        set(`D${row}`, r.projectCode||"");
        set(`E${row}`, r.projectName||"");
        set(`F${row}`, r.desc||"");
        set(`G${row}`, r.location||"");
        set(`H${row}`, "PS");
        set(`I${row}`, "PS");
        set(`J${row}`, profile.position||"เจ้าหน้าที่บริการลูกค้า");
        set(`K${row}`, r.hours||0);
        set(`Q${row}`, profile.supervisorOT||profile.supervisor||"");
        set(`R${row}`, profile.staff||"");
        set(`S${row}`, r.remark||"");
      } else {
        ["A","B","C","D","E","F","G","H","I","J","K","L","Q","R","S"].forEach(c=>{ ws.getCell(`${c}${row}`).value = null; });
      }
    }

    const today = new Date();
    const todayTH = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()+543}`;
    set("A33", `( ...........${profile.nameTH||""}............. )`);
    set("F33", `( ${profile.supervisor||""} )`);
    set("A34", `วันที่.............${todayTH}........................................`);
    set("F34", `วันที่.............${todayTH}........................................`);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = encodeURIComponent(`OT_${profile.nameTH||"export"}_${periodMonth||"all"}.xlsx`);
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''${filename}`);
    res.send(Buffer.from(buffer));
  } catch(err) {
    console.error("generate-ot error:", err);
    res.status(500).json({ error: err.message });
  }
}
