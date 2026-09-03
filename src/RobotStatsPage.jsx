import { useState, useEffect } from 'react';

const ORANGE = '#F97316';
const PURPLE = '#6B21A8';

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function formatMinutes(mins) {
  const n = Number(mins) || 0;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h} ชม. ${m} นาที`;
}

export default function RobotStatsPage({ onBack }) {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start_time: startDate,
        end_time: endDate,
        page: '1',
        size: '100',
      });
      const res = await fetch(`/api/robot-stats?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      setRows(data.result || []);
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2 style={{ color: PURPLE, margin: 0 }}>📊 สถิติการทำงานหุ่นยนต์ (VIGGO)</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label>
          จาก:{' '}
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          ถึง:{' '}
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: ORANGE,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'กำลังโหลด...' : '🔍 ค้นหา'}
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 12 }}>⚠️ {error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: PURPLE, color: '#fff' }}>
              <th style={th}>รถ</th>
              <th style={th}>โปรเจกต์</th>
              <th style={th}>จำนวนงาน</th>
              <th style={th}>เวลาทำงานรวม</th>
              <th style={th}>พื้นที่วางแผน (ตร.ม.)</th>
              <th style={th}>พื้นที่ทำจริง (ตร.ม.)</th>
              <th style={th}>ยังไม่ทำ (ตร.ม.)</th>
              <th style={th}>% สำเร็จ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.plan_clean_area > 0
                ? ((Number(r.actual_clean_area) / Number(r.plan_clean_area)) * 100).toFixed(1)
                : '-';
              return (
                <tr key={r.vin} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={td}>{r.vehicle_name}</td>
                  <td style={td}>{r.project_name}</td>
                  <td style={td}>{r.task_num}</td>
                  <td style={td}>{formatMinutes(r.total_time)}</td>
                  <td style={td}>{Number(r.plan_clean_area).toLocaleString()}</td>
                  <td style={td}>{Number(r.actual_clean_area).toLocaleString()}</td>
                  <td style={td}>{Number(r.uncleaned_area).toLocaleString()}</td>
                  <td style={td}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>ไม่พบข้อมูล</div>
        )}
      </div>
    </div>
  );
}

const th = { padding: '10px 8px', textAlign: 'left' };
const td = { padding: '8px' };
