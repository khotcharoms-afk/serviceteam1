import { google } from 'googleapis';

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
};

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return new google.auth.JWT(json.client_email, null, json.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  }
  // fallback: ใช้ค่าที่แยกเป็น 2 ตัวแปร (เผื่อยังไม่ได้ตั้งค่าแบบ base64)
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

  // รูปแบบใหม่: "DD/MM/YYYY-DD/MM/YYYY" เช่น "31/8/2569-6/9/2569"
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const startDate = new Date(parseInt(m[3], 10) - 543, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    const endDate = new Date(parseInt(m[6], 10) - 543, parseInt(m[5], 10) - 1, parseInt(m[4], 10));
    return { startDate, endDate };
  }

  // รูปแบบเก่า: "D1-D2/MM/YYYY" เช่น "15-21/09/2568" หรือ "27-2/10/2568" (ข้ามเดือน)
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

export default async function handler(req, res) {
  const dateParam = req.query.date || new Date().toISOString().split('T')[0];
  const write = req.query.write === 'true'; // ต้องระบุ write=true ชัดเจนถึงจะเขียนจริง — ค่าเริ่มต้นคือแค่พรีวิว

  const hasBase64Creds = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const hasSplitCreds = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;
  if (!hasBase64Creds && !hasSplitCreds) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า Google credentials บน Vercel (GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 หรือ GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)' });
  }
  const robotToken = process.env.ROBOT_API_TOKEN;
  if (!robotToken) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า ROBOT_API_TOKEN บน Vercel' });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1) อ่านข้อมูลทั้งชีตที่เกี่ยวข้อง
    const range = `'${TAB_NAME}'!A1:AH2000`;
    const readRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const rows = readRes.data.values || [];

    // 2) หาบล็อกสัปดาห์ที่ตรงกับวันที่เป้าหมาย
    const targetDate = new Date(dateParam + 'T00:00:00');
    let block = null;
    for (let i = 0; i < rows.length; i++) {
      const parsed = parseDateRangeHeader(rows[i]?.[0]);
      if (!parsed || !(targetDate >= parsed.startDate && targetDate <= parsed.endDate)) continue;
      // หาแถว "จันทร์" ที่อยู่ถัดจากแถวหัวข้อนี้ — แล้วถือว่าแถวก่อนหน้ามันคือแถวหัวตาราง (ชื่อไซต์)
      // วิธีนี้ทนทานต่อกรณีมีแถวแทรก (เช่น แถวบอกรุ่นรถ) ระหว่างแถวหัวข้อกับแถวข้อมูล
      for (let r = i + 1; r < Math.min(i + 10, rows.length); r++) {
        if ((rows[r]?.[0] || '').trim() === 'จันทร์') {
          block = { titleRow: i, headerRow: r - 1, dataStartRow: r };
          break;
        }
      }
      if (block) break;
    }
    if (!block) {
      return res.status(404).json({ error: `ไม่พบบล็อกสัปดาห์ที่ตรงกับวันที่ ${dateParam} ใน Sheet (อาจจะยังไม่ได้สร้างบล็อกของสัปดาห์นี้ไว้)` });
    }

    const headerRow = rows[block.headerRow] || [];
    const weekdayName = THAI_WEEKDAYS[targetDate.getDay()];
    let targetRowIndex = null;
    for (let r = block.dataStartRow; r < block.dataStartRow + 8; r++) {
      if ((rows[r]?.[0] || '').trim() === weekdayName) { targetRowIndex = r; break; }
    }
    if (targetRowIndex === null) {
      return res.status(404).json({ error: `หาแถวของวัน "${weekdayName}" ในบล็อกสัปดาห์นี้ไม่เจอ` });
    }

    // 3) ดึงข้อมูลจริงจาก VIGGO สำหรับวันที่เป้าหมาย
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('size', '100');
    params.append('start_time', dateParam);
    params.append('end_time', dateParam);
    const viggoUrl = `https://wolfsburg.phpserver.idriverplus.com/basic/web/index.php/wv/statistics/cars-list?access-token=${robotToken}`;
    const viggoRes = await fetch(viggoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const viggoData = await viggoRes.json();
    const byProject = {};
    (viggoData.result || []).forEach((r) => {
      byProject[r.project_name] = (byProject[r.project_name] || 0) + (Number(r.actual_clean_area) || 0);
    });

    // 4) จับคู่หัวคอลัมน์กับไซต์ที่รู้จัก เตรียมค่าที่จะเขียน
    const updates = [];
    const skippedColumns = [];
    headerRow.forEach((label, colIdx) => {
      const key = (label || '').trim();
      if (!key) return;
      const codes = SHEET_SITE_MAP[key];
      if (!codes) { skippedColumns.push(key); return; }
      const value = codes.reduce((sum, c) => sum + (byProject[c] || 0), 0);
      updates.push({
        column: key,
        cell: `${colIndexToLetter(colIdx)}${targetRowIndex + 1}`,
        currentValue: rows[targetRowIndex]?.[colIdx] ?? '',
        newValue: Math.round(value),
      });
    });

    if (!write) {
      return res.status(200).json({ mode: 'preview', date: dateParam, weekday: weekdayName, updates, skippedColumns });
    }

    // 5) เขียนจริง
    const data = updates.map((u) => ({
      range: `'${TAB_NAME}'!${u.cell}`,
      values: [[u.newValue]],
    }));
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    res.status(200).json({ mode: 'written', date: dateParam, weekday: weekdayName, updated: updates.length, updates });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด', detail: err.message });
  }
}
