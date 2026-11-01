import { google } from 'googleapis';
import { getCars } from './_viggo.js';

const SHEET_ID = '1AvIzJ4mWfsS8I5mov4EpT32aKAaS4aHETMD7oYzT9cI';
const TAB_NAME = 'Weekly สรุป';

// เทียบชื่อคอลัมน์ใน Google Sheet -> โค้ดโปรเจกต์ใน VIGGO (ใส่หลายโค้ดถ้าต้องรวมค่ากัน)
// คอลัมน์ไหนไม่ได้ใส่ไว้ในนี้ ระบบจะข้ามไปเฉยๆ ไม่เขียนทับ
const SHEET_SITE_MAP = {
  'ARL - Ban Thap Chang': ['ARL_BTC'],
  'ARL - Hua Mak': ['ARL_HUM'],
  'ARL - Lat Krabang': ['ARL_LKB'],
  'ARL - Makkasan': ['ARL_MAS_1', 'ARL_MAS_2'],
  'ARL - Phaya Thai': ['ARL_PTH'],
  'ARL - Ramkhamhaeng': ['ARL_RKH'],
  'ARL - Ratchaprarop': ['ARL_RPR'],
  'ARL - Suvarnabhumi': ['ARL_SVB'],
  'DAD_BB_SC80': ['DAD'],
  'PDR_LPN_Prod': ['PDR_LPN_PRD'],
  'PDR_LPN_OPMM': ['PDR_LPN_OPM'],
  'VIBHA_BKK_SC50S': ['VBH_BKK'],
  'KKP_ASOKE': ['KKP_ASOK'],
  'RAM2_SC50S': ['RAM2'],
  'RAV_CHM': ['RAV_CHM'],
  'SCB_East': ['SCB_EAST'],
  'SCB_West': ['SCB_WEST'],
  'SCB_HQ': ['SCB_MID'],
  'THAMC_FL1': ['THAMC_F1'],
  'THAMC_FL2': ['THAMC_F2'],
  'THAMC_FL4': ['THAMC_F4'],
  'THAMC_FL5': ['THAMC_F5'],
  'SP_Srinakarin': ['SP_SNK'],
  'CP MEJI': ['CP-meiji'],
  'SET Northpark1': ['CMA_1'],
  'SET Northpark2': ['CMA_2'],
  'AMATA': ['VBH_AMTA'],
  'VIBHA_LCB': ['VBH_LEAM'],
  'AOTGA_FL.B_East': ['AOTGA_TH_3'],
  'AOTGA_FL.B_West': ['AOTGA_TH_2'],
  'AOTGA_FL.2_West': ['AOTGA_TH_1'],
  'SET RatchadaA': ['SET_1'],
  'SET RatchadaB': ['SET_2'],
  'SET RatchadaC': ['SET_3'],
};

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MAX_SYNC_DAYS = 31; // กันเผลอเลือกช่วงกว้างเกินไปจนยิง request มหาศาล

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return new google.auth.JWT(json.client_email, null, json.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  key = key.replace(/\\n/g, '\n').trim();
  return new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/spreadsheets']);
}

function colIndexToLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseDateRangeHeader(text) {
  const t = (text || '').trim();

  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const startDate = new Date(parseInt(m[3], 10) - 543, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    const endDate = new Date(parseInt(m[6], 10) - 543, parseInt(m[5], 10) - 1, parseInt(m[4], 10));
    return { startDate, endDate };
  }

  m = t.match(/^(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    const endMonth = parseInt(m[3], 10);
    const yearCE = parseInt(m[4], 10) - 543;
    const endDate = new Date(yearCE, endMonth - 1, d2);
    let startMonth = endMonth;
    let startYear = yearCE;
    if (d1 > d2) {
      startMonth -= 1;
      if (startMonth < 1) { startMonth = 12; startYear -= 1; }
    }
    const startDate = new Date(startYear, startMonth - 1, d1);
    return { startDate, endDate };
  }

  return null;
}

function findBlockForDate(rows, targetDate) {
  for (let i = 0; i < rows.length; i++) {
    const parsed = parseDateRangeHeader(rows[i]?.[0]);
    if (!parsed || !(targetDate >= parsed.startDate && targetDate <= parsed.endDate)) continue;
    for (let r = i + 1; r < Math.min(i + 10, rows.length); r++) {
      if ((rows[r]?.[0] || '').trim() === 'จันทร์') {
        return { titleRow: i, headerRow: r - 1, dataStartRow: r };
      }
    }
  }
  return null;
}

// ตารางของสัปดาห์ที่มีวันนั้นอยู่: หัวคอลัมน์ไซต์ตามลำดับในชีต + ค่า 7 วัน (จันทร์→อาทิตย์) + target
// ค่าในชีตอาจมี * / ** นำหน้า (หมายเหตุ) — แยกออกมาเป็น mark
function readWeek(rows, targetDate) {
  const block = findBlockForDate(rows, targetDate);
  if (!block) return { error: 'ไม่พบบล็อกสัปดาห์ที่ตรงกับวันที่นี้ใน Sheet', columns: [] };
  const header = rows[block.headerRow] || [];
  const order = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const dayRows = order.map((name) => {
    for (let r = block.dataStartRow; r < block.dataStartRow + 8; r++) if ((rows[r]?.[0] || '').trim() === name) return r;
    return null;
  });
  const tRow = block.dataStartRow + 7;
  const hasTarget = (rows[tRow]?.[0] || '').trim().toLowerCase() === 'target';
  const parse = (v) => {
    const t = String(v ?? '').trim();
    if (!t) return { value: null, mark: '' };
    const mark = (/^\*+/.exec(t) || [''])[0].slice(0, 2);
    const n = Number(t.replace(/[^0-9.\-]/g, ''));
    return { value: t.replace(/[*\s,]/g, '') === '' || isNaN(n) ? null : Math.round(n), mark };
  };
  const columns = [];
  header.forEach((label, ci) => {
    const name = String(label || '').trim();
    if (!ci || !name) return;
    const cells = dayRows.map((r) => (r === null ? { value: null, mark: '' } : parse(rows[r]?.[ci])));
    if (!cells.some((x) => x.value !== null)) return; // ไซต์ที่ทั้งสัปดาห์ไม่มีตัวเลข ข้าม
    const t = hasTarget ? parse(rows[tRow]?.[ci]).value : null;
    columns.push({ name, cells, target: t && t > 0 ? t : null });
  });
  return { title: String(rows[block.titleRow]?.[0] || '').trim(), columns };
}

function toISO(d) {
  return d.toISOString().split('T')[0];
}

async function fetchViggoDay(dateStr, robotToken) {
  // ใช้ตัวเดียวกับหน้าสถิติ: ครบทุกหน้า + เติมวันที่สรุปค้างเป็น 0 จากงานดิบ
  const { result } = await getCars(robotToken, dateStr, dateStr, { pageSize: 100 });
  const byProject = {};
  result.forEach((r) => {
    byProject[r.project_name] = (byProject[r.project_name] || 0) + (Number(r.actual_clean_area) || 0);
  });
  return byProject;
}

export default async function handler(req, res) {
  const startParam = req.query.start_date || req.query.date || toISO(new Date());
  const endParam = req.query.end_date || startParam;
  const write = req.query.write === 'true';

  const hasBase64Creds = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const hasSplitCreds = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;
  if (!hasBase64Creds && !hasSplitCreds) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า Google credentials บน Vercel (GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 หรือ GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)' });
  }
  const robotToken = process.env.ROBOT_API_TOKEN;
  if (!robotToken) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า ROBOT_API_TOKEN บน Vercel' });
  }

  // โหมดอ่านอย่างเดียว: ตารางทั้งสัปดาห์จากชีต (ไว้ทำสไลด์รายสัปดาห์) — ไม่ต้องใช้ ROBOT_API_TOKEN
  if (req.query.mode === 'week') {
    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth() });
      const readRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB_NAME}'!A1:CZ3000` });
      return res.status(200).json(readWeek(readRes.data.values || [], new Date(startParam + 'T00:00:00')));
    } catch (err) {
      return res.status(500).json({ error: 'อ่าน Google Sheet ไม่สำเร็จ', detail: err.message });
    }
  }

  const startDateObj = new Date(startParam + 'T00:00:00');
  const endDateObj = new Date(endParam + 'T00:00:00');
  if (endDateObj < startDateObj) {
    return res.status(400).json({ error: 'วันที่สิ้นสุดต้องไม่มาก่อนวันที่เริ่ม' });
  }
  const dates = [];
  for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
    dates.push(toISO(d));
  }
  if (dates.length > MAX_SYNC_DAYS) {
    return res.status(400).json({ error: `เลือกช่วงวันที่กว้างเกินไป (สูงสุด ${MAX_SYNC_DAYS} วันต่อครั้ง)` });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const range = `'${TAB_NAME}'!A1:CZ3000`;
    const readRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const rows = readRes.data.values || [];

    const perDate = [];
    const allUpdates = [];
    const skippedColumnsSet = new Set();

    for (const dateStr of dates) {
      const targetDate = new Date(dateStr + 'T00:00:00');
      const block = findBlockForDate(rows, targetDate);
      if (!block) {
        perDate.push({ date: dateStr, error: 'ไม่พบบล็อกสัปดาห์ที่ตรงกับวันที่นี้ใน Sheet' });
        continue;
      }

      const headerRow = rows[block.headerRow] || [];
      const weekdayName = THAI_WEEKDAYS[targetDate.getDay()];
      let dayRowIndex = null;
      for (let r = block.dataStartRow; r < block.dataStartRow + 8; r++) {
        if ((rows[r]?.[0] || '').trim() === weekdayName) { dayRowIndex = r; break; }
      }
      if (dayRowIndex === null) {
        perDate.push({ date: dateStr, error: `หาแถวของวัน "${weekdayName}" ในบล็อกสัปดาห์นี้ไม่เจอ` });
        continue;
      }
      const targetRowIndex = block.dataStartRow + 7;
      const isTargetRow = (rows[targetRowIndex]?.[0] || '').trim().toLowerCase() === 'target';

      const byProject = await fetchViggoDay(dateStr, robotToken);

      const updates = [];
      headerRow.forEach((label, colIdx) => {
        const key = (label || '').trim();
        if (!key) return;
        const codes = SHEET_SITE_MAP[key];
        if (!codes) { skippedColumnsSet.add(key); return; }
        const value = codes.reduce((sum, c) => sum + (byProject[c] || 0), 0);
        const targetVal = isTargetRow ? Number(rows[targetRowIndex]?.[colIdx]) : null;
        const update = {
          date: dateStr,
          column: key,
          cell: `${colIndexToLetter(colIdx)}${dayRowIndex + 1}`,
          currentValue: rows[dayRowIndex]?.[colIdx] ?? '',
          newValue: Math.round(value),
          target: (targetVal !== null && !isNaN(targetVal) && targetVal > 0) ? targetVal : null,
          row: dayRowIndex,
          col: colIdx,
        };
        updates.push(update);
        allUpdates.push(update);
      });

      perDate.push({ date: dateStr, weekday: weekdayName, updates });
    }

    if (!write) {
      return res.status(200).json({
        mode: 'preview',
        startDate: startParam,
        endDate: endParam,
        perDate,
        totalCells: allUpdates.length,
        skippedColumns: Array.from(skippedColumnsSet),
      });
    }

    const data = allUpdates.map((u) => ({
      range: `'${TAB_NAME}'!${u.cell}`,
      values: [[u.newValue]],
    }));
    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      });
    }

    // สีตัวอักษรตาม target: ต่ำกว่า target = แดง · ถึง target = ดำ · คอลัมน์ที่ไม่มี target ไม่แตะสี
    const withTarget = allUpdates.filter((u) => u.target !== null);
    let colored = 0;
    if (withTarget.length > 0) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties(sheetId,title)' });
      const tab = (meta.data.sheets || []).find((x) => x.properties?.title === TAB_NAME);
      if (tab) {
        const RED = { red: 0.85, green: 0.1, blue: 0.1 };
        const BLACK = { red: 0, green: 0, blue: 0 };
        const requests = withTarget.map((u) => ({
          repeatCell: {
            range: { sheetId: tab.properties.sheetId, startRowIndex: u.row, endRowIndex: u.row + 1, startColumnIndex: u.col, endColumnIndex: u.col + 1 },
            cell: { userEnteredFormat: { textFormat: { foregroundColorStyle: { rgbColor: u.newValue < u.target ? RED : BLACK } } } },
            fields: 'userEnteredFormat.textFormat.foregroundColorStyle',
          },
        }));
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
        colored = withTarget.filter((u) => u.newValue < u.target).length;
      }
    }

    res.status(200).json({
      mode: 'written',
      startDate: startParam,
      endDate: endParam,
      updated: allUpdates.length,
      belowTarget: colored,
      perDate,
    });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด', detail: err.message });
  }
}
