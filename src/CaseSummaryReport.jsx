import { useState } from "react";
import { fmtDate } from "./utils.js";

const STATUS_LABEL = {
  open:       { label:"เปิดเคส",        color:"#f59e0b" },
  inprogress: { label:"กำลังดำเนินการ", color:"#3b82f6" },
  done:       { label:"เสร็จสิ้น",      color:"#10b981" },
  hold:       { label:"รอดำเนินการ",    color:"#ef4444" },
};

function getRange(mode, customFrom, customTo) {
  const now = new Date();
  if (mode === "today") {
    const d = now.toISOString().slice(0,10);
    return { from: d, to: d, label: `วันที่ ${fmtDate(d)}` };
  }
  if (mode === "week") {
    const to = now.toISOString().slice(0,10);
    const f = new Date(now); f.setDate(f.getDate()-6);
    const from = f.toISOString().slice(0,10);
    return { from, to, label: `${fmtDate(from)} – ${fmtDate(to)}` };
  }
  if (mode === "month") {
    const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,"0");
    const from = `${y}-${m}-01`;
    const to = now.toISOString().slice(0,10);
    return { from, to, label: `เดือน ${m}/${y}` };
  }
  if (mode === "custom") {
    return { from: customFrom, to: customTo, label: customFrom && customTo ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}` : "กำหนดเอง" };
  }
  return { from: "", to: "", label: "" };
}

export default function CaseSummaryReport({ onBack, cases, projects }) {
  const [mode, setMode] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedProj, setSelectedProj] = useState("all");

  const { from, to, label } = getRange(mode, customFrom, customTo);

  // filter เคสในช่วงเวลา + โครงการ
  const filtered = cases.filter(c => {
    if (!c.date) return false;
    if (from && c.date < from) return false;
    if (to   && c.date > to)   return false;
    if (selectedProj !== "all" && c.projectId !== selectedProj) return false;
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date));

  const newCases     = filtered;
  const doneCases    = filtered.filter(c => c.status === "done");
  const holdCases    = filtered.filter(c => c.status === "hold");
  const pendingCases = filtered.filter(c => c.status !== "done");

  // (KPI section removed — not shown in report)

  // สถิติต่อโครงการ (เฉพาะที่มีเคส)
  const projPool = selectedProj==="all" ? projects : projects.filter(p=>p.id===selectedProj);
  const projStats = projPool.map(p=>{
    const pc = cases.filter(c=>c.projectId===p.id);
    return { ...p, total:pc.length,
      open:pc.filter(c=>c.status==="open").length,
      inprogress:pc.filter(c=>c.status==="inprogress").length,
      done:pc.filter(c=>c.status==="done").length,
      hold:pc.filter(c=>c.status==="hold").length };
  }).filter(p=>p.total>0);

  function printReport() {
    window.print();
  }

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        @media print {
          .no-print { display:none !important; }
          body { background:#fff !important; }
          .print-page { padding:20px !important; background:#fff !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      {/* Header — ซ่อนตอน print */}
      <div className="no-print" style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",
        padding:"14px 20px",display:"flex",alignItems:"center",gap:12,
        position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>📄 รายงานสรุปเคส</div>
        <button onClick={printReport}
          style={{ marginLeft:"auto",background:"#2563eb",border:"none",color:"#fff",
            borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
          🖨 พิมพ์ / Export PDF
        </button>
      </div>

      {/* Filter — ซ่อนตอน print */}
      <div className="no-print" style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 20px" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600 }}>ช่วงเวลา:</span>
          {[
            { v:"today", l:"วันนี้" },
            { v:"week",  l:"7 วันล่าสุด" },
            { v:"month", l:"เดือนนี้" },
            { v:"custom",l:"กำหนดเอง" },
          ].map(b=>(
            <button key={b.v} onClick={()=>setMode(b.v)}
              style={{ background:mode===b.v?"#2563eb":"#f1f5f9",
                border:`1.5px solid ${mode===b.v?"#2563eb":"#e2e8f0"}`,
                color:mode===b.v?"#fff":"#475569",borderRadius:8,
                padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              {b.l}
            </button>
          ))}
          <select value={selectedProj} onChange={e=>setSelectedProj(e.target.value)}
            style={{ border:"1.5px solid #e2e8f0",borderRadius:8,padding:"6px 12px",
              fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer",
              color:"#475569",fontWeight:600,background:"#fff" }}>
            <option value="all">ทุกโครงการ</option>
            {projects.map(p=>(
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {mode==="custom" && (
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                style={{ border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}/>
              <span style={{ fontSize:12,color:"#94a3b8" }}>ถึง</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
                style={{ border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}/>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="print-page" style={{ padding:"24px 20px 48px",maxWidth:1200,margin:"0 auto" }}>

        {/* หัวรายงาน */}
        <div style={{ marginBottom:24,paddingBottom:16,borderBottom:"2px solid #e2e8f0" }}>
          <div style={{ fontSize:20,fontWeight:800,color:"#0f172a",marginBottom:4 }}>
            รายงานสรุปเคส — บริษัท เมทเธียร์ จำกัด
          </div>
          <div style={{ fontSize:13,color:"#64748b" }}>ช่วงเวลา: {label}</div>
          {selectedProj!=="all" && (
            <div style={{ fontSize:13,color:"#64748b" }}>
              โครงการ: {projects.find(p=>p.id===selectedProj)?.name||""}
            </div>
          )}
          <div style={{ fontSize:13,color:"#64748b" }}>วันที่พิมพ์: {fmtDate(new Date().toISOString().slice(0,10))}</div>
        </div>

        {/* สรุปตัวเลข 4 ช่อง */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14 }}>
          {[
            { label:"เคสทั้งหมด",   val:newCases.length,    color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe", top:"#3b82f6" },
            { label:"เสร็จสิ้น",    val:doneCases.length,   color:"#065f46", bg:"#f0fdf4", border:"#bbf7d0", top:"#10b981" },
            { label:"ยังไม่เสร็จ",  val:pendingCases.length,color:"#92400e", bg:"#fffbeb", border:"#fde68a", top:"#f59e0b" },
            { label:"ติดปัญหา/รอ", val:holdCases.length,   color:"#991b1b", bg:"#fff5f5", border:"#fecaca", top:"#ef4444" },
          ].map(s=>(
            <div key={s.label} style={{ background:s.bg,border:`0.5px solid ${s.border}`,
              borderRadius:8,padding:"8px 10px",borderTop:`2px solid ${s.top}` }}>
              <div style={{ fontSize:18,fontWeight:500,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:10,marginTop:3,fontWeight:500,color:s.color,opacity:.7 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* สถิติต่อโครงการ — compact table */}
        {projStats.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:8,
              paddingBottom:6,borderBottom:"1px solid #e2e8f0" }}>◆ สถิติต่อโครงการ</div>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["โครงการ","ทั้งหมด","เปิดเคส","กำลังทำ","เสร็จ","รอ"].map((h,i)=>(
                    <th key={h} style={{ padding:"6px 10px",textAlign:i===0?"left":"center",
                      fontSize:10,color:"#94a3b8",fontWeight:700,
                      borderBottom:"1px solid #e2e8f0",letterSpacing:.3 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projStats.map((p,i)=>(
                  <tr key={p.id} style={{ background:i%2===0?"#fff":"#f8fafc" }}>
                    <td style={{ padding:"6px 10px",borderBottom:"1px solid #f1f5f9" }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}>
                        <span style={{ width:8,height:8,borderRadius:2,background:p.color,display:"inline-block",flexShrink:0 }}/>
                        <span style={{ fontWeight:600,color:"#0f172a" }}>{p.name}</span>
                      </span>
                    </td>
                    {[
                      {v:p.total,c:"#64748b"},
                      {v:p.open,c:"#f59e0b"},
                      {v:p.inprogress,c:"#3b82f6"},
                      {v:p.done,c:"#10b981"},
                      {v:p.hold,c:"#ef4444"},
                    ].map((x,j)=>(
                      <td key={j} style={{ padding:"6px 10px",textAlign:"center",
                        borderBottom:"1px solid #f1f5f9",
                        fontWeight:700,color:x.c,fontSize:13 }}>{x.v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* เคสที่เข้ามาในช่วงนี้ */}
        <ReportSection title="📋 เคสทั้งหมดในช่วงนี้" count={newCases.length}>
          {newCases.length===0 ? <Empty/> : (
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["วันที่","ชื่องาน","โครงการ","ผู้ดำเนินการ","สถานะ"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px",textAlign:"left",fontSize:11,
                      color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0",
                      textTransform:"uppercase",letterSpacing:0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newCases.map((c,i)=>{
                  const proj = projects.find(p=>p.id===c.projectId);
                  const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : ["-"]);
                  const s = STATUS_LABEL[c.status]||STATUS_LABEL.open;
                  return (
                    <tr key={c.id} style={{ background:i%2===0?"#fff":"#f8fafc" }}>
                      <td style={{ padding:"8px 12px",borderBottom:"1px solid #f1f5f9",
                        color:"#64748b",whiteSpace:"nowrap" }}>{fmtDate(c.date)}</td>
                      <td style={{ padding:"8px 12px",borderBottom:"1px solid #f1f5f9",
                        color:"#0f172a",fontWeight:500 }}>{c.title}</td>
                      <td style={{ padding:"8px 12px",borderBottom:"1px solid #f1f5f9" }}>
                        {proj && <span style={{ color:proj.color,fontWeight:600,fontSize:12 }}>◆ {proj.name}</span>}
                      </td>
                      <td style={{ padding:"8px 12px",borderBottom:"1px solid #f1f5f9",
                        color:"#475569" }}>{techs.join(", ")}</td>
                      <td style={{ padding:"8px 12px",borderBottom:"1px solid #f1f5f9" }}>
                        <span style={{ background:s.color+"15",color:s.color,borderRadius:20,
                          padding:"2px 8px",fontSize:11,fontWeight:600 }}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ReportSection>



      </div>
    </div>
  );
}

function ReportSection({ title, count, children }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12,
        paddingBottom:8,borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{title}</div>
        <span style={{ background:"#f1f5f9",color:"#64748b",borderRadius:20,
          padding:"1px 8px",fontSize:11,fontWeight:700 }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text="ไม่มีข้อมูลในช่วงนี้" }) {
  return (
    <div style={{ textAlign:"center",color:"#cbd5e1",padding:"20px 0",fontSize:13 }}>{text}</div>
  );
}
