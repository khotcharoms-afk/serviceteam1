import { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import OnsiteModal from "./OnsiteModal.jsx";

export default function OnsitePage({ onBack, projects, users, currentUser, cases, onSaveOnsite, saving }) {

  const [showModal, setShowModal] = useState(false);

  // Filters
  const [filterProj, setFilterProj]   = useState("all");
  const [filterTech, setFilterTech]   = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");

  // แตก onsiteLog[] จากทุก case มารวมกัน พร้อมแนบข้อมูล case ไว้ด้วย
  const records = (cases || []).flatMap(c =>
    (c.onsiteLog || []).map(entry => ({
      ...entry,
      caseId:     c.id,
      caseTitle:  c.title || "",
      projectId:  c.projectId || "",
      site:       c.site || "",
      techs:      c.techs || (c.tech ? [c.tech] : []),
    }))
  );

  // Filter
  const filtered = records.filter(r => {
    if (filterProj !== "all" && r.projectId !== filterProj) return false;
    if (filterTech !== "all" && !(r.techs||[]).includes(filterTech)) return false;
    if (filterScope !== "all" && r.scope !== filterScope) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  }).sort((a,b) => (b.date||"").localeCompare(a.date||""));

  // Summary
  const totalLabor  = filtered.reduce((s,r) => s + (r.laborCost||0), 0);
  const totalTravel = filtered.reduce((s,r) => s + (r.travelCost||0), 0);
  const totalAll    = filtered.reduce((s,r) => s + (r.totalCost||0), 0);

  const techNames = [...new Set(records.flatMap(r => r.techs||[]))].sort();
  const scopes    = [...new Set(records.map(r => r.scope).filter(Boolean))].sort();

  async function handleSave(data) {
    await onSaveOnsite(data);
    setShowModal(false);
  }

  function exportExcel() {
    const rows = filtered.map((r,i) => {
      const proj = projects.find(p => p.id === r.projectId);
      return {
        "ลำดับ":          i+1,
        "วันที่ Onsite":   r.date||"",
        "ชื่อเคส":         r.caseTitle||"",
        "โครงการ":         proj?.name||r.projectId||"",
        "ไซต์งาน":        r.site||"",
        "ขอบเขต":         r.scope||"",
        "รายละเอียด":     r.detail||"",
        "พนักงาน":        (r.techs||[]).join(", "),
        "ระยะทาง (กม.)":  r.km||0,
        "ค่าเดินทาง":     r.travelCost||0,
        "ค่าขนส่ง":       r.shippingCost||0,
        "ค่าอุปกรณ์":     r.partsCost||0,
        "ค่าแรง":         r.laborCost||0,
        "รวม":            r.totalCost||0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [5,12,24,16,14,14,24,20,10,12,10,10,10,12].map(w=>({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onsite");
    const now = new Date();
    XLSX.writeFile(wb, `Onsite_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}.xlsx`);
  }

  const inputStyle = {
    border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px",
    fontSize:12, fontFamily:"inherit", background:"#f8fafc", outline:"none",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"14px 20px",
        display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9", border:"none", borderRadius:8,
          padding:"7px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit", color:"#475569", fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>📍 Onsite Records</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={exportExcel}
            style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#16a34a",
              borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            📥 Export Excel
          </button>
        </div>
      </div>

      <div style={{ padding:"16px 20px 48px", maxWidth:1100, margin:"0 auto" }}>

        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
          {[
            { label:"ครั้ง Onsite", val:filtered.length, color:"#2563eb", unit:"ครั้ง" },
            { label:"ค่าแรงรวม",    val:totalLabor.toLocaleString(), color:"#16a34a", unit:"บาท" },
            { label:"รวมทั้งสิ้น",  val:totalAll.toLocaleString(), color:"#f97316", unit:"บาท" },
          ].map(c => (
            <div key={c.label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px",
              border:`1px solid ${c.color}20`, boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ fontSize:11, color:"#94a3b8", fontWeight:700, marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.val}</div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>{c.unit}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px",
          border:"1px solid #e2e8f0", marginBottom:16,
          display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
          <select value={filterProj} onChange={e=>setFilterProj(e.target.value)} style={inputStyle}>
            <option value="all">ทุกโครงการ</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterTech} onChange={e=>setFilterTech(e.target.value)} style={inputStyle}>
            <option value="all">ทุกคน</option>
            {techNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filterScope} onChange={e=>setFilterScope(e.target.value)} style={inputStyle}>
            <option value="all">ทุกขอบเขต</option>
            {scopes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputStyle}/>
          <span style={{ fontSize:12, color:"#94a3b8" }}>ถึง</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputStyle}/>
          {(filterProj!=="all"||filterTech!=="all"||filterScope!=="all"||dateFrom||dateTo) && (
            <button onClick={()=>{ setFilterProj("all"); setFilterTech("all"); setFilterScope("all"); setDateFrom(""); setDateTo(""); }}
              style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444",
                borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              ล้าง
            </button>
          )}
          <span style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto" }}>{filtered.length} รายการ</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", color:"#cbd5e1", padding:48, fontSize:14 }}>
            ยังไม่มีข้อมูล Onsite
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    {["#","วันที่","โครงการ/ไซต์","เคส","ขอบเขต","พนักงาน","ค่าเดินทาง","ค่าแรง","รวม"].map(h => (
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11,
                        color:"#64748b", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i) => {
                    const proj = projects.find(p => p.id === r.projectId);
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid #f1f5f9",
                        background: i%2===0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding:"10px 12px", color:"#94a3b8", fontWeight:600 }}>{i+1}</td>
                        <td style={{ padding:"10px 12px", whiteSpace:"nowrap", color:"#475569" }}>{r.date||"-"}</td>
                        <td style={{ padding:"10px 12px" }}>
                          <div style={{ fontWeight:600, color:"#0f172a" }}>{proj?.name||r.projectId}</div>
                          {r.site && <div style={{ fontSize:11, color:"#64748b" }}>📍 {r.site}</div>}
                        </td>
                        <td style={{ padding:"10px 12px", maxWidth:160,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#0f172a" }}>
                          {r.caseTitle||"-"}
                        </td>
                        <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>
                          <span style={{ background:"#f1f5f9", color:"#475569", borderRadius:6,
                            padding:"2px 8px", fontSize:11, fontWeight:600 }}>{r.scope||"-"}</span>
                        </td>
                        <td style={{ padding:"10px 12px", color:"#475569" }}>
                          {(r.techs||[]).join(", ")}
                        </td>
                        <td style={{ padding:"10px 12px", textAlign:"right", whiteSpace:"nowrap", color:"#475569" }}>
                          {(r.travelCost||0).toLocaleString()}
                        </td>
                        <td style={{ padding:"10px 12px", textAlign:"right", whiteSpace:"nowrap", color:"#16a34a", fontWeight:600 }}>
                          {(r.laborCost||0).toLocaleString()}
                        </td>
                        <td style={{ padding:"10px 12px", textAlign:"right", whiteSpace:"nowrap",
                          color:"#f97316", fontWeight:700, fontSize:13 }}>
                          {(r.totalCost||0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#fff7ed", borderTop:"2px solid #fed7aa" }}>
                    <td colSpan={6} style={{ padding:"10px 12px", fontWeight:700, color:"#7c2d12", fontSize:12 }}>
                      รวม {filtered.length} รายการ
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:700, color:"#475569" }}>
                      {totalTravel.toLocaleString()}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:700, color:"#16a34a" }}>
                      {totalLabor.toLocaleString()}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:800, color:"#f97316", fontSize:14 }}>
                      {totalAll.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
