// สถิติหุ่นยนต์รายคันจาก VIGGO
// 1) ดึงสรุปรายคัน (cars-list) ให้ครบทุกหน้า
// 2) VIGGO ไม่คำนวณสรุปใหม่เมื่อหุ่นส่งข้อมูลย้อนหลังมาทีหลัง (เช่นเน็ตหน้างานล่มแล้วกลับมา)
//    สรุปของวันนั้นจึงค้างเป็น 0 ทั้งที่เว็บ VIGGO มีงานแล้ว
//    → คันที่สรุปเป็น 0 ให้เติมจากข้อมูลงานดิบ (multi-original-download) ของช่วงเดียวกัน
export const BASE = 'https://wolfsburg.phpserver.idriverplus.com/basic/web/index.php/wv/statistics';
const MAX_PAGES = 10;

async function fetchSummaryPage(token, start_time, end_time, page, size) {
  const params = new URLSearchParams({ page: String(page), size: String(size), start_time, end_time });
  const upstream = await fetch(`${BASE}/cars-list?access-token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); }
  catch {
    const e = new Error(`API ต้นทางตอบกลับผิดรูปแบบ (HTTP ${upstream.status})`);
    e.detail = text.slice(0, 300); e.status = 502; throw e;
  }
  if (data.err_no !== 200) {
    const msg = data.err_msg || data.msg || data.message || data.error || '';
    const e = new Error(`API ต้นทางตอบ error (err_no ${data.err_no ?? '-'}${msg ? `: ${msg}` : ''})`);
    e.detail = data; e.status = 502; throw e;
  }
  return data;
}

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const pick = (row, re) => { const k = Object.keys(row).find((h) => re.test(h)); return k ? row[k] : ''; };

// งานดิบ → { vin: { task_num, actual_clean_area, total_time } }
async function fetchRawByVin(token, start_time, end_time) {
  const url = `${BASE}/multi-original-download?access-token=${token}&start_time=${start_time}&end_time=${end_time}`;
  // จำกัดเวลา 8 วิ — ถ้างานดิบช้า ให้ตอบด้วยสรุปเดิมไปก่อน ไม่ให้ทั้งคำขอค้างจนล้มเหลว
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let text;
  try {
    const upstream = await fetch(url, { signal: ctrl.signal });
    if (!upstream.ok) return null;
    text = new TextDecoder('gb18030').decode(await upstream.arrayBuffer()).replace(/^﻿/, '');
  } finally {
    clearTimeout(timer);
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return {};
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const byVin = {};
  lines.slice(1).forEach((line) => {
    const cells = parseCsvLine(line);
    const row = {}; headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    const vin = (row.vin || pick(row, /^vin$/i)).trim();
    if (!vin) return;
    const b = byVin[vin] || (byVin[vin] = { task_num: 0, actual_clean_area: 0, total_time: 0 });
    b.task_num += 1;
    b.actual_clean_area += num(pick(row, /^actual cleaning area/i));
    b.total_time += num(pick(row, /^cleaning time/i));
  });
  return byVin;
}


const isZero = (r) => !(Number(r.task_num) > 0) && !(Number(r.actual_clean_area) > 0) && !(Number(r.total_time) > 0);

// สรุปรายคันครบทุกหน้า + เติมคันที่เป็น 0 จากงานดิบ
export async function getCars(token, start_time, end_time, { page = 1, pageSize = 100, raw = true } = {}) {
  const first = await fetchSummaryPage(token, start_time, end_time, page, pageSize);
  const result = [...(first.result || [])];
  if ((first.result || []).length === pageSize) {
    for (let p = page + 1; p < page + MAX_PAGES; p++) {
      const r = (await fetchSummaryPage(token, start_time, end_time, p, pageSize)).result || [];
      result.push(...r);
      if (r.length < pageSize) break;
    }
  }
  let filled = 0;
  if (raw && result.some(isZero)) {
    try {
      const byVin = await fetchRawByVin(token, start_time, end_time);
      if (byVin) result.forEach((r) => {
        const x = byVin[r.vin];
        if (isZero(r) && x && x.task_num > 0) {
          r.task_num = x.task_num;
          r.actual_clean_area = Math.round(x.actual_clean_area * 100) / 100;
          r.total_time = Math.round(x.total_time);
          r.from_raw = true;
          filled++;
        }
      });
    } catch { /* งานดิบล้มเหลว — ใช้สรุปเดิม */ }
  }
  return { first, result, filled };
}
