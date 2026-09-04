import iconv from 'iconv-lite';

export default async function handler(req, res) {
  const { start_time, end_time } = req.query;

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'ต้องระบุ start_time และ end_time (YYYY-MM-DD)' });
  }

  const token = process.env.ROBOT_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า ROBOT_API_TOKEN บน Vercel' });
  }

  try {
    const url = `https://wolfsburg.phpserver.idriverplus.com/basic/web/index.php/wv/statistics/multi-original-download?access-token=${token}&start_time=${start_time}&end_time=${end_time}`;

    const upstream = await fetch(url, { method: 'GET' });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'ดึงข้อมูลจาก VIGGO ไม่สำเร็จ' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = iconv.decode(buffer, 'gb18030');

    const rows = parseCsv(text);
    res.status(200).json({ rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด', detail: err.message });
  }
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] !== undefined ? cells[i] : ''; });
    return obj;
  });
}
