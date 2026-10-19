// src/DevicesPage.jsx — "อุปกรณ์/รีโมท" รวม IP, AnyDesk/RustDesk และรหัสเข้าอุปกรณ์หน้างานของแต่ละโครงการ
// ข้อมูลอยู่ใน Firestore collection "devices" (โหลดเฉพาะตอนเปิดหน้านี้)
// ทุกคนในทีมดูได้ ส่วนเพิ่ม/แก้ไข/ลบ/นำเข้า Excel ทำได้เฉพาะ admin/dev
// รูปแบบไฟล์ Excel อยู่ใน src/deviceImport.js (ปุ่มส่งออกให้ไฟล์รูปแบบเดียวกับที่นำเข้าได้)

import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs } from "firebase/firestore";
import { useTheme } from "./theme.js";
import { IS as inputBase } from "./utils.js";
import {
  DEVICE_COLUMNS, rowsToDevices, devicesToRows, deviceSearchText, sortDevices, parseAccounts, formatAccounts,
} from "./deviceImport.js";

const PURPLE = "#6B21A8";
const ORANGE = "#F97316";
const RED = "#DC2626";

const TYPE_COLOR = {
  NUC: "#2563EB", PC: "#2563EB", Server: "#7C3AED", Router: "#EA580C", VPN: "#EA580C", Switch: "#0891B2",
  NVR: "#16A34A", CCTV: "#0F766E", Intrusion: "#DB2777", Ruejai: "#CA8A04", "Face Scan": "#9333EA", Web: "#475569",
};
const typeColor = (t) => TYPE_COLOR[t] || "#64748B";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// ── ช่องข้อมูลหนึ่งช่อง: ป้าย + ค่า + ปุ่มคัดลอก (รหัสผ่านซ่อนไว้ กดตาเพื่อดู) ──
function Field({ label, value, secret, href, onCopied, c }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  const shown = secret && !show ? "••••••••" : value;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.bg, border: `1px solid ${c.borderSoft}`,
      borderRadius: 8, padding: "4px 6px 4px 9px", maxWidth: "100%", minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: c.text400, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: c.text900, fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{shown}</span>
      {secret && (
        <button onClick={() => setShow((s) => !s)} title={show ? "ซ่อน" : "แสดงรหัส"}
          style={iconBtn(c)}>{show ? "🙈" : "👁"}</button>
      )}
      {href && (
        <a href={href} title="เปิดโปรแกรมรีโมท" style={{ ...iconBtn(c), textDecoration: "none" }}>↗</a>
      )}
      <button onClick={() => { copyText(value); onCopied?.(label); }} title="คัดลอก" style={iconBtn(c)}>⧉</button>
    </div>
  );
}
const iconBtn = (c) => ({ border: "none", background: "transparent", cursor: "pointer", color: c.text400, fontSize: 12.5,
  padding: "1px 3px", lineHeight: 1, fontFamily: "inherit", flexShrink: 0 });

const withPort = (ip, port) => (ip ? (port ? `${ip}:${port}` : ip) : port ? `port ${port}` : "");

function DeviceCard({ d, canEdit, onEdit, onDelete, onCopied, c }) {
  const [more, setMore] = useState(false);
  const color = typeColor(d.type);
  const details = [
    ["ยี่ห้อ", d.brand], ["S/N", d.serial], ["Firmware", d.firmware], ["Subnet", d.subnet], ["Gateway", d.gateway],
    ["RTSP", d.rtsp], ["Storage", d.storage],
  ].filter(([, v]) => v);
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color, background: color + "16", borderRadius: 6, padding: "3px 7px",
          whiteSpace: "nowrap", marginTop: 1 }}>{d.type || "อุปกรณ์"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: c.text900, wordBreak: "break-word" }}>{d.name}</div>
          {d.model && <div style={{ fontSize: 11.5, color: c.text400, marginTop: 1 }}>{d.model}</div>}
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={() => onEdit(d)} title="แก้ไข" style={iconBtn(c)}>✏️</button>
            <button onClick={() => onDelete(d)} title="ลบ" style={iconBtn(c)}>🗑️</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <Field label="IP" value={withPort(d.ip, d.port)} onCopied={onCopied} c={c} />
        <Field label="Public" value={withPort(d.publicIp, d.publicPort)} onCopied={onCopied} c={c} />
        <Field label="AnyDesk" value={d.anydesk}
          href={/^\d[\d ]+$/.test(d.anydesk) ? `anydesk:${d.anydesk.replace(/\s/g, "")}` : null} onCopied={onCopied} c={c} />
        <Field label="RustDesk" value={d.rustdesk}
          href={/^\d[\d ]+$/.test(d.rustdesk) ? `rustdesk://${d.rustdesk.replace(/\s/g, "")}` : null} onCopied={onCopied} c={c} />
        <Field label="User" value={d.username} onCopied={onCopied} c={c} />
        <Field label="Pass" value={d.password} secret onCopied={onCopied} c={c} />
      </div>
      {(d.accounts || []).length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: c.text400 }}>บัญชีอื่น:</span>
          {d.accounts.map((a, i) => (
            <React.Fragment key={i}>
              <Field label="User" value={a.username} onCopied={onCopied} c={c} />
              <Field label="Pass" value={a.password} secret onCopied={onCopied} c={c} />
            </React.Fragment>
          ))}
        </div>
      )}
      {d.note && <div style={{ fontSize: 12, color: c.text500, marginTop: 7 }}>📝 {d.note}</div>}
      {details.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setMore((m) => !m)} style={{ ...iconBtn(c), fontSize: 11.5, color: PURPLE, padding: 0 }}>
            {more ? "▴ ซ่อนรายละเอียด" : `▾ รายละเอียดเพิ่ม (${details.length})`}
          </button>
          {more && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {details.map(([k, v]) => <Field key={k} label={k} value={v} onCopied={onCopied} c={c} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ฟอร์มเพิ่ม/แก้ไขอุปกรณ์ ──
function DeviceModal({ record, projects, onClose, onSave, saving }) {
  const { c } = useTheme();
  const [f, setF] = useState(() => {
    const init = {};
    DEVICE_COLUMNS.forEach(({ key }) => { init[key] = key === "accounts" ? formatAccounts(record?.accounts) : record?.[key] || ""; });
    return init;
  });
  const IS = inputBase({ padding: "7px 10px", fontSize: 13 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const canSave = (f.name.trim() || f.ip.trim()) && f.project.trim();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,23,42,.5)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: c.card, borderRadius: 16, width: "100%", maxWidth: 620,
        maxHeight: "92vh", overflowY: "auto", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text900 }}>{record?.id ? "✏️ แก้ไขอุปกรณ์" : "➕ เพิ่มอุปกรณ์"}</h2>
          <button onClick={onClose} style={{ background: c.borderSoft, border: "none", color: c.text500, cursor: "pointer",
            fontSize: 14, width: 30, height: 30, borderRadius: 8 }}>✕</button>
        </div>
        <datalist id="device-projects">{projects.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="device-types">{Object.keys(TYPE_COLOR).map((t) => <option key={t} value={t} />)}</datalist>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
          {DEVICE_COLUMNS.filter((x) => !["accounts", "note", "rtsp"].includes(x.key)).map(({ key, label }) => (
            <label key={key} style={{ fontSize: 11, color: c.text400, fontWeight: 700 }}>
              {label}{key === "project" ? " *" : ""}
              <input value={f[key]} onChange={set(key)} style={{ ...IS, marginTop: 3 }}
                list={key === "project" ? "device-projects" : key === "type" ? "device-types" : undefined} />
            </label>
          ))}
        </div>
        {["rtsp", "accounts", "note"].map((key) => (
          <label key={key} style={{ display: "block", fontSize: 11, color: c.text400, fontWeight: 700, marginTop: 10 }}>
            {DEVICE_COLUMNS.find((x) => x.key === key).label}
            {key === "accounts" && <span style={{ fontWeight: 400 }}> (บรรทัดละบัญชี รูปแบบ user / password)</span>}
            <textarea value={f[key]} onChange={set(key)} rows={key === "rtsp" ? 1 : 2} style={{ ...IS, marginTop: 3, resize: "vertical" }} />
          </label>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text500, borderRadius: 10,
            padding: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ยกเลิก</button>
          <button disabled={!canSave || saving}
            onClick={() => onSave({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === "accounts" ? parseAccounts(v) : String(v).trim()])) })}
            style={{ background: canSave ? PURPLE : c.border, border: "none", color: "#fff", borderRadius: 10, padding: "10px",
              cursor: canSave ? "pointer" : "default", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ยืนยันการนำเข้า ──
function ImportDialog({ data, existing, onClose, onConfirm, busy }) {
  const { c } = useTheme();
  const byProject = {};
  data.devices.forEach((d) => { byProject[d.project || "(ไม่ระบุโครงการ)"] = (byProject[d.project || "(ไม่ระบุโครงการ)"] || 0) + 1; });
  const btn = (bg) => ({ border: "none", background: bg, color: "#fff", borderRadius: 10, padding: "10px 12px",
    cursor: busy ? "default" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, opacity: busy ? 0.6 : 1 });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(15,23,42,.5)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ background: c.card, borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", padding: 20 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, color: c.text900 }}>📥 นำเข้าอุปกรณ์ {data.devices.length} รายการ</h2>
        <div style={{ fontSize: 13, color: c.text500, lineHeight: 1.7 }}>
          {Object.entries(byProject).map(([p, n]) => <div key={p}>• {p}: {n} รายการ</div>)}
        </div>
        {data.unknownHeaders.length > 0 && (
          <div style={{ fontSize: 12, color: ORANGE, marginTop: 10 }}>ข้ามคอลัมน์ที่ไม่รู้จัก: {data.unknownHeaders.join(", ")}</div>
        )}
        <div style={{ fontSize: 12.5, color: c.text500, marginTop: 12 }}>ตอนนี้ในระบบมี {existing} รายการ</div>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {existing > 0 && (
            <button disabled={busy} onClick={() => onConfirm("replace")} style={btn(RED)}>
              แทนที่ทั้งหมด (ลบ {existing} รายการเดิม แล้วใส่ชุดใหม่)
            </button>
          )}
          <button disabled={busy} onClick={() => onConfirm("append")} style={btn(PURPLE)}>
            {existing > 0 ? "เพิ่มต่อจากของเดิม" : "นำเข้า"}
          </button>
          <button disabled={busy} onClick={onClose} style={{ ...btn("transparent"), color: c.text500, border: `1px solid ${c.border}` }}>
            ยกเลิก
          </button>
        </div>
        {busy && <div style={{ fontSize: 12.5, color: c.text400, marginTop: 10, textAlign: "center" }}>กำลังบันทึก...</div>}
      </div>
    </div>
  );
}

export default function DevicesPage({ onBack, currentUser }) {
  const { c } = useTheme();
  const canEdit = ["admin", "dev"].includes(currentUser?.role);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [open, setOpen] = useState({}); // โครงการที่กางอยู่
  const [modal, setModal] = useState(null); // null | {} (เพิ่ม) | device (แก้ไข)
  const [saving, setSaving] = useState(false);
  const [importData, setImportData] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "devices"), (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError(err.code === "permission-denied"
        ? "ไม่มีสิทธิ์อ่านข้อมูลอุปกรณ์ — ต้องเพิ่มกฎ Firestore ให้ collection \"devices\""
        : "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง");
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const sorted = useMemo(() => sortDevices(devices), [devices]);
  const projects = useMemo(() => {
    const m = new Map();
    sorted.forEach((d) => m.set(d.project || "(ไม่ระบุโครงการ)", (m.get(d.project || "(ไม่ระบุโครงการ)") || 0) + 1));
    return [...m.entries()];
  }, [sorted]);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => sorted.filter((d) =>
    (!project || (d.project || "(ไม่ระบุโครงการ)") === project) &&
    (!q || q.split(/\s+/).every((w) => deviceSearchText(d).includes(w)))), [sorted, project, q]);

  // จัดกลุ่ม โครงการ → ไซต์
  const groups = useMemo(() => {
    const out = [];
    filtered.forEach((d) => {
      const p = d.project || "(ไม่ระบุโครงการ)";
      let g = out[out.length - 1];
      if (!g || g.project !== p) out.push((g = { project: p, sites: [] }));
      let s = g.sites[g.sites.length - 1];
      if (!s || s.site !== (d.site || "")) g.sites.push((s = { site: d.site || "", items: [] }));
      s.items.push(d);
    });
    return out;
  }, [filtered]);
  const expandAll = Boolean(q || project) || groups.length === 1;

  const onCopied = (label) => setToast(`คัดลอก ${label} แล้ว`);

  async function handleSave(data) {
    setSaving(true);
    try {
      const payload = { ...data, updatedAt: Date.now(), updatedBy: currentUser?.name || currentUser?.email || "" };
      if (modal?.id) await updateDoc(doc(db, "devices", modal.id), payload);
      else await addDoc(collection(db, "devices"), { ...payload, order: Date.now(), createdAt: Date.now() });
      setModal(null);
    } catch (err) {
      console.error(err);
      alert(err.code === "permission-denied" ? "ไม่มีสิทธิ์บันทึก — ต้องเพิ่มกฎ Firestore ให้ collection \"devices\"" : "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function handleDelete(d) {
    if (!window.confirm(`ลบ "${d.name}" (${d.project}${d.site ? " / " + d.site : ""})?`)) return;
    try { await deleteDoc(doc(db, "devices", d.id)); } catch (err) { console.error(err); alert("ลบไม่สำเร็จ"); }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      if (!wb.Sheets["devices"] && wb.SheetNames.length > 1 &&
        !window.confirm(`ไฟล์นี้ไม่ใช่ไฟล์รูปแบบนำเข้า (ไม่มีชีต "devices") จะอ่านเฉพาะชีตแรก "${wb.SheetNames[0]}" ชีตอื่นอีก ${wb.SheetNames.length - 1} ชีตจะไม่ถูกนำเข้า — ทำต่อไหม?`)) return;
      const sheet = wb.Sheets["devices"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const data = rowsToDevices(rows);
      if (!data.devices.length) { alert("ไม่พบรายการอุปกรณ์ในไฟล์"); return; }
      setImportData(data);
    } catch (err) {
      console.error(err);
      alert(err.message || "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  async function runImport(mode) {
    setSaving(true);
    try {
      const col = collection(db, "devices");
      let ops = [];
      if (mode === "replace") {
        const snap = await getDocs(col);
        snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      }
      const base = Date.now();
      const by = currentUser?.name || currentUser?.email || "";
      importData.devices.forEach((d, i) => {
        ops.push((b) => b.set(doc(col), { ...d, order: base + i, createdAt: base, updatedAt: base, updatedBy: by }));
      });
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db);
        ops.slice(i, i + 400).forEach((fn) => fn(batch));
        await batch.commit();
      }
      setImportData(null);
      setToast(`นำเข้า ${importData.devices.length} รายการแล้ว`);
    } catch (err) {
      console.error(err);
      alert(err.code === "permission-denied" ? "ไม่มีสิทธิ์บันทึก — ต้องเพิ่มกฎ Firestore ให้ collection \"devices\"" : "นำเข้าไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function handleExport() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(devicesToRows(filtered));
    ws["!cols"] = DEVICE_COLUMNS.map((x) => ({ wch: ["name", "note", "rtsp", "accounts"].includes(x.key) ? 30 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "devices");
    XLSX.writeFile(wb, `devices-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const chip = (active) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap", border: `1px solid ${active ? PURPLE : c.border}`,
    background: active ? PURPLE : c.card, color: active ? "#fff" : c.text500 });
  const toolBtn = { ...chip(false), color: PURPLE, display: "inline-flex", alignItems: "center", gap: 4 };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${c.border}`,
        background: c.card, position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, color: c.text500, cursor: "pointer",
          padding: 4, lineHeight: 1 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0891B216", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 17 }}>🖥️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>อุปกรณ์/รีโมท</div>
          <div style={{ fontSize: 11.5, color: c.text400 }}>IP · AnyDesk · RustDesk · รหัสเข้าอุปกรณ์หน้างาน</div>
        </div>
        <div style={{ fontSize: 12, color: c.text400, whiteSpace: "nowrap" }}>{devices.length} รายการ</div>
      </div>

      <div style={{ padding: "14px 16px 40px", maxWidth: 880, margin: "0 auto" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา ชื่ออุปกรณ์ / IP / AnyDesk / ไซต์ / รุ่น..."
          style={inputBase({ padding: "10px 14px", fontSize: 14, borderRadius: 12 })} />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px", WebkitOverflowScrolling: "touch" }}>
          <button onClick={() => setProject("")} style={chip(!project)}>ทั้งหมด</button>
          {projects.map(([p, n]) => (
            <button key={p} onClick={() => setProject(project === p ? "" : p)} style={chip(project === p)}>{p} · {n}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 12px" }}>
          {canEdit && <button onClick={() => setModal({})} style={toolBtn}>➕ เพิ่มอุปกรณ์</button>}
          {canEdit && (
            <label style={{ ...toolBtn, cursor: "pointer" }}>📥 นำเข้า Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          )}
          {devices.length > 0 && <button onClick={handleExport} style={toolBtn}>📤 ส่งออก Excel</button>}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: c.text400, fontSize: 13 }}>กำลังโหลด...</div>}
        {error && <div style={{ background: RED + "10", color: RED, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>{error}</div>}
        {!loading && !error && devices.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 10px", color: c.text400, fontSize: 13, lineHeight: 1.8 }}>
            ยังไม่มีข้อมูลอุปกรณ์{canEdit ? " — กด \"นำเข้า Excel\" เพื่อใส่ข้อมูลชุดแรก" : ""}
          </div>
        )}
        {!loading && devices.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: c.text400, fontSize: 13 }}>ไม่พบอุปกรณ์ที่ตรงกับคำค้น</div>
        )}

        {groups.map((g) => {
          const isOpen = expandAll || open[g.project];
          const count = g.sites.reduce((n, s) => n + s.items.length, 0);
          return (
            <div key={g.project} style={{ marginBottom: 10 }}>
              <button onClick={() => setOpen((o) => ({ ...o, [g.project]: !isOpen }))} disabled={expandAll}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: c.card, border: `1px solid ${c.border}`,
                  borderRadius: 12, padding: "11px 14px", cursor: expandAll ? "default" : "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: c.text900, flex: 1 }}>{g.project}</span>
                <span style={{ fontSize: 11.5, color: c.text400 }}>{g.sites.length} ไซต์ · {count} รายการ</span>
                {!expandAll && <span style={{ color: c.text400, fontSize: 12 }}>{isOpen ? "▴" : "▾"}</span>}
              </button>
              {isOpen && g.sites.map((s) => (
                <div key={s.site} style={{ padding: "8px 0 0 6px" }}>
                  {s.site && <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, margin: "2px 0 6px 4px" }}>📍 {s.site}</div>}
                  {s.items.map((d) => (
                    <DeviceCard key={d.id} d={d} canEdit={canEdit} onEdit={setModal} onDelete={handleDelete} onCopied={onCopied} c={c} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {modal && (
        <DeviceModal record={modal} projects={projects.map(([p]) => p)} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />
      )}
      {importData && (
        <ImportDialog data={importData} existing={devices.length} onClose={() => setImportData(null)} onConfirm={runImport} busy={saving} />
      )}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff",
          padding: "8px 16px", borderRadius: 999, fontSize: 13, zIndex: 700, boxShadow: "0 6px 20px rgba(0,0,0,.25)" }}>{toast}</div>
      )}
    </div>
  );
}
