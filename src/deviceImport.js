// src/deviceImport.js — แปลงไฟล์ Excel ⇄ ข้อมูลอุปกรณ์ (collection "devices")
// ใช้รูปแบบไฟล์เดียว: ชีตแรก แถวแรกเป็นหัวคอลัมน์ตาม DEVICE_COLUMNS (ไทยหรือ key อังกฤษก็ได้)

export const DEVICE_COLUMNS = [
  { key: "project", label: "โครงการ" },
  { key: "site", label: "ไซต์" },
  { key: "type", label: "ประเภท" },
  { key: "name", label: "ชื่ออุปกรณ์" },
  { key: "brand", label: "ยี่ห้อ" },
  { key: "model", label: "รุ่น" },
  { key: "serial", label: "S/N" },
  { key: "firmware", label: "Firmware" },
  { key: "ip", label: "Local IP" },
  { key: "port", label: "Port" },
  { key: "publicIp", label: "Public IP" },
  { key: "publicPort", label: "Public Port" },
  { key: "subnet", label: "Subnet" },
  { key: "gateway", label: "Gateway" },
  { key: "anydesk", label: "AnyDesk" },
  { key: "rustdesk", label: "RustDesk" },
  { key: "username", label: "Username" },
  { key: "password", label: "Password" },
  { key: "accounts", label: "บัญชีอื่น" },
  { key: "rtsp", label: "RTSP" },
  { key: "storage", label: "Storage" },
  { key: "note", label: "หมายเหตุ" },
];

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const HEADER_TO_KEY = new Map();
for (const c of DEVICE_COLUMNS) {
  HEADER_TO_KEY.set(norm(c.label), c.key);
  HEADER_TO_KEY.set(norm(c.key), c.key);
}
// ชื่อหัวคอลัมน์แบบอื่นที่พบบ่อย
[["site", "site"], ["device", "name"], ["ip", "ip"], ["rushdesk", "rustdesk"], ["user", "username"],
  ["device type", "type"], ["name device", "name"], ["description", "note"]].forEach(([h, k]) => {
  if (!HEADER_TO_KEY.has(h)) HEADER_TO_KEY.set(h, k);
});

function cell(v) {
  if (v === null || v === undefined) return "";
  const t = String(v).trim();
  return t === "-" ? "" : t.replace(/\s+/g, " ");
}

// "user / pass" หนึ่งบัญชีต่อบรรทัด
export function parseAccounts(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(" / ");
      return i >= 0 ? { username: l.slice(0, i).trim(), password: l.slice(i + 3).trim() } : { username: l, password: "" };
    });
}
export const formatAccounts = (accounts = []) =>
  accounts.map((a) => `${a.username || ""} / ${a.password || ""}`).join("\n");

// rows = array of arrays (แถวแรกเป็นหัวคอลัมน์) → { devices, unknownHeaders }
export function rowsToDevices(rows) {
  if (!rows?.length) return { devices: [], unknownHeaders: [] };
  const header = rows[0].map((h) => HEADER_TO_KEY.get(norm(h)) || null);
  const unknownHeaders = rows[0].filter((h, i) => cell(h) && !header[i]).map(cell);
  if (!header.includes("name") && !header.includes("ip")) {
    throw new Error("ไม่พบหัวคอลัมน์ \"ชื่ออุปกรณ์\" หรือ \"Local IP\" ในแถวแรก — ใช้ไฟล์รูปแบบเดียวกับปุ่มส่งออก");
  }
  const devices = [];
  for (const r of rows.slice(1)) {
    const d = {};
    DEVICE_COLUMNS.forEach((c) => { d[c.key] = c.key === "accounts" ? [] : ""; });
    header.forEach((key, i) => {
      if (!key) return;
      if (key === "accounts") d.accounts = parseAccounts(r[i]);
      else d[key] = cell(r[i]);
    });
    if (!d.name && !d.ip && !d.anydesk && !d.model) continue; // แถวว่าง
    if (!d.name) d.name = d.type || d.ip || d.anydesk;
    devices.push(d);
  }
  return { devices, unknownHeaders };
}

export function devicesToRows(devices) {
  return [
    DEVICE_COLUMNS.map((c) => c.label),
    ...devices.map((d) => DEVICE_COLUMNS.map((c) => (c.key === "accounts" ? formatAccounts(d.accounts) : d[c.key] ?? ""))),
  ];
}

// ค่าที่ใช้ค้นหา (ไม่รวมรหัสผ่าน)
export function deviceSearchText(d) {
  return [d.project, d.site, d.type, d.name, d.brand, d.model, d.serial, d.ip, d.publicIp, d.anydesk, d.rustdesk,
    d.username, d.note, ...(d.accounts || []).map((a) => a.username)].join(" ").toLowerCase();
}

// เรียงตามโครงการ → ไซต์ → ลำดับเดิมในไฟล์
export function sortDevices(list) {
  return [...list].sort((a, b) =>
    (a.project || "").localeCompare(b.project || "", "th") ||
    (a.site || "").localeCompare(b.site || "", "th", { numeric: true }) ||
    (a.order ?? 0) - (b.order ?? 0));
}
