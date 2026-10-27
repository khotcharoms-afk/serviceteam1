// src/TaskBoard.jsx — บอร์ดงาน
//  📅 ปฏิทิน (หน้าหลัก): ปฏิทินรายเดือน หัวหน้า (admin/dev) ลงงานตามวัน (วันเริ่ม–วันจบ) แล้วค่อยมอบว่าใครทำ
//  งานของฉัน / ทั้งหมด / เสร็จแล้ว: รายการแบ่งตามกำหนดส่ง
// สถานะ: ต้องทำ (todo) → กำลังทำ (inprogress) → เสร็จ (done) — งานเก่าที่เป็น "accepted" นับเป็น "ต้องทำ"
// สิทธิ์: สร้าง/แก้ไข/มอบงาน/ลบ/แปลงเป็นเคส = admin/dev · ผู้รับผิดชอบเปลี่ยนสถานะงานของตัวเองได้ · ทุกคนแสดงความคิดเห็นได้
// วันที่ของงาน: startDate (วันเริ่ม) – dueDate (วันจบ/กำหนดส่ง) ถ้าไม่มี startDate ถือว่าเป็นงานวันเดียว

import React, { useMemo, useState } from "react";
import { useTheme } from "./theme.js";
import { fmtDate } from "./utils.js";
import TaskModal from "./TaskModal.jsx";


export const TASK_STATUS = {
  todo:       { label: "ต้องทำ",   color: "#64748B" },
  inprogress: { label: "กำลังทำ", color: "#D97706" },
  done:       { label: "เสร็จ",     color: "#16A34A" },
};
const normStatus = (s) => (s === "accepted" ? "todo" : TASK_STATUS[s] ? s : "todo");

const PRIORITY = {
  urgent_high: { label: "ด่วนมาก", color: "#b91c1c", bg: "transparent", rank: 0 },
  urgent:      { label: "ด่วน",    color: "#b45309", bg: "transparent", rank: 1 },
  normal:      { label: "",        color: "", bg: "", rank: 2 },
};

// ── วันที่ (สตริง YYYY-MM-DD ตามเวลาไทย) ──
const localToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const toDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const toIso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toIso(d); };
const dayDiff = (iso, todayIso) => (iso ? Math.round((toDate(iso) - toDate(todayIso)) / 86400000) : null);
const startOf = (t) => t.startDate || t.dueDate || "";
const endOf = (t) => t.dueDate || t.startDate || "";
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_DAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const fmtShort = (iso) => { const d = toDate(iso); return `${d.getDate()} ${TH_MONTHS[d.getMonth()].slice(0, 3)}.`; };
const rangeText = (t) => {
  const s = startOf(t), e = endOf(t);
  if (!s) return "";
  return s === e ? fmtDate(s) : `${fmtShort(s)} – ${fmtDate(e)}`;
};

const GROUPS = [
  { key: "overdue", label: "เลยกำหนด", danger: true },
  { key: "today",   label: "วันนี้" },
  { key: "week",    label: "7 วันข้างหน้า" },
  { key: "later",   label: "ภายหลัง" },
  { key: "nodate",  label: "ไม่กำหนดวัน" },
];
function groupOf(t, todayIso) {
  const s = startOf(t), e = endOf(t);
  if (!e) return "nodate";
  if (e < todayIso) return "overdue";
  if (s <= todayIso) return "today"; // วันนี้อยู่ในช่วงงาน
  return dayDiff(s, todayIso) <= 7 ? "week" : "later";
}
function dueText(t, todayIso) {
  const e = endOf(t), s = startOf(t);
  if (!e) return "";
  if (normStatus(t.status) === "done") return rangeText(t);
  if (e < todayIso) return `เลย ${-dayDiff(e, todayIso)} วัน`;
  if (s <= todayIso) return s === e ? "วันนี้" : `วันนี้ – ${fmtShort(e)}`;
  const d = dayDiff(s, todayIso);
  if (d === 1) return s === e ? "พรุ่งนี้" : `พรุ่งนี้ – ${fmtShort(e)}`;
  return rangeText(t);
}

function Avatars({ names = [], size = 22 }) {
  return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      {names.slice(0, 4).map((n, i) => (
        <span key={n} title={n} style={{ width: size, height: size, borderRadius: "50%", background: "var(--av-bg, #e2e8f0)", color: "var(--av-fg, #0f172a)",
          fontSize: size * 0.48, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginLeft: i ? -6 : 0, border: "2px solid var(--card-bg, #fff)" }}>{n.charAt(0)}</span>
      ))}
      {names.length > 4 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>+{names.length - 4}</span>}
    </span>
  );
}
const Unassigned = ({ small }) => (
  <span style={{ fontSize: small ? 10 : 11, fontWeight: 600, color: "var(--av-fg, #0f172a)", border: "1px dashed currentColor", borderRadius: 6, opacity: 0.7,
    padding: small ? "0 4px" : "1px 6px", whiteSpace: "nowrap" }}>ยังไม่มีคนทำ</span>
);

export default function TaskBoard({ onBack, projects = [], users = [], currentUser, tasks = [], saving, onSaveTask, onDeleteTask, onConvertToCase }) {
  const { c } = useTheme();
  const me = currentUser?.name || "";
  const isAdmin = ["admin", "dev"].includes(currentUser?.role);
  const todayIso = localToday();
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;

  const [tab, setTab] = useState("calendar"); // calendar | mine | all | done
  const W = tab === "calendar" ? 1680 : 860; // ความกว้างสูงสุดของหน้า (ปฏิทินกว้างเกือบเต็มจอ)
  const [month, setMonth] = useState(todayIso.slice(0, 7)); // YYYY-MM
  const [mineOnly, setMineOnly] = useState(!isAdmin);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | { task? , date? }
  const [detailId, setDetailId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "delete"|"convert", task }

  const all = useMemo(() => (tasks || []).map((t) => ({ ...t, status: normStatus(t.status) })), [tasks]);
  const detail = all.find((t) => t.id === detailId) || null;
  const isMine = (t) => (t.assignees || []).includes(me);
  const canStatus = (t) => isAdmin || isMine(t);

  const q = search.trim().toLowerCase();
  const projOf = (t) => projects.find((p) => p.id === t.projectId);
  const projName = (t) => projOf(t)?.name || t.projectName || "";
  const projColor = (t) => projOf(t)?.color || t.projectColor || "";
  const matches = (t) => !q || [t.title, t.site, t.note, projName(t), ...(t.assignees || [])].some((x) => (x || "").toLowerCase().includes(q));

  const mineActive = all.filter((t) => t.status !== "done" && isMine(t));
  const allActive = all.filter((t) => t.status !== "done");
  const doneList = all.filter((t) => t.status === "done");
  const unassigned = allActive.filter((t) => !(t.assignees || []).length);

  function save(t, patch) {
    const { id, ...rest } = t;
    // คงสถานะดิบไว้ (เช่น accepted รุ่นเก่า) ถ้าไม่ได้ตั้งใจเปลี่ยนสถานะ — rules ให้คนที่ไม่ใช่ผู้รับผิดชอบคอมเมนต์ได้ แต่ห้ามแตะ status
    const raw = (tasks || []).find((x) => x.id === id);
    if (raw && !("status" in patch)) rest.status = raw.status;
    onSaveTask({ ...rest, ...patch, updatedAt: new Date().toISOString() }, id);
  }
  const setStatus = (t, status) => save(t, { status, ...(status === "done" ? { completedAt: new Date().toISOString(), completedBy: me } : {}) });

  const tabBtn = (key, label, n, warn) => {
    const on = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
        padding: "10px 4px", marginRight: 14, fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? c.text900 : c.text500,
        borderBottom: `2px solid ${on ? c.ink : "transparent"}`, whiteSpace: "nowrap" }}>
        {label}{n != null && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
          background: c.borderSoft, color: warn ? c.danger : c.text500 }}>{n}</span>}
      </button>
    );
  };

  // ── รายการ (แท็บงานของฉัน/ทั้งหมด/เสร็จแล้ว) ──
  const list = (tab === "mine" ? mineActive : tab === "all" ? allActive : tab === "done" ? doneList : []).filter(matches);
  const sortActive = (a, b) =>
    (a.status === "inprogress" ? 0 : 1) - (b.status === "inprogress" ? 0 : 1) ||
    (PRIORITY[a.priority]?.rank ?? 2) - (PRIORITY[b.priority]?.rank ?? 2) ||
    (endOf(a) || "9999").localeCompare(endOf(b) || "9999") ||
    (a.createdAt || "").localeCompare(b.createdAt || "");
  const groups = tab === "done"
    ? [{ key: "done", label: "เสร็จแล้ว",
        items: [...list].sort((a, b) => (b.completedAt || b.updatedAt || "").localeCompare(a.completedAt || a.updatedAt || "")).slice(0, 100) }]
    : GROUPS.map((g) => ({ ...g, items: list.filter((t) => groupOf(t, todayIso) === g.key).sort(sortActive) })).filter((g) => g.items.length);
  const overdueMine = mineActive.filter((t) => groupOf(t, todayIso) === "overdue").length;

  const rowProps = (t) => ({ t, c, todayIso, projName: projName(t), projColor: projColor(t), canStatus: canStatus(t),
    onOpen: () => setDetailId(t.id), onStatus: (s) => setStatus(t, s) });

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif", "--card-bg": c.card, "--av-bg": c.borderSoft, "--av-fg": c.text900 }}>
      {/* Header */}
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 6px", maxWidth: W, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, color: c.text500, cursor: "pointer", padding: 4, lineHeight: 1 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>บอร์ดงาน</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>
              งานของคุณ {mineActive.length} งาน{overdueMine > 0 && <span style={{ color: c.danger, fontWeight: 700 }}> · เลยกำหนด {overdueMine}</span>}
              {isAdmin && unassigned.length > 0 && <span style={{ color: c.warn, fontWeight: 700 }}> · ยังไม่มีคนทำ {unassigned.length}</span>}
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setModal({ date: tab === "calendar" && month !== todayIso.slice(0, 7) ? `${month}-01` : todayIso })}
              style={{ background: c.ink, border: "none", color: c.onInk, borderRadius: 10, padding: "8px 14px",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ ลงงาน</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px", maxWidth: W, margin: "0 auto", overflowX: "auto" }}>
          {tabBtn("calendar", "ปฏิทิน")}
          {tabBtn("mine", "งานของฉัน", mineActive.length, overdueMine > 0)}
          {tabBtn("all", "ทั้งหมด", allActive.length)}
          {tabBtn("done", "เสร็จแล้ว", doneList.length)}
        </div>
      </div>

      {tab === "calendar" ? (
        <div style={{ maxWidth: W, margin: "0 auto", padding: narrow ? "10px 6px 60px" : "14px 20px 60px" }}>
          <MonthCalendar month={month} setMonth={setMonth} todayIso={todayIso} c={c} narrow={narrow} isAdmin={isAdmin}
            tasks={all.filter((t) => (!mineOnly || isMine(t)) && matches(t))} projColor={projColor} me={me}
            mineOnly={mineOnly} setMineOnly={setMineOnly} search={search} setSearch={setSearch}
            onOpen={(t) => setDetailId(t.id)} onAdd={(date) => setModal({ date })} />
          {(() => {
            const undated = all.filter((t) => t.status !== "done" && !endOf(t) && (!mineOnly || isMine(t)) && matches(t)).sort(sortActive);
            if (!undated.length) return null;
            return (
              <section style={{ marginTop: 16, padding: narrow ? "0 4px" : 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: c.text500, margin: "0 2px 6px" }}>ยังไม่กำหนดวัน <span style={{ fontWeight: 600, color: c.text400 }}>{undated.length}</span></div>
                <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {undated.map((t, i) => <TaskRow key={t.id} first={i === 0} showAssignees {...rowProps(t)} />)}
                </div>
              </section>
            );
          })()}
        </div>
      ) : (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 16px 60px" }}>
          {all.length > 0 && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา ชื่องาน / โครงการ / ไซต์ / คน…"
              style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5,
                outline: "none", background: c.card, color: c.text900, marginBottom: 4 }} />
          )}
          {groups.length === 0 && (
            <div style={{ textAlign: "center", padding: "50px 10px", color: c.text400, fontSize: 13.5, lineHeight: 1.9 }}>
              {q ? "ไม่พบงานที่ตรงกับคำค้น" : tab === "mine" ? "ไม่มีงานค้างของคุณ" : tab === "all" ? "ยังไม่มีงานที่ค้างอยู่" : "ยังไม่มีงานที่เสร็จ"}
            </div>
          )}
          {groups.map((g) => (
            <section key={g.key} style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 6px" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: g.danger ? c.danger : c.text900 }}>{g.label}</span>
                <span style={{ fontSize: 11.5, color: c.text400 }}>{g.items.length}</span>
              </div>
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                {g.items.map((t, i) => <TaskRow key={t.id} first={i === 0} showAssignees={tab !== "mine"} {...rowProps(t)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {detail && (
        <TaskDetail t={detail} c={c} me={me} isAdmin={isAdmin} canStatus={canStatus(detail)} todayIso={todayIso} users={users}
          projName={projName(detail)} projColor={projColor(detail)}
          onClose={() => setDetailId(null)} onStatus={(s) => setStatus(detail, s)}
          onAssign={(assignees) => save(detail, { assignees })}
          onEdit={() => setModal({ task: detail })}
          onDelete={() => setConfirm({ kind: "delete", task: detail })}
          onConvert={() => setConfirm({ kind: "convert", task: detail })}
          onComment={(text) => save(detail, { comments: [...(detail.comments || []), { text, by: me, at: new Date().toISOString() }] })} />
      )}

      {confirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: c.card, borderRadius: 16, padding: 22, maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text900, marginBottom: 4 }}>{confirm.kind === "delete" ? "ลบงานนี้?" : "สร้างเคสจากงานนี้?"}</div>
            <div style={{ fontSize: 13, color: c.text500, marginBottom: 18 }}>"{confirm.task.title}"{confirm.kind === "delete" && <><br />ลบแล้วกู้คืนไม่ได้</>}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setConfirm(null)} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500, borderRadius: 10, padding: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={() => {
                if (confirm.kind === "delete") { onDeleteTask(confirm.task.id); setDetailId(null); } else onConvertToCase(confirm.task);
                setConfirm(null);
              }} style={{ background: confirm.kind === "delete" ? c.danger : c.ink, border: "none", color: confirm.kind === "delete" ? "#fff" : c.onInk, borderRadius: 10, padding: 10,
                fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{confirm.kind === "delete" ? "ลบ" : "สร้างเคส"}</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <TaskModal onClose={() => setModal(null)}
          onSave={(data, id) => { onSaveTask(data, id); setModal(null); }}
          saving={saving} projects={projects} users={users} currentUser={currentUser}
          editTask={modal.task || null} initialDate={modal.date || ""} />
      )}
    </div>
  );
}

// ── ปฏิทินรายเดือน ──
function MonthCalendar({ month, setMonth, todayIso, c, narrow, isAdmin, tasks, projColor, onOpen, onAdd, mineOnly, setMineOnly, search, setSearch }) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;
  const gridStart = addDays(first, -((toDate(first).getDay() + 6) % 7)); // วันจันทร์ของสัปดาห์แรก
  const weeks = [];
  for (let ws = gridStart; ws <= last; ws = addDays(ws, 7)) weeks.push(ws);
  const shiftMonth = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  const dated = tasks.filter((t) => endOf(t));
  const inMonth = dated.filter((t) => startOf(t) <= last && endOf(t) >= first);
  const barH = narrow ? 20 : 26;
  // ให้ปฏิทินสูงพอดีจอ (อย่างน้อย 120px ต่อสัปดาห์บนคอม)
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, padding: narrow ? "0 4px" : 0 }}>
        <button onClick={() => shiftMonth(-1)} style={navBtn(c)}>‹</button>
        <div style={{ fontSize: narrow ? 17 : 20, fontWeight: 800, color: c.text900, minWidth: narrow ? 0 : 200, textAlign: "center" }}>{TH_MONTHS[m - 1]} {y + 543}</div>
        <button onClick={() => shiftMonth(1)} style={navBtn(c)}>›</button>
        {month !== todayIso.slice(0, 7) && <button onClick={() => setMonth(todayIso.slice(0, 7))} style={{ ...navBtn(c), width: "auto", padding: "0 12px", fontSize: 12.5 }}>วันนี้</button>}
        <span style={{ fontSize: 12, color: c.text400 }}>{inMonth.length} งานในเดือนนี้</span>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: c.text500, cursor: "pointer", fontWeight: 600 }}>
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} style={{ accentColor: c.ink }} /> เฉพาะงานของฉัน
        </label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา…"
          style={{ width: narrow ? "100%" : 200, border: `1px solid ${c.border}`, borderRadius: 9, padding: "6px 10px", fontSize: 12.5, outline: "none",
            background: c.card, color: c.text900 }} />
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: c.bg, borderBottom: `1px solid ${c.border}` }}>
          {TH_DAYS.map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: narrow ? 11.5 : 13, fontWeight: 800, padding: narrow ? "6px 0" : "9px 0", color: c.text400 }}>{d}</div>
          ))}
        </div>

        {weeks.map((ws) => {
          const we = addDays(ws, 6);
          // ช่วงของแต่ละงานในสัปดาห์นี้ แล้วจัดเลน (แถว) ไม่ให้ทับกัน
          const segs = dated.filter((t) => startOf(t) <= we && endOf(t) >= ws).map((t) => {
            const s = startOf(t) < ws ? ws : startOf(t), e = endOf(t) > we ? we : endOf(t);
            return { t, col: dayDiff(s, ws), span: dayDiff(e, s) + 1, contL: startOf(t) < ws, contR: endOf(t) > we };
          }).sort((a, b) => a.col - b.col || b.span - a.span || (PRIORITY[a.t.priority]?.rank ?? 2) - (PRIORITY[b.t.priority]?.rank ?? 2));
          const laneEnds = [];
          segs.forEach((sg) => {
            let lane = laneEnds.findIndex((end) => end < sg.col);
            if (lane < 0) { lane = laneEnds.length; laneEnds.push(-1); }
            laneEnds[lane] = sg.col + sg.span - 1;
            sg.lane = lane;
          });
          const minH = narrow ? 76 : Math.max(120, Math.floor((vh - 300) / weeks.length));
          return (
            <div key={ws} style={{ position: "relative", borderTop: ws === gridStart ? "none" : `1px solid ${c.border}`, minHeight: minH }}>
              {/* พื้นหลังแต่ละวัน (กดเพื่อลงงาน) */}
              <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const iso = addDays(ws, i);
                  const out = iso < first || iso > last;
                  return (
                    <div key={iso} onClick={isAdmin ? () => onAdd(iso) : undefined} title={isAdmin ? "กดเพื่อลงงานวันนี้" : undefined}
                      style={{ borderLeft: i ? `1px solid ${c.borderSoft}` : "none", cursor: isAdmin ? "copy" : "default",
                        background: iso === todayIso ? c.borderSoft : out ? c.bg : "transparent" }} />
                  );
                })}
              </div>
              {/* วันที่ + แถบงาน */}
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: barH + 3, rowGap: 0,
                pointerEvents: "none", paddingBottom: 6 }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const iso = addDays(ws, i);
                  const out = iso < first || iso > last;
                  const isToday = iso === todayIso;
                  return (
                    <div key={iso} style={{ gridRow: 1, gridColumn: i + 1, padding: narrow ? "3px 4px 0" : "7px 10px 0", fontSize: narrow ? 11.5 : 14,
                      fontWeight: isToday ? 800 : 600, color: out ? c.text400 + "99" : c.text500 }}>
                      <span style={isToday ? { background: c.ink, color: c.onInk, borderRadius: 999, padding: "1px 6px" } : undefined}>{toDate(iso).getDate()}</span>
                    </div>
                  );
                })}
                {segs.map((sg) => (
                  <CalBar key={sg.t.id + ws} sg={sg} c={c} narrow={narrow} h={barH} color={projColor(sg.t)} onOpen={() => onOpen(sg.t)} todayIso={todayIso} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {isAdmin && <div style={{ fontSize: 11.5, color: c.text400, marginTop: 6, padding: narrow ? "0 4px" : 0 }}>กดช่องว่างในวันที่เพื่อลงงาน · กดแถบงานเพื่อดูรายละเอียด/มอบงาน</div>}
    </div>
  );
}
const navBtn = (c) => ({ width: 32, height: 32, borderRadius: 9, border: `1px solid ${c.border}`, background: c.card, color: c.text500, fontSize: 17,
  cursor: "pointer", lineHeight: 1, fontWeight: 700 });

function CalBar({ sg, c, narrow, h, color, onOpen, todayIso }) {
  const { t } = sg;
  const done = t.status === "done";
  const none = !(t.assignees || []).length;
  const overdue = !done && endOf(t) < todayIso;
  const pri = PRIORITY[t.priority] || PRIORITY.normal;
  // แถบเรียบ: พื้นการ์ด กรอบเทา แถบซ้ายสีโครงการ (เลยกำหนด = แดง) · ยังไม่มีคนทำ = กรอบประ
  const edge = none ? `1px dashed ${c.text400}` : `1px solid ${c.border}`;
  return (
    <div onClick={(e) => { e.stopPropagation(); onOpen(); }} title={`${t.title}${none ? " (ยังไม่มีคนทำ)" : ` — ${(t.assignees || []).join(", ")}`}`}
      style={{ gridRow: sg.lane + 2, gridColumn: `${sg.col + 1} / span ${sg.span}`, pointerEvents: "auto", cursor: "pointer",
        margin: `1px ${sg.contR ? 0 : 3}px 2px ${sg.contL ? 0 : 3}px`, height: h, display: "flex", alignItems: "center", gap: 5, overflow: "hidden",
        padding: narrow ? "0 4px" : "0 8px", fontSize: narrow ? 10.5 : 12.5, fontWeight: 600,
        borderRadius: `${sg.contL ? 0 : 5}px ${sg.contR ? 0 : 5}px ${sg.contR ? 0 : 5}px ${sg.contL ? 0 : 5}px`,
        background: c.card, color: done ? c.text400 : c.text900,
        borderTop: edge, borderBottom: edge, borderRight: sg.contR ? "none" : edge,
        borderLeft: sg.contL ? "none" : `3px solid ${overdue ? c.danger : color || c.text400}`,
        textDecoration: done ? "line-through" : "none" }}>
      {t.status === "inprogress" && <span title="กำลังทำ" style={{ width: 6, height: 6, borderRadius: "50%", background: c.warn, flexShrink: 0 }} />}
      {pri.label && !narrow && <span style={{ fontSize: 10.5, fontWeight: 700, color: pri.rank === 0 ? c.danger : c.warn, flexShrink: 0 }}>{pri.label}</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
      {!narrow && !none && <span style={{ marginLeft: "auto", fontSize: 11, color: c.text400, fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap" }}>{(t.assignees || []).join(", ")}</span>}
    </div>
  );
}

// ── แถวงานหนึ่งรายการ ──
function TaskRow({ t, first, c, todayIso, showAssignees, projName, projColor, canStatus, onOpen, onStatus }) {
  const pri = PRIORITY[t.priority] || PRIORITY.normal;
  const done = t.status === "done";
  const e = endOf(t);
  const dueColor = done || !e ? c.text400 : e < todayIso ? c.danger : startOf(t) <= todayIso ? c.text900 : c.text500;
  const next = t.status === "todo" ? { s: "inprogress", label: "เริ่มทำ" }
    : t.status === "inprogress" ? { s: "done", label: "เสร็จ" } : null;
  const where = [projName, t.site].filter(Boolean).join(" · ");
  const none = !(t.assignees || []).length;
  return (
    <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", cursor: "pointer",
      borderTop: first ? "none" : `1px solid ${c.borderSoft}`, borderLeft: `3px solid ${projColor || "transparent"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {pri.label && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "0 6px", borderRadius: 5, border: `1px solid ${c.border}`, color: pri.rank === 0 ? c.danger : c.warn }}>{pri.label}</span>}
          {t.status === "inprogress" && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, padding: "0 6px", borderRadius: 5, border: `1px solid ${c.border}`, color: c.text500 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: c.warn }} />กำลังทำ</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: done ? c.text400 : c.text900, textDecoration: done ? "line-through" : "none", wordBreak: "break-word" }}>{t.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: 12, color: c.text400 }}>
          {where && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{where}</span>}
          {e && <span style={{ color: dueColor, fontWeight: !done && startOf(t) <= todayIso ? 700 : 500 }}>{dueText(t, todayIso)}</span>}
          {(t.comments || []).length > 0 && <span>{t.comments.length} ความคิดเห็น</span>}
          {t.caseId && <span>เป็นเคสแล้ว</span>}
          {done && t.completedBy && <span>โดย {t.completedBy}</span>}
        </div>
      </div>
      {showAssignees && (none ? (!done && <Unassigned />) : <Avatars names={t.assignees} />)}
      {canStatus && next && !none && (
        <button onClick={(ev) => { ev.stopPropagation(); onStatus(next.s); }}
          style={{ border: `1px solid ${c.border}`, background: c.card, color: c.text900, borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{next.label}</button>
      )}
    </div>
  );
}

// ── รายละเอียดงาน: สถานะ มอบงาน ความคิดเห็น ──
function TaskDetail({ t, c, me, isAdmin, canStatus, todayIso, users, projName, projColor, onClose, onStatus, onAssign, onEdit, onDelete, onConvert, onComment }) {
  const [text, setText] = useState("");
  const pri = PRIORITY[t.priority] || PRIORITY.normal;
  const send = () => { const v = text.trim(); if (!v) return; onComment(v); setText(""); };
  const people = (users || []).filter((u) => !["pending", "disabled"].includes(u.role));
  const assignees = t.assignees || [];
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

          <div style={{ display: "flex", gap: 6, margin: "12px 0 10px" }}>
            {Object.entries(TASK_STATUS).map(([k, s]) => {
              const on = t.status === k;
              return (
                <button key={k} disabled={!canStatus || on} onClick={() => onStatus(k)}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: canStatus && !on ? "pointer" : "default", border: `1px solid ${on ? c.ink : c.border}`,
                    background: on ? c.ink : "transparent", color: on ? c.onInk : canStatus ? c.text500 : c.text400 }}>{s.label}</button>
              );
            })}
          </div>

          {meta("วันที่", (startOf(t) && `${rangeText(t)}${t.status !== "done" && dueText(t, todayIso) !== rangeText(t) ? ` (${dueText(t, todayIso)})` : ""}`) || <span style={{ color: c.text400 }}>ยังไม่กำหนด</span>)}
          {meta("โครงการ", projName && <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: projColor || "#94a3b8", marginRight: 6 }} />{projName}</span>)}
          {meta("ไซต์", t.site)}
          {meta("ความเร่งด่วน", pri.label && <span style={{ fontWeight: 700, color: pri.rank === 0 ? c.danger : c.warn }}>{pri.label}</span>)}
          {meta("ประเภท", t.type)}
          {!isAdmin && meta("ผู้รับผิดชอบ", assignees.length ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatars names={assignees} /> {assignees.join(", ")}</span> : <Unassigned />)}
          {meta("ลงงานโดย", t.createdBy && `${t.createdBy}${t.createdAt ? ` · ${fmtDate(t.createdAt.slice(0, 10))}` : ""}`)}
          {meta("เสร็จเมื่อ", t.status === "done" && t.completedAt && `${fmtDate(t.completedAt.slice(0, 10))}${t.completedBy ? ` โดย ${t.completedBy}` : ""}`)}
          {t.note && <div style={{ marginTop: 8, background: c.bg, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: c.text500, whiteSpace: "pre-wrap" }}>{t.note}</div>}

          {isAdmin && (
            <div style={{ marginTop: 12, background: c.bg, border: `1px ${assignees.length ? "solid" : "dashed"} ${assignees.length ? c.border : c.text400}`,
              borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: assignees.length ? c.text500 : c.text900, marginBottom: 8 }}>
                {assignees.length ? `ผู้รับผิดชอบ (${assignees.length})` : "ยังไม่มีคนทำ — เลือกคนทำงานนี้"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {people.map((u) => {
                  const on = assignees.includes(u.name);
                  return (
                    <button key={u.id} onClick={() => onAssign(on ? assignees.filter((n) => n !== u.name) : [...assignees, u.name])}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 999, cursor: "pointer",
                        fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? c.ink : c.border}`, background: on ? c.ink : c.card,
                        color: on ? c.onInk : c.text500 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: on ? c.onInk : c.borderSoft, color: on ? c.ink : c.text900, fontSize: 10, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{(u.name || "?").charAt(0)}</span>
                      {u.name}{on && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {isAdmin && <button onClick={onEdit} style={smallBtn(c)}>แก้ไขงาน</button>}
            {isAdmin && t.status === "done" && !t.caseId && <button onClick={onConvert} style={smallBtn(c)}>สร้างเคสจากงานนี้</button>}
            {t.caseId && <span style={{ fontSize: 12.5, color: c.text500, alignSelf: "center" }}>สร้างเคสแล้ว</span>}
            {isAdmin && <button onClick={onDelete} style={{ ...smallBtn(c), color: c.danger, border: "none", marginLeft: "auto" }}>ลบ</button>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", minHeight: 80 }}>
          <div style={{ fontSize: 11.5, color: c.text400, fontWeight: 700, marginBottom: 8 }}>ความคิดเห็น ({(t.comments || []).length})</div>
          {(t.comments || []).length === 0 ? (
            <div style={{ color: c.text400, fontSize: 12.5, padding: "6px 0" }}>ยังไม่มีความคิดเห็น</div>
          ) : (t.comments || []).map((m, i) => {
            const mine = m.by === me;
            return (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, flexDirection: mine ? "row-reverse" : "row" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: c.borderSoft, color: c.text900, fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{(m.by || "?").charAt(0)}</span>
                <div style={{ maxWidth: "78%" }}>
                  <div style={{ fontSize: 10.5, color: c.text400, marginBottom: 2, textAlign: mine ? "right" : "left" }}>{m.by} · {m.at ? fmtDate(m.at.slice(0, 10)) : ""}</div>
                  <div style={{ background: mine ? c.borderSoft : c.card, border: `1px solid ${c.border}`, borderRadius: 12,
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
            style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5, resize: "none",
              outline: "none", background: c.bg, color: c.text900 }} />
          <button onClick={send} disabled={!text.trim()} style={{ background: c.ink, border: "none", color: c.onInk, borderRadius: 10, padding: "9px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: text.trim() ? 1 : 0.5 }}>ส่ง</button>
        </div>
      </div>
    </div>
  );
}
const smallBtn = (c) => ({ border: `1px solid ${c.border}`, background: "transparent", color: c.text900, borderRadius: 9, padding: "6px 12px",
  fontSize: 12.5, fontWeight: 600, cursor: "pointer" });
