import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useTheme } from './theme.js';

// พื้นหลังแถวที่ต่ำกว่าเป้า/ไม่ได้ทำงาน — อ่อนใน light, เข้มใน dark
const redBgFor = (dark) => (dark ? '#3f1d1d' : '#fffafa');

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

function formatIdleDays(n, lookback) {
  if (n === undefined || n === null) return null;
  if (n === 0) return null;
  return n >= lookback ? `${lookback}+ วัน` : `${n} วัน`;
}

// วันที่ตามเวลาไทย — toISOString() เป็น UTC ช่วงเที่ยงคืน–7 โมงเช้าจะได้วันของเมื่อวาน
function todayStr(offsetDays = 0) {
  return addDays(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }), offsetDays);
}

function mondayOfThisWeek() {
  const t = todayStr();
  const day = new Date(t + "T00:00:00Z").getUTCDay(); // 0=อาทิตย์ ... 6=เสาร์
  return addDays(t, day === 0 ? -6 : 1 - day);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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

function performanceColor(pct, c) {
  if (pct === null) return c.text400;
  if (pct >= 90) return c.green;
  if (pct >= 70) return c.amber;
  return c.red;
}

function ProgressBar({ pct }) {
  const { c } = useTheme();
  const color = performanceColor(pct, c);
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 20, background: c.borderSoft, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 20, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
        {pct === null ? '—' : `${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

function StatusBadge({ worked }) {
  const { c } = useTheme();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: worked ? '#f0fdf4' : '#fff5f5',
      color: worked ? c.green : c.red,
      border: `1px solid ${worked ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {worked ? '✅ ทำงาน' : '⛔ ไม่ได้ทำงาน'}
    </span>
  );
}

function QuickRangeBtn({ label, active, onClick }) {
  const { c } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? c.purple : c.card,
        border: `1px solid ${active ? c.purple : c.border}`,
        color: active ? '#fff' : c.text500,
        borderRadius: 8,
        padding: '7px 13px',
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
  const { c } = useTheme();
  return (
    <div style={{
      background: c.card, border: `1px solid ${c.border}`, borderRadius: 14,
      padding: '14px 16px', flex: 1, minWidth: 130, borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.text900, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: c.text500, marginTop: 3, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: c.text400, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function WeekBarChart({ data, maxValue }) {
  const { c } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, padding: '0 4px' }}>
      {data.map((d) => {
        const h = maxValue > 0 ? (d.actual_clean_area / maxValue) * 100 : 0;
        const isToday = d.date === todayStr();
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: c.text500, whiteSpace: 'nowrap' }}>
              {d.actual_clean_area > 0 ? d.actual_clean_area.toLocaleString() : '-'}
            </div>
            <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', height: `${d.actual_clean_area > 0 ? Math.max(h, 4) : 0}%`,
                background: isToday ? c.orange : c.purple, borderRadius: '6px 6px 0 0',
                transition: 'height .3s',
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? c.orange : c.text500 }}>{d.dayLabel}</div>
            <div style={{ fontSize: 9.5, color: c.text400 }}>{d.dateShort}</div>
          </div>
        );
      })}
    </div>
  );
}

function VehicleDetail({ vehicle, onBack }) {
  const { c } = useTheme();
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWeek() {
      setLoading(true);
      setError(null);
      try {
        const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
        const monday = mondayOfThisWeek();
        const days = [];
        for (let i = 0; i < 7; i++) days.push(addDays(monday, i));
        const results = await Promise.all(days.map(async (date) => {
          const d = new Date(date);
          if (date > todayStr()) {
            return { date, dateShort: `${d.getDate()}/${d.getMonth() + 1}`, dayLabel: dayNames[d.getDay()], task_num: 0, actual_clean_area: 0, total_time: 0 };
          }
          const params = new URLSearchParams({ start_time: date, end_time: date, page: '1', size: '100' });
          const res = await fetch(`/api/robot-stats?${params.toString()}`);
          const data = await res.json();
          const row = (data.result || []).find((r) => r.vin === vehicle.vin);
          return {
            date,
            dateShort: `${d.getDate()}/${d.getMonth() + 1}`,
            dayLabel: dayNames[d.getDay()],
            task_num: Number(row?.task_num) || 0,
            actual_clean_area: Math.round(Number(row?.actual_clean_area) || 0),
            total_time: Number(row?.total_time) || 0,
          };
        }));
        if (!cancelled) setWeekData(results);
      } catch (err) {
        if (!cancelled) setError('โหลดข้อมูลรายสัปดาห์ไม่สำเร็จ ลองใหม่อีกครั้ง');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadWeek();
    return () => { cancelled = true; };
  }, [vehicle.vin]);

  const maxArea = Math.max(1, ...weekData.map((d) => d.actual_clean_area));
  const weekTotalArea = weekData.reduce((s, d) => s + d.actual_clean_area, 0);
  const weekTotalTask = weekData.reduce((s, d) => s + d.task_num, 0);
  const daysWorked = weekData.filter((d) => d.task_num > 0).length;

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif", overflowX: 'hidden' }}>
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: c.bg, border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text500, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>{vehicle.vehicle_name}</div>
            <div style={{ fontSize: 11.5, color: c.text400, marginTop: 1 }}>{siteName(vehicle.project_name)} · {vehicle.vin}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 700, margin: '0 auto' }}>
        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: c.text400 }}>กำลังโหลดข้อมูล 7 วันล่าสุด…</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <StatCard label="พื้นที่รวม 7 วัน" value={weekTotalArea.toLocaleString()} color={c.orange} sub="ตร.ม." />
              <StatCard label="งานรวม 7 วัน" value={weekTotalTask.toLocaleString()} color="#2563eb" sub="งาน" />
              <StatCard label="วันที่ทำงาน" value={`${daysWorked}/7`} color={c.green} sub="วัน" />
            </div>

            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text900, marginBottom: 14 }}>พื้นที่ทำความสะอาดรายวัน (ตร.ม.)</div>
              <WeekBarChart data={weekData} maxValue={maxArea} />
            </div>

            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: c.bg, borderBottom: `1px solid ${c.border}` }}>
                    {['วัน', 'วันที่', 'งาน', 'เวลาทำงาน', 'พื้นที่ (ตร.ม.)'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, color: c.text500, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekData.map((d) => (
                    <tr key={d.date} style={{ borderBottom: `1px solid ${c.borderSoft}`, background: d.date === todayStr() ? `${c.orange}14` : 'transparent' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: c.text900 }}>{d.dayLabel}</td>
                      <td style={{ padding: '10px 14px', color: c.text500 }}>{d.dateShort}</td>
                      <td style={{ padding: '10px 14px', color: c.text500 }}>{d.task_num}</td>
                      <td style={{ padding: '10px 14px', color: c.text500 }}>{formatHours(d.total_time)}</td>
                      <td style={{ padding: '10px 14px', color: c.text900, fontWeight: 600 }}>{d.actual_clean_area.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RobotStatsPage({ onBack, projects = [], currentUser }) {
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
  const [showSheetSync, setShowSheetSync] = useState(false);
  const [sheetSyncStart, setSheetSyncStart] = useState(todayStr());
  const [sheetSyncEnd, setSheetSyncEnd] = useState(todayStr());
  const [sheetPreview, setSheetPreview] = useState(null);
  const [sheetSyncLoading, setSheetSyncLoading] = useState(false);
  const [sheetSyncError, setSheetSyncError] = useState(null);
  const [sheetWriteDone, setSheetWriteDone] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const { dark, c } = useTheme();
  const redBg = redBgFor(dark);
  const IDLE_CASE_THRESHOLD = 3; // หยุดเกินกี่วันถึงจะให้ปุ่มสร้างเคสโผล่
  const [caseModalFor, setCaseModalFor] = useState(null); // vehicle row ที่กำลังจะสร้างเคส
  const [projPickerOpen, setProjPickerOpen] = useState(false);
  const [projSearch, setProjSearch] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [caseProjectId, setCaseProjectId] = useState('');
  const [caseNote, setCaseNote] = useState('');
  const [caseSaving, setCaseSaving] = useState(false);
  const [caseCreatedFor, setCaseCreatedFor] = useState({}); // vin -> true หลังสร้างเคสแล้ว (กันกดซ้ำในหน้าเดียวกัน)
  const [idleDays, setIdleDays] = useState({});
  const [idleLoading, setIdleLoading] = useState(false);
  const isMobile = window.innerWidth < 720;

  const IDLE_MAX_DAYS = 14; // ย้อนหลังกี่วัน — เกินนี้ถือว่า "14+ วัน"

  async function loadIdleDays() {
    setIdleLoading(true);
    try {
      const days = [];
      for (let i = 0; i < IDLE_MAX_DAYS; i++) days.push(todayStr(-i));
      const dayResults = await Promise.all(days.map(async (date) => {
        const params = new URLSearchParams({ start_time: date, end_time: date, page: '1', size: '100' });
        const res = await fetch(`/api/robot-stats?${params.toString()}`);
        const data = await res.json();
        return { date, rows: data.result || [] };
      }));
      const byVin = {};
      dayResults.forEach(({ date, rows: dayRows }) => {
        dayRows.forEach((r) => {
          if (!byVin[r.vin]) byVin[r.vin] = {};
          byVin[r.vin][date] = Number(r.task_num) > 0;
        });
      });
      const result = {};
      Object.keys(byVin).forEach((vin) => {
        let count = 0;
        for (let i = 0; i < IDLE_MAX_DAYS; i++) {
          if (byVin[vin][todayStr(-i)]) break;
          count++;
        }
        result[vin] = count;
      });
      setIdleDays(result);
    } catch (e) {
      // เงียบไว้ — ถ้าโหลดไม่สำเร็จแค่ไม่โชว์คอลัมน์นี้ ไม่ต้องขึ้น error รบกวนหน้าหลัก
    } finally {
      setIdleLoading(false);
    }
  }

  async function fetchData(from = startDate, to = endDate) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start_time: from, end_time: to, page: '1', size: '100' });
      const res = await fetch(`/api/robot-stats?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      const allResults = data.result || [];
      setRows(allResults.filter((r) => !EXCLUDED_CODES.includes(r.project_name)));
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    loadIdleDays();
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
    .sort((a, b) => (Number(b.task_num) > 0 ? 1 : 0) - (Number(a.task_num) > 0 ? 1 : 0));

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

  async function loadSheetPreview() {
    setSheetSyncLoading(true);
    setSheetSyncError(null);
    setSheetPreview(null);
    setSheetWriteDone(false);
    try {
      const params = new URLSearchParams({ start_date: sheetSyncStart, end_date: sheetSyncEnd });
      const res = await fetch(`/api/sheet-sync?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data.error || 'โหลดตัวอย่างไม่สำเร็จ') + (data.detail ? ` — ${data.detail}` : ''));
      setSheetPreview(data);
    } catch (err) {
      setSheetSyncError(err.message);
    } finally {
      setSheetSyncLoading(false);
    }
  }

  async function confirmSheetWrite() {
    setSheetSyncLoading(true);
    setSheetSyncError(null);
    try {
      const params = new URLSearchParams({ start_date: sheetSyncStart, end_date: sheetSyncEnd, write: 'true' });
      const res = await fetch(`/api/sheet-sync?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data.error || 'เขียนข้อมูลไม่สำเร็จ') + (data.detail ? ` — ${data.detail}` : ''));
      setSheetWriteDone(true);
    } catch (err) {
      setSheetSyncError(err.message);
    } finally {
      setSheetSyncLoading(false);
    }
  }

  function openCreateCase(r) {
    const days = idleDays[r.vin];
    setCaseModalFor(r);
    setCaseTitle(`หุ่นยนต์ ${r.vehicle_name} ไม่ได้ทำงาน${days ? ` ${days} วัน` : ''}`);
    setCaseProjectId('');
    setCaseNote(`ไซต์: ${siteName(r.project_name)} (${r.project_name})\nVIN: ${r.vin}`);
  }

  async function submitIdleCase() {
    if (!caseTitle.trim() || caseSaving) return;
    setCaseSaving(true);
    try {
      const now = new Date().toISOString();
      const proj = projects.find((p) => p.id === caseProjectId);
      await setDoc(doc(db, 'cases', Date.now().toString()), {
        title: caseTitle.trim(),
        projectId: caseProjectId,
        warrantyEnd: proj?.warrantyEnd || null,
        leaseEnd: proj?.leaseEnd || null,
        site: siteName(caseModalFor.project_name),
        type: 'หุ่นยนต์',
        techs: currentUser?.name ? [currentUser.name] : [],
        tech: currentUser?.name || '',
        status: 'open',
        note: caseNote,
        date: todayStr(),
        handoverLog: [],
        updateLog: [],
        updatedAt: now,
        activityAt: now,
      });
      setCaseCreatedFor((prev) => ({ ...prev, [caseModalFor.vin]: true }));
      setCaseModalFor(null);
    } catch (e) {
      alert('สร้างเคสไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setCaseSaving(false);
    }
  }

  if (selectedVehicle) {
    return <VehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicle(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif", overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: isMobile ? '10px 12px' : '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={{ background: c.bg, border: 'none', borderRadius: 8, width: 30, height: 30, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text500, flexShrink: 0 }}>←</button>
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: isMobile ? 14 : 15.5, fontWeight: 800, color: c.text900, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ fontSize: isMobile ? 15 : 17, flexShrink: 0 }}>📊</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>สถิติการทำงานหุ่นยนต์</span>
            </div>
            {!isMobile && <div style={{ fontSize: 11.5, color: c.text400, marginTop: 1 }}>ข้อมูลจากระบบ VIGGO</div>}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? 12 : 16, maxWidth: 1400, margin: '0 auto' }}>
        {/* Date filter */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', marginBottom: 10, flexDirection: isMobile ? 'column' : 'row' }}>
            <span style={{ fontSize: 12, color: c.text500, fontWeight: 600 }}>📅 ช่วงวันที่:</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text900, padding: '9px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: isMobile ? 1 : 'none', minWidth: 0 }} />
              <span style={{ fontSize: 12, color: c.text400, flexShrink: 0 }}>ถึง</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text900, padding: '9px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: isMobile ? 1 : 'none', minWidth: 0 }} />
            </div>
            <button onClick={() => fetchData()} disabled={loading}
              style={{ background: c.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: isMobile ? '100%' : 'auto' }}>
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
              <StatCard label="รถที่ทำงาน" value={activeCount} color={c.green} sub={`จากทั้งหมด ${rows.length} คัน`} />
            </div>
            <div onClick={() => setStatusFilter(statusFilter === 'notworked' ? 'all' : 'notworked')} style={{ cursor: 'pointer', flex: 1, minWidth: 130 }}>
              <StatCard label="รถที่ไม่ได้ทำงาน" value={notWorkedCount} color={c.red} sub="กดดูรายการ" />
            </div>
            <StatCard label="งานทั้งหมด" value={totalTask.toLocaleString()} color="#2563eb" sub="งาน" />
            <StatCard label="พื้นที่ทำสำเร็จ" value={`${Math.round(totalActual).toLocaleString()}`} color={c.orange} sub="ตร.ม." />
          </div>
        )}

        {/* Status filter chips */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <QuickRangeBtn label={`ทั้งหมด (${rows.length})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              <QuickRangeBtn label={`ทำงาน (${activeCount})`} active={statusFilter === 'worked'} onClick={() => setStatusFilter('worked')} />
              <QuickRangeBtn label={`ไม่ได้ทำงาน (${notWorkedCount})`} active={statusFilter === 'notworked'} onClick={() => setStatusFilter('notworked')} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowReport((v) => !v)}
                style={{
                  background: showReport ? c.purple : c.card, color: showReport ? '#fff' : c.purple,
                  border: `1px solid ${c.purple}`, borderRadius: 8, padding: '8px 13px',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                📋 {showReport ? 'ซ่อนรายงาน' : (isMobile ? 'รายงาน' : 'สร้างรายงานประจำวัน')}
              </button>
              <button
                onClick={() => { setShowSheetSync((v) => !v); setSheetPreview(null); setSheetWriteDone(false); setSheetSyncError(null); }}
                style={{
                  background: showSheetSync ? c.green : c.card, color: showSheetSync ? '#fff' : c.green,
                  border: `1px solid ${c.green}`, borderRadius: 8, padding: '8px 13px',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                📤 {showSheetSync ? 'ซ่อน Sheet Sync' : (isMobile ? 'Sheet Sync' : 'ส่งเข้า Google Sheet')}
              </button>
            </div>
          </div>
        )}

        {/* Google Sheet sync panel */}
        {showSheetSync && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text900, marginBottom: 10 }}>📤 ส่งข้อมูลเข้า Google Sheet (Weekly สรุป)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: c.text500, fontWeight: 600 }}>จาก:</span>
              <input type="date" value={sheetSyncStart} onChange={(e) => { setSheetSyncStart(e.target.value); setSheetPreview(null); setSheetWriteDone(false); }}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 12, color: c.text400 }}>ถึง</span>
              <input type="date" value={sheetSyncEnd} onChange={(e) => { setSheetSyncEnd(e.target.value); setSheetPreview(null); setSheetWriteDone(false); }}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text900, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={loadSheetPreview} disabled={sheetSyncLoading}
                style={{ background: c.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {sheetSyncLoading ? 'กำลังโหลด…' : 'ดูตัวอย่าง'}
              </button>
            </div>

            {sheetSyncError && (
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                ⚠️ {sheetSyncError}
              </div>
            )}

            {sheetWriteDone && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: c.green, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
                ✓ เขียนข้อมูลเข้า Google Sheet เรียบร้อยแล้ว ({sheetPreview?.totalCells || 0} ช่อง)
              </div>
            )}

            {sheetPreview && !sheetWriteDone && (
              <>
                <div style={{ fontSize: 12.5, color: c.text500, marginBottom: 10 }}>
                  รวม <strong>{sheetPreview.totalCells}</strong> ช่อง ใน {sheetPreview.perDate?.length || 0} วัน — จะเขียนทับตามนี้:
                </div>

                {sheetPreview.perDate?.map((day) => (
                  <div key={day.date} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c.purple, marginBottom: 6 }}>
                      {day.date} {day.weekday ? `(${day.weekday})` : ''}
                    </div>
                    {day.error ? (
                      <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                        ⚠️ {day.error}
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: c.bg }}>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>ไซต์ (คอลัมน์)</th>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>ช่อง</th>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>ค่าเดิม</th>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>ค่าใหม่</th>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>Target</th>
                              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: c.text500 }}>เทียบ Target</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.updates.map((u) => {
                              const hasTarget = u.target !== null && u.target !== undefined;
                              const pct = hasTarget ? (u.newValue / u.target) * 100 : null;
                              const belowTarget = hasTarget && u.newValue < u.target;
                              return (
                                <tr key={u.cell} style={{ borderBottom: `1px solid ${c.borderSoft}`, background: belowTarget ? redBg : 'transparent' }}>
                                  <td style={{ padding: '6px 10px', color: c.text900, fontWeight: 600 }}>{u.column}</td>
                                  <td style={{ padding: '6px 10px', color: c.text400, fontFamily: 'monospace' }}>{u.cell}</td>
                                  <td style={{ padding: '6px 10px', color: c.text500 }}>{u.currentValue || '-'}</td>
                                  <td style={{ padding: '6px 10px', color: c.green, fontWeight: 700 }}>{u.newValue.toLocaleString()}</td>
                                  <td style={{ padding: '6px 10px', color: c.text400 }}>{hasTarget ? u.target.toLocaleString() : '-'}</td>
                                  <td style={{ padding: '6px 10px', fontWeight: 700, color: hasTarget ? (belowTarget ? c.red : c.green) : c.text400 }}>
                                    {hasTarget ? `${pct.toFixed(0)}%` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {sheetPreview.skippedColumns?.length > 0 && (
                  <div style={{ fontSize: 11.5, color: c.text400, marginBottom: 12 }}>
                    ข้ามคอลัมน์ที่ยังไม่รู้จัก: {sheetPreview.skippedColumns.join(', ')}
                  </div>
                )}
                <button onClick={confirmSheetWrite} disabled={sheetSyncLoading || sheetPreview.totalCells === 0}
                  style={{ background: c.green, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {sheetSyncLoading ? 'กำลังเขียน…' : `✓ ยืนยันเขียนข้อมูลจริง (${sheetPreview.totalCells} ช่อง)`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Daily report panel */}
        {showReport && rows.length > 0 && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text900 }}>รายงานประจำวัน · {endDate}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <QuickRangeBtn label="🌅 เช้า" active={reportMode === 'morning'} onClick={() => setReportMode('morning')} />
                <QuickRangeBtn label="🌙 เย็น" active={reportMode === 'evening'} onClick={() => setReportMode('evening')} />
                <button onClick={copyReport}
                  style={{ background: copied ? c.green : c.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกข้อความ'}
                </button>
              </div>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap', fontFamily: "'Noto Sans Thai',sans-serif", fontSize: 13.5,
              color: c.text900, background: c.bg, borderRadius: 10, padding: 14, margin: 0, lineHeight: 1.7,
              maxHeight: 420, overflowY: 'auto',
            }}>
              {reportText}
            </pre>
            <div style={{ fontSize: 11, color: c.text400, marginTop: 8 }}>
              💡 ถ้ามีไซต์ใหม่เพิ่มใน VIGGO ที่ยังไม่มีในรายงาน ให้เพิ่มโค้ดในไฟล์ RobotStatsPage.jsx ตรง SITE_CONFIG และ SITE_ORDER ด้านบนไฟล์
            </div>
          </div>
        )}

        {/* Search */}
        {rows.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: c.text400, fontSize: 15 }}>⌕</span>
              <input
                placeholder="ค้นหารถ, VIN หรือโปรเจกต์..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, color: c.text900, padding: '10px 14px 10px 34px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ fontSize: 11, color: c.text400, marginTop: 6 }}>💡 กดที่รถแต่ละคันเพื่อดูผลงานย้อนหลัง 7 วัน</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && !error && (
          <div style={{ background: c.card, border: `1.5px solid ${c.border}`, borderRadius: 14, padding: '48px 20px', textAlign: 'center', color: c.text400 }}>
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
                <div key={r.vin} onClick={() => setSelectedVehicle(r)} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: c.text900 }}>{r.vehicle_name}</div>
                      <div style={{ fontSize: 12, color: c.text500, marginTop: 1, fontWeight: 600 }}>{siteName(r.project_name)}</div>
                      <div style={{ fontSize: 11.5, color: c.text400, marginTop: 1 }}>{r.project_name}</div>
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1, fontFamily: 'monospace' }}>{r.vin}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge worked={Number(r.task_num) > 0} />
                      {formatIdleDays(idleDays[r.vin], IDLE_MAX_DAYS) && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: c.red }}>
                          ⏱ ไม่ได้ทำงานมา {formatIdleDays(idleDays[r.vin], IDLE_MAX_DAYS)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: c.text500, marginBottom: 10 }}>
                    <span>{r.task_num} งาน</span>
                    <span>{formatHours(r.total_time)}</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ color: c.text400, whiteSpace: 'nowrap' }}>ทำแล้ว {Number(r.actual_clean_area).toLocaleString()} ตร.ม.</span>
                    <span style={{ color: c.text400, whiteSpace: 'nowrap' }}>ยังไม่ทำ {Number(r.uncleaned_area).toLocaleString()} ตร.ม.</span>
                  </div>
                  {(idleDays[r.vin] || 0) >= IDLE_CASE_THRESHOLD && (
                    caseCreatedFor[r.vin] ? (
                      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: c.green, fontWeight: 700 }}>✓ สร้างเคสแล้ว</div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); openCreateCase(r); }}
                        style={{ marginTop: 10, width: '100%', background: '#fff5f5', border: '1px solid #fecaca', color: c.red, borderRadius: 8, padding: '8px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        🔧 สร้างเคส
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Desktop: table */}
        {!isMobile && filteredRows.length > 0 && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: c.bg, borderBottom: `1px solid ${c.border}` }}>
                    {['สถานะ', 'ไม่ทำงานมา', 'รถ', 'ไซต์', 'งาน', 'เวลาทำงาน', 'ทำสำเร็จ (ตร.ม.)', 'ยังไม่ทำ (ตร.ม.)', 'ผลงาน', 'จัดการ'].map((h) => (
                      <th key={h} style={{ padding: '10px 10px', textAlign: 'left', fontSize: 11.5, color: c.text500, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const pct = pctOf(r);
                    return (
                      <tr key={r.vin} onClick={() => setSelectedVehicle(r)} style={{ borderBottom: `1px solid ${c.borderSoft}`, background: Number(r.task_num) > 0 ? 'transparent' : redBg, cursor: 'pointer' }}>
                        <td style={{ padding: '10px 10px' }}><StatusBadge worked={Number(r.task_num) > 0} /></td>
                        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                          {formatIdleDays(idleDays[r.vin], IDLE_MAX_DAYS)
                            ? <span style={{ color: c.red, fontWeight: 700, fontSize: 12.5 }}>⏱ {formatIdleDays(idleDays[r.vin], IDLE_MAX_DAYS)}</span>
                            : (idleLoading ? <span style={{ color: c.text400, fontSize: 12 }}>…</span> : <span style={{ color: c.text400 }}>-</span>)}
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: c.text900, whiteSpace: 'nowrap' }}>
                          {r.vehicle_name}
                          <div style={{ fontSize: 10, color: c.text400, fontWeight: 400, fontFamily: 'monospace' }}>{r.vin}</div>
                        </td>
                        <td style={{ padding: '10px 10px', color: c.text900, fontWeight: 600 }}>
                          {siteName(r.project_name)}
                          <div style={{ fontSize: 10, color: c.text400, fontWeight: 400 }}>{r.project_name}</div>
                        </td>
                        <td style={{ padding: '10px 10px', color: c.text500 }}>{r.task_num}</td>
                        <td style={{ padding: '10px 10px', color: c.text500, whiteSpace: 'nowrap' }}>{formatHours(r.total_time)}</td>
                        <td style={{ padding: '10px 10px', color: c.text500, whiteSpace: 'nowrap' }}>{Number(r.actual_clean_area).toLocaleString()}</td>
                        <td style={{ padding: '10px 10px', color: c.text500, whiteSpace: 'nowrap' }}>{Number(r.uncleaned_area).toLocaleString()}</td>
                        <td style={{ padding: '10px 10px', minWidth: 110 }}><ProgressBar pct={pct} /></td>
                        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                          {(idleDays[r.vin] || 0) >= IDLE_CASE_THRESHOLD && (
                            caseCreatedFor[r.vin] ? (
                              <span style={{ fontSize: 12, color: c.green, fontWeight: 700 }}>✓ สร้างแล้ว</span>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); openCreateCase(r); }}
                                style={{ background: '#fff5f5', border: '1px solid #fecaca', color: c.red, borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                🔧 สร้างเคส
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 0 && filteredRows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: c.text400, fontSize: 13.5 }}>ไม่พบรถที่ตรงกับเงื่อนไขที่เลือก</div>
        )}
      </div>

      {/* Create-case modal */}
      {caseModalFor && (
        <div onClick={() => { if (!caseSaving) { setCaseModalFor(null); setProjPickerOpen(false); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: c.card, borderRadius: 16, width: '100%', maxWidth: 440, padding: 20, fontFamily: "'Noto Sans Thai',sans-serif", maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.text900, marginBottom: 4 }}>🔧 สร้างเคส</div>
            <div style={{ fontSize: 12, color: c.text400, marginBottom: 16 }}>{caseModalFor.vehicle_name} · {siteName(caseModalFor.project_name)}</div>

            <label style={{ fontSize: 12.5, color: c.text500, fontWeight: 600 }}>หัวข้อเคส</label>
            <input value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)}
              style={{ width: '100%', border: `1px solid ${c.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, marginTop: 4, marginBottom: 12, fontFamily: 'inherit', outline: 'none', background: c.bg, color: c.text900 }} />

            <label style={{ fontSize: 12.5, color: c.text500, fontWeight: 600 }}>โครงการ (ServiceLog) — ไม่บังคับ</label>
            <div style={{ position: 'relative', marginTop: 4, marginBottom: 12 }}>
              <button type="button" onClick={() => { setProjPickerOpen((v) => !v); setProjSearch(''); }}
                style={{ width: '100%', border: `1px solid ${c.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: c.bg, color: caseProjectId ? c.text900 : c.text400, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {caseProjectId ? (projects.find((p) => p.id === caseProjectId)?.name || '') : '-- ยังไม่ผูกโครงการ --'}
                </span>
                <span style={{ fontSize: 11, color: c.text400, flexShrink: 0 }}>{projPickerOpen ? '▲' : '▼'}</span>
              </button>

              {projPickerOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40, background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.28)', overflow: 'hidden' }}>
                  <input autoFocus value={projSearch} onChange={(e) => setProjSearch(e.target.value)}
                    placeholder="ค้นหาโครงการ…"
                    style={{ width: '100%', border: 'none', borderBottom: `1px solid ${c.border}`, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: c.bg, color: c.text900 }} />
                  <div style={{ maxHeight: 210, overflowY: 'auto' }}>
                    {[{ id: '', name: '-- ยังไม่ผูกโครงการ --' }, ...projects]
                      .filter((p) => !projSearch.trim() || p.name.toLowerCase().includes(projSearch.trim().toLowerCase()))
                      .map((p) => (
                        <div key={p.id || '__none'} onClick={() => { setCaseProjectId(p.id); setProjPickerOpen(false); }}
                          style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: p.id ? c.text900 : c.text400, background: caseProjectId === p.id ? `${c.orange}22` : 'transparent', borderBottom: `1px solid ${c.borderSoft}` }}>
                          {p.name}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <label style={{ fontSize: 12.5, color: c.text500, fontWeight: 600 }}>หมายเหตุ</label>
            <textarea value={caseNote} onChange={(e) => setCaseNote(e.target.value)} rows={3}
              style={{ width: '100%', border: `1px solid ${c.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, marginTop: 4, marginBottom: 16, fontFamily: 'inherit', outline: 'none', resize: 'vertical', background: c.bg, color: c.text900 }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setCaseModalFor(null); setProjPickerOpen(false); }} disabled={caseSaving}
                style={{ flex: 1, background: c.borderSoft, border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, color: c.text500, cursor: 'pointer', fontFamily: 'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={submitIdleCase} disabled={!caseTitle.trim() || caseSaving}
                style={{ flex: 1, background: !caseTitle.trim() ? '#fca5a5' : c.orange, border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: !caseTitle.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {caseSaving ? 'กำลังบันทึก…' : 'สร้างเคส'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { siteName, SITE_CONFIG };
