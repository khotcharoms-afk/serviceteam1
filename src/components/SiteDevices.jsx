// src/components/SiteDevices.jsx — อุปกรณ์/รีโมทของไซต์ในเคส (แสดงในหน้ารายละเอียดเคส)
// โหลด collection "devices" เมื่อกดเปิดครั้งแรก (แคชไว้ 10 นาที) แล้วจับคู่กับไซต์/โครงการของเคส
// ชื่อโครงการในหน้าอุปกรณ์ไม่จำเป็นต้องตรงกับชื่อโครงการในระบบ → จับคู่แบบคล้ายกัน และมีช่องค้นหาเองได้
import { useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useTheme } from "../theme.js";
import EyeIcon from "./EyeIcon.jsx";

let cache = { list: null, at: 0 };
async function loadDevices() {
  if (cache.list && Date.now() - cache.at < 10 * 60 * 1000) return cache.list;
  const snap = await getDocs(collection(db, "devices"));
  cache = { list: snap.docs.map((d) => ({ id: d.id, ...d.data() })), at: Date.now() };
  return cache.list;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[\s_\-()/.,:]+/g, "");
const GENERIC = new Set(["site", "ไซต์", "อาคาร", "ชั้น", "โครงการ", "project", "the", "and", "plan", "building", "tower",
  "cleaning", "service", "services", "smart", "robot", "หุ่นยนต์", "lot1", "floor", "บริษัท", "จำกัด", "co", "ltd"].map(norm));
const hasThai = (t) => /[\u0E00-\u0E7F]/.test(t);
// คำในข้อความ: แยกด้วยช่องว่าง/สัญลักษณ์ และแยกไทยออกจากอังกฤษ ("รัชโยธินWest" → รัชโยธิน, west)
const wordsOf = (s) => String(s || "").toLowerCase().split(/[^a-z0-9\u0E00-\u0E7F]+|(?<=[\u0E00-\u0E7F])(?=[a-z0-9])|(?<=[a-z0-9])(?=[\u0E00-\u0E7F])/)
  .filter(Boolean);
// คำนำหน้าชื่อสถานที่ที่ไม่ใช่ชื่อจริง ("สถานีราชปรารภ" → "ราชปรารภ")
const TH_PREFIX = /^(สถานี|สาขา|โรงพยาบาล|รพ|อาคาร|ตึก|ศูนย์การแพทย์|ศูนย์|ห้าง|บริษัท|โครงการ|มหาวิทยาลัย|โรงเรียน|คลัง)/;
const stripPrefix = (t) => (hasThai(t) ? t.replace(TH_PREFIX, "") : t);
const tokensOf = (...vals) => [...new Set(vals.flatMap(wordsOf).map(stripPrefix)
  .filter((t) => (hasThai(t) ? t.length >= 4 : t.length >= 3) && !GENERIC.has(t)))];
// คำไทยไม่มีช่องว่าง → เทียบแบบมีอยู่ในข้อความ · คำอังกฤษ/รหัส → ต้องตรงทั้งคำ (กัน "era" ไปตรงกับ "TowerA")
const tokenIn = (t, text, words) => (hasThai(t) ? norm(text).includes(t) : words.includes(t));

// คะแนนความเกี่ยวข้องของอุปกรณ์กับเคส: ไซต์ตรงกันได้คะแนนสูงสุด รองลงมาคือคำในชื่อไซต์ และชื่อโครงการที่ตรงกัน
// ชื่อเรียกอื่นของไซต์ (รหัสสนามบินในหน้าอุปกรณ์ ↔ ชื่อที่ใช้ในเคส)
const SITE_ALIASES = {
  bkk: ["สุวรรณภูมิ", "suvarnabhumi"], dmk: ["ดอนเมือง", "donmueang", "donmuang"], hdy: ["หาดใหญ่", "hatyai"],
  pkt: ["ภูเก็ต", "phuket"], cnx: ["เชียงใหม่", "chiangmai"], cei: ["เชียงราย", "chiangrai"], usm: ["สมุย", "samui"],
  kbv: ["กระบี่", "krabi"], utp: ["อู่ตะเภา", "utapao"],
};

// แยกคะแนนเป็น 2 ส่วน: site = ไซต์ตรงกัน, proj = โครงการตรงกัน
// คืน { list, byProject } — list = เครื่องที่ตรงไซต์ (หรือทั้งโครงการถ้าเคสไม่ได้ระบุไซต์), byProject = ทุกเครื่องของโครงการ
export function matchDevices(devices, caseData, project) {
  const projNorm = norm(String(project?.name || "").replace(/^โครงการ/, ""));
  const inProject = (d) => { const dp = norm(d.project); return dp.length >= 4 && projNorm.length >= 4 && (projNorm.includes(dp) || dp.includes(projNorm)); };
  const loose = devices.filter(inProject);
  // ชื่อโครงการตรงกันทั้งชื่อ (เช่น "Plan B Billboard") → ไม่ต้องเอาโครงการชื่อสั้นกว่า ("Plan B") มาปน
  const exact = loose.filter((d) => norm(d.project) === projNorm);
  const byProject = (exact.length ? exact : loose).slice()
    .sort((a, b) => String(a.site || "").localeCompare(String(b.site || ""), "th", { numeric: true }));

  // ไม่ได้เลือกไซต์ → ใช้ชื่อโครงการเป็นตัวบอกไซต์ เช่น "Workforce Phuket (Smart Cleaning)" → Phuket → PKT
  // (ตัดคำที่เป็นชื่อโครงการในหน้าอุปกรณ์ออก เช่น "Workforce")
  let siteText = caseData.site || "";
  let pool = devices;
  if (!siteText && byProject.length) {
    const projWords = new Set(byProject.flatMap((d) => wordsOf(d.project)));
    siteText = wordsOf(String(project?.name || "").replace(/^โครงการ/, "")).filter((w) => !projWords.has(w)).join(" ");
    pool = byProject;
  }
  const site = norm(siteText);
  const siteTokens = tokensOf(siteText);
  // ไซต์ "สุวรรณภูมิ" → เพิ่มรหัส bkk ให้ไปตรงกับไซต์ "BKK" ในหน้าอุปกรณ์ (และกลับกัน)
  Object.entries(SITE_ALIASES).forEach(([code, names]) => {
    if (names.some((n) => site.includes(norm(n))) && !siteTokens.includes(code)) siteTokens.push(code);
    if (siteTokens.includes(code)) names.forEach((n) => { if (!siteTokens.includes(norm(n))) siteTokens.push(norm(n)); });
  });
  const inferred = !caseData.site && !!site;
  if (!site) return { list: byProject, byProject };

  const hits = pool.map((d) => {
    const dSite = norm(d.site);
    const dWords = [...wordsOf(d.site), ...wordsOf(d.name)];
    const dText = `${d.site} ${d.name}`;
    let score = 0;
    if (site.length >= 3 && (dSite === site || (site.length >= 5 && dSite.includes(site)) || (dSite.length >= 5 && site.includes(dSite)))) score += 100;
    siteTokens.forEach((t) => { if (tokenIn(t, dText, dWords)) score += 10 + t.length; });
    // กลับด้าน: ชื่อไทยของอุปกรณ์อยู่ในไซต์ของเคส เช่น อุปกรณ์ "ราชปรารภ" ↔ เคส "สถานีราชปรารภ"
    tokensOf(d.site).filter(hasThai).forEach((t) => { if (site.includes(t) && !siteTokens.includes(t)) score += 10 + t.length; });
    if (score && inProject(d)) score += 20; // เครื่องของโครงการเดียวกันมาก่อนไซต์ชื่อซ้ำของโครงการอื่น
    return { d, score };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score);

  if (!hits.length) return { list: caseData.site ? [] : byProject, byProject };
  const best = hits[0].score;
  const list = hits.filter((x) => x.score >= best * (best >= 100 ? 0.9 : 0.75)).map((x) => x.d);
  return { list, byProject, inferredSite: inferred ? [...new Set(list.map((d) => d.site))].join(", ") : "" };
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
}

function Val({ label, value, href, secret, c, onCopied }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.card, border: `1px solid ${c.border}`, borderRadius: 7,
      padding: "2px 4px 2px 7px", fontSize: 12, maxWidth: "100%" }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: c.text400 }}>{label}</span>
      <span style={{ color: c.text900, fontVariantNumeric: "tabular-nums", wordBreak: "break-all" }}>{secret && !show ? "••••••" : value}</span>
      {secret && <button onClick={() => setShow((s) => !s)} title={show ? "ซ่อนรหัส" : "แสดงรหัส"} style={btn(c)}><EyeIcon off={show} size={13} /></button>}
      {href && <a href={href} title="เปิดโปรแกรมรีโมท" style={{ ...btn(c), textDecoration: "none", color: "#6B21A8", fontWeight: 800 }}>↗</a>}
      <button onClick={() => { copyText(value); onCopied(label); }} title={`คัดลอก ${label}`} style={btn(c)}>⧉</button>
    </span>
  );
}
const btn = (c) => ({ border: "none", background: "transparent", color: c.text400, cursor: "pointer", padding: "0 3px", fontSize: 12.5,
  lineHeight: 1, display: "inline-flex", alignItems: "center", fontFamily: "inherit" });
const remoteHref = (kind, id) => (/^\d[\d ]+$/.test(id || "") ? `${kind === "anydesk" ? "anydesk:" : "rustdesk://"}${id.replace(/\s/g, "")}` : null);

export default function SiteDevices({ caseData, project }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !devices) {
      try { setDevices(await loadDevices()); } catch (e) { console.error(e); setError("โหลดข้อมูลอุปกรณ์ไม่สำเร็จ"); }
    }
  }

  const [showAllProject, setShowAllProject] = useState(false);
  const { list: siteMatched, byProject, inferredSite } = useMemo(() => (devices ? matchDevices(devices, caseData, project) : { list: [], byProject: [] }),
    [devices, caseData.site, project]); // eslint-disable-line react-hooks/exhaustive-deps
  const matched = showAllProject ? byProject : siteMatched;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searched = useMemo(() => {
    if (!devices || !words.length) return null;
    return devices.filter((d) => {
      const t = [d.project, d.site, d.name, d.type, d.model, d.ip, d.anydesk, d.serial].join(" ").toLowerCase();
      return words.every((w) => t.includes(w));
    });
  }, [devices, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = (searched || matched).slice(0, 30);
  const onCopied = (label) => { setCopied(`คัดลอก ${label} แล้ว`); setTimeout(() => setCopied(""), 1400); };

  return (
    <div style={{ marginBottom: 16, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={toggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: c.borderSoft,
        border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 15 }}>🖥️</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: c.text900 }}>อุปกรณ์ / รีโมท ของไซต์นี้</span>
        {devices && !searched && <span style={{ fontSize: 11.5, color: c.text400 }}>{matched.length ? `${matched.length} เครื่อง` : "ไม่พบที่ตรง"}</span>}
        <span style={{ color: c.text400, fontSize: 12 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 12px 12px", background: c.bg }}>
          {!devices && !error && <div style={{ fontSize: 12.5, color: c.text400, padding: 6 }}>กำลังโหลด…</div>}
          {error && <div style={{ fontSize: 12.5, color: "#DC2626" }}>{error}</div>}
          {devices && (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นอุปกรณ์อื่น (ชื่อไซต์ / เครื่อง / IP / AnyDesk)"
                style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 9, padding: "7px 10px", fontSize: 12.5, outline: "none",
                  background: c.card, color: c.text900, marginBottom: 8, fontFamily: "inherit" }} />
              {!list.length && (
                <div style={{ fontSize: 12.5, color: c.text400, padding: "4px 2px" }}>
                  {searched ? "ไม่พบอุปกรณ์ที่ตรงกับคำค้น" : caseData.site ? `ไม่พบอุปกรณ์ของไซต์ "${caseData.site}" ลองค้นด้วยชื่ออื่นด้านบน` : "ไม่พบอุปกรณ์ของโครงการนี้ ลองค้นด้านบน"}
                </div>
              )}
              {!searched && !caseData.site && list.length > 0 && !showAllProject && (
                <div style={{ fontSize: 11.5, color: c.text400, margin: "0 2px 6px" }}>
                  {inferredSite ? `ไซต์จากชื่อโครงการ: ${inferredSite}` : "ยังไม่ได้เลือกไซต์ — แสดงทุกเครื่องของโครงการ"}
                </div>
              )}
              {!searched && (caseData.site || inferredSite) && byProject.length > 0 && (showAllProject || byProject.length > siteMatched.length) && (
                <button onClick={() => setShowAllProject((v) => !v)} style={{ border: `1px dashed ${c.border}`, background: c.card, color: "#6B21A8",
                  borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
                  {showAllProject ? `แสดงเฉพาะไซต์ "${caseData.site || inferredSite}"` : `ดูทุกเครื่องของโครงการนี้ (${byProject.length})`}
                </button>
              )}
              <div style={{ display: "grid", gap: 6 }}>
                {list.map((d) => {
                  const contact = String(d.note || "").split(" · ").find((n) => n.startsWith("ติดต่อหน้างาน:"));
                  return (
                    <div key={d.id} style={{ background: c.card, border: `1px solid ${c.borderSoft}`, borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                        {d.type && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#6B21A8", background: "#6B21A814", borderRadius: 5, padding: "1px 6px" }}>{d.type}</span>}
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.text900 }}>{d.name}</span>
                        <span style={{ fontSize: 11.5, color: c.text400 }}>{[d.project, d.site].filter(Boolean).join(" / ")}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <Val label="AnyDesk" value={d.anydesk} href={remoteHref("anydesk", d.anydesk)} c={c} onCopied={onCopied} />
                        <Val label="RustDesk" value={d.rustdesk} href={remoteHref("rustdesk", d.rustdesk)} c={c} onCopied={onCopied} />
                        <Val label="IP" value={d.ip ? (d.port ? `${d.ip}:${d.port}` : d.ip) : ""} c={c} onCopied={onCopied} />
                        <Val label="Public" value={d.publicIp ? (d.publicPort ? `${d.publicIp}:${d.publicPort}` : d.publicIp) : ""} c={c} onCopied={onCopied} />
                        <Val label="User" value={d.username} c={c} onCopied={onCopied} />
                        <Val label="Pass" value={d.password} secret c={c} onCopied={onCopied} />
                      </div>
                      {contact && <div style={{ fontSize: 12, color: c.text500, marginTop: 5 }}>📞 {contact.replace("ติดต่อหน้างาน: ", "")}</div>}
                    </div>
                  );
                })}
              </div>
              {copied && <div style={{ fontSize: 12, color: "#16A34A", marginTop: 6, fontWeight: 700 }}>✓ {copied}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
