// ดึงตัวเลขรายวันของ Smart Pole (Mett Pole) จาก Grafana — bi.know.studio
// ทำแบบเดียวกับโปรแกรม Grafana Navigator ของทีม: ล็อกอินด้วยบัญชีกลาง (สิทธิ์ Viewer พอ)
// → หา dashboard ของแต่ละไซต์ → หา panel ที่ต้องการตามชื่อ → สั่ง query ผ่าน /api/ds/query
// ไม่ต้องใช้ Service Account token และไม่ต้องเปิด Chrome

export const SITES = [
  "[METTRIQ] AOTGA-BKK",
  "[METTRIQ] AOTGA-HKT",
  "[METTRIQ] EXAT",
  "[METTRIQ] KKP",
  "[METTRIQ] MDES",
  "[METTRIQ] PTT AREAR-04",
  "[METTRIQ] PTT AREAR-06",
  "[METTRIQ] SCG",
  "[METTRIQ] Singha Complex",
  "[METTRIQ] Smart Pole – PTT 11 Chai Nat",
  "[METTRIQ] Smart Pole – PTT 11 Nakhon Sawan",
  "[METTRIQ] TRUE Call Center Rangsit",
  "[METTRIQ] TRUE Call Center Srinakarin",
  "[MIOC] Boon Rawd Brewery - SINGHA COMPLEX",
  "[MIOC] DAD",
  "[MIOC] DAD ms_mioc",
];

// panel ที่ต้องการ — เทียบจากชื่อ panel (ตัวพิมพ์เล็ก)
const METRICS = {
  faces: (t) => t.includes("จำนวนใบหน้าที่กล้อง ai สามารถตรวจจับได้ในแต่ละวัน")
    || (t.includes("กล้อง ai") && t.includes("ใบหน้า") && t.includes("แต่ละวัน")),
  vip: (t) => /\bvip\b/.test(t),
  blacklist: (t) => t.includes("blacklist") || t.includes("black list") || t.includes("แบล็คลิสต์") || t.includes("แบล็กลิสต์") || t.includes("บัญชีดำ"),
};
// panel ที่ไม่ใช่ตัวเลข (ภาพ/ข้อความ) ข้ามไป
const SKIP_TYPES = new Set(["text", "row", "news", "dashlist", "alertlist", "annolist", "welcome"]);

const DAY_MS = 86400000;
const BKK_MS = 7 * 3600000;
// เวลา (ms) → วันที่ตามเวลาไทย YYYY-MM-DD
const bkkDate = (ms) => new Date(ms + BKK_MS).toISOString().slice(0, 10);
// ช่วงเวลาของวันนั้นตามเวลาไทย
export function dayRange(date) {
  const start = Date.parse(`${date}T00:00:00+07:00`);
  return { start, end: start + DAY_MS - 1 };
}

const norm = (s) => String(s || "").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

export class GrafanaClient {
  constructor(base, user, password) {
    this.base = base.replace(/\/$/, "");
    this.user = user;
    this.password = password;
    this.cookie = "";
  }

  async login() {
    const res = await fetch(`${this.base}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ user: this.user, password: this.password }),
      redirect: "manual",
    });
    if (res.status !== 200) throw new Error(`ล็อกอิน Grafana ไม่สำเร็จ (HTTP ${res.status}) — เช็ค GRAFANA_USER / GRAFANA_PASSWORD บน Vercel`);
    const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
    this.cookie = raw.flatMap((c) => String(c).split(/,(?=\s*[\w-]+=)/)).map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    if (!this.cookie) throw new Error("ล็อกอิน Grafana แล้วแต่ไม่ได้ session cookie");
  }

  async api(path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Cookie: this.cookie, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) throw new Error(`Grafana ${path.split("?")[0]} HTTP ${res.status}${data?.message ? `: ${data.message}` : ""}`);
    return data;
  }
}

// รวมทุก panel (รวม panel ที่อยู่ใน row ที่ยุบไว้)
function allPanels(panels = []) {
  return panels.flatMap((p) => [p, ...allPanels(p.panels || [])]);
}

// แทนค่าตัวแปรของ dashboard ใน query ($var / ${var} / [[var]]) — /api/ds/query ไม่แทนให้เอง
function applyVars(target, dash) {
  const vars = {};
  for (const v of dash?.templating?.list || []) {
    let val = v?.current?.value;
    if (Array.isArray(val)) val = val.length === 1 ? val[0] : val.map((x) => `'${x}'`).join(",");
    if (val === "$__all" || val == null) continue;
    vars[v.name] = String(val);
  }
  if (!Object.keys(vars).length) return target;
  const rep = (s) => s.replace(/\$\{(\w+)(?::[^}]*)?\}|\[\[(\w+)\]\]|\$(\w+)/g, (m, a, b, c) => {
    const k = a || b || c;
    return k in vars && !k.startsWith("__") ? vars[k] : m;
  });
  const out = { ...target };
  for (const key of ["rawSql", "query", "expr", "rawQuery"]) if (typeof out[key] === "string") out[key] = rep(out[key]);
  return out;
}

// ผลจาก /api/ds/query → ตัวเลขของวันนั้น
// - ถ้ามีคอลัมน์เวลา: รวมค่าของแถวที่ตรงวัน (ตามเวลาไทย)
// - ถ้าไม่มีคอลัมน์เวลา: รวมคอลัมน์ตัวเลขแรก หรือนับแถวถ้าเป็นตารางรายการ
export function valueForDay(result, date) {
  let total = 0, found = false;
  for (const r of Object.values(result?.results || {})) {
    if (r.error) throw new Error(r.error);
    for (const f of r.frames || []) {
      const fields = f.schema?.fields || [];
      const values = f.data?.values || [];
      if (!values.length) continue;
      const ti = fields.findIndex((x) => x.type === "time");
      const ni = fields.findIndex((x, i) => i !== ti && x.type === "number");
      const rows = (values[0] || []).length;
      if (ti >= 0 && ni >= 0) {
        values[ti].forEach((t, i) => {
          const ms = typeof t === "number" ? t : Date.parse(t);
          if (bkkDate(ms) === date) { total += Number(values[ni][i]) || 0; found = true; }
        });
      } else if (ni >= 0) {
        total += values[ni].reduce((s, v) => s + (Number(v) || 0), 0); found = true;
      } else if (rows) {
        total += rows; found = true;
      } else {
        found = true;
      }
    }
  }
  return found ? total : 0;
}

async function queryPanel(client, dash, panel, from, to) {
  const ds = panel.datasource;
  const queries = (panel.targets || []).filter((t) => !t.hide).map((t) => ({ ...applyVars(t, dash), datasource: t.datasource?.uid ? t.datasource : ds }));
  if (!queries.length) throw new Error("panel ไม่มี query");
  return client.api("/api/ds/query", { queries, from: String(from), to: String(to) });
}

// ตัวเลขทั้งหมดของไซต์เดียว
async function siteReport(client, site, dashMeta, date) {
  const out = { site, uid: dashMeta?.uid || "", faces: null, vip: null, blacklist: null, panels: {}, errors: [] };
  if (!dashMeta) { out.errors.push("ไม่พบ dashboard ของไซต์นี้"); return out; }
  const dash = (await client.api(`/api/dashboards/uid/${encodeURIComponent(dashMeta.uid)}`))?.dashboard || {};
  const panels = allPanels(dash.panels).filter((p) => p.targets?.length && !SKIP_TYPES.has(p.type));
  const { start, end } = dayRange(date);
  for (const [key, match] of Object.entries(METRICS)) {
    const panel = panels.find((p) => match(norm(p.title)));
    if (!panel) continue;
    out.panels[key] = panel.title;
    try {
      // ใบหน้า: panel เป็นกราฟรายวัน 30 วัน → query ย้อนหลังแล้วหยิบวันที่ต้องการ
      // VIP/Blacklist: query เฉพาะวันนั้น
      const from = key === "faces" ? start - 30 * DAY_MS : start;
      const res = await queryPanel(client, dash, panel, from, end);
      out[key] = valueForDay(res, date);
    } catch (e) {
      out.errors.push(`${panel.title}: ${e.message}`);
    }
  }
  if (!Object.keys(out.panels).length) out.errors.push("ไม่พบ panel ใบหน้า/VIP/Blacklist ใน dashboard นี้");
  return out;
}

// หา dashboard ของไซต์: ชื่อตรงกันพอดีก่อน แล้วค่อยหาแบบ "มีชื่อไซต์อยู่ในชื่อ"
// โดยไม่เอา dashboard ของไซต์อื่นที่ชื่อยาวกว่าแต่ครอบชื่อนี้ (เช่น [MIOC] DAD กับ [MIOC] DAD ms_mioc)
export function findDashboard(list, site) {
  const n = norm(site);
  const longer = SITES.filter((o) => o !== site && norm(o).includes(n)).map(norm);
  return list.find((d) => norm(d.title) === n)
    || list.find((d) => { const t = norm(d.title); return t.includes(n) && !longer.some((o) => t.includes(o)); });
}

export async function smartPoleReport({ base, user, password, date }) {
  const client = new GrafanaClient(base, user, password);
  await client.login();
  const list = (await client.api("/api/search?type=dash-db&limit=500")) || [];
  const findDash = (site) => findDashboard(list, site);
  const results = [];
  // ทีละ 4 ไซต์ ไม่ยิงพร้อมกันทั้ง 16
  for (let i = 0; i < SITES.length; i += 4) {
    results.push(...await Promise.all(SITES.slice(i, i + 4).map(async (site) => {
      try { return await siteReport(client, site, findDash(site), date); }
      catch (e) { return { site, faces: null, vip: null, blacklist: null, panels: {}, errors: [e.message] }; }
    })));
  }
  return results;
}
