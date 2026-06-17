import { useState } from "react";
import * as XLSX from "xlsx";
import OnsiteModal from "./OnsiteModal.jsx";

const SCOPE_LABEL = {
  Maintenance:"บำรุงรักษา", Installation:"ติดตั้ง",
  Inspection:"ตรวจสอบ", Troubleshooting:"แก้ไขปัญหา", Other:"อื่นๆ",
};

const STATUS_STYLE = {
  pending:  { bg:"#fef9c3", color:"#854d0e", label:"รออนุมัติ" },
  approved: { bg:"#f0fdf4", color:"#15803d", label:"อนุมัติแล้ว" },
  rejected: { bg:"#fff1f2", color:"#be123c", label:"ไม่อนุมัติ" },
};

export default function OnsitePage({ onBack, projects, users, currentUser, onsiteRecords, onSaveOnsite, onApproveOnsite, onDeleteOnsite, saving }) {

  const [tab, setTab] = useState("list");   // list | report | export
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const [filterProj, setFilterProj]   = useState("all");
  const [filterTech, setFilterTech]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");

  const isAdmin = currentUser?.role === "admin";

  // คำนวณ laborCost ใหม่จาก onsiteRate ปัจจุบัน
  const records = (onsiteRecords || []).map(r => {
    const laborCost = (r.techs||[]).reduce((sum, name) => {
      const u = (users || []).find(u => u.name === name);
      return sum + (u?.onsiteRate || 0);
    }, 0);
    return { ...r, laborCost, totalCost: (r.travelCost||0)+(r.shippingCost||0)+(r.partsCost||0)+laborCost };
  });

  const filtered = records.filter(r => {
    if (filterProj !== "all" && r.projectId !== filterProj) return false;
    if (filterTech !== "all" && !(r.techs||[]).includes(filterTech)) return false;
    if (filterStatus !== "all" && (r.status||"pending") !== filterStatus) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  }).sort((a,b) => (b.date||"").localeCompare(a.date||""));

  const pendingCount = records.filter(r => (r.status||"pending") === "pending").length;

  // รายงานนับเฉพาะ approved
  const approvedRecords = filtered.filter(r => r.status === "approved");
  const totalLabor  = approvedRecords.reduce((s,r) => s + (r.laborCost||0), 0);
  const totalTravel = approvedRecords.reduce((s,r) => s + (r.travelCost||0), 0);
  const totalAll    = approvedRecords.reduce((s,r) => s + (r.totalCost||0), 0);

  const techNames = [...new Set(records.flatMap(r => r.techs||[]))].sort();

  // สรุปรายคน (เฉพาะ approved)
  const perPerson = {};
  approvedRecords.forEach(r => {
    (r.techs||[]).forEach(name => {
      if (!perPerson[name]) perPerson[name] = { count:0, labor:0 };
      const u = (users||[]).find(u => u.name === name);
      perPerson[name].count += 1;
      perPerson[name].labor += (u?.onsiteRate || 0);
    });
  });

  // สรุปรายโครงการ (เฉพาะ approved)
  const perProject = {};
  approvedRecords.forEach(r => {
    const key = r.projectId || "unknown";
    if (!perProject[key]) perProject[key] = { count:0, total:0, name:r.projectName||"" };
    perProject[key].count += 1;
    perProject[key].total += (r.totalCost||0);
  });

  async function handleSave(data, recordId) {
    await onSaveOnsite(data, recordId);
    setShowModal(false);
    setEditRecord(null);
  }

  function openEdit(r) {
    setEditRecord(r);
    setShowModal(true);
  }

  function exportExcel() {
    const rows = approvedRecords.map((r,i) => {
      const proj = projects.find(p => p.id === r.projectId);
      return {
        "ลำดับ": i+1,
        "วันที่": r.date||"",
        "โครงการ": proj?.name||r.projectName||r.projectId||"",
        "ไซต์งาน": r.site||"",
        "ขอบเขต": SCOPE_LABEL[r.scope]||r.scope||"",
        "รายละเอียด": r.detail||"",
        "พนักงาน": (r.techs||[]).join(", "),
        "ระยะทาง(กม.)": r.km||0,
        "ค่าเดินทาง": r.travelCost||0,
        "ค่าขนส่ง": r.shippingCost||0,
        "ค่าอุปกรณ์": r.partsCost||0,
        "ค่าแรง": r.laborCost||0,
        "รวม": r.totalCost||0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [5,12,18,14,12,24,20,10,12,10,10,10,12].map(w=>({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onsite");
    const now = new Date();
    const projName = filterProj!=="all" ? (projects.find(p=>p.id===filterProj)?.name||"") : "ทั้งหมด";
    XLSX.writeFile(wb, `Onsite_${projName}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}.xlsx`);
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
        <div style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>📍 Onsite</div>
        {isAdmin && pendingCount > 0 && (
          <span style={{ background:"#fef9c3", color:"#854d0e", borderRadius:20,
            padding:"3px 10px", fontSize:12, fontWeight:700 }}>
            {pendingCount} รออนุมัติ
          </span>
        )}
        <button onClick={() => { setEditRecord(null); setShowModal(true); }}
          style={{ marginLeft:"auto", background:"#f97316", border:"none", color:"#fff",
            borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          + บันทึก Onsite
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 20px",
        display:"flex", gap:4, position:"sticky", top:57, zIndex:9 }}>
        {[
          { key:"list",   label:"📋 รายการ" },
          { key:"report", label:"📊 รายงาน" },
          { key:"export", label:"📥 Export" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t.key?"#f97316":"transparent"}`,
              color: tab===t.key?"#f97316":"#94a3b8", padding:"12px 16px", fontSize:13,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"16px 20px 48px", maxWidth:1100, margin:"0 auto" }}>

        {/* Filters (list + report) */}
        {tab !== "export" && (
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
            {tab === "list" && (
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={inputStyle}>
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รออนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ไม่อนุมัติ</option>
              </select>
            )}
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputStyle}/>
            <span style={{ fontSize:12, color:"#94a3b8" }}>ถึง</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputStyle}/>
            {(filterProj!=="all"||filterTech!=="all"||filterStatus!=="all"||dateFrom||dateTo) && (
              <button onClick={()=>{ setFilterProj("all"); setFilterTech("all"); setFilterStatus("all"); setDateFrom(""); setDateTo(""); }}
                style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444",
                  borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                ล้าง
              </button>
            )}
            <span style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto" }}>{filtered.length} รายการ</span>
          </div>
        )}

        {/* ─── TAB: LIST ─── */}
        {tab === "list" && (
          filtered.length === 0 ? (
            <div style={{ textAlign:"center", color:"#cbd5e1", padding:48, fontSize:14 }}>ยังไม่มีข้อมูล Onsite</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(r => {
                const proj = projects.find(p => p.id === r.projectId);
                const st = STATUS_STYLE[r.status||"pending"];
                const canEdit = isAdmin || r.createdBy === currentUser?.name;
                return (
                  <div key={r.id} style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0",
                    padding:"14px 16px", borderLeft:`4px solid ${st.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>{proj?.name||r.projectName||r.projectId}</span>
                          <span style={{ background:st.bg, color:st.color, borderRadius:20,
                            padding:"2px 10px", fontSize:11, fontWeight:700 }}>{st.label}</span>
                        </div>
                        <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>
                          {r.site && `📍 ${r.site} · `}{r.date} · {SCOPE_LABEL[r.scope]||r.scope}
                        </div>
                        <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>
                          👤 {(r.techs||[]).join(", ")}
                        </div>
                        {r.detail && <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>{r.detail}</div>}
                        {r.status === "approved" && r.approvedBy && (
                          <div style={{ fontSize:11, color:"#16a34a", marginTop:4 }}>
                            ✅ อนุมัติโดย {r.approvedBy}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:"right", marginLeft:12, flexShrink:0 }}>
                        <div style={{ fontSize:18, fontWeight:800, color:"#f97316" }}>{(r.totalCost||0).toLocaleString()}</div>
                        <div style={{ fontSize:10, color:"#94a3b8" }}>บาท</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingTop:8, borderTop:"1px solid #f1f5f9" }}>
                      {isAdmin && (r.status||"pending") === "pending" && (
                        <>
                          <button onClick={() => onApproveOnsite(r.id, "approved")}
                            style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#15803d",
                              borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                            ✅ อนุมัติ
                          </button>
                          <button onClick={() => onApproveOnsite(r.id, "rejected")}
                            style={{ background:"#fff1f2", border:"1px solid #fecdd3", color:"#be123c",
                              borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                            ❌ ไม่อนุมัติ
                          </button>
                        </>
                      )}
                      {isAdmin && r.status === "approved" && (
                        <button onClick={() => onApproveOnsite(r.id, "pending")}
                          style={{ background:"#fffbeb", border:"1px solid #fde68a", color:"#92400e",
                            borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                          ↩ คืนเป็นรออนุมัติ
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openEdit(r)}
                          style={{ background:"#eff6ff", border:"1px solid #bfdbfe", color:"#2563eb",
                            borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                          ✏️ แก้ไข
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => onDeleteOnsite(r.id)}
                          style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444",
                            borderRadius:7, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                          🗑 ลบ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ─── TAB: REPORT ─── */}
        {tab === "report" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
              {[
                { label:"ครั้ง Onsite (อนุมัติ)", val:approvedRecords.length, color:"#2563eb", unit:"ครั้ง" },
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

            {/* สรุปรายคน */}
            <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:12 }}>👤 สรุปรายคน</div>
              {Object.keys(perPerson).length === 0 ? (
                <div style={{ fontSize:13, color:"#cbd5e1" }}>ยังไม่มีข้อมูล</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {Object.entries(perPerson).sort((a,b)=>b[1].labor-a[1].labor).map(([name,d]) => (
                    <div key={name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"10px 12px", background:"#f8fafc", borderRadius:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:32, height:32, borderRadius:"50%",
                          background:`hsl(${name.charCodeAt(0)*7%360},60%,70%)`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:13, fontWeight:700, color:"#fff" }}>{name.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{name}</div>
                          <div style={{ fontSize:11, color:"#94a3b8" }}>{d.count} ครั้ง</div>
                        </div>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:"#16a34a" }}>{d.labor.toLocaleString()} บาท</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* สรุปรายโครงการ */}
            <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:12 }}>◆ สรุปรายโครงการ</div>
              {Object.keys(perProject).length === 0 ? (
                <div style={{ fontSize:13, color:"#cbd5e1" }}>ยังไม่มีข้อมูล</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {Object.entries(perProject).sort((a,b)=>b[1].total-a[1].total).map(([pid,d]) => {
                    const proj = projects.find(p => p.id === pid);
                    return (
                      <div key={pid} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"10px 12px", background:"#f8fafc", borderRadius:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ width:10, height:10, borderRadius:"50%", background:proj?.color||"#94a3b8" }}/>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{proj?.name||d.name||pid}</div>
                            <div style={{ fontSize:11, color:"#94a3b8" }}>{d.count} ครั้ง</div>
                          </div>
                        </div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#f97316" }}>{d.total.toLocaleString()} บาท</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB: EXPORT ─── */}
        {tab === "export" && (
          <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"20px" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", marginBottom:8 }}>📥 Export Excel</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>
              เลือกโครงการและช่วงเวลาที่ต้องการ แล้วดาวน์โหลดเป็นไฟล์ Excel (เฉพาะรายการที่อนุมัติแล้ว)
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"center", marginBottom:16 }}>
              <select value={filterProj} onChange={e=>setFilterProj(e.target.value)} style={inputStyle}>
                <option value="all">ทุกโครงการ</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inputStyle}/>
              <span style={{ fontSize:12, color:"#94a3b8" }}>ถึง</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inputStyle}/>
            </div>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:"12px 14px", marginBottom:16 }}>
              <div style={{ fontSize:12, color:"#64748b" }}>จะ export ทั้งหมด <b style={{ color:"#f97316" }}>{approvedRecords.length}</b> รายการ
                · รวม <b style={{ color:"#f97316" }}>{totalAll.toLocaleString()}</b> บาท</div>
            </div>
            <button onClick={exportExcel} disabled={approvedRecords.length===0}
              style={{ background:"#16a34a", border:"none", color:"#fff", borderRadius:10,
                padding:"12px 24px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                opacity: approvedRecords.length===0?0.5:1 }}>
              📥 ดาวน์โหลด Excel
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <OnsiteModal onClose={() => { setShowModal(false); setEditRecord(null); }}
          onSave={handleSave} saving={saving}
          projects={projects} users={users} currentUser={currentUser}
          editRecord={editRecord}/>
      )}
    </div>
  );
}
