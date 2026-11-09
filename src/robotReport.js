// ตั้งค่าไซต์หุ่นยนต์และตัวสร้างข้อความรายงานประจำวัน — ใช้ร่วมกันระหว่างหน้าสถิติหุ่นยนต์ และรายงานสถานะอุปกรณ์ (หน้า Smart Pole)
// ── ตั้งค่าชื่อไซต์ที่ใช้ในรายงาน ──
// key = ชื่อโปรเจกต์จาก VIGGO (r.project_name)
// site  = ชื่อไซต์ที่จะโชว์ในรายงาน
// label = (ใส่เฉพาะไซต์ที่มีรถ/จุดย่อยหลายจุด เช่น หลายชั้น หรือหลายรุ่น) ป้ายกำกับหน้าสถานะ
export const SITE_CONFIG = {
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
  'CLOUD11': { site: 'Cloud11' },
};

// การผูกหุ่นกับไซต์ด้วย VIN ทำที่ฝั่งเซิร์ฟเวอร์ (api/_viggo.js → VIN_PROJECT) — ข้อมูลที่มาถึงหน้าเว็บแก้ project_name แล้ว
export const normalizeRobot = (r) => r;

// ── ลำดับการแสดงผลในรายงาน (เรียงตามลำดับโค้ดในนี้) ──
// ไซต์ที่ไม่มีโค้ดอยู่ในลิสต์นี้ จะถูกจัดไว้ท้ายสุดตามลำดับที่มาจาก VIGGO
export const SITE_ORDER = [
  'DAD', 'PDR_LPN_PRD', 'PDR_LPN_OPM', 'RAM2', 'VBH_BKK', 'KKP_ASOK', 'VBH_LEAM',
  'THAMC_F1', 'THAMC_F2', 'THAMC_F4', 'THAMC_F5',
  'ARL_BTC', 'ARL_HUM', 'ARL_LKB', 'ARL_MAS_1', 'ARL_MAS_2', 'ARL_PTH', 'ARL_RKH', 'ARL_RPR', 'ARL_SVB',
  'SCB_WEST', 'SCB_EAST', 'SCB_MID',
  'VBH_AMTA', 'SP_SNK',
  'SET_1', 'SET_2', 'SET_3', 'CMA_1', 'CMA_2',
  'RAV_CHM', 'CP-meiji',
  'AOTGA_TH_3', 'AOTGA_TH_2', 'AOTGA_TH_1',
  'CLOUD11',
];
export function orderIndex(code) {
  const i = SITE_ORDER.indexOf(code);
  return i === -1 ? 9999 : i;
}

// ── โค้ดที่ยังไม่ต้องโชว์ในรายงาน (เช่น รถที่ยังอยู่ในคลัง ยังไม่ได้ส่งไซต์) ──
export const EXCLUDED_CODES = ['MTTH_2', 'MTTH_3', 'MTTH_4', 'MTTH_5', 'MTTH_7', '泰国20260822'];

export function siteName(code) {
  return SITE_CONFIG[code]?.site || code || 'ไม่ระบุไซต์';
}
export function siteLabel(code, fallbackName) {
  return SITE_CONFIG[code]?.label || fallbackName;
}

// ถือว่า "ทำงาน" ถ้ามีงานที่จบแล้ว หรือมีพื้นที่/เวลาทำความสะอาด
// (VIGGO นับ task_num เฉพาะงานที่จบแล้ว — รถที่กำลังทำงานอยู่จะมี task_num = 0 แต่มีพื้นที่/เวลาแล้ว)
export function isWorked(r) {
  return Number(r?.task_num) > 0 || Number(r?.actual_clean_area) > 0 || Number(r?.total_time) > 0;
}

export function buildDailyReport(rows, mode = 'morning') {
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
      const worked = isWorked(v);
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
