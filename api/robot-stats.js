// สถิติหุ่นยนต์รายคันจาก VIGGO — ตรรกะอยู่ใน _viggo.js (ใช้ร่วมกับ sheet-sync)
import { getCars } from './_viggo.js';

export default async function handler(req, res) {
  const { start_time, end_time, page = '1', size = '50' } = req.query;
  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'ต้องระบุ start_time และ end_time (YYYY-MM-DD)' });
  }
  const token = process.env.ROBOT_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า ROBOT_API_TOKEN บน Vercel' });
  }
  try {
    const { first, result, filled } = await getCars(token, start_time, end_time, {
      page: Number(page) || 1, pageSize: Number(size) || 50, raw: req.query.raw !== '0',
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ...first, result, filled_from_raw: filled });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'เรียก API ไม่สำเร็จ', detail: err.detail ?? err.message });
  }
}
