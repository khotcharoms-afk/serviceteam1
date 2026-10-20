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
const GENERIC = new Set(["site", "ไซต์", "อาคาร", "ชั้น", "โครงการ", "project", "the", "and", "plan", "bkk", "building", "tower",
  "cleaning", "service", "services", "robot", "หุ่นยนต์", "lot1", "floor", "บริษัท", "จำกัด", "co", "ltd"].map(norm));
const hasThai = (t) => /[\u0E00-\u0E7F]/.test(t);
// คำในข้อความ: แยกด้วยช่องว่าง/สัญลักษณ์ และแยกไทยออกจากอังกฤษ ("รัชโยธินWest" → รัชโยธิน, west)
const wordsOf = (s) => String(s || "").toLowerCase().split(/[^a-z0-9\u0E00-\u0E7F]+|(?<=[\u0E00-\u0E7F])(?=[a-z0-9])|(?<=[a-z0-9])(?=[\u0E00-\u0E7F])/)
  .filter(Boolean);
const tokensOf = (...vals) => [...new Set(vals.flatMap(wordsOf).filter((t) => (hasThai(t) ? t.length >= 4 : t.length >= 3) && !GENERIC.has(t)))];
// คำไทยไม่มีช่องว่าง → เทียบแบบมีอยู่ในข้อความ · คำอังกฤษ/รหัส → ต้องตรงทั้งคำ (กัน "era" ไปตรงกับ "TowerA")
const tokenIn = (t, text, words) => (hasThai(t) ? norm(text).includes(t) : words.includes(t));

// คะแนนความเกี่ยวข้องของอุปกรณ์กับเคส: ไซต์ตรงกันได้คะแนนสูงสุด รองลงมาคือคำในชื่อไซต์ และชื่อโครงการที่ตรงกัน
export function matchDevices(devices, caseData, project) {
  const site = norm(caseData.site);
  const siteTokens = tokensOf(caseData.site);
  const projNorm = norm(String(project?.name || "").replace(/^โครงการ/, ""));
  const scored = devices.map((d) => {
    const dSite = norm(d.site), dProj = norm(d.project);
    const dWords = [...wordsOf(d.site), ...wordsOf(d.name)];
    const dText = `${d.site} ${d.name}`;
    let score = 0;
    if (site.length >= 3 && (dSite === site || (site.length >= 5 && dSite.includes(site)) || (dSite.length >= 5 && site.includes(dSite)))) score += 100;
    siteTokens.forEach((t) => { if (tokenIn(t, dText, dWords)) score += 10 + t.length; });
    // ชื่อโครงการในหน้าอุปกรณ์อยู่ในชื่อโครงการของเคส (หรือกลับกัน) เช่น "Plan B" ↔ "โครงการ Plan B Building"
    if (dProj.length >= 4 && projNorm.length >= 4 && (projNorm.includes(dProj) || dProj.includes(projNorm))) score += 20;
    return { d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const best = scored[0].score;
  // ถ้ามีเครื่องที่ตรงไซต์ชัดๆ เอาเฉพาะกลุ่มนั้น ไม่งั้นเอาที่คะแนนใกล้ตัวที่ดีที่สุด
  return scored.filter((x) => x.score >= best * (best >= 100 ? 0.9 : 0.6)).map((x) => x.d);
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

  const matched = useMemo(() => (devices ? matchDevices(devices, caseData, project) : []), [devices, caseData, project]);
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
                  {searched ? "ไม่พบอุปกรณ์ที่ตรงกับคำค้น" : `ไม่พบอุปกรณ์ที่ตรงกับไซต์ "${caseData.site || project?.name || ""}" ลองค้นด้วยชื่ออื่นด้านบน`}
                </div>
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
