import { useState, useEffect } from 'react';
import { siteName } from './RobotStatsPage.jsx';

const PURPLE = '#6B21A8';
const ORANGE = '#F97316';
const SLATE_900 = '#0f172a';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const BORDER = '#e2e8f0';
const BG = '#f8fafc';
const GREEN = '#16a34a';

// แปลข้อความจีนที่พบบ่อยในไฟล์ต้นฉบับให้อ่านง่ายขึ้น — เพิ่มเข้าไปได้ถ้าเจอคำใหม่
const TRANSLATE = {
  '尘推模式': 'ดันฝุ่น (Dust-push)',
  '补给任务': 'งานเติมเสบียง (Supply task)',
};
function tr(text) {
  if (!text) return '-';
  return TRANSLATE[text] || text;
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const PAGE_SIZE = 50;

export default function RawTaskLogPage({ onBack }) {
  const [startDate, setStartDate] = useState(todayStr(-6));
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [page, setPage] = useState(1);
  const isMobile = window.innerWidth < 900;

  async function fetchData() {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      // 1) ดึงข้อมูลงานละเอียดรายตัว
      const rawParams = new URLSearchParams({ start_time: startDate, end_time: endDate });
      const rawRes = await fetch(`/api/robot-raw-export?${rawParams.toString()}`);
      const rawData = await rawRes.json();
      if (!rawRes.ok) throw new Error(rawData.error || 'ดึงข้อมูลงานละเอียดไม่สำเร็จ');

      // 2) ดึง mapping VIN -> ไซต์ จากช่วงวันเดียวกัน
      const sumParams = new URLSearchParams({ start_time: startDate, end_time: endDate, page: '1', size: '100' });
      const sumRes = await fetch(`/api/robot-stats?${sumParams.toString()}`);
      const sumData = await sumRes.json();
      const vinToSite = {};
      (sumData.result || []).forEach((r) => { vinToSite[r.vin] = siteName(r.project_name); });

      const merged = (rawData.rows || []).map((r) => ({
        ...r,
        __site: vinToSite[r.vin] || 'ไม่ทราบไซต์',
      }));
      setRows(merged);
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

  const siteOptions = Array.from(new Set(rows.map((r) => r.__site))).sort();

  const filteredRows = rows.filter((r) => {
    if (siteFilter !== 'all' && r.__site !== siteFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r['Vehicle name'], r.vin, r['Task name'], r.__site].some((x) => x?.toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalActual = filteredRows.reduce((s, r) => s + num(r['Actual cleaning area(㎡)']), 0);
  const totalTime = filteredRows.reduce((s, r) => s + num(r['Cleaning time(min)']), 0);

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SLATE_500, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: SLATE_900, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 17 }}>📄</span> งานละเอียด (Raw Data)
            </div>
            <div style={{ fontSize: 11.5, color: SLATE_400, marginTop: 1 }}>ข้อมูลรายงานย่อยระดับงานจาก VIGGO</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: SLATE_500, fontWeight: 600 }}>📅 ช่วงวันที่:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <span style={{ fontSize: 12, color: SLATE_400 }}>ถึง</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={fetchData} disabled={loading}
              style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'กำลังโหลด…' : 'ค้นหา'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: SLATE_500, fontWeight: 600 }}>ไซต์:</span>
            <select value={siteFilter} onChange={(e) => { setSiteFilter(e.target.value); setPage(1); }}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 180 }}>
              <option value="all">ทั้งหมด</option>
              {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="ค้นหารถ, VIN, ชื่องาน..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              style={{ flex: 1, minWidth: 180, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 16px', borderLeft: `4px solid ${PURPLE}`, flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: SLATE_900 }}>{filteredRows.length.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: SLATE_500, fontWeight: 600 }}>งานทั้งหมด</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 16px', borderLeft: `4px solid ${ORANGE}`, flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: SLATE_900 }}>{Math.round(totalActual).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: SLATE_500, fontWeight: 600 }}>พื้นที่ทำสำเร็จรวม (ตร.ม.)</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 16px', borderLeft: `4px solid ${GREEN}`, flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: SLATE_900 }}>{Math.floor(totalTime / 60)} ชม. {Math.round(totalTime % 60)} น.</div>
              <div style={{ fontSize: 11, color: SLATE_500, fontWeight: 600 }}>เวลาทำงานรวม</div>
            </div>
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '48px 20px', textAlign: 'center', color: SLATE_400 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14 }}>ไม่พบข้อมูลในช่วงวันที่นี้</div>
          </div>
        )}

        {pagedRows.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                    {['ไซต์', 'รถ', 'ชื่องาน', 'โหมด', 'รอบ', 'เวลา (นาที)', 'วางแผน (ตร.ม.)', 'ทำจริง (ตร.ม.)', 'ไม่ได้ทำ (ตร.ม.)', '% สำเร็จ', 'ประสิทธิภาพ', 'เริ่ม', 'จบ'].map((h) => (
                      <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, color: SLATE_500, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: SLATE_900, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.__site}</td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: SLATE_900 }}>{r['Vehicle name']}</div>
                        <div style={{ fontSize: 9.5, color: SLATE_400, fontFamily: 'monospace' }}>{r.vin}</div>
                      </td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{r['Task name'] ? tr(r['Task name']) : '-'}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500, whiteSpace: 'nowrap' }}>{tr(r['Cleaning mode'])}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{r.Cycles}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{r['Cleaning time(min)']}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{num(r['Programmed cleaning area(㎡)']).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_900, fontWeight: 600 }}>{num(r['Actual cleaning area(㎡)']).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{num(r['Uncleaned area(㎡)']).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500 }}>{r['Task completion rate(%)']}%</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500, whiteSpace: 'nowrap' }}>{r['Cleaning efficiency(㎡/h)']}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500, whiteSpace: 'nowrap' }}>{r['Start time']}</td>
                      <td style={{ padding: '8px 10px', color: SLATE_500, whiteSpace: 'nowrap' }}>{r['End time']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? SLATE_400 : SLATE_500, fontFamily: 'inherit' }}>←</button>
            <span style={{ fontSize: 12.5, color: SLATE_500 }}>หน้า {page}/{totalPages} ({filteredRows.length} รายการ)</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? SLATE_400 : SLATE_500, fontFamily: 'inherit' }}>→</button>
          </div>
        )}
      </div>
    </div>
  );
}
