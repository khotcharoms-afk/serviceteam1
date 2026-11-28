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
  'Cloud11': ['CLOUD11'],
};
// จับคู่หัวคอลัมน์แบบไม่สนตัวพิมพ์เล็ก/ใหญ่ ช่องว่าง _ - . (เช่น "CLOUD 11" = "Cloud11")
const normKey = (x) => String(x || '').toLowerCase().replace(/[\s_.\-]/g, '');
const SITE_MAP_NORM = Object.fromEntries(Object.entries(SHEET_SITE_MAP).map(([k, v]) => [normKey(k), v]));

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
  // แถว Target: หาในช่วงใต้แถววัน เผื่อชื่อเขียนต่างกันเล็กน้อย เช่น "TARGET", "Target (ตร.ม.)", "เป้าหมาย"
  let tRow = -1;
  for (let r = block.dataStartRow + 7; r < block.dataStartRow + 10; r++) {
    if (/^(target|เป้า)/i.test((rows[r]?.[0] || '').trim())) { tRow = r; break; }
  }
  const hasTarget = tRow >= 0;
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

// ── สร้างตารางสัปดาห์ใหม่อัตโนมัติ ─────────────────────────────────────
// ถ้าวันที่ที่จะเขียนเลยตารางสัปดาห์ล่าสุดในชีตไปแล้ว ระบบจะคัดลอกตารางสัปดาห์ล่าสุด
// (หัวคอลัมน์ไซต์ แถววัน แถว Target สูตร และรูปแบบ) ไปวางเป็นสัปดาห์ใหม่ เปลี่ยนหัวข้อเป็นช่วงวันที่ใหม่
// และล้างตัวเลขในแถววัน (ช่องที่เป็นสูตรไม่แตะ) — วางต่อท้ายหรือแทรกด้านบน ตามที่ชีตเรียงอยู่
const MAX_NEW_WEEKS = 8;
const DAY_NAMES_ORDER = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

// ล้างเฉพาะช่องตัวเลขที่พิมพ์ไว้ — ข้อความ (ชื่อวัน หัวตาราง Site/Target) และสูตรเก็บไว้ตามต้นแบบ
function isClearableCell(f) {
  if (f === undefined || f === null || f === '') return false;
  if (typeof f === 'number') return true;
  const t = String(f).trim();
  if (t.startsWith('=')) return false;
  return /^-?[\d,]+(\.\d+)?%?$/.test(t);
}

function listBlocks(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = parseDateRangeHeader(rows[i]?.[0]);
    if (!parsed) continue;
    for (let r = i + 1; r < Math.min(i + 10, rows.length); r++) {
      if ((rows[r]?.[0] || '').trim() === 'จันทร์') {
        out.push({ titleRow: i, headerRow: r - 1, dataStartRow: r, start: parsed.startDate, end: parsed.endDate });
        break;
      }
    }
  }
  return out;
}

const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDaysD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function makeTitle(sample, start, end) {
  const pad = /(^|[^\d])0\d\//.test(sample) ? (n) => String(n).padStart(2, '0') : (n) => String(n);
  const be = (d) => d.getFullYear() + 543;
  if (/^\d{1,2}-\d{1,2}\/\d{1,2}\/\d{4}$/.test(sample.trim())) {
    return `${pad(start.getDate())}-${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${be(end)}`;
  }
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${be(start)}-${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${be(end)}`;
}

// วางแผนสร้างสัปดาห์ที่ขาด (ไม่แตะชีต) — คืน null ถ้าไม่ต้องสร้าง
function planNewWeeks(rows, dates) {
  const blocks = listBlocks(rows);
  if (!blocks.length) return { error: 'ไม่พบตารางสัปดาห์ต้นแบบในชีต (ต้องมีอย่างน้อย 1 ตาราง)' };
  const newest = blocks.reduce((a, b) => (b.start > a.start ? b : a));
  const lastDate = dates.map((d) => new Date(d + 'T00:00:00')).reduce((a, b) => (b > a ? b : a));
  if (lastDate <= newest.end) return null;
  const weeks = [];
  for (let m = mondayOf(addDaysD(newest.end, 1)); m <= lastDate; m = addDaysD(m, 7)) {
    weeks.push({ start: m, end: addDaysD(m, 6) });
  }
  if (weeks.length > MAX_NEW_WEEKS) return { error: `ต้องสร้างตารางใหม่ ${weeks.length} สัปดาห์ เกินกว่าที่ตั้งไว้ (${MAX_NEW_WEEKS}) — ตรวจวันที่อีกครั้ง` };
  // ชีตเรียงสัปดาห์ใหม่ไว้ล่าง หรือไว้บน
  const byRow = [...blocks].sort((a, b) => a.titleRow - b.titleRow);
  const appendBottom = blocks.length < 2 || byRow[byRow.length - 1] === newest;
  let span;
  if (blocks.length >= 2) {
    const idx = byRow.indexOf(newest);
    const neighbor = appendBottom ? byRow[idx - 1] : byRow[idx + 1];
    span = Math.abs(newest.titleRow - neighbor.titleRow);
  } else {
    let last = newest.dataStartRow + 7;
    for (let r = newest.dataStartRow + 7; r < newest.dataStartRow + 10; r++) if ((rows[r] || []).some((v) => String(v ?? '').trim())) last = r;
    span = last - newest.titleRow + 2;
  }
  const titleSample = String(rows[newest.titleRow]?.[0] || '');
  return {
    newest, span, appendBottom,
    weeks: weeks.map((w) => ({ ...w, title: makeTitle(titleSample, w.start, w.end) })),
  };
}

// จำลองผลหลังสร้าง (ใช้ตอนดูตัวอย่าง ไม่เขียนชีต)
function simulateNewWeeks(rows, plan, formulaRows) {
  const { newest, span, appendBottom, weeks } = plan;
  const tpl = [];
  for (let i = 0; i < span; i++) tpl.push([...(rows[newest.titleRow + i] || [])]);
  const makeBlock = (title) => tpl.map((row, i) => {
    const r = [...row];
    if (i === 0) r[0] = title;
    const dayIdx = newest.dataStartRow - newest.titleRow;
    if (i >= dayIdx && i < dayIdx + 7) for (let c = 1; c < r.length; c++) {
      if (isClearableCell(formulaRows?.[i]?.[c])) r[c] = '';
    }
    return r;
  });
  let out = rows.map((r) => [...(r || [])]);
  if (appendBottom) {
    weeks.forEach((w, k) => {
      const dest = newest.titleRow + span * (k + 1);
      while (out.length < dest) out.push([]);
      makeBlock(w.title).forEach((r, i) => { out[dest + i] = r; });
    });
  } else {
    weeks.forEach((w) => { out = [...out.slice(0, newest.titleRow), ...makeBlock(w.title), ...out.slice(newest.titleRow)]; });
  }
  return out;
}

// สร้างจริงในชีต
async function createNewWeeks(sheets, plan, formulaRows) {
  const { newest, span, appendBottom, weeks } = plan;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties(sheetId,title,gridProperties)' });
  const tab = (meta.data.sheets || []).find((x) => x.properties?.title === TAB_NAME);
  if (!tab) throw new Error(`ไม่พบแท็บ ${TAB_NAME}`);
  const sheetId = tab.properties.sheetId;
  const colCount = tab.properties.gridProperties.columnCount;
  let rowCount = tab.properties.gridProperties.rowCount;
  const dayOffset = newest.dataStartRow - newest.titleRow;
  const titleCells = [];
  const clearRanges = [];
  const requests = [];

  weeks.forEach((w, k) => {
    let dest, src;
    if (appendBottom) {
      src = newest.titleRow;
      dest = newest.titleRow + span * (k + 1);
      if (dest + span > rowCount) {
        requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: dest + span - rowCount } });
        rowCount = dest + span;
      }
    } else {
      // แทรกแถวว่างเหนือสัปดาห์ล่าสุด แล้วคัดลอกสัปดาห์ล่าสุด (ซึ่งถูกดันลงไป span แถว) ขึ้นมา
      dest = newest.titleRow;
      src = newest.titleRow + span;
      requests.push({ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: dest, endIndex: dest + span }, inheritFromBefore: false } });
    }
    requests.push({ copyPaste: {
      source: { sheetId, startRowIndex: src, endRowIndex: src + span, startColumnIndex: 0, endColumnIndex: colCount },
      destination: { sheetId, startRowIndex: dest, endRowIndex: dest + span, startColumnIndex: 0, endColumnIndex: colCount },
      pasteType: 'PASTE_NORMAL',
    } });
    // ตำแหน่งสุดท้ายของสัปดาห์นี้ (กรณีแทรกด้านบน สัปดาห์ที่ใส่ทีหลังจะดันสัปดาห์ก่อนหน้าลงไป)
    const finalRow = appendBottom ? dest : newest.titleRow + span * (weeks.length - 1 - k);
    titleCells.push({ row: finalRow, title: w.title });
    // ล้างตัวเลขในแถววัน (เฉพาะช่องที่ไม่ใช่สูตร)
    for (let d = 0; d < 7; d++) {
      const fr = formulaRows?.[dayOffset + d] || [];
      for (let c = 1; c < colCount; c++) {
        if (!isClearableCell(fr[c])) continue;
        clearRanges.push({ row: finalRow + dayOffset + d, col: c });
      }
    }
  });

  // ทำทีละสัปดาห์ตามลำดับ (กรณีแทรกด้านบน ตำแหน่งต้องคำนวณต่อจากรอบก่อน)
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
  const data = titleCells.map((t) => ({ range: `'${TAB_NAME}'!A${t.row + 1}`, values: [[t.title]] }));
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { valueInputOption: 'USER_ENTERED', data } });
  // รวมช่องที่ต้องล้างเป็นช่วงต่อเนื่องในแต่ละแถว
  const byRow = {};
  clearRanges.forEach(({ row, col }) => { (byRow[row] = byRow[row] || []).push(col); });
  const ranges = [];
  Object.entries(byRow).forEach(([row, cols]) => {
    cols.sort((a, b) => a - b);
    let s0 = cols[0], prev = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      if (i < cols.length && cols[i] === prev + 1) { prev = cols[i]; continue; }
      ranges.push(`'${TAB_NAME}'!${colIndexToLetter(s0)}${+row + 1}:${colIndexToLetter(prev)}${+row + 1}`);
      if (i < cols.length) { s0 = cols[i]; prev = cols[i]; }
    }
  });
  if (ranges.length) await sheets.spreadsheets.values.batchClear({ spreadsheetId: SHEET_ID, requestBody: { ranges } });
  return weeks.map((w) => w.title);
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
  // ตรวจโครงตาราง (อ่านอย่างเดียว): ค่าและสูตรของคอลัมน์ A–C ในช่วงแถว
  if (req.query.mode === 'inspect') {
    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth() });
      const from = Math.max(1, parseInt(req.query.from, 10) || 1);
      const to = Math.min(from + 80, parseInt(req.query.to, 10) || from + 40);
      const rng = `'${TAB_NAME}'!A${from}:${req.query.cols || 'C'}${to}`;
      const [v, f] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng }),
        sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: rng, valueRenderOption: 'FORMULA' }),
      ]);
      const all = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB_NAME}'!A1:CZ3000` });
      const hits = [];
      (all.data.values || []).forEach((r, i) => r.forEach((x, c) => { if (/(30\/11|\/12\/2569)/.test(String(x))) hits.push([i + 1, colIndexToLetter(c), x]); }));
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties(title,gridProperties)' });
      const titles = (all.data.values || []).map((r, i) => [i + 1, r[0]]).filter(([, t]) => parseDateRangeHeader(t));
      return res.status(200).json({ from, values: v.data.values || [], formulas: f.data.values || [], titles: titles.filter(([, t]) => /\/1[12]\/2569/.test(t)), nonEmptyAfter: (all.data.values || []).length, hits: hits.slice(0, 40), tabs: (meta.data.sheets || []).map((x) => [x.properties.title, x.properties.gridProperties.rowCount]) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
    let rows = readRes.data.values || [];

    // สัปดาห์ที่ยังไม่มีตาราง → สร้างใหม่จากตารางสัปดาห์ล่าสุด
    let createdWeeks = [];
    const plan = planNewWeeks(rows, dates);
    if (plan?.error) return res.status(400).json({ error: plan.error });
    if (plan) {
      const tplRange = `'${TAB_NAME}'!A${plan.newest.titleRow + 1}:CZ${plan.newest.titleRow + plan.span}`;
      const fr = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tplRange, valueRenderOption: 'FORMULA' });
      const formulaRows = fr.data.values || [];
      createdWeeks = plan.weeks.map((w) => w.title);
      if (write) {
        await createNewWeeks(sheets, plan, formulaRows);
        const again = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
        rows = again.data.values || [];
      } else {
        rows = simulateNewWeeks(rows, plan, formulaRows);
      }
    }

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
        const codes = SHEET_SITE_MAP[key] || SITE_MAP_NORM[normKey(key)];
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
        createdWeeks,
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
      createdWeeks,
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
