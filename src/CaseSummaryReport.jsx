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

  const { from, to, label } = getRange(mode, customFrom, customTo);

  // filter เคสในช่วงเวลา
  const filtered = cases.filter(c => {
    if (!c.date) return false;
    if (from && c.date < from) return false;
    if (to   && c.date > to)   return false;
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date));

  const newCases  = filtered;
  const doneCases = filtered.filter(c => c.status === "done");
  const holdCases = filtered.filter(c => c.status === "hold");
  const pendingCases = filtered.filter(c => c.status !== "done");

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
          <div style={{ fontSize:13,color:"#64748b" }}>วันที่พิมพ์: {fmtDate(new Date().toISOString().slice(0,10))}</div>
        </div>

        {/* สรุปตัวเลข */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24 }}>
          {[
            { label:"เคสทั้งหมด",    val:newCases.length,   color:"#2563eb" },
            { label:"เสร็จสิ้น",     val:doneCases.length,  color:"#10b981" },
            { label:"ยังไม่เสร็จ",   val:pendingCases.length,color:"#f59e0b" },
            { label:"ติดปัญหา/รอ",  val:holdCases.length,  color:"#ef4444" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#fff",border:`1.5px solid ${s.color}30`,
              borderRadius:12,padding:"14px 16px",borderTop:`3px solid ${s.color}` }}>
              <div style={{ fontSize:28,fontWeight:800,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:11,color:"#94a3b8",marginTop:4,fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>

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

        {/* เคสที่เสร็จแล้ว */}
        <ReportSection title="✅ เคสที่เสร็จสิ้นแล้ว" count={doneCases.length}>
          {doneCases.length===0 ? <Empty text="ไม่มีเคสที่เสร็จในช่วงนี้"/> : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {doneCases.map(c=>{
                const proj = projects.find(p=>p.id===c.projectId);
                const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : ["-"]);
                return (
                  <div key={c.id} style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",
                    borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>{c.title}</div>
                      <div style={{ fontSize:11,color:"#64748b",marginTop:2 }}>
                        {proj && <span style={{ color:proj.color,fontWeight:600 }}>◆ {proj.name} </span>}
                        · {techs.join(", ")} · {fmtDate(c.date)}
                      </div>
                      {c.note && <div style={{ fontSize:11,color:"#16a34a",marginTop:4,lineHeight:1.5 }}>📝 {c.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ReportSection>

        {/* เคสที่ติดปัญหา */}
        <ReportSection title="⚠️ เคสที่ติดปัญหา / รอดำเนินการ" count={holdCases.length}>
          {holdCases.length===0 ? <Empty text="ไม่มีเคสติดปัญหาในช่วงนี้ 🎉"/> : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {holdCases.map(c=>{
                const proj = projects.find(p=>p.id===c.projectId);
                const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : ["-"]);
                return (
                  <div key={c.id} style={{ background:"#fff5f5",border:"1px solid #fecaca",
                    borderRadius:10,padding:"10px 14px" }}>
                    <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>{c.title}</div>
                    <div style={{ fontSize:11,color:"#64748b",marginTop:2 }}>
                      {proj && <span style={{ color:proj.color,fontWeight:600 }}>◆ {proj.name} </span>}
                      · {techs.join(", ")} · {fmtDate(c.date)}
                    </div>
                    {c.note && <div style={{ fontSize:11,color:"#ef4444",marginTop:4,lineHeight:1.5 }}>📝 {c.note}</div>}
                  </div>
                );
              })}
            </div>
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
