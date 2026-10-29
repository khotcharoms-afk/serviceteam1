// สถานะกล้องรถ EV จาก Imou Open Platform (open.imoulife.com) — ใช้กับรายงาน EV Car ในหน้า Smart Pole
// บัญชี Imou ของ Metthier: Data Center = East Asia → server openapi-sg.easy4ip.com
// รูปแบบคำขอ (ตามเอกสาร Imou): POST {base}/openapi/{method}
//   body = { system: { ver, appId, sign, time, nonce }, id, params }  · sign = md5("time:{t},nonce:{n},appSecret:{secret}")
import crypto from "crypto";

// กล้องของแต่ละคัน (deviceId ใน Imou = S/N ของกล้อง) — ตาม inventory_EVMT · EV11 ยังไม่มี S/N กล้อง
export const EV_CAMS = {
  ev01: ["61407AHPSFDF027", "61407AHPSF920FC", "61407AHPSF20761", "61407AHPSF4B1AA"],
  ev02: ["61407AHPSFD5C28", "61407AHPSF86127", "61407AHPSF7FD49", "61407AHPSF08036"],
  ev03: ["61407AHPSF916A0", "61407AHPSF11001", "61407AHPSF8D9AF", "61407AHPSFF26C4"],
  ev04: ["61407AHPSF9316E", "61407AHPSF70AFD", "61407AHPSF510E4", "61407AHPSF3A70F"],
  ev05: ["61407AHPSF89D15", "61407AHPSFE7D95", "61407AHPSF0E476", "61407AHPSF9CB92"],
  ev06: ["61407AHPSF57CA0", "61407AHPSFB19AE", "61407AHPSF0A5AA", "61407AHPSFFAAB3"],
  ev07: ["02E6AAJPSFFD010", "02E6AAJPSF19B39", "02E6AAJPSF28ABE", "02E6AAJPSF19F86"],
  ev08: ["02E6AAJPSFCA970", "02E6AAJPSFF88D0", "02E6AAJPSF93BFB", "02E6AAJPSF48287"],
  ev09: ["02E6AAJPSF4F515", "02E6AAJPSFED903", "02E6AAJPSF2067A", "02E6AAJPSF5C4C4"],
  ev10: ["4707EBBPSFBB30F", "4707EBBPSF25555", "4707EBBPSFB5587", "4707EBBPSFF5538"],
};

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
let tokenCache = null; // { token, exp } — token ของ Imou ใช้ได้หลายวัน เก็บไว้ในหน่วยความจำของ function

export class ImouClient {
  constructor(appId, appSecret, base = "https://openapi-sg.easy4ip.com") {
    this.appId = appId; this.appSecret = appSecret; this.base = base.replace(/\/$/, "");
    this.calls = 0;
  }

  async call(method, params = {}) {
    const time = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString("hex");
    const body = {
      system: { ver: "1.0", appId: this.appId, sign: md5(`time:${time},nonce:${nonce},appSecret:${this.appSecret}`), time, nonce },
      id: crypto.randomUUID(),
      params,
    };
    this.calls++;
    const res = await fetch(`${this.base}/openapi/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`Imou ${method}: ตอบกลับผิดรูปแบบ (HTTP ${res.status})`); }
    const r = json.result || json;
    if (String(r.code) !== "0") throw new Error(`Imou ${method}: ${r.code || "?"} ${r.msg || ""}`.trim());
    return r.data || {};
  }

  async token() {
    if (tokenCache && tokenCache.appId === this.appId && tokenCache.exp > Date.now() + 60000) return tokenCache.token;
    const d = await this.call("accessToken");
    if (!d.accessToken) throw new Error("Imou ไม่ส่ง accessToken กลับมา");
    tokenCache = { appId: this.appId, token: d.accessToken, exp: Date.now() + (Number(d.expireTime) || 3600) * 1000 };
    return d.accessToken;
  }
}

// อ่านสถานะออนไลน์จากหลายรูปแบบที่ Imou ใช้ ("online"/"offline", "1"/"0", true/false)
export function parseOnline(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).toLowerCase();
  if (["online", "1", "true", "on"].includes(s)) return true;
  if (["offline", "0", "false", "off", "sleep", "dormant"].includes(s)) return false;
  return null;
}
const devOnline = (d) => parseOnline(d.deviceStatus ?? d.status ?? d.onLine ?? d.online ?? d.deviceOnline);

// รายชื่ออุปกรณ์ทั้งหมดที่บัญชีเห็น (รวมอุปกรณ์ที่คนอื่นแชร์มา)
async function listDevices(client, token) {
  const out = new Map();
  // 1) แบบแบ่งหน้า (มีสถานะมาด้วย)
  try {
    for (let page = 1; page <= 5; page++) {
      const d = await client.call("listDeviceDetailsByPage", { token, page, pageSize: 50 });
      const list = d.deviceList || [];
      list.forEach((x) => out.set(String(x.deviceId), { id: String(x.deviceId), name: x.deviceName || x.name || "", online: devOnline(x) }));
      if (list.length < 50) break;
    }
  } catch (e) { out.errorPaged = e.message; }
  // 2) รวมอุปกรณ์ที่ถูกแชร์มา (bindAndShare)
  try {
    const d = await client.call("deviceBaseList", { token, bindId: -1, limit: 128, type: "bindAndShare", needApInfo: false });
    (d.deviceList || []).forEach((x) => {
      const id = String(x.deviceId);
      const prev = out.get(id) || {};
      const chName = (x.channels || x.channelList || [])[0]?.channelName;
      out.set(id, { id, name: prev.name || x.deviceName || chName || x.name || "", online: prev.online ?? devOnline(x), shared: x.shareFlag ?? x.share ?? undefined });
    });
  } catch (e) { out.errorBase = e.message; }
  return out;
}

export async function evStatus({ appId, appSecret, base }) {
  const client = new ImouClient(appId, appSecret, base);
  const token = await client.token();
  const devices = await listDevices(client, token);
  const errors = [devices.errorPaged && `listDeviceDetailsByPage: ${devices.errorPaged}`, devices.errorBase && `deviceBaseList: ${devices.errorBase}`].filter(Boolean);

  // กล้องที่ยังไม่รู้สถานะ → ถามทีละตัว (deviceOnline) เฉพาะกล้องของรถ EV
  const wanted = Object.values(EV_CAMS).flat();
  for (const sn of wanted) {
    const d = devices.get(sn);
    if (d && d.online !== null && d.online !== undefined) continue;
    try {
      const r = await client.call("deviceOnline", { token, deviceId: sn });
      const online = parseOnline(r.onLine ?? r.online ?? r.status);
      devices.set(sn, { ...(d || { id: sn, name: "" }), online, found: !!d || online !== null });
    } catch (e) {
      if (!d) devices.set(sn, { id: sn, name: "", online: null, error: e.message });
    }
  }

  const cars = {};
  for (const [car, sns] of Object.entries(EV_CAMS)) {
    const cams = sns.map((sn) => devices.get(sn) || { id: sn, name: "", online: null });
    const known = cams.filter((x) => x.online !== null && x.online !== undefined);
    cars[car] = {
      online: known.length ? cams.some((x) => x.online === true) : null, // มีกล้องออนไลน์อย่างน้อย 1 ตัว = รถออนไลน์
      camsOnline: cams.filter((x) => x.online === true).length,
      cams: cams.map((x) => ({ sn: x.id, name: x.name, online: x.online ?? null, error: x.error })),
    };
  }
  return { cars, deviceCount: [...devices.keys()].length, apiCalls: client.calls, errors };
}
