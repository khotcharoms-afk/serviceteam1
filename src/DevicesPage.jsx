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
import EyeIcon from "./components/EyeIcon.jsx";

const PURPLE = "#6B21A8";
const ORANGE = "#F97316";
const RED = "#DC2626";

const TYPE_COLOR = {
  NUC: "#2563EB", PC: "#2563EB", Server: "#7C3AED", Router: "#EA580C", VPN: "#EA580C", Switch: "#0891B2",
  NVR: "#16A34A", CCTV: "#0F766E", Intrusion: "#DB2777", Ruejai: "#CA8A04", "Face Scan": "#9333EA", Web: "#475569", Robot: "#C026D3",
  SC50: "#2563EB", "SC50 Plus": "#7C3AED", SC80: "#EA580C", Mix1: "#0D9488",
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

// ค่าต่างๆ (IP, AnyDesk, รหัส) ใช้ฟอนต์เดียวกับทั้งแอป + ตัวเลขกว้างเท่ากันให้อ่านง่าย
const MONO = "'Noto Sans Thai','Sora',sans-serif";
const iconBtn = (c) => ({ border: "none", background: "transparent", cursor: "pointer", color: c.text400, fontSize: 12.5,
  padding: "1px 3px", lineHeight: 1, fontFamily: "inherit", flexShrink: 0 });
const withPort = (ip, port) => (ip ? (port ? `${ip}:${port}` : ip) : port ? `port ${port}` : "");
const remoteHref = (kind, id) => (/^\d[\d ]+$/.test(id || "") ? `${kind === "anydesk" ? "anydesk:" : "rustdesk://"}${id.replace(/\s/g, "")}` : null);

function useIsNarrow(px = 760) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < px);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < px);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [px]);
  return narrow;
}

// ค่าที่กดแล้วคัดลอก
// ปุ่มไอคอนคัดลอก (แสดงข้างค่าทุกช่อง)
function CopyBtn({ value, label, onCopied, c }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); copyText(value); onCopied?.(label); setDone(true); setTimeout(() => setDone(false), 1200); }}
      title={`คัดลอก ${label}`} aria-label={`คัดลอก ${label}`}
      style={{ border: `1px solid ${done ? "#16A34A55" : c.border}`, background: done ? "#16A34A12" : c.card, borderRadius: 6,
        width: 24, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        padding: 0, flexShrink: 0, color: done ? "#16A34A" : c.text400 }}>
      {done ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      )}
    </button>
  );
}

function Copy({ value, label, onCopied, c, mono = true, muted }) {
  if (!value) return <span style={{ color: c.text400, opacity: 0.5 }}>–</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
      <button onClick={(e) => { e.stopPropagation(); copyText(value); onCopied?.(label); }} title={`คัดลอก ${label}`}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "copy", fontFamily: mono ? MONO : "inherit", fontVariantNumeric: "tabular-nums",
          fontSize: 12.5, color: muted ? c.text400 : c.text900, textAlign: "left", wordBreak: "break-all", minWidth: 0 }}>
        {value}
      </button>
      <CopyBtn value={value} label={label} onCopied={onCopied} c={c} />
    </span>
  );
}

// รหัสผ่าน: ซ่อนไว้ กด 👁 เพื่อดู กดที่ตัวรหัสเพื่อคัดลอก
function Secret({ value, onCopied, c }) {
  const [show, setShow] = useState(false);
  if (!value) return <span style={{ color: c.text400, opacity: 0.5 }}>–</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <button onClick={(e) => { e.stopPropagation(); copyText(value); onCopied?.("รหัสผ่าน"); }} title="คัดลอกรหัสผ่าน"
        style={{ border: "none", background: "transparent", padding: 0, cursor: "copy", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12.5,
          color: c.text900, wordBreak: "break-all", textAlign: "left" }}>{show ? value : "••••••"}</button>
      <button onClick={(e) => { e.stopPropagation(); setShow((s) => !s); }} title={show ? "ซ่อนรหัส" : "แสดงรหัส"} style={{ ...iconBtn(c), display: "inline-flex", alignItems: "center" }}>
        <EyeIcon off={show} size={14} />
      </button>
      <CopyBtn value={value} label="รหัสผ่าน" onCopied={onCopied} c={c} />
    </span>
  );
}

function Remote({ d, onCopied, c }) {
  const items = [["anydesk", "AnyDesk", d.anydesk], ["rustdesk", "RustDesk", d.rustdesk]].filter(([, , v]) => v);
  if (!items.length) return <span style={{ color: c.text400, opacity: 0.5 }}>–</span>;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {items.map(([k, label, v]) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: k === "anydesk" ? "#EF4444" : "#0EA5E9" }}>{k === "anydesk" ? "AD" : "RD"}</span>
          <Copy value={v} label={label} onCopied={onCopied} c={c} />
          {remoteHref(k, v) && <a href={remoteHref(k, v)} title={`เปิด ${label}`} onClick={(e) => e.stopPropagation()}
            style={{ ...iconBtn(c), textDecoration: "none", color: PURPLE }}>↗</a>}
        </span>
      ))}
    </div>
  );
}

const TypeBadge = ({ t }) => (
  <span style={{ fontSize: 10.5, fontWeight: 800, color: typeColor(t), background: typeColor(t) + "16", borderRadius: 6,
    padding: "2px 7px", whiteSpace: "nowrap" }}>{t || "อุปกรณ์"}</span>
);

// รายละเอียดเพิ่มเติม (กดแถวเพื่อเปิด)
function Details({ d, shared, canEdit, onEdit, onDelete, onCopied, c }) {
  const rows = [["ยี่ห้อ", d.brand], ["รุ่น", d.model], ["S/N", d.serial], ["Firmware", d.firmware], ["Subnet", d.subnet],
    ["Gateway", d.gateway], ["RTSP", d.rtsp], ["Storage", d.storage]].filter(([, v]) => v);
  const accounts = [...(shared ? [{ username: d.username, password: d.password, main: true }] : []), ...(d.accounts || [])];
  return (
    <div style={{ background: c.bg, borderRadius: 10, padding: "10px 12px", display: "grid", gap: 8, fontSize: 12.5 }}>
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 14px" }}>
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <span style={{ color: c.text400, fontWeight: 700, fontSize: 11.5 }}>{k}</span>
              <Copy value={v} label={k} onCopied={onCopied} c={c} />
            </React.Fragment>
          ))}
        </div>
      )}
      {accounts.length > 0 && (
        <div>
          <div style={{ color: c.text400, fontWeight: 700, fontSize: 11.5, marginBottom: 4 }}>บัญชีเข้าใช้งาน</div>
          <div style={{ display: "grid", gridTemplateColumns: "max-content max-content", gap: "4px 18px" }}>
            {accounts.map((a, i) => (
              <React.Fragment key={i}>
                <Copy value={a.username} label="Username" onCopied={onCopied} c={c} />
                <Secret value={a.password} onCopied={onCopied} c={c} />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      {d.note && <div style={{ color: c.text500 }}>📝 {d.note}</div>}
      {canEdit && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onEdit(d)} style={{ ...iconBtn(c), color: PURPLE, fontWeight: 700, fontSize: 12 }}>✏️ แก้ไข</button>
          <button onClick={() => onDelete(d)} style={{ ...iconBtn(c), color: RED, fontWeight: 700, fontSize: 12 }}>🗑️ ลบ</button>
        </div>
      )}
    </div>
  );
}

// user/password ที่ใช้ซ้ำมากที่สุดในไซต์ (≥3 เครื่อง) แสดงครั้งเดียวที่หัวไซต์
function sharedLogin(items) {
  const m = new Map();
  items.forEach((d) => { if (d.password) { const k = `${d.username}\u0000${d.password}`; m.set(k, (m.get(k) || 0) + 1); } });
  let best = null;
  m.forEach((n, k) => { if (n >= 3 && (!best || n > best.n)) best = { n, k }; });
  if (!best) return null;
  const [username, password] = best.k.split("\u0000");
  return { username, password, n: best.n };
}

function SiteTable({ site, items, canEdit, onEdit, onDelete, onCopied, c, narrow }) {
  const [openId, setOpenId] = useState(null);
  const shared = useMemo(() => sharedLogin(items), [items]);
  const isShared = (d) => shared && d.username === shared.username && d.password === shared.password;
  const has = (f) => items.some(f);
  const cols = [
    { key: "type", label: "ประเภท", w: "88px", show: true },
    { key: "name", label: "อุปกรณ์", w: "minmax(150px,1.4fr)", show: true },
    { key: "ip", label: "Local IP", w: "minmax(120px,1fr)", show: has((d) => d.ip || d.port) },
    { key: "pub", label: "Public", w: "minmax(130px,1fr)", show: has((d) => d.publicIp || d.publicPort) },
    { key: "remote", label: "รีโมท", w: "minmax(120px,1fr)", show: has((d) => d.anydesk || d.rustdesk) },
    { key: "user", label: "User", w: "minmax(80px,.8fr)", show: has((d) => d.username || d.password) },
    { key: "pass", label: "Password", w: "minmax(110px,1fr)", show: has((d) => d.username || d.password) },
  ].filter((x) => x.show);
  const grid = cols.map((x) => x.w).join(" ") + " 22px";
  const extras = (d) => {
    const n = (d.accounts || []).length;
    return (
      <span style={{ display: "inline-flex", gap: 4, marginLeft: 6, verticalAlign: "middle" }}>
        {n > 0 && <span style={{ fontSize: 10, color: PURPLE, background: PURPLE + "14", borderRadius: 5, padding: "1px 5px" }}>+{n} บัญชี</span>}
        {d.note && <span title={d.note} style={{ fontSize: 11 }}>📝</span>}
      </span>
    );
  };
  const cell = (d, key) => {
    switch (key) {
      case "type": return <TypeBadge t={d.type} />;
      case "name": return (
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: c.text900, wordBreak: "break-word" }}>{d.name}</span>{extras(d)}
          {d.model && <div style={{ fontSize: 11, color: c.text400 }}>{d.model}</div>}
        </div>);
      case "ip": return <Copy value={withPort(d.ip, d.port)} label="IP" onCopied={onCopied} c={c} />;
      case "pub": return <Copy value={withPort(d.publicIp, d.publicPort)} label="Public IP" onCopied={onCopied} c={c} />;
      case "remote": return <Remote d={d} onCopied={onCopied} c={c} />;
      case "user": return isShared(d) ? <span style={{ fontSize: 11.5, color: "#92400E", whiteSpace: "nowrap" }}>🔑 รหัสหลัก</span>
        : <Copy value={d.username} label="Username" onCopied={onCopied} c={c} />;
      case "pass": return isShared(d) ? null
        : <Secret value={d.password} onCopied={onCopied} c={c} />;
      default: return null;
    }
  };

  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", padding: "10px 14px",
        borderBottom: `1px solid ${c.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>📍 {site || "ไม่ระบุไซต์"}</span>
        <span style={{ fontSize: 11.5, color: c.text400 }}>{items.length} เครื่อง</span>
        {shared && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, background: "#FEF3C7",
            borderRadius: 8, padding: "3px 10px", marginLeft: "auto" }}>
            <span style={{ color: "#92400E", fontWeight: 700 }}>🔑 รหัสหลัก ({shared.n} เครื่อง)</span>
            <Copy value={shared.username} label="Username" onCopied={onCopied} c={c} />
            <Secret value={shared.password} onCopied={onCopied} c={c} />
          </span>
        )}
      </div>

      {!narrow && (
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10, padding: "7px 14px", background: c.bg,
          fontSize: 10.5, fontWeight: 800, color: c.text400, letterSpacing: 0.3 }}>
          {cols.map((x) => <span key={x.key}>{x.label}</span>)}<span />
        </div>
      )}

      {items.map((d, i) => {
        const open = openId === d.id;
        return (
          <div key={d.id} style={{ borderTop: i ? `1px solid ${c.borderSoft}` : "none", background: open ? PURPLE + "06" : "transparent" }}>
            <div onClick={() => setOpenId(open ? null : d.id)} style={{ cursor: "pointer", padding: "8px 14px" }}>
              {narrow ? (
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TypeBadge t={d.type} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13, color: c.text900, wordBreak: "break-word" }}>
                      {d.name}{extras(d)}</span>
                    <span style={{ color: c.text400, fontSize: 11 }}>{open ? "▴" : "▾"}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "center", fontSize: 12 }}>
                    {(d.ip || d.port) && <span>{cell(d, "ip")}</span>}
                    {(d.publicIp || d.publicPort) && <span><span style={{ fontSize: 10, color: c.text400, fontWeight: 700 }}>PUB </span>{cell(d, "pub")}</span>}
                    {(d.anydesk || d.rustdesk) && <Remote d={d} onCopied={onCopied} c={c} />}
                    {!isShared(d) && (d.username || d.password) && (
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <Copy value={d.username} label="Username" onCopied={onCopied} c={c} /> <Secret value={d.password} onCopied={onCopied} c={c} />
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10, alignItems: "center" }}>
                  {cols.map((x) => <div key={x.key} style={{ minWidth: 0 }}>{cell(d, x.key)}</div>)}
                  <span style={{ color: c.text400, fontSize: 11, textAlign: "right" }}>{open ? "▴" : "▾"}</span>
                </div>
              )}
            </div>
            {open && (
              <div style={{ padding: "0 14px 10px" }}>
                <Details d={d} shared={isShared(d)} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} onCopied={onCopied} c={c} />
              </div>
            )}
          </div>
        );
      })}
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
function ImportDialog({ data, existingDevices, onClose, onConfirm, busy }) {
  const existing = existingDevices.length;
  const fileProjects = [...new Set(data.devices.map((d) => d.project || ""))];
  const sameProject = existingDevices.filter((d) => fileProjects.includes(d.project || "")).length;
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
          {sameProject > 0 ? (
            <button disabled={busy} onClick={() => onConfirm("projects")} style={btn(PURPLE)}>
              อัปเดตเฉพาะโครงการในไฟล์ (แทน {sameProject} รายการเดิมของโครงการเหล่านี้ โครงการอื่นไม่โดน)
            </button>
          ) : (
            <button disabled={busy} onClick={() => onConfirm("append")} style={btn(PURPLE)}>
              {existing > 0 ? `เพิ่มเข้าไป (ของเดิม ${existing} รายการยังอยู่ครบ)` : "นำเข้า"}
            </button>
          )}
          {sameProject > 0 && (
            <button disabled={busy} onClick={() => onConfirm("append")} style={{ ...btn("transparent"), color: PURPLE, border: `1px solid ${PURPLE}` }}>
              เพิ่มต่อโดยไม่ลบอะไร (อาจได้รายการซ้ำ)
            </button>
          )}
          {existing > 0 && (
            <button disabled={busy} onClick={() => { if (window.confirm(`ลบอุปกรณ์ทั้งหมด ${existing} รายการทุกโครงการ แล้วใส่เฉพาะชุดในไฟล์นี้?`)) onConfirm("replace"); }}
              style={{ ...btn("transparent"), color: RED, border: `1px solid ${RED}55`, fontWeight: 600 }}>
              แทนที่ทั้งหมดทุกโครงการ (ลบ {existing} รายการเดิม)
            </button>
          )}
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
  const narrow = useIsNarrow();
  const canEdit = ["admin", "dev"].includes(currentUser?.role);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [typeF, setTypeF] = useState("");
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
  const inProject = useMemo(() => sorted.filter((d) => !project || (d.project || "(ไม่ระบุโครงการ)") === project), [sorted, project]);
  // ประเภทในโครงการที่เลือก (เช่น หุ่นยนต์: SC50 / SC50 Plus / SC80 / Mix1)
  const types = useMemo(() => {
    const m = new Map();
    inProject.forEach((d) => m.set(d.type || "อุปกรณ์", (m.get(d.type || "อุปกรณ์") || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inProject]);
  const filtered = useMemo(() => inProject.filter((d) =>
    (!typeF || (d.type || "อุปกรณ์") === typeF) &&
    (!q || q.split(/\s+/).every((w) => deviceSearchText(d).includes(w)))), [inProject, typeF, q]);

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
  const expandAll = Boolean(q || project || typeF) || groups.length === 1;

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
      } else if (mode === "projects") {
        const names = new Set(importData.devices.map((d) => d.project || ""));
        devices.filter((d) => names.has(d.project || "")).forEach((d) => ops.push((b) => b.delete(doc(db, "devices", d.id))));
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

      <div style={{ padding: "14px 16px 40px", maxWidth: 1180, margin: "0 auto" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา ชื่ออุปกรณ์ / IP / AnyDesk / ไซต์ / รุ่น..."
          style={inputBase({ padding: "10px 14px", fontSize: 14, borderRadius: 12 })} />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px", WebkitOverflowScrolling: "touch" }}>
          <button onClick={() => setProject("")} style={chip(!project)}>ทั้งหมด</button>
          {projects.map(([p, n]) => (
            <button key={p} onClick={() => { setProject(project === p ? "" : p); setTypeF(""); }} style={chip(project === p)}>{p} · {n}</button>
          ))}
        </div>
        {project && types.length > 1 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: c.text400, whiteSpace: "nowrap" }}>ประเภท:</span>
            {types.map(([t, n]) => {
              const on = typeF === t;
              return (
                <button key={t} onClick={() => setTypeF(on ? "" : t)} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5,
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  border: `1px solid ${on ? typeColor(t) : typeColor(t) + "40"}`, background: on ? typeColor(t) : typeColor(t) + "10",
                  color: on ? "#fff" : typeColor(t) }}>{t} · {n}</button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 12px" }}>
          {canEdit && <button onClick={() => setModal({})} style={toolBtn}>➕ เพิ่มอุปกรณ์</button>}
          {canEdit && (
            <label style={{ ...toolBtn, cursor: "pointer" }}>📥 นำเข้า Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          )}
          {devices.length > 0 && <button onClick={handleExport} style={toolBtn}>📤 ส่งออก Excel</button>}
        </div>
        {devices.length > 0 && (
          <div style={{ fontSize: 11.5, color: c.text400, margin: "-4px 0 10px" }}>
            กดที่ค่าเพื่อคัดลอก · กดที่แถวเพื่อดูรายละเอียด/บัญชีอื่น · 🔑 รหัสหลัก = ใช้รหัสเดียวกับที่แสดงบนหัวไซต์
          </div>
        )}

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
              {isOpen && <div style={{ paddingTop: 8 }}>{g.sites.map((s) => (
                <SiteTable key={s.site} site={s.site} items={s.items} canEdit={canEdit} onEdit={setModal} onDelete={handleDelete}
                  onCopied={onCopied} c={c} narrow={narrow} />
              ))}</div>}
            </div>
          );
        })}
      </div>

      {modal && (
        <DeviceModal record={modal} projects={projects.map(([p]) => p)} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />
      )}
      {importData && (
        <ImportDialog data={importData} existingDevices={devices} onClose={() => setImportData(null)} onConfirm={runImport} busy={saving} />
      )}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff",
          padding: "8px 16px", borderRadius: 999, fontSize: 13, zIndex: 700, boxShadow: "0 6px 20px rgba(0,0,0,.25)" }}>{toast}</div>
      )}
    </div>
  );
}
