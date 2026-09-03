import { useState, useEffect } from 'react';

const PURPLE = '#6B21A8';
const ORANGE = '#F97316';
const SLATE_900 = '#0f172a';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const BORDER = '#e2e8f0';
const BG = '#f8fafc';
const GREEN = '#16a34a';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// ── ตั้งค่าชื่อไซต์ที่ใช้ในรายงาน ──
// key = ชื่อโปรเจกต์จาก VIGGO (r.project_name)
// site  = ชื่อไซต์ที่จะโชว์ในรายงาน
// label = (ใส่เฉพาะไซต์ที่มีรถ/จุดย่อยหลายจุด เช่น หลายชั้น หรือหลายรุ่น) ป้ายกำกับหน้าสถานะ
const SITE_CONFIG = {
  'PDR_LPN_PRD': { site: 'แพนโดร่า สาขาลำพูน production' },
  'PDR_LPN_OPM': { site: 'แพนโดร่า สาขาลำพูน 2 operation' },
  'RAM2':        { site: 'โรงพยาบาลรามคำแหง' },
  'VBH_BKK':     { site: 'รพ.วิภารามพัฒนาการ' },
  'KKP_ASOK':    { site: 'ธนาคารเกียรตินาคิน สาขา อโศก' },

  'THAMC_F1': { site: 'โรงพยาบาลธรรมศาสตร์รังสิต', label: 'ชั้น 1' },
  'THAMC_F2': { site: 'โรงพยาบาลธรรมศาสตร์รังสิต', label: 'ชั้น 2' },
  'THAMC_F4': { site: 'โรงพยาบาลธรรมศาสตร์รังสิต', label: 'ชั้น 4' },
  'THAMC_F5': { site: 'โรงพยาบาลธรรมศาสตร์รังสิต', label: 'ชั้น 5' },

  'ARL_MAS_1': { site: 'ARL - Makkasan', label: 'SC50' },
  'ARL_MAS_2': { site: 'ARL - Makkasan', label: 'SC80' },

  'SCB_WEST': { site: 'SCB - WEST' },
  'SCB_EAST': { site: 'SCB - EAST' },
  'SCB_MID':  { site: 'SCB - HQ' },

  'VBH_AMTA': { site: 'VPH_Amata_SC50' },
  'SP_SNK':   { site: 'SP_Srinakarin_SC50PLUS' },

  'SET_1': { site: 'SET Ratchada 1' },
  'SET_2': { site: 'SET Ratchada 2' },
  'SET_3': { site: 'SET Ratchada 3' },

  'RAV_CHM':   { site: 'RAV_CHM' },
  'CP-meiji':  { site: 'CP-MEJI' },

  'AOTGA_TH_3': { site: 'AOTGA', label: 'FL.B.EAST' },
  'AOTGA_TH_2': { site: 'AOTGA', label: 'FL.B.WEST' },
  'AOTGA_TH_1': { site: 'AOTGA', label: 'FL.2.WEST' },

  'ARL_BTC': { site: 'ARL - Ban Thap Chang' },
  'ARL_HUM': { site: 'ARL - Hua Mak' },
  'ARL_LKB': { site: 'ARL - Lat Krabang' },
  'ARL_PTH': { site: 'ARL - Phaya Thai' },
  'ARL_RKH': { site: 'ARL - Ramkhamhaeng' },
  'ARL_RPR': { site: 'ARL - Ratchaprarop' },
  'ARL_SVB': { site: 'ARL - Suvarnabhumi' },
  'DAD':     { site: 'ศูนย์ราชการแจ้งวัฒนะ' },
  'VBH_LEAM': { site: 'รพ.วิภารามแหลมฉบัง MIX-1' },
  'CMA_1':   { site: 'SET Northpark 1' },
  'CMA_2':   { site: 'SET Northpark 2' },
};

// ── ลำดับการแสดงผลในรายงาน (เรียงตามลำดับโค้ดในนี้) ──
// ไซต์ที่ไม่มีโค้ดอยู่ในลิสต์นี้ จะถูกจัดไว้ท้ายสุดตามลำดับที่มาจาก VIGGO
const SITE_ORDER = [
  'DAD', 'PDR_LPN_PRD', 'PDR_LPN_OPM', 'RAM2', 'VBH_BKK', 'KKP_ASOK', 'VBH_LEAM',
  'THAMC_F1', 'THAMC_F2', 'THAMC_F4', 'THAMC_F5',
  'ARL_BTC', 'ARL_HUM', 'ARL_LKB', 'ARL_MAS_1', 'ARL_MAS_2', 'ARL_PTH', 'ARL_RKH', 'ARL_RPR', 'ARL_SVB',
  'SCB_WEST', 'SCB_EAST', 'SCB_MID',
  'VBH_AMTA', 'SP_SNK',
  'SET_1', 'SET_2', 'SET_3', 'CMA_1', 'CMA_2',
  'RAV_CHM', 'CP-meiji',
  'AOTGA_TH_3', 'AOTGA_TH_2', 'AOTGA_TH_1',
];
function orderIndex(code) {
  const i = SITE_ORDER.indexOf(code);
  return i === -1 ? 9999 : i;
}

// ── โค้ดที่ยังไม่ต้องโชว์ในรายงาน (เช่น รถที่ยังอยู่ในคลัง ยังไม่ได้ส่งไซต์) ──
const EXCLUDED_CODES = ['MTTH_2', 'MTTH_3', 'MTTH_4', 'MTTH_5', 'MTTH_7', '泰国20260822'];

function siteName(code) {
  return SITE_CONFIG[code]?.site || code || 'ไม่ระบุไซต์';
}
function siteLabel(code, fallbackName) {
  return SITE_CONFIG[code]?.label || fallbackName;
}

function buildDailyReport(rows, mode = 'morning') {
  const bySite = {};
  rows.forEach((r) => {
    const code = r.project_name || '';
    if (EXCLUDED_CODES.includes(code)) return;
    const site = siteName(code);
    if (!bySite[site]) bySite[site] = [];
    bySite[site].push(r);
  });

  // เรียงรถภายในแต่ละไซต์ตามลำดับที่กำหนด
  Object.values(bySite).forEach((vehicles) => {
    vehicles.sort((a, b) => orderIndex(a.project_name) - orderIndex(b.project_name));
  });

  // เรียงไซต์ตามลำดับต่ำสุดของโค้ดในกลุ่มนั้น
  const orderedSites = Object.keys(bySite).sort((siteA, siteB) => {
    const minA = Math.min(...bySite[siteA].map((v) => orderIndex(v.project_name)));
    const minB = Math.min(...bySite[siteB].map((v) => orderIndex(v.project_name)));
    return minA - minB;
  });

  const lines = [];
  orderedSites.forEach((site) => {
    const vehicles = bySite[site];
    lines.push(site);
    const needsLabel = vehicles.length > 1 || vehicles.some((v) => SITE_CONFIG[v.project_name]?.label);
    vehicles.forEach((v) => {
      const worked = Number(v.task_num) > 0;
      const label = needsLabel ? siteLabel(v.project_name, v.vehicle_name) : null;

      if (mode === 'evening') {
        if (worked) {
          const area = Math.round(Number(v.actual_clean_area) || 0);
          lines.push(label
            ? `🟢ออนไลน์ ${label} ทำงานปกติ ${area} ตารางเมตร`
            : `🟢ออนไลน์ทำงานปกติ ${area} ตารางเมตร`);
        } else {
          lines.push(label
            ? `🔴ออฟไลน์ ${label} ยังไม่ได้เริ่มสั่งงาน`
            : '🔴ออฟไลน์ ยังไม่ได้เริ่มสั่งงาน');
        }
      } else {
        lines.push(label
          ? (worked ? `🟢${label} ออนไลน์ทำงานปกติ` : `🔴${label} ออฟไลน์ ยังไม่ได้เริ่มสั่งงาน`)
          : (worked ? '🟢ออนไลน์ทำงานปกติ' : '🔴ออฟไลน์ ยังไม่ได้เริ่มสั่งงาน'));
      }
    });
  });
  return lines.join('\n').trim();
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function formatHours(mins) {
  const n = Number(mins) || 0;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h} ชม. ${m} น.`;
}

function pctOf(r) {
  const plan = Number(r.plan_clean_area) || 0;
  const actual = Number(r.actual_clean_area) || 0;
  if (plan <= 0) return null;
  return (actual / plan) * 100;
}

function performanceColor(pct) {
  if (pct === null) return SLATE_400;
  if (pct >= 90) return GREEN;
  if (pct >= 70) return AMBER;
  return RED;
}

function ProgressBar({ pct }) {
  const color = performanceColor(pct);
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 20, background: '#eef1f5', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 20, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
        {pct === null ? '—' : `${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

function StatusBadge({ worked }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: worked ? '#f0fdf4' : '#fff5f5',
      color: worked ? GREEN : RED,
      border: `1px solid ${worked ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {worked ? '✅ ทำงาน' : '⛔ ไม่ได้ทำงาน'}
    </span>
  );
}

function QuickRangeBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? PURPLE : '#fff',
        border: `1px solid ${active ? PURPLE : BORDER}`,
        color: active ? '#fff' : SLATE_500,
        borderRadius: 8,
        padding: '6px 13px',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
      padding: '14px 16px', flex: 1, minWidth: 130, borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: SLATE_900, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: SLATE_500, marginTop: 3, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: SLATE_400, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function RobotStatsPage({ onBack }) {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | worked | notworked
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState('morning'); // morning | evening
  const [copied, setCopied] = useState(false);
  const isMobile = window.innerWidth < 720;

  async function fetchData(from = startDate, to = endDate) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start_time: from, end_time: to, page: '1', size: '100' });
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

  function setRange(daysBack) {
    const to = todayStr();
    const from = todayStr(-daysBack);
    setStartDate(from);
    setEndDate(to);
    fetchData(from, to);
  }

  const filteredRows = rows
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [r.vehicle_name, r.project_name, r.vin, siteName(r.project_name)].some((x) => x?.toLowerCase().includes(q));
    })
    .filter((r) => {
      const worked = Number(r.task_num) > 0;
      if (statusFilter === 'worked') return worked;
      if (statusFilter === 'notworked') return !worked;
      return true;
    })
    .sort((a, b) => (Number(a.task_num) > 0 ? 1 : 0) - (Number(b.task_num) > 0 ? 1 : 0));

  const totalTask = rows.reduce((s, r) => s + (Number(r.task_num) || 0), 0);
  const totalActual = rows.reduce((s, r) => s + (Number(r.actual_clean_area) || 0), 0);
  const totalPlan = rows.reduce((s, r) => s + (Number(r.plan_clean_area) || 0), 0);
  const avgPct = totalPlan > 0 ? (totalActual / totalPlan) * 100 : null;
  const activeCount = rows.filter((r) => Number(r.task_num) > 0).length;
  const notWorkedCount = rows.length - activeCount;

  const isToday = startDate === todayStr() && endDate === todayStr();
  const is7 = startDate === todayStr(-6) && endDate === todayStr();
  const is30 = startDate === todayStr(-29) && endDate === todayStr();

  const reportText = buildDailyReport(rows, reportMode);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert('คัดลอกไม่สำเร็จ ลองกดค้างเพื่อเลือกข้อความเองแทน');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SLATE_500, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: SLATE_900, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 17 }}>📊</span> สถิติการทำงานหุ่นยนต์
            </div>
            <div style={{ fontSize: 11.5, color: SLATE_400, marginTop: 1 }}>ข้อมูลจากระบบ VIGGO</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        {/* Date filter */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: SLATE_500, fontWeight: 600 }}>📅 ช่วงวันที่:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <span style={{ fontSize: 12, color: SLATE_400 }}>ถึง</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE_900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => fetchData()} disabled={loading}
              style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'กำลังโหลด…' : 'ค้นหา'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <QuickRangeBtn label="วันนี้" active={isToday} onClick={() => setRange(0)} />
            <QuickRangeBtn label="7 วัน" active={is7} onClick={() => setRange(6)} />
            <QuickRangeBtn label="30 วัน" active={is30} onClick={() => setRange(29)} />
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Summary stats */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <div onClick={() => setStatusFilter(statusFilter === 'worked' ? 'all' : 'worked')} style={{ cursor: 'pointer', flex: 1, minWidth: 130 }}>
              <StatCard label="รถที่ทำงาน" value={activeCount} color={GREEN} sub={`จากทั้งหมด ${rows.length} คัน`} />
            </div>
            <div onClick={() => setStatusFilter(statusFilter === 'notworked' ? 'all' : 'notworked')} style={{ cursor: 'pointer', flex: 1, minWidth: 130 }}>
              <StatCard label="รถที่ไม่ได้ทำงาน" value={notWorkedCount} color={RED} sub="กดดูรายการ" />
            </div>
            <StatCard label="งานทั้งหมด" value={totalTask.toLocaleString()} color="#2563eb" sub="งาน" />
            <StatCard label="พื้นที่ทำสำเร็จ" value={`${Math.round(totalActual).toLocaleString()}`} color={ORANGE} sub="ตร.ม." />
          </div>
        )}

        {/* Status filter chips */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <QuickRangeBtn label={`ทั้งหมด (${rows.length})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <QuickRangeBtn label={`ทำงาน (${activeCount})`} active={statusFilter === 'worked'} onClick={() => setStatusFilter('worked')} />
            <QuickRangeBtn label={`ไม่ได้ทำงาน (${notWorkedCount})`} active={statusFilter === 'notworked'} onClick={() => setStatusFilter('notworked')} />
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowReport((v) => !v)}
              style={{
                background: showReport ? PURPLE : '#fff', color: showReport ? '#fff' : PURPLE,
                border: `1px solid ${PURPLE}`, borderRadius: 8, padding: '6px 13px',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              📋 {showReport ? 'ซ่อนรายงาน' : 'สร้างรายงานประจำวัน'}
            </button>
          </div>
        )}

        {/* Daily report panel */}
        {showReport && rows.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: SLATE_900 }}>รายงานประจำวัน · {endDate}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <QuickRangeBtn label="🌅 เช้า" active={reportMode === 'morning'} onClick={() => setReportMode('morning')} />
                <QuickRangeBtn label="🌙 เย็น" active={reportMode === 'evening'} onClick={() => setReportMode('evening')} />
                <button onClick={copyReport}
                  style={{ background: copied ? GREEN : ORANGE, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ'}
                </button>
              </div>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap', fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13.5,
              color: SLATE_900, background: BG, borderRadius: 10, padding: 14, margin: 0, lineHeight: 1.7,
              maxHeight: 420, overflowY: 'auto',
            }}>
              {reportText}
            </pre>
            <div style={{ fontSize: 11, color: SLATE_400, marginTop: 8 }}>
              💡 ถ้ามีไซต์ใหม่เพิ่มใน VIGGO ที่ยังไม่มีในรายงาน ให้เพิ่มโค้ดในไฟล์ RobotStatsPage.jsx ตรง SITE_CONFIG และ SITE_ORDER ด้านบนไฟล์
            </div>
          </div>
        )}

        {/* Search */}
        {rows.length > 0 && (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: SLATE_400, fontSize: 15 }}>⌕</span>
            <input
              placeholder="ค้นหารถ, VIN หรือโปรเจกต์..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, color: SLATE_900, padding: '10px 14px 10px 34px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && !error && (
          <div style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '48px 20px', textAlign: 'center', color: SLATE_400 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 14 }}>ไม่พบข้อมูลในช่วงวันที่นี้</div>
          </div>
        )}

        {/* Mobile: card list */}
        {isMobile && filteredRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredRows.map((r) => {
              const pct = pctOf(r);
              return (
                <div key={r.vin} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: SLATE_900 }}>{r.vehicle_name}</div>
                      <div style={{ fontSize: 12, color: SLATE_500, marginTop: 1, fontWeight: 600 }}>{siteName(r.project_name)}</div>
                      <div style={{ fontSize: 11.5, color: SLATE_400, marginTop: 1 }}>{r.project_name}</div>
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1, fontFamily: 'monospace' }}>{r.vin}</div>
                    </div>
                    <StatusBadge worked={Number(r.task_num) > 0} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SLATE_500, marginBottom: 10 }}>
                    <span>{r.task_num} งาน</span>
                    <span>{formatHours(r.total_time)}</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: SLATE_400 }}>ทำแล้ว {Number(r.actual_clean_area).toLocaleString()} ตร.ม.</span>
                    <span style={{ color: SLATE_400 }}>ยังไม่ทำ {Number(r.uncleaned_area).toLocaleString()} ตร.ม.</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Desktop: table */}
        {!isMobile && filteredRows.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
                    {['สถานะ', 'รถ', 'โปรเจกต์', 'ไซต์', 'งาน', 'เวลาทำงาน', 'ทำสำเร็จ (ตร.ม.)', 'ยังไม่ทำ (ตร.ม.)', 'ผลงาน'].map((h) => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: h === 'ผลงาน' ? 'left' : 'left', fontSize: 11.5, color: SLATE_500, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const pct = pctOf(r);
                    return (
                      <tr key={r.vin} style={{ borderBottom: `1px solid #f1f5f9`, background: Number(r.task_num) > 0 ? 'transparent' : '#fffafa' }}>
                        <td style={{ padding: '12px 14px' }}><StatusBadge worked={Number(r.task_num) > 0} /></td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: SLATE_900 }}>
                          {r.vehicle_name}
                          <div style={{ fontSize: 10, color: SLATE_400, fontWeight: 400, fontFamily: 'monospace' }}>{r.vin}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: SLATE_500 }}>{r.project_name}</td>
                        <td style={{ padding: '12px 14px', color: SLATE_900, fontWeight: 600 }}>{siteName(r.project_name)}</td>
                        <td style={{ padding: '12px 14px', color: SLATE_500 }}>{r.task_num}</td>
                        <td style={{ padding: '12px 14px', color: SLATE_500, whiteSpace: 'nowrap' }}>{formatHours(r.total_time)}</td>
                        <td style={{ padding: '12px 14px', color: SLATE_500 }}>{Number(r.actual_clean_area).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', color: SLATE_500 }}>{Number(r.uncleaned_area).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', minWidth: 140 }}><ProgressBar pct={pct} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 0 && filteredRows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: SLATE_400, fontSize: 13.5 }}>ไม่พบรถที่ตรงกับเงื่อนไขที่เลือก</div>
        )}
      </div>
    </div>
  );
}
