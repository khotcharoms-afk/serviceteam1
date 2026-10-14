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
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    params.append('start_time', start_time);
    params.append('end_time', end_time);

    const url = `https://wolfsburg.phpserver.idriverplus.com/basic/web/index.php/wv/statistics/cars-list?access-token=${token}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      // ต้นทางไม่ได้ตอบเป็น JSON (เช่น หน้า error ของเซิร์ฟเวอร์)
      return res.status(502).json({
        error: `API ต้นทางตอบกลับผิดรูปแบบ (HTTP ${upstream.status})`,
        detail: text.slice(0, 300),
      });
    }

    if (data.err_no !== 200) {
      // ใส่รหัสและข้อความจาก VIGGO ลงใน error ให้หน้าเว็บแสดงได้เลย
      const msg = data.err_msg || data.msg || data.message || data.error || '';
      return res.status(502).json({
        error: `API ต้นทางตอบ error (err_no ${data.err_no ?? '-'}${msg ? `: ${msg}` : ''})`,
        detail: data,
      });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'เรียก API ไม่สำเร็จ', detail: err.message });
  }
}
