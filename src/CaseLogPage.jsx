import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useTheme } from "./theme.js";
import { IS } from "./utils.js";

// บันทึกการรับเคส — สมุดจดเคสที่แก้ได้ทางไกล (เช่น แนะนำวิธีแก้ผ่าน LINE OA)
// แยกจากเคสหลัก (cases) เก็บใน collection "caseLogs"
// ฟิลด์: title, detail, receivedAt, closedAt (null = ยังไม่ปิด), createdBy, createdAt

// ISO → ค่าของ <input type="datetime-local"> (เวลาท้องถิ่น)
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = v => (v ? new Date(v).toISOString() : null);
const fmt = iso => iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "";

function LogModal({ record, onClose, onSave, saving }) {
  const { c } = useTheme();
  const [title, setTitle] = useState(record?.title || "");
  const [receivedAt, setReceivedAt] = useState(toLocalInput(record?.receivedAt));
  const [detail, setDetail] = useState(record?.detail || "");
  const [closed, setClosed] = useState(!!record?.closedAt);
  const [closedAt, setClosedAt] = useState(toLocalInput(record?.closedAt));
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim()) return setError("กรุณากรอกชื่อเคส");
    if (closed && closedAt < receivedAt) return setError("เวลาปิดเคสต้องไม่ก่อนเวลารับ");
    onSave({
      title: title.trim(),
      detail: detail.trim(),
      receivedAt: fromLocalInput(receivedAt),
      closedAt: closed ? fromLocalInput(closedAt) : null,
    }, record?.id || null);
  }

  const LB = { fontSize: 11, color: c.text500, fontWeight: 600, marginBottom: 5, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,23,42,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: c.card, borderRadius: 16, width: "100%", maxWidth: 480,
        maxHeight: "92vh", overflowY: "auto", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text900 }}>
            {record ? "✏️ แก้ไขบันทึก" : "🗂️ บันทึกเคส"}
          </h2>
          <button onClick={onClose} style={{ background: c.borderSoft, border: "none", color: c.text500,
            cursor: "pointer", fontSize: 14, width: 30, height: 30, borderRadius: 8 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>ชื่อเคส / อาการที่แจ้ง *</label>
          <input value={title} onChange={e => { setTitle(e.target.value); setError(""); }}
            placeholder="เช่น หุ่นยนต์ไม่ออกจากแท่นชาร์จ" style={IS({ padding: "9px 12px", fontSize: 14 })} autoFocus/>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>เวลารับ</label>
          <input type="datetime-local" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
            style={IS({ padding: "9px 12px", fontSize: 14 })}/>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LB}>รายละเอียดการแก้ไข</label>
          <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={4}
            placeholder="เช่น แนะนำลูกค้าผ่าน LINE OA ให้ปิด-เปิดเครื่องใหม่ แล้วกลับมาใช้งานได้"
            style={IS({ padding: "9px 12px", fontSize: 14, resize: "vertical", lineHeight: 1.6 })}/>
        </div>

        <div style={{ marginBottom: 18, padding: "12px 14px", background: c.bg,
          border: `1px solid ${c.border}`, borderRadius: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: c.text900 }}>
            <input type="checkbox" checked={closed} style={{ accentColor: "#16a34a", width: 16, height: 16 }}
              onChange={e => { setClosed(e.target.checked); if (e.target.checked && !record?.closedAt) setClosedAt(toLocalInput()); }}/>
            ✅ ปิดเคสแล้ว
          </label>
          {closed && (
            <div style={{ marginTop: 10 }}>
              <label style={LB}>เวลาปิดเคส</label>
              <input type="datetime-local" value={closedAt} onChange={e => setClosedAt(e.target.value)}
                style={IS({ padding: "9px 12px", fontSize: 14 })}/>
            </div>
          )}
        </div>

        {error && <div style={{ color: c.red, fontSize: 12, marginBottom: 12, fontWeight: 500 }}>⚠ {error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button onClick={onClose} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500,
            borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            ยกเลิก
          </button>
          <button onClick={submit} disabled={saving}
            style={{ background: "#2563eb", border: "none", color: "#fff", borderRadius: 10, padding: 12,
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {saving ? "กำลังบันทึก…" : "💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseLogPage({ onBack, currentUser }) {
  const { c } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);        // null | "new" | record
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");     // all | open | closed
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 720);

  const isAdminOrDev = ["admin", "dev"].includes(currentUser?.role);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "caseLogs"), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
      setLogs(data); setLoading(false); setLoadError("");
    }, err => {
      console.error("caseLogs:", err);
      setLoading(false);
      setLoadError(err.code === "permission-denied"
        ? "ไม่มีสิทธิ์อ่านข้อมูล — ต้องเพิ่ม rule ของ caseLogs ใน Firebase Console ก่อน"
        : "โหลดข้อมูลไม่สำเร็จ: " + err.message);
    });
    return unsub;
  }, []);

  async function save(data, id) {
    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db, "caseLogs", id), { ...data, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, "caseLogs"), {
          ...data, createdBy: currentUser?.name || "", createdAt: new Date().toISOString(),
        });
      }
      setModal(null);
    } catch (e) {
      console.error(e);
      alert("บันทึกไม่สำเร็จ: " + e.message);
    }
    setSaving(false);
  }

  async function quickClose(r) {
    try {
      await updateDoc(doc(db, "caseLogs", r.id), { closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } catch (e) { console.error(e); alert("ปิดเคสไม่สำเร็จ: " + e.message); }
  }

  async function remove(r) {
    if (!confirm(`ลบบันทึก "${r.title}"?`)) return;
    try { await deleteDoc(doc(db, "caseLogs", r.id)); }
    catch (e) { console.error(e); alert("ลบไม่สำเร็จ: " + e.message); }
  }

  const filtered = logs.filter(r => {
    if (filter === "open" && r.closedAt) return false;
    if (filter === "closed" && !r.closedAt) return false;
    const q = search.trim().toLowerCase();
    return !q || (r.title || "").toLowerCase().includes(q) || (r.detail || "").toLowerCase().includes(q);
  });
  const openCount = logs.filter(r => !r.closedAt).length;

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
        "ชื่อเคส": r.title,
        "เวลารับ": fmt(r.receivedAt),
        "รายละเอียดการแก้ไข": r.detail || "",
        "เวลาปิดเคส": r.closedAt ? fmt(r.closedAt) : "ยังไม่ปิด",
        "ผู้บันทึก": r.createdBy || "",
      })));
      ws["!cols"] = [{ wch: 36 }, { wch: 16 }, { wch: 55 }, { wch: 16 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "บันทึกการรับเคส");
      XLSX.writeFile(wb, `บันทึกการรับเคส_${toLocalInput().slice(0, 10)}.xlsx`);
    } catch (e) { console.error(e); alert("Export ไม่สำเร็จ: " + e.message); }
    setExporting(false);
  }

  const btn = (bg, color, border) => ({ background: bg, color, border: border ? `1px solid ${border}` : "none",
    borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap" });

  const actions = r => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {!r.closedAt && <button onClick={() => quickClose(r)} style={btn(`${c.green}1a`, c.green, `${c.green}55`)}>✅ ปิดเคส</button>}
      <button onClick={() => setModal(r)} style={btn(`${c.blue}1a`, c.blue, `${c.blue}55`)}>✏️</button>
      {isAdminOrDev && <button onClick={() => remove(r)} style={btn(`${c.red}1a`, c.red, `${c.red}55`)}>🗑</button>}
    </div>
  );

  const closedCell = r => r.closedAt
    ? <span style={{ color: c.green, fontWeight: 600 }}>{fmt(r.closedAt)}</span>
    : <span style={{ background: `${c.amber}22`, color: c.amber, borderRadius: 20, padding: "2px 8px",
        fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>ยังไม่ปิด</span>;

  const th = { textAlign: "left", fontSize: 11, color: c.text400, fontWeight: 700,
    padding: "10px 12px", borderBottom: `1px solid ${c.border}`, whiteSpace: "nowrap" };
  const td = { fontSize: 13, color: c.text500, padding: "12px", verticalAlign: "top",
    borderBottom: `1px solid ${c.borderSoft}` };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai',sans-serif" }}>
      {/* Header */}
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: c.borderSoft, border: "none", borderRadius: 8,
          padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: c.text500, fontWeight: 600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.text900, whiteSpace: "nowrap" }}>🗂️ บันทึกการรับเคส</div>
        <button onClick={() => setModal("new")}
          style={{ marginLeft: "auto", background: "#2563eb", border: "none", color: "#fff", borderRadius: 8,
            padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          + บันทึกเคส
        </button>
      </div>

      <div style={{ padding: "16px 16px 80px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          {[["all", `ทั้งหมด (${logs.length})`], ["open", `ยังไม่ปิด (${openCount})`], ["closed", "ปิดแล้ว"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ ...btn(filter === v ? c.text900 : c.card, filter === v ? c.card : c.text500, filter === v ? null : c.border),
                padding: "6px 12px" }}>{l}</button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา..."
            style={IS({ flex: 1, width: "auto", minWidth: 160, padding: "7px 12px", fontSize: 13 })}/>
          <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
            style={{ ...btn("#16a34a", "#fff"), padding: "7px 12px", opacity: exporting || filtered.length === 0 ? 0.6 : 1 }}>
            {exporting ? "กำลัง Export…" : "⬇ Excel"}
          </button>
        </div>

        {loadError ? (
          <div style={{ background: `${c.red}1a`, border: `1px solid ${c.red}55`, color: c.red,
            borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>⚠ {loadError}</div>
        ) : loading ? (
          <div style={{ textAlign: "center", color: c.text400, padding: 48 }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: c.text400, padding: 48, fontSize: 14 }}>
            {logs.length === 0 ? "ยังไม่มีบันทึก กด + บันทึกเคส ได้เลย" : "ไม่พบรายการ"}
          </div>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(r => (
              <div key={r.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text900 }}>{r.title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: 12, marginTop: 8, color: c.text500 }}>
                  <span style={{ color: c.text400 }}>รับ</span><span>{fmt(r.receivedAt) || "—"}</span>
                  <span style={{ color: c.text400 }}>ปิด</span><span>{closedCell(r)}</span>
                </div>
                {r.detail && <div style={{ fontSize: 12, color: c.text900, marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.detail}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
                  <span style={{ fontSize: 11, color: c.text400 }}>{r.createdBy}</span>
                  {actions(r)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>ชื่อเคส</th>
                  <th style={th}>เวลารับ</th>
                  <th style={th}>รายละเอียดการแก้ไข</th>
                  <th style={th}>เวลาปิดเคส</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, width: "26%" }}>
                      <div style={{ fontWeight: 700, color: c.text900 }}>{r.title}</div>
                      {r.createdBy && <div style={{ fontSize: 11, color: c.text400, marginTop: 2 }}>{r.createdBy}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(r.receivedAt) || "—"}</td>
                    <td style={{ ...td, color: r.detail ? c.text900 : c.text400, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.detail || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{closedCell(r)}</td>
                    <td style={{ ...td, width: 1 }}>{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <LogModal record={modal === "new" ? null : modal} saving={saving}
          onClose={() => setModal(null)} onSave={save}/>
      )}
    </div>
  );
}
