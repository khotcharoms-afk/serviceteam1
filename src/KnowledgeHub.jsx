// src/KnowledgeHub.jsx — คลังวิธีแก้ปัญหาของทีม (Firestore "knowledge")
// บทความ: title, category, problem (อาการ), cause (สาเหตุ), solution (วิธีแก้ — 1 บรรทัด = 1 ขั้นตอน), tags (คำค้นเพิ่มเติม)
// บทความเก่าที่ยังไม่มี category จะเดาหมวดจากชื่อ/แท็กเพื่อแสดงผล (ไม่เขียนกลับจนกว่าจะแก้ไข)
// ผู้ช่วย AI ค้นบทความเหล่านี้ผ่าน search_knowledge ใน src/assistantTools.js

import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { useTheme } from "./theme.js";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";

const PURPLE = "#6B21A8";
const RED = "#DC2626";

export const KB_CATEGORIES = [
  { key: "WMS",            icon: "📦", color: "#2563EB" },
  { key: "หุ่นยนต์",         icon: "🤖", color: "#C026D3" },
  { key: "CCTV / NVR",     icon: "📹", color: "#0F766E" },
  { key: "Network",        icon: "🌐", color: "#EA580C" },
  { key: "Access Control", icon: "🚪", color: "#7C3AED" },
  { key: "Smart Pole",     icon: "🗼", color: "#0891B2" },
  { key: "Software อื่นๆ",  icon: "💻", color: "#475569" },
  { key: "Hardware",       icon: "🔧", color: "#92400E" },
  { key: "อื่นๆ",           icon: "💡", color: "#64748B" },
];
const catInfo = (k) => KB_CATEGORIES.find((x) => x.key === k) || KB_CATEGORIES[KB_CATEGORIES.length - 1];

// หมวดของบทความ (บทความเก่าไม่มี category → เดาจากชื่อ/แท็ก)
export function categoryOf(a) {
  if (a.category && KB_CATEGORIES.some((x) => x.key === a.category)) return a.category;
  const t = `${a.title || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
  if (/\bwms\b/.test(t)) return "WMS";
  if (/robot|หุ่นยนต์|sc50|sc80|mix1/.test(t)) return "หุ่นยนต์";
  if (/cctv|nvr|กล้อง/.test(t)) return "CCTV / NVR";
  if (/network|router|switch|vpn|wifi|เน็ต/.test(t)) return "Network";
  if (/access control|face scan|ประตู/.test(t)) return "Access Control";
  if (/smart pole/.test(t)) return "Smart Pole";
  if (/software/.test(t)) return "Software อื่นๆ";
  if (/hardware/.test(t)) return "Hardware";
  return "อื่นๆ";
}

// วิธีแก้ → รายการขั้นตอน (ตัดเลขข้อเดิมออก)
const toSteps = (text) => String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  .map((l) => l.replace(/^(\d+[.)]|[-•*])\s*/, ""));

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear() + 543}`;
};

function Highlight({ text, words }) {
  if (!words.length || !text) return text || null;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(text).split(re).map((part, i) =>
    i % 2 ? <mark key={i} style={{ background: "#FDE68A", color: "inherit", borderRadius: 3, padding: "0 1px" }}>{part}</mark> : part);
}

// ── ฟอร์มเพิ่ม/แก้ไข ──
export function KnowledgeModal({ onClose, onSave, saving, editRecord, heading, intro }) {
  const { c } = useTheme();
  const [title, setTitle] = useState(editRecord?.title || "");
  const [category, setCategory] = useState(editRecord ? categoryOf(editRecord) : "");
  const [problem, setProblem] = useState(editRecord?.problem || "");
  const [cause, setCause] = useState(editRecord?.cause || "");
  const [solution, setSolution] = useState(editRecord?.solution || "");
  const [tagText, setTagText] = useState((editRecord?.tags || []).join(", "));

  const IS = { width: "100%", boxSizing: "border-box", border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5,
    fontFamily: "inherit", outline: "none", background: c.bg, color: c.text900, lineHeight: 1.6 };
  const LB = { fontSize: 12, color: c.text500, fontWeight: 700, marginBottom: 5, display: "block" };
  const HINT = { fontWeight: 400, color: c.text400, fontSize: 11.5 };

  const shortTitle = title.trim() && (title.trim().length < 10 || !/\s/.test(title.trim()));
  const steps = toSteps(solution);
  const canSave = title.trim() && solution.trim() && category && !saving;

  function handleSave() {
    if (!canSave) return;
    onSave({
      title: title.trim(), category, problem: problem.trim(), cause: cause.trim(), solution: solution.trim(),
      tags: [...new Set(tagText.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))],
    }, editRecord?.id || null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.card, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "94vh",
        overflowY: "auto", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: c.text900 }}>{editRecord?.id ? "✏️ แก้ไขบทความ" : heading || "📝 เพิ่มบทความ"}</h2>
          <button onClick={onClose} style={{ background: c.borderSoft, border: "none", color: c.text500, cursor: "pointer", fontSize: 14, width: 30, height: 30, borderRadius: 8 }}>✕</button>
        </div>
        {intro && <div style={{ fontSize: 13, color: c.text500, background: "#16A34A10", border: "1px solid #16A34A33", borderRadius: 10,
          padding: "9px 12px", margin: "-4px 0 14px", lineHeight: 1.6 }}>{intro}</div>}

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>หมวด *</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {KB_CATEGORIES.map((k) => {
              const on = category === k.key;
              return (
                <button key={k.key} type="button" onClick={() => setCategory(k.key)}
                  style={{ padding: "6px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${on ? k.color : c.border}`, background: on ? k.color : c.bg, color: on ? "#fff" : c.text500 }}>
                  {k.icon} {k.key}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>หัวข้อ * <span style={HINT}>— บอกอาการให้ค้นเจอง่าย</span></label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น WMS กด D/O ไม่ได้, หุ่นยนต์ SC50 ค้างหน้า Login" style={IS} />
          {shortTitle && <div style={{ fontSize: 12, color: "#B45309", marginTop: 4 }}>⚠️ หัวข้อสั้นไป ลองใส่อาการด้วย เช่น "{title.trim()} …ไม่ได้ / error อะไร" จะค้นเจอง่ายขึ้น</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>🔴 อาการ <span style={HINT}>— เจออะไร error อะไร ที่หน้าไหน</span></label>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} placeholder="เช่น กดปุ่ม D/O แล้วขึ้น error 500 / หุ่นยนต์หยุดกลางทาง ไฟแดงกระพริบ" style={{ ...IS, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>🟠 สาเหตุ <span style={HINT}>— ถ้ารู้ (ไม่บังคับ)</span></label>
          <textarea value={cause} onChange={(e) => setCause(e.target.value)} rows={2} placeholder="เช่น ข้อมูล shipment ไม่ครบ / แบตต่ำกว่า 10%" style={{ ...IS, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>✅ วิธีแก้ * <span style={HINT}>— ขึ้นบรรทัดใหม่ = ขั้นตอนถัดไป</span></label>
          <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={5}
            placeholder={"เข้าเมนู Booking\nแก้น้ำหนักให้ตรงกับใบ AWB\nกด Save แล้วไปที่หน้า Shipment"} style={{ ...IS, resize: "vertical" }} />
          {steps.length > 1 && <div style={{ fontSize: 11.5, color: c.text400, marginTop: 4 }}>จะแสดงเป็น {steps.length} ขั้นตอน</div>}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={LB}>คำค้นเพิ่มเติม <span style={HINT}>— คั่นด้วย , เช่น ชื่อลูกค้า รหัส error ชื่อเมนู</span></label>
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="เช่น Import, AWB, E01" style={IS} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button onClick={onClose} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500, borderRadius: 10, padding: 12, fontSize: 14,
            fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={!canSave} style={{ background: PURPLE, border: "none", color: "#fff", borderRadius: 10, padding: 12, fontSize: 14,
            fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit", opacity: canSave ? 1 : 0.5 }}>
            {saving ? "กำลังบันทึก..." : !category ? "เลือกหมวดก่อน" : "💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── บทความหนึ่งรายการ ──
function Article({ a, open, onToggle, words, c, canDelete, onEdit, onDelete }) {
  const cat = catInfo(categoryOf(a));
  const steps = toSteps(a.solution);
  const preview = (a.problem || steps[0] || "").replace(/\s+/g, " ");
  const Section = ({ label, color, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
  return (
    <div style={{ background: c.card, border: `1px solid ${open ? cat.color + "66" : c.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: cat.color + "16", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0 }}>{cat.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: c.text900, lineHeight: 1.4, wordBreak: "break-word" }}><Highlight text={a.title} words={words} /></div>
          {!open && preview && (
            <div style={{ fontSize: 12.5, color: c.text500, marginTop: 3, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {a.problem ? "" : "วิธีแก้: "}<Highlight text={preview} words={words} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 5, fontSize: 11.5, color: c.text400 }}>
            <span style={{ fontWeight: 700, color: cat.color }}>{cat.key}</span>
            {steps.length > 1 && <span>· {steps.length} ขั้นตอน</span>}
            {(a.tags || []).slice(0, 4).map((t) => <span key={t} style={{ background: c.borderSoft, borderRadius: 6, padding: "0 6px" }}>{t}</span>)}
            <span>· {a.createdBy} · {fmtDate(a.updatedAt || a.createdAt)}</span>
          </div>
        </div>
        <span style={{ color: c.text400, fontSize: 12, flexShrink: 0, marginTop: 4 }}>{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${c.borderSoft}`, padding: `14px 16px 12px ${typeof window !== "undefined" && window.innerWidth < 640 ? 16 : 60}px` }}>
          {a.problem && (
            <Section label="🔴 อาการ" color={RED}>
              <div style={{ fontSize: 13.5, color: c.text900, lineHeight: 1.7, whiteSpace: "pre-wrap" }}><Highlight text={a.problem} words={words} /></div>
            </Section>
          )}
          {a.cause && (
            <Section label="🟠 สาเหตุ" color="#EA580C">
              <div style={{ fontSize: 13.5, color: c.text900, lineHeight: 1.7, whiteSpace: "pre-wrap" }}><Highlight text={a.cause} words={words} /></div>
            </Section>
          )}
          <Section label="✅ วิธีแก้" color="#16A34A">
            {steps.length > 1 ? (
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {steps.map((s, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: c.text900, lineHeight: 1.65, wordBreak: "break-word" }}><Highlight text={s} words={words} /></span>
                  </li>
                ))}
              </ol>
            ) : (
              <div style={{ fontSize: 13.5, color: c.text900, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#16A34A0f", border: "1px solid #16A34A33",
                borderRadius: 10, padding: "10px 12px" }}><Highlight text={a.solution} words={words} /></div>
            )}
          </Section>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onEdit} style={{ border: `1px solid ${PURPLE}40`, background: PURPLE + "0c", color: PURPLE, borderRadius: 9, padding: "6px 12px",
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏️ แก้ไข</button>
            {canDelete && <button onClick={onDelete} style={{ border: `1px solid ${RED}40`, background: RED + "0c", color: RED, borderRadius: 9, padding: "6px 12px",
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🗑️ ลบ</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeHub({ onBack, currentUser }) {
  const { c } = useTheme();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {} | article
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const isAdmin = ["admin", "dev"].includes(currentUser?.role);

  useEffect(() => onSnapshot(collection(db, "knowledge"), (snap) => {
    setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }), []);

  async function saveArticle(data, id) {
    setSaving(true);
    try {
      if (id) await updateDoc(doc(db, "knowledge", id), { ...data, updatedAt: new Date().toISOString(), updatedBy: currentUser?.name || "" });
      else await addDoc(collection(db, "knowledge"), { ...data, createdBy: currentUser?.name || "", createdAt: new Date().toISOString() });
      setModal(null);
    } catch (e) { console.error(e); alert("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function deleteArticle(id) {
    await deleteDoc(doc(db, "knowledge", id));
    setConfirmId(null);
    if (expanded === id) setExpanded(null);
  }

  const words = useMemo(() => search.trim().toLowerCase().split(/\s+/).filter(Boolean), [search]);
  const withCat = useMemo(() => articles.map((a) => ({ ...a, _cat: categoryOf(a) }))
    .sort((x, y) => (y.updatedAt || y.createdAt || "").localeCompare(x.updatedAt || x.createdAt || "")), [articles]);
  const counts = useMemo(() => {
    const m = {};
    withCat.forEach((a) => { m[a._cat] = (m[a._cat] || 0) + 1; });
    return m;
  }, [withCat]);
  const filtered = withCat.filter((a) => {
    if (cat && a._cat !== cat) return false;
    if (!words.length) return true;
    const text = [a.title, a.problem, a.cause, a.solution, a._cat, ...(a.tags || [])].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
  // ไม่ได้ค้น/กรอง → จัดกลุ่มตามหมวด
  const grouped = !words.length && !cat;
  const groups = grouped
    ? KB_CATEGORIES.map((k) => ({ ...k, items: filtered.filter((a) => a._cat === k.key) })).filter((g) => g.items.length)
    : [{ key: "", items: filtered }];

  const chip = (on, color = PURPLE) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    whiteSpace: "nowrap", border: `1px solid ${on ? color : c.border}`, background: on ? color : c.card, color: on ? "#fff" : c.text500 });

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", maxWidth: 860, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, color: c.text500, cursor: "pointer", padding: 4, lineHeight: 1 }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F59E0B1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>💡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>Knowledge Hub</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>วิธีแก้ปัญหาที่ทีมบันทึกไว้ · {articles.length} บทความ</div>
          </div>
          <button onClick={() => setModal({})} style={{ background: PURPLE, border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 13,
            fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ เพิ่มบทความ</button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 80px" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 ค้นหาอาการ วิธีแก้ ชื่อเมนู รหัส error…"
          style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${c.border}`, borderRadius: 12, padding: "11px 14px", fontSize: 14,
            fontFamily: "inherit", outline: "none", background: c.card, color: c.text900 }} />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 2px" }}>
          <button onClick={() => setCat("")} style={chip(!cat)}>ทั้งหมด · {articles.length}</button>
          {KB_CATEGORIES.filter((k) => counts[k.key]).map((k) => (
            <button key={k.key} onClick={() => setCat(cat === k.key ? "" : k.key)} style={chip(cat === k.key, k.color)}>{k.icon} {k.key} · {counts[k.key]}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: c.text400, padding: 48 }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: c.text400, padding: "48px 10px", fontSize: 13.5, lineHeight: 1.9 }}>
            {words.length || cat ? <>ไม่พบบทความที่ตรงกับ "{search || cat}"<br /><span style={{ fontSize: 12.5 }}>ถ้าแก้ได้แล้ว กด "+ เพิ่มบทความ" เก็บไว้ให้ทีม</span></> : "ยังไม่มีบทความ กด + เพิ่มบทความได้เลย"}
          </div>
        ) : groups.map((g) => (
          <section key={g.key || "all"} style={{ marginTop: 14 }}>
            {grouped && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 6px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: g.color }}>{g.icon} {g.key}</span>
                <span style={{ fontSize: 11.5, color: c.text400 }}>{g.items.length}</span>
              </div>
            )}
            {!grouped && <div style={{ fontSize: 12, color: c.text400, margin: "0 2px 6px" }}>พบ {filtered.length} บทความ</div>}
            <div style={{ display: "grid", gap: 8 }}>
              {g.items.map((a) => (
                <Article key={a.id} a={a} c={c} words={words} open={expanded === a.id || (!grouped && filtered.length === 1)}
                  onToggle={() => setExpanded(expanded === a.id ? null : a.id)} canDelete={isAdmin}
                  onEdit={() => setModal(a)} onDelete={() => setConfirmId(a.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: c.card, borderRadius: 16, padding: 22, maxWidth: 320, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text900, marginBottom: 6 }}>ลบบทความนี้?</div>
            <div style={{ fontSize: 13, color: c.text500, marginBottom: 18 }}>ลบแล้วกู้คืนไม่ได้</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setConfirmId(null)} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500, borderRadius: 10, padding: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
              <button onClick={() => deleteArticle(confirmId)} style={{ background: RED, border: "none", color: "#fff", borderRadius: 10, padding: 10, fontSize: 14,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ลบ</button>
            </div>
          </div>
        </div>
      )}

      {modal && <KnowledgeModal onClose={() => setModal(null)} onSave={saveArticle} saving={saving} editRecord={modal.id ? modal : null} />}
    </div>
  );
}
