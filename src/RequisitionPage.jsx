// ใบขอเบิกสินค้า — กรอกในเว็บ เก็บประวัติ แล้วออกไฟล์ Excel ตามฟอร์มบริษัท
import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useTheme } from "./theme.js";
import { IS as inputBase, today } from "./utils.js";
import { downloadRequisition, thaiDate, MAX_ITEMS } from "./requisitionExcel.js";
import { downloadRequisitionPdf } from "./requisitionPdf.js";

// ชื่อโครงการในระบบส่วนใหญ่ขึ้นต้นด้วย "โครงการ" อยู่แล้ว — ไม่เติมซ้ำ
const projLabel = (name = "") => (name.trim().startsWith("โครงการ") ? name.trim() : `โครงการ ${name.trim()}`);
const emptyItem = () => ({ serial: "", name: "", qty: 1, unit: "Ea.", note: "" });
const emptyForm = () => ({ jobNo: "", project: "", projectId: "", site: "", date: today(), sales: "", items: [emptyItem()] });

export default function RequisitionPage({ onBack, currentUser, projects = [] }) {
  const { c } = useTheme();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // { ...data, id? }
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const narrow = typeof window !== "undefined" && window.innerWidth < 720;
  const isAdmin = ["admin", "dev"].includes(currentUser?.role);
  const canEdit = (r) => isAdmin || r.createdByUid === currentUser?.id;

  useEffect(() => onSnapshot(collection(db, "requisitions"),
    (snap) => { setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
    (err) => { setError(err.code === "permission-denied" ? "ยังไม่มีสิทธิ์อ่านใบเบิก — ต้องเพิ่ม rules ของ requisitions ใน Firebase Console" : err.message); setLoading(false); }), []);

  const flash = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2500); };

  // คำแนะนำจากใบเบิกเก่า: ชื่อรายการ หน่วย ไซต์
  const suggest = useMemo(() => {
    const names = new Map(), units = new Set(["Ea.", "ชิ้น", "ชุด", "อัน", "ม้วน", "เส้น", "กล่อง", "ลิตร"]), sites = new Set();
    list.forEach((r) => {
      if (r.site) sites.add(r.site);
      (r.items || []).forEach((it) => { if (it.name) names.set(it.name, it.unit || ""); if (it.unit) units.add(it.unit); });
    });
    return { names, units: [...units], sites: [...sites] };
  }, [list]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list
      .filter((r) => !s || [r.jobNo, r.project, r.site, r.sales, r.createdBy, ...(r.items || []).map((i) => `${i.name} ${i.serial}`)]
        .some((x) => (x || "").toLowerCase().includes(s)))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [list, q]);

  async function save() {
    const items = form.items.filter((it) => it.name.trim());
    if (!form.project.trim()) return flash("กรอกโครงการก่อน", false);
    if (!items.length) return flash("ใส่รายการสินค้าอย่างน้อย 1 รายการ", false);
    if (items.length > MAX_ITEMS) return flash(`ฟอร์มใส่ได้สูงสุด ${MAX_ITEMS} รายการต่อใบ`, false);
    const now = new Date().toISOString();
    const data = {
      jobNo: form.jobNo.trim(), project: form.project.trim(), projectId: form.projectId || "",
      site: form.site.trim(), date: form.date || today(), sales: form.sales.trim(),
      items: items.map((it) => ({ serial: it.serial.trim(), name: it.name.trim(), qty: Number(it.qty) || 0, unit: it.unit.trim(), note: it.note.trim() })),
      updatedAt: now,
    };
    setBusy("save");
    try {
      if (form.id) await updateDoc(doc(db, "requisitions", form.id), data);
      else await addDoc(collection(db, "requisitions"), { ...data, createdAt: now, createdBy: currentUser?.name || "", createdByUid: currentUser?.id || "" });
      setForm(null);
      flash(form.id ? "บันทึกการแก้ไขแล้ว" : "บันทึกใบเบิกแล้ว");
    } catch (e) {
      flash(e.code === "permission-denied" ? "ไม่มีสิทธิ์บันทึก (ต้องเพิ่ม rules ของ requisitions)" : "บันทึกไม่สำเร็จ", false);
    } finally { setBusy(null); }
  }

  async function remove(r) {
    if (!window.confirm(`ลบใบเบิกวันที่ ${thaiDate(r.date)} (${r.site || r.project}) ?`)) return;
    try { await deleteDoc(doc(db, "requisitions", r.id)); flash("ลบแล้ว"); }
    catch { flash("ลบไม่สำเร็จ", false); }
  }

  async function download(r, kind = "xlsx") {
    setBusy(`${r.id || "form"}-${kind}`);
    try {
      if (kind === "pdf") {
        const font = await downloadRequisitionPdf(r);
        if (font === "sarabun") flash("เครื่องนี้ไม่มีฟอนต์ Angsana New — ใช้ Sarabun แทน");
      } else await downloadRequisition(r);
    }
    catch (e) { flash(e.message || "สร้างไฟล์ไม่สำเร็จ", false); }
    finally { setBusy(null); }
  }

  const IS = inputBase({ background: c.bg, border: `1px solid ${c.border}`, color: c.text900 });
  const btn = (bg, fg = "#fff", extra = {}) => ({ border: "none", background: bg, color: fg, borderRadius: 9, padding: "8px 13px",
    fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", ...extra });
  const label = { fontSize: 11.5, fontWeight: 700, color: c.text500, marginBottom: 4, display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: "14px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 1000, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: c.bg, border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: c.text500 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>📦 ใบเบิกของ</div>
            <div style={{ fontSize: 11.5, color: c.text400 }}>กรอกรายการแล้วดาวน์โหลดใบขอเบิกสินค้าเป็น PDF หรือ Excel</div>
          </div>
          <button onClick={() => setForm(emptyForm())} style={btn(c.purple)}>+ สร้างใบเบิก</button>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
        <input placeholder="ค้นหาโครงการ ไซต์ รายการ serial ผู้เบิก…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ ...IS, background: c.card, marginBottom: 14 }} />

        {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13.5 }}>⚠️ {error}</div>}
        {loading ? <div style={{ textAlign: "center", color: c.text400, padding: 40 }}>กำลังโหลด…</div>
          : !shown.length ? (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: "40px 20px", textAlign: "center", color: c.text400 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>📦</div>
              {q ? "ไม่พบใบเบิกที่ค้นหา" : "ยังไม่มีใบเบิก กด \"+ สร้างใบเบิก\" เพื่อเริ่ม"}
            </div>
          ) : shown.map((r) => (
            <div key={r.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.text900 }}>{r.site || "—"} <span style={{ fontWeight: 500, color: c.text400, fontSize: 12.5 }}>· {thaiDate(r.date)}</span></div>
                  <div style={{ fontSize: 12.5, color: c.text500, marginTop: 2 }}>{r.project}{r.jobNo ? ` · JOB ${r.jobNo}` : ""}</div>
                  <div style={{ fontSize: 12.5, color: c.text900, marginTop: 8, lineHeight: 1.7 }}>
                    {(r.items || []).slice(0, 4).map((it, i) => (
                      <div key={i}>• {it.name} <span style={{ color: c.text500 }}>× {it.qty} {it.unit}</span>{it.serial ? <span style={{ color: c.text400 }}> · SN {it.serial}</span> : null}</div>
                    ))}
                    {(r.items || []).length > 4 && <div style={{ color: c.text400 }}>และอีก {(r.items || []).length - 4} รายการ</div>}
                  </div>
                  <div style={{ fontSize: 11, color: c.text400, marginTop: 6 }}>โดย {r.createdBy || "-"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => download(r, "pdf")} disabled={!!busy} style={btn(c.red)}>{busy === `${r.id}-pdf` ? "กำลังสร้าง…" : "⬇ PDF"}</button>
                  <button onClick={() => download(r)} disabled={!!busy} style={btn(c.green)}>{busy === `${r.id}-xlsx` ? "กำลังสร้าง…" : "⬇ Excel"}</button>
                  <button onClick={() => setForm({ ...emptyForm(), ...r, id: undefined, date: today(), items: (r.items || []).map((it) => ({ ...emptyItem(), ...it })) })}
                    title="สร้างใบใหม่โดยใช้รายการเดิม" style={btn(c.bg, c.text900, { border: `1px solid ${c.border}` })}>⧉ ใช้ซ้ำ</button>
                  {canEdit(r) && <>
                    <button onClick={() => setForm({ ...emptyForm(), ...r, items: (r.items || []).map((it) => ({ ...emptyItem(), ...it })) })}
                      style={btn(c.bg, c.text900, { border: `1px solid ${c.border}` })}>แก้ไข</button>
                    <button onClick={() => remove(r)} style={btn(c.bg, c.red, { border: `1px solid ${c.border}` })}>ลบ</button>
                  </>}
                </div>
              </div>
            </div>
          ))}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 300, display: "flex", alignItems: narrow ? "stretch" : "center", justifyContent: "center", padding: narrow ? 0 : 20 }}
          onClick={() => !busy && setForm(null)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: c.card, borderRadius: narrow ? 0 : 16, width: "100%", maxWidth: 860, maxHeight: narrow ? "100vh" : "92vh", overflowY: "auto", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900, flex: 1 }}>{form.id ? "แก้ไขใบเบิก" : "สร้างใบเบิก"}</div>
              <button onClick={() => setForm(null)} style={{ background: "none", border: "none", fontSize: 18, color: c.text400, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "2fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={label}>PROJECT (โครงการ) *</label>
                <input list="req-projects" value={form.project} placeholder="เช่น โครงการ Asia Era One : Cleaning Services"
                  onChange={(e) => {
                    const v = e.target.value;
                    const p = projects.find((x) => projLabel(x.name) === v || x.name === v);
                    setForm({ ...form, project: v, projectId: p?.id || "" });
                  }} style={IS} />
                <datalist id="req-projects">{projects.map((p) => <option key={p.id} value={projLabel(p.name)} />)}</datalist>
              </div>
              <div>
                <label style={label}>วันที่</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={IS} />
              </div>
              <div>
                <label style={label}>สถานที่ / ไซต์</label>
                <input list="req-sites" value={form.site} placeholder="เช่น สถานีมักกะสัน" onChange={(e) => setForm({ ...form, site: e.target.value })} style={IS} />
                <datalist id="req-sites">{suggest.sites.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label style={label}>JOB NO</label>
                <input value={form.jobNo} onChange={(e) => setForm({ ...form, jobNo: e.target.value })} style={IS} />
              </div>
              <div>
                <label style={label}>SALES</label>
                <input value={form.sales} onChange={(e) => setForm({ ...form, sales: e.target.value })} style={IS} />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: c.text900, margin: "14px 0 8px" }}>
              รายการสินค้า <span style={{ fontWeight: 500, color: c.text400, fontSize: 12 }}>({form.items.length}/{MAX_ITEMS})</span>
            </div>
            <datalist id="req-items">{[...suggest.names.keys()].map((n) => <option key={n} value={n} />)}</datalist>
            <datalist id="req-units">{suggest.units.map((u) => <option key={u} value={u} />)}</datalist>
            {form.items.map((it, i) => {
              const set = (patch) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "28px 3fr 1.3fr 70px 80px 1.3fr 30px", gap: 6, alignItems: "center",
                  padding: narrow ? 10 : 0, border: narrow ? `1px solid ${c.borderSoft}` : "none", borderRadius: 10, marginBottom: 6 }}>
                  {!narrow && <div style={{ fontSize: 12, color: c.text400, textAlign: "center" }}>{i + 1}</div>}
                  <input list="req-items" placeholder={narrow ? `${i + 1}. รายการสินค้า` : "รายการสินค้า"} value={it.name}
                    onChange={(e) => { const v = e.target.value; const u = suggest.names.get(v); set(u ? { name: v, unit: u } : { name: v }); }}
                    style={{ ...IS, gridColumn: narrow ? "1 / -1" : "auto" }} />
                  <input placeholder="Serial number" value={it.serial} onChange={(e) => set({ serial: e.target.value })} style={{ ...IS, gridColumn: narrow ? "1 / -1" : "auto" }} />
                  <input type="number" min="0" placeholder="จำนวน" value={it.qty} onChange={(e) => set({ qty: e.target.value })} style={IS} />
                  <input list="req-units" placeholder="หน่วย" value={it.unit} onChange={(e) => set({ unit: e.target.value })} style={IS} />
                  <input placeholder="หมายเหตุ" value={it.note} onChange={(e) => set({ note: e.target.value })} style={{ ...IS, gridColumn: narrow ? "1 / 2" : "auto" }} />
                  <button onClick={() => setForm({ ...form, items: form.items.length > 1 ? form.items.filter((_, j) => j !== i) : [emptyItem()] })}
                    title="ลบรายการนี้" style={{ background: "none", border: "none", color: c.red, fontSize: 16, cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
            {form.items.length < MAX_ITEMS && (
              <button onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}
                style={btn(c.bg, c.purple, { border: `1px dashed ${c.border}`, width: "100%", marginTop: 2 })}>+ เพิ่มรายการ</button>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => download(form, "pdf")} disabled={!!busy} style={btn(c.bg, c.red, { border: `1px solid ${c.red}` })}>
                {busy === "form-pdf" ? "กำลังสร้าง…" : "⬇ PDF"}</button>
              <button onClick={() => download(form)} disabled={!!busy} style={btn(c.bg, c.green, { border: `1px solid ${c.green}` })}>
                {busy === "form-xlsx" ? "กำลังสร้าง…" : "⬇ Excel"}</button>
              <button onClick={() => setForm(null)} disabled={!!busy} style={btn(c.bg, c.text500, { border: `1px solid ${c.border}` })}>ยกเลิก</button>
              <button onClick={save} disabled={!!busy} style={btn(c.purple)}>{busy === "save" ? "กำลังบันทึก…" : "บันทึก"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.ok ? "#16a34a" : "#dc2626", color: "#fff",
          padding: "10px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, zIndex: 400, boxShadow: "0 6px 20px rgba(0,0,0,.2)" }}>{toast.msg}</div>
      )}
    </div>
  );
}
