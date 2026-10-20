// src/TaskBoard.jsx — บอร์ดงาน: รายการงานแบ่งตามกำหนดส่ง (เลยกำหนด / วันนี้ / 7 วันข้างหน้า / ภายหลัง / ไม่กำหนดวัน)
// สถานะ 3 ขั้น: ต้องทำ (todo) → กำลังทำ (inprogress) → เสร็จ (done)
// งานเก่าที่เป็น "accepted" (รับแล้ว) นับเป็น "ต้องทำ"
// ใครก็สร้างงานได้ · แก้ไข/เปลี่ยนสถานะได้ถ้าเป็นผู้รับผิดชอบ ผู้สร้าง หรือ admin/dev · ลบ/แปลงเป็นเคสเฉพาะ admin/dev

import React, { useMemo, useState } from "react";
import { useTheme } from "./theme.js";
import { fmtDate, SERVICE_TYPES } from "./utils.js";
import TaskModal from "./TaskModal.jsx";

const PURPLE = "#6B21A8";
const RED = "#DC2626";

export const TASK_STATUS = {
  todo:       { label: "ต้องทำ",   color: "#64748B" },
  inprogress: { label: "กำลังทำ", color: "#D97706" },
  done:       { label: "เสร็จ",     color: "#16A34A" },
};
const normStatus = (s) => (s === "accepted" ? "todo" : TASK_STATUS[s] ? s : "todo");

const PRIORITY = {
  urgent_high: { label: "ด่วนมาก", color: "#fff", bg: "#DC2626", rank: 0 },
  urgent:      { label: "ด่วน",    color: "#B45309", bg: "#FEF3C7", rank: 1 },
  normal:      { label: "",        color: "", bg: "", rank: 2 },
};

// วันที่ตามเวลาไทย YYYY-MM-DD
const localToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const dayDiff = (iso, todayIso) => (iso ? Math.round((new Date(iso) - new Date(todayIso)) / 86400000) : null);

const GROUPS = [
  { key: "overdue", label: "🔥 เลยกำหนด", color: RED },
  { key: "today",   label: "📌 วันนี้", color: "#EA580C" },
  { key: "week",    label: "🗓️ 7 วันข้างหน้า", color: "#2563EB" },
  { key: "later",   label: "⏳ ภายหลัง", color: "#64748B" },
  { key: "nodate",  label: "📝 ไม่กำหนดวัน", color: "#64748B" },
];
function groupOf(t, todayIso) {
  const d = dayDiff(t.dueDate, todayIso);
  if (d === null) return "nodate";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

const avatarBg = (name = "") => `hsl(${(name.charCodeAt(0) || 0) * 7 % 360},55%,58%)`;
function Avatars({ names = [], size = 22 }) {
  return (
    <span style={{ display: "inline-flex" }}>
      {names.slice(0, 4).map((n, i) => (
        <span key={n} title={n} style={{ width: size, height: size, borderRadius: "50%", background: avatarBg(n), color: "#fff",
          fontSize: size * 0.48, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginLeft: i ? -6 : 0, border: "2px solid var(--card-bg, #fff)" }}>{n.charAt(0)}</span>
      ))}
      {names.length > 4 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>+{names.length - 4}</span>}
    </span>
  );
}

function dueText(t, todayIso) {
  if (!t.dueDate) return "";
  const d = dayDiff(t.dueDate, todayIso);
  if (normStatus(t.status) === "done") return fmtDate(t.dueDate);
  if (d < 0) return `เลย ${-d} วัน`;
  if (d === 0) return "วันนี้";
  if (d === 1) return "พรุ่งนี้";
  return d <= 7 ? `อีก ${d} วัน` : fmtDate(t.dueDate);
}

export default function TaskBoard({ onBack, projects = [], users = [], currentUser, tasks = [], saving, onSaveTask, onDeleteTask, onConvertToCase }) {
  const { c, dark } = useTheme();
  const me = currentUser?.name || "";
  const isAdmin = ["admin", "dev"].includes(currentUser?.role);
  const todayIso = localToday();

  const [tab, setTab] = useState("mine"); // mine | all | done
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");
  const [modal, setModal] = useState(null); // null | { task?, title? }
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "delete"|"convert", task }

  const all = useMemo(() => (tasks || []).map((t) => ({ ...t, status: normStatus(t.status) })), [tasks]);
  const detail = all.find((t) => t.id === detailId) || null;
  const canEdit = (t) => isAdmin || (t.assignees || []).includes(me) || t.createdBy === me;

  const q = search.trim().toLowerCase();
  const projName = (t) => projects.find((p) => p.id === t.projectId)?.name || t.projectName || "";
  const matches = (t) => !q || [t.title, t.site, t.note, projName(t), ...(t.assignees || [])].some((x) => (x || "").toLowerCase().includes(q));

  const mineActive = all.filter((t) => t.status !== "done" && (t.assignees || []).includes(me));
  const allActive = all.filter((t) => t.status !== "done");
  const doneList = all.filter((t) => t.status === "done");

  const list = (tab === "mine" ? mineActive : tab === "all" ? allActive : doneList).filter(matches);
  const sortActive = (a, b) =>
    (a.status === "inprogress" ? 0 : 1) - (b.status === "inprogress" ? 0 : 1) ||
    (PRIORITY[a.priority]?.rank ?? 2) - (PRIORITY[b.priority]?.rank ?? 2) ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    (a.createdAt || "").localeCompare(b.createdAt || "");

  const groups = useMemo(() => {
    if (tab === "done") {
      return [{ key: "done", label: "✅ เสร็จแล้ว", color: "#16A34A",
        items: [...list].sort((a, b) => (b.completedAt || b.updatedAt || "").localeCompare(a.completedAt || a.updatedAt || "")).slice(0, 100) }];
    }
    return GROUPS.map((g) => ({ ...g, items: list.filter((t) => groupOf(t, todayIso) === g.key).sort(sortActive) })).filter((g) => g.items.length);
  }, [list, tab, todayIso]); // eslint-disable-line react-hooks/exhaustive-deps

  const overdueMine = mineActive.filter((t) => groupOf(t, todayIso) === "overdue").length;

  function setStatus(t, status) {
    const { id, ...rest } = t;
    onSaveTask({ ...rest, status, updatedAt: new Date().toISOString(), ...(status === "done" ? { completedAt: new Date().toISOString(), completedBy: me } : {}) }, id);
  }

  function addQuick() {
    const title = quick.trim();
    if (!title) return;
    const now = new Date().toISOString();
    onSaveTask({
      title, projectId: "", projectName: "", projectColor: "#94a3b8", site: "",
      type: SERVICE_TYPES.includes("อื่นๆ") ? "อื่นๆ" : SERVICE_TYPES[0], dueDate: "", priority: "normal",
      assignees: me ? [me] : [], note: "", status: "todo", comments: [],
      createdBy: me, createdByUid: currentUser?.id || "", createdAt: now, updatedAt: now,
    }, null);
    setQuick("");
  }

  const tabBtn = (key, label, n) => {
    const on = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
        padding: "10px 4px", marginRight: 14, fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? PURPLE : c.text500,
        borderBottom: `2.5px solid ${on ? PURPLE : "transparent"}`, whiteSpace: "nowrap" }}>
        {label}{n != null && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
          background: on ? PURPLE + "18" : c.borderSoft, color: on ? PURPLE : c.text400 }}>{n}</span>}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif", "--card-bg": c.card }}>
      {/* Header */}
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 6px", maxWidth: 860, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, color: c.text500, cursor: "pointer", padding: 4, lineHeight: 1 }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: PURPLE + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📋</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>บอร์ดงาน</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>
              งานของคุณ {mineActive.length} งาน{overdueMine > 0 && <span style={{ color: RED, fontWeight: 700 }}> · เลยกำหนด {overdueMine}</span>}
            </div>
          </div>
          <button onClick={() => setModal({})} style={{ background: PURPLE, border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ สร้างงาน</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px", maxWidth: 860, margin: "0 auto", overflowX: "auto" }}>
          {tabBtn("mine", "งานของฉัน", mineActive.length)}
          {tabBtn("all", "ทั้งหมด", allActive.length)}
          {tabBtn("done", "เสร็จแล้ว", doneList.length)}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 60px" }}>
        {/* เพิ่มงานเร็ว */}
        {tab !== "done" && (
          <div style={{ display: "flex", gap: 8, background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 6, marginBottom: 10 }}>
            <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addQuick(); }}
              placeholder="＋ เพิ่มงานของฉัน… พิมพ์แล้วกด Enter"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", padding: "8px 10px", fontSize: 14,
                fontFamily: "inherit", color: c.text900 }} />
            {quick.trim() && (
              <>
                <button onClick={() => { setModal({ title: quick.trim() }); setQuick(""); }} title="ใส่รายละเอียด (โครงการ, กำหนดส่ง, คนรับผิดชอบ)"
                  style={{ border: `1px solid ${c.border}`, background: c.bg, color: c.text500, borderRadius: 8, padding: "0 10px", fontSize: 12.5,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>รายละเอียด…</button>
                <button onClick={addQuick} style={{ border: "none", background: PURPLE, color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 13,
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>เพิ่ม</button>
              </>
            )}
          </div>
        )}

        {(all.length > 0) && (
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 ค้นหา ชื่องาน / โครงการ / ไซต์ / คน…"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13,
              fontFamily: "inherit", outline: "none", background: c.card, color: c.text900, marginBottom: 6 }} />
        )}

        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 10px", color: c.text400, fontSize: 13.5, lineHeight: 1.9 }}>
            {q ? "ไม่พบงานที่ตรงกับคำค้น" :
              tab === "mine" ? <>ไม่มีงานค้างของคุณ 🎉<br /><span style={{ fontSize: 12.5 }}>พิมพ์ในช่องด้านบนเพื่อจดงาน หรือกด "+ สร้างงาน" เพื่อมอบงานให้คนอื่น</span></> :
              tab === "all" ? "ยังไม่มีงานที่ค้างอยู่" : "ยังไม่มีงานที่เสร็จ"}
          </div>
        )}

        {groups.map((g) => (
          <section key={g.key} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 6px" }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 11.5, color: c.text400 }}>{g.items.length}</span>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
              {g.items.map((t, i) => (
                <TaskRow key={t.id} t={t} first={i === 0} c={c} dark={dark} todayIso={todayIso} showAssignees={tab !== "mine"}
                  projName={projName(t)} projColor={projects.find((p) => p.id === t.projectId)?.color || t.projectColor}
                  canEdit={canEdit(t)} onOpen={() => setDetailId(t.id)} onStatus={(s) => setStatus(t, s)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {detail && (
        <TaskDetail t={detail} c={c} me={me} isAdmin={isAdmin} canEdit={canEdit(detail)} todayIso={todayIso}
          projName={projName(detail)} projColor={projects.find((p) => p.id === detail.projectId)?.color || detail.projectColor}
          onClose={() => setDetailId(null)} onStatus={(s) => setStatus(detail, s)}
          onEdit={() => setModal({ task: detail })}
          onDelete={() => setConfirm({ kind: "delete", task: detail })}
          onConvert={() => setConfirm({ kind: "convert", task: detail })}
          onComment={(text) => {
            const { id, ...rest } = detail;
            onSaveTask({ ...rest, comments: [...(detail.comments || []), { text, by: me, at: new Date().toISOString() }] }, id);
          }} />
      )}

      {confirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: c.card, borderRadius: 16, padding: 22, maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>{confirm.kind === "delete" ? "🗑️" : "📁"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text900, marginBottom: 4 }}>{confirm.kind === "delete" ? "ลบงานนี้?" : "สร้างเคสจากงานนี้?"}</div>
            <div style={{ fontSize: 13, color: c.text500, marginBottom: 18 }}>"{confirm.task.title}"{confirm.kind === "delete" && <><br />ลบแล้วกู้คืนไม่ได้</>}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setConfirm(null)} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500, borderRadius: 10, padding: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
              <button onClick={() => {
                if (confirm.kind === "delete") { onDeleteTask(confirm.task.id); setDetailId(null); } else onConvertToCase(confirm.task);
                setConfirm(null);
              }} style={{ background: confirm.kind === "delete" ? RED : PURPLE, border: "none", color: "#fff", borderRadius: 10, padding: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{confirm.kind === "delete" ? "ลบ" : "สร้างเคส"}</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <TaskModal onClose={() => setModal(null)}
          onSave={(data, id) => { onSaveTask(data, id); setModal(null); }}
          saving={saving} projects={projects} users={users} currentUser={currentUser}
          editTask={modal.task || null} initialTitle={modal.title || ""} />
      )}
    </div>
  );
}

// ── แถวงานหนึ่งรายการ ──
function TaskRow({ t, first, c, todayIso, showAssignees, projName, projColor, canEdit, onOpen, onStatus }) {
  const pri = PRIORITY[t.priority] || PRIORITY.normal;
  const d = dayDiff(t.dueDate, todayIso);
  const done = t.status === "done";
  const dueColor = done ? c.text400 : d === null ? c.text400 : d < 0 ? RED : d === 0 ? "#EA580C" : c.text500;
  const next = t.status === "todo" ? { s: "inprogress", label: "▶ เริ่มทำ", bg: "#FEF3C7", color: "#B45309" }
    : t.status === "inprogress" ? { s: "done", label: "✓ เสร็จ", bg: "#DCFCE7", color: "#15803D" } : null;
  const where = [projName, t.site].filter(Boolean).join(" · ");
  return (
    <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", cursor: "pointer",
      borderTop: first ? "none" : `1px solid ${c.borderSoft}`, borderLeft: `3px solid ${projColor || "transparent"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {pri.label && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 6, background: pri.bg, color: pri.color }}>{pri.label}</span>}
          {t.status === "inprogress" && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 6, background: "#D9770618", color: "#D97706" }}>กำลังทำ</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: done ? c.text400 : c.text900, textDecoration: done ? "line-through" : "none",
            wordBreak: "break-word" }}>{t.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: 12, color: c.text400 }}>
          {where && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{where}</span>}
          {t.dueDate && <span style={{ color: dueColor, fontWeight: !done && d !== null && d <= 0 ? 700 : 500 }}>📅 {dueText(t, todayIso)}</span>}
          {(t.comments || []).length > 0 && <span>💬 {t.comments.length}</span>}
          {t.caseId && <span style={{ color: "#16A34A" }}>📁 เป็นเคสแล้ว</span>}
          {done && t.completedBy && <span>โดย {t.completedBy}</span>}
        </div>
      </div>
      {showAssignees && (t.assignees || []).length > 0 && <Avatars names={t.assignees} />}
      {canEdit && next && (
        <button onClick={(e) => { e.stopPropagation(); onStatus(next.s); }}
          style={{ border: "none", background: next.bg, color: next.color, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{next.label}</button>
      )}
    </div>
  );
}

// ── รายละเอียดงาน + ความคิดเห็น ──
function TaskDetail({ t, c, me, isAdmin, canEdit, todayIso, projName, projColor, onClose, onStatus, onEdit, onDelete, onConvert, onComment }) {
  const [text, setText] = useState("");
  const pri = PRIORITY[t.priority] || PRIORITY.normal;
  const send = () => { const v = text.trim(); if (!v) return; onComment(v); setText(""); };
  const meta = (label, value) => value ? (
    <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "3px 0" }}>
      <span style={{ width: 92, flexShrink: 0, color: c.text400 }}>{label}</span>
      <span style={{ color: c.text900, minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  ) : null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.card, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${c.borderSoft}`, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: c.text900, lineHeight: 1.35, wordBreak: "break-word" }}>{t.title}</div>
            <button onClick={onClose} style={{ background: c.borderSoft, border: "none", color: c.text500, cursor: "pointer", fontSize: 14, width: 30, height: 30, borderRadius: 8, flexShrink: 0 }}>✕</button>
          </div>

          {/* สถานะ */}
          <div style={{ display: "flex", gap: 6, margin: "12px 0 10px" }}>
            {Object.entries(TASK_STATUS).map(([k, s]) => {
              const on = t.status === k;
              return (
                <button key={k} disabled={!canEdit || on} onClick={() => onStatus(k)}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                    cursor: canEdit && !on ? "pointer" : "default", border: `1.5px solid ${on ? s.color : c.border}`,
                    background: on ? s.color : "transparent", color: on ? "#fff" : canEdit ? c.text500 : c.text400 }}>{s.label}</button>
              );
            })}
          </div>

          {meta("โครงการ", projName && <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: projColor || "#94a3b8", marginRight: 6 }} />{projName}</span>)}
          {meta("ไซต์", t.site)}
          {meta("กำหนดส่ง", t.dueDate && `${fmtDate(t.dueDate)} (${dueText(t, todayIso)})`)}
          {meta("ความเร่งด่วน", pri.label && <span style={{ fontWeight: 700, padding: "1px 8px", borderRadius: 6, background: pri.bg, color: pri.color }}>{pri.label}</span>)}
          {meta("ประเภท", t.type)}
          {meta("ผู้รับผิดชอบ", (t.assignees || []).length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatars names={t.assignees} /> {t.assignees.join(", ")}</span>)}
          {meta("สร้างโดย", t.createdBy && `${t.createdBy}${t.createdAt ? ` · ${fmtDate(t.createdAt.slice(0, 10))}` : ""}`)}
          {meta("เสร็จเมื่อ", t.status === "done" && t.completedAt && `${fmtDate(t.completedAt.slice(0, 10))}${t.completedBy ? ` โดย ${t.completedBy}` : ""}`)}
          {t.note && <div style={{ marginTop: 8, background: c.bg, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: c.text500, whiteSpace: "pre-wrap" }}>{t.note}</div>}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {canEdit && <button onClick={onEdit} style={smallBtn(c, PURPLE)}>✏️ แก้ไข</button>}
            {isAdmin && t.status === "done" && !t.caseId && <button onClick={onConvert} style={smallBtn(c, PURPLE)}>📁 สร้างเคสจากงานนี้</button>}
            {t.caseId && <span style={{ fontSize: 12.5, color: "#16A34A", alignSelf: "center" }}>📁 สร้างเคสแล้ว</span>}
            {isAdmin && <button onClick={onDelete} style={{ ...smallBtn(c, RED), marginLeft: "auto" }}>🗑️ ลบ</button>}
          </div>
        </div>

        {/* ความคิดเห็น */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", minHeight: 80 }}>
          <div style={{ fontSize: 11.5, color: c.text400, fontWeight: 700, marginBottom: 8 }}>💬 ความคิดเห็น ({(t.comments || []).length})</div>
          {(t.comments || []).length === 0 ? (
            <div style={{ color: c.text400, fontSize: 12.5, padding: "6px 0" }}>ยังไม่มีความคิดเห็น</div>
          ) : (t.comments || []).map((m, i) => {
            const mine = m.by === me;
            return (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: avatarBg(m.by), color: "#fff", fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(m.by || "?").charAt(0)}</span>
                <div style={{ maxWidth: "78%" }}>
                  <div style={{ fontSize: 10.5, color: c.text400, marginBottom: 2, textAlign: mine ? "right" : "left" }}>{m.by} · {m.at ? fmtDate(m.at.slice(0, 10)) : ""}</div>
                  <div style={{ background: mine ? PURPLE + "12" : c.bg, border: `1px solid ${mine ? PURPLE + "30" : c.border}`, borderRadius: 12,
                    padding: "7px 11px", fontSize: 13, color: c.text900, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${c.borderSoft}`, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            placeholder="พิมพ์ความคิดเห็น… (Enter ส่ง)"
            style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontFamily: "inherit", resize: "none",
              outline: "none", background: c.bg, color: c.text900 }} />
          <button onClick={send} disabled={!text.trim()} style={{ background: PURPLE, border: "none", color: "#fff", borderRadius: 10, padding: "9px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: text.trim() ? 1 : 0.5 }}>ส่ง</button>
        </div>
      </div>
    </div>
  );
}
const smallBtn = (c, color) => ({ border: `1px solid ${color}40`, background: color + "0c", color, borderRadius: 9, padding: "6px 12px",
  fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
