import { useState, useEffect, useMemo } from "react";
import { useTheme } from "./theme.js";
import { IS, getReceivedAt, getClosedAt, getResolution, fmtDateTime } from "./utils.js";

// บันทึกการรับเคส — ชื่อเคส / เวลารับ / รายละเอียดการแก้ไข / เวลาปิดเคส
// อ่านจาก cases ที่ App.jsx โหลดไว้แล้ว ไม่มีการอ่าน Firestore เพิ่ม
export default function CaseLogPage({ onBack, cases, projects }) {
  const { c } = useTheme();
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 720
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const rows = useMemo(() => {
    const projName = id => projects.find(p => p.id === id)?.name || "";
    return (cases || [])
      .map(cs => ({
        id: cs.id,
        title: cs.title || "ไม่ระบุชื่อ",
        project: projName(cs.projectId),
        site: cs.site || "",
        status: cs.status,
        receivedAt: getReceivedAt(cs),
        closedAt: getClosedAt(cs),
        resolution: getResolution(cs),
      }))
      .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
  }, [cases, projects]);

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.title, r.project, r.site, r.resolution].some(x => (x || "").toLowerCase().includes(q));
  });

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = filtered.map(r => ({
        "ชื่อเคส": r.title,
        "โครงการ": r.project,
        "ไซต์": r.site,
        "เวลารับ": fmtDateTime(r.receivedAt),
        "รายละเอียดการแก้ไข": r.resolution,
        "เวลาปิดเคส": r.status === "done" ? (fmtDateTime(r.closedAt) || "ปิดแล้ว (ไม่ทราบเวลา)") : "ยังไม่ปิด",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 50 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "บันทึกการรับเคส");
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `บันทึกการรับเคส_${stamp}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Export ไม่สำเร็จ: " + e.message);
    }
    setExporting(false);
  }

  const closedCell = r => r.status === "done"
    ? <span style={{ color: c.green, fontWeight: 600 }}>{fmtDateTime(r.closedAt) || "ปิดแล้ว"}</span>
    : <span style={{ background: `${c.amber}22`, color: c.amber, borderRadius: 20,
        padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>ยังไม่ปิด</span>;

  const resolutionCell = r => r.resolution
    ? <span style={{ color: c.text900, whiteSpace: "pre-wrap" }}>{r.resolution}</span>
    : <span style={{ color: c.text400 }}>—</span>;

  const th = { textAlign: "left", fontSize: 11, color: c.text400, fontWeight: 700,
    padding: "10px 12px", borderBottom: `1px solid ${c.border}`, whiteSpace: "nowrap" };
  const td = { fontSize: 13, color: c.text500, padding: "12px", verticalAlign: "top",
    borderBottom: `1px solid ${c.borderSoft}` };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai',sans-serif" }}>
      {/* Header */}
      <div style={{ background: c.card, borderBottom: `1px solid ${c.border}`, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: c.borderSoft, border: "none", borderRadius: 8,
          padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: c.text500, fontWeight: 600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.text900 }}>🗂️ บันทึกการรับเคส</div>
        <button onClick={exportExcel} disabled={exporting || filtered.length === 0}
          style={{ marginLeft: "auto", background: "#16a34a", border: "none", color: "#fff",
            borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", opacity: exporting || filtered.length === 0 ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {exporting ? "กำลัง Export…" : "⬇ Excel"}
        </button>
      </div>

      <div style={{ padding: "16px 16px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาชื่อเคส โครงการ ไซต์ รายละเอียด..."
            style={IS({ flex: 1, width: "auto", minWidth: 200, padding: "8px 12px", fontSize: 13 })}/>
          <span style={{ fontSize: 12, color: c.text400 }}>{filtered.length} เคส</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: c.text400, padding: 48, fontSize: 14 }}>
            {search ? "ไม่พบเคสที่ตรงกับการค้นหา" : "ยังไม่มีเคส"}
          </div>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(r => (
              <div key={r.id} style={{ background: c.card, border: `1px solid ${c.border}`,
                borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text900 }}>{r.title}</div>
                {(r.project || r.site) && (
                  <div style={{ fontSize: 11, color: c.text400, marginTop: 2 }}>
                    {[r.project, r.site].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px",
                  fontSize: 12, marginTop: 10, color: c.text500 }}>
                  <span style={{ color: c.text400 }}>รับ</span><span>{fmtDateTime(r.receivedAt) || "—"}</span>
                  <span style={{ color: c.text400 }}>ปิด</span><span>{closedCell(r)}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>{resolutionCell(r)}</div>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, width: "30%" }}>
                      <div style={{ fontWeight: 700, color: c.text900 }}>{r.title}</div>
                      {(r.project || r.site) && (
                        <div style={{ fontSize: 11, color: c.text400, marginTop: 2 }}>
                          {[r.project, r.site].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTime(r.receivedAt) || "—"}</td>
                    <td style={{ ...td, lineHeight: 1.6 }}>{resolutionCell(r)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{closedCell(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
