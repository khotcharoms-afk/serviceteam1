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

    const data = await upstream.json();

    if (data.err_no !== 200) {
      return res.status(502).json({ error: 'API ต้นทางตอบ error', detail: data });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'เรียก API ไม่สำเร็จ', detail: err.message });
  }
}
