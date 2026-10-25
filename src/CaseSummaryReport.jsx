import { useState } from "react";
import { fmtDate, today, addDays } from "./utils.js";
import { useTheme, THEMES } from "./theme.js";

const tint = (hex, alpha = "22") => `${hex}${alpha}`;

const STATUS_LABEL = {
  open:       { label:"เปิดเคส",        colorKey:"amber" },
  inprogress: { label:"กำลังดำเนินการ", colorKey:"blue" },
  done:       { label:"เสร็จสิ้น",      colorKey:"green" },
  hold:       { label:"รอดำเนินการ",    colorKey:"red" },
};

function getRange(mode, customFrom, customTo) {
  const now = new Date();
  if (mode === "today") {
    const d = today();
    return { from: d, to: d, label: `วันที่ ${fmtDate(d)}` };
  }
  if (mode === "week") {
    const to = today();
    const from = addDays(to, -6);
    return { from, to, label: `${fmtDate(from)} – ${fmtDate(to)}` };
  }
  if (mode === "month") {
    const to = today();
    const from = `${to.slice(0,7)}-01`;
    return { from, to, label: `เดือน ${m}/${y}` };
  }
  if (mode === "year") {
    const to = today();
    const from = `${to.slice(0,4)}-01-01`;
    return { from, to, label: `ปี ${y+543}` };
  }
  if (mode === "custom") {
    return { from: customFrom, to: customTo, label: customFrom && customTo ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}` : "กำหนดเอง" };
  }
  return { from: "", to: "", label: "" };
}

export default function CaseSummaryReport({ onBack, cases, projects }) {
  const { c: liveC } = useTheme();
  const [forcePrint, setForcePrint] = useState(false);
  // ตอน print: บังคับใช้ light theme ชั่วคราว ไม่ว่าแอปจะอยู่ dark mode หรือไม่
  const c = forcePrint ? THEMES.light : liveC;

  const [mode, setMode] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedProj, setSelectedProj] = useState("all");

  const { from, to, label } = getRange(mode, customFrom, customTo);

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

  const projPool = selectedProj==="all" ? projects : projects.filter(p=>p.id===selectedProj);
  const projStats = projPool.map(p=>{
    const pc = filtered.filter(cs=>cs.projectId===p.id);
    return { ...p, total:pc.length,
      open:pc.filter(cs=>cs.status==="open").length,
      inprogress:pc.filter(cs=>cs.status==="inprogress").length,
      done:pc.filter(cs=>cs.status==="done").length,
      hold:pc.filter(cs=>cs.status==="hold").length };
  }).filter(p=>p.total>0);

  function printReport() {
    setForcePrint(true);
    // รอให้ React re-render เป็น light theme ก่อนเรียก print
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const style = document.createElement("style");
        style.innerHTML = `@media print { body { zoom: 0.75; } }`;
        document.head.appendChild(style);
        window.print();
        document.head.removeChild(style);
        setForcePrint(false); // กลับเป็น theme ที่ผู้ใช้เลือกไว้
      });
    });
  }

  return (
    <div className="print-outer" style={{ minHeight:"100vh",background:c.bg,fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        @media print {
          .no-print { display:none !important; }
          body { background:#fff !important; margin:0 !important; }
          .print-outer { min-height:unset !important; height:auto !important; background:#fff !important; }
          .print-page { padding:10px 14px 0 !important; background:#fff !important; max-width:100% !important; }
          .print-break { page-break-before: always; }
          @page { size: A4; margin: 10mm 12mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Header — ซ่อนตอน print */}
      <div className="no-print" style={{ background:c.card,borderBottom:`1px solid ${c.border}`,
        padding:"14px 20px",display:"flex",alignItems:"center",gap:12,
        position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:c.borderSoft,border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:c.text500,fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:c.text900 }}>📄 รายงานสรุปเคส</div>
        <button onClick={printReport}
          style={{ marginLeft:"auto",background:c.blue,border:"none",color:"#fff",
            borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
          🖨 พิมพ์ / Export PDF
        </button>
      </div>

      {/* Filter — ซ่อนตอน print */}
      <div className="no-print" style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:"12px 20px" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <span style={{ fontSize:12,color:c.text400,fontWeight:600 }}>ช่วงเวลา:</span>
          {[
            { v:"today", l:"วันนี้" },
            { v:"week",  l:"7 วันล่าสุด" },
            { v:"month", l:"เดือนนี้" },
            { v:"year",  l:"ปีนี้" },
            { v:"custom",l:"กำหนดเอง" },
          ].map(b=>(
            <button key={b.v} onClick={()=>setMode(b.v)}
              style={{ background:mode===b.v?c.blue:c.borderSoft,
                border:`1.5px solid ${mode===b.v?c.blue:c.border}`,
                color:mode===b.v?"#fff":c.text500,borderRadius:8,
                padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              {b.l}
            </button>
          ))}
          <select value={selectedProj} onChange={e=>setSelectedProj(e.target.value)}
            style={{ border:`1.5px solid ${c.border}`,borderRadius:8,padding:"6px 12px",
              fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer",
              color:c.text500,fontWeight:600,background:c.card }}>
            <option value="all">ทุกโครงการ</option>
            {projects.map(p=>(
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {mode==="custom" && (
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                style={{ border:`1px solid ${c.border}`,borderRadius:8,padding:"6px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",background:c.card,color:c.text900 }}/>
              <span style={{ fontSize:12,color:c.text400 }}>ถึง</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}
                style={{ border:`1px solid ${c.border}`,borderRadius:8,padding:"6px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",background:c.card,color:c.text900 }}/>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="print-page" style={{ padding:"24px 20px 16px",maxWidth:1200,margin:"0 auto" }}>

        {/* หัวรายงาน */}
        <div style={{ marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${c.border}` }}>
          <div style={{ fontSize:20,fontWeight:800,color:c.text900,marginBottom:4 }}>
            รายงานสรุปเคส — บริษัท เมทเธียร์ จำกัด
          </div>
          <div style={{ fontSize:13,color:c.text500 }}>ช่วงเวลา: {label}</div>
          {selectedProj!=="all" && (
            <div style={{ fontSize:13,color:c.text500 }}>
              โครงการ: {projects.find(p=>p.id===selectedProj)?.name||""}
            </div>
          )}
          <div style={{ fontSize:13,color:c.text500 }}>วันที่พิมพ์: {fmtDate(today())}</div>
        </div>

        {/* สรุปตัวเลข 4 ช่อง */}
        <div className="summary-cards" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14 }}>
          {[
            { label:"เคสทั้งหมด",   val:newCases.length,    color:c.blue },
            { label:"เสร็จสิ้น",    val:doneCases.length,   color:c.green },
            { label:"ยังไม่เสร็จ",  val:pendingCases.length,color:c.amber },
            { label:"ติดปัญหา/รอ", val:holdCases.length,   color:c.red },
          ].map(s=>(
            <div key={s.label} style={{ background:tint(s.color,"14"),border:`0.5px solid ${tint(s.color,"55")}`,
              borderRadius:8,padding:"8px 10px",borderTop:`2px solid ${s.color}` }}>
              <div style={{ fontSize:18,fontWeight:500,color:s.color,lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:10,marginTop:3,fontWeight:500,color:s.color,opacity:.85 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* สถิติต่อโครงการ — compact table */}
        {projStats.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:8,
              paddingBottom:6,borderBottom:`1px solid ${c.border}` }}>◆ สถิติต่อโครงการ</div>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead>
                <tr style={{ background:c.borderSoft }}>
                  {["โครงการ","ทั้งหมด","เปิดเคส","กำลังทำ","เสร็จ","รอ"].map((h,i)=>(
                    <th key={h} style={{ padding:"6px 10px",textAlign:i===0?"left":"center",
                      fontSize:10,color:c.text400,fontWeight:700,
                      borderBottom:`1px solid ${c.border}`,letterSpacing:.3 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projStats.map((p,i)=>(
                  <tr key={p.id} style={{ background:i%2===0?c.card:c.borderSoft }}>
                    <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}` }}>
                      <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}>
                        <span style={{ width:8,height:8,borderRadius:2,background:p.color,display:"inline-block",flexShrink:0 }}/>
                        <span style={{ fontWeight:600,color:c.text900 }}>{p.name}</span>
                      </span>
                    </td>
                    {[
                      {v:p.total,col:c.text500},
                      {v:p.open,col:c.amber},
                      {v:p.inprogress,col:c.blue},
                      {v:p.done,col:c.green},
                      {v:p.hold,col:c.red},
                    ].map((x,j)=>(
                      <td key={j} style={{ padding:"6px 10px",textAlign:"center",
                        borderBottom:`1px solid ${c.borderSoft}`,
                        fontWeight:700,color:x.col,fontSize:13 }}>{x.v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* สรุปรายทีม */}
        {(() => {
          const allNames = [...new Set(filtered.flatMap(cs => cs.techs?.length ? cs.techs : cs.tech ? [cs.tech] : []))].filter(Boolean);
          if (allNames.length === 0) return null;
          const teamStats = allNames.map(name => {
            const tc = filtered.filter(cs => (cs.techs?.length ? cs.techs : cs.tech ? [cs.tech] : []).includes(name));
            return { name, total:tc.length, done:tc.filter(cs=>cs.status==="done").length, hold:tc.filter(cs=>cs.status==="hold").length, pending:tc.filter(cs=>cs.status!=="done").length };
          }).sort((a,b)=>b.total-a.total);
          return (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${c.border}` }}>👤 สรุปรายทีม</div>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                <thead>
                  <tr style={{ background:c.borderSoft }}>
                    {["ชื่อ","เคสทั้งหมด","เสร็จแล้ว","อัตราปิดงาน","ค้างอยู่"].map((h,i)=>(
                      <th key={h} style={{ padding:"6px 10px",textAlign:i===0?"left":"center",fontSize:10,color:c.text400,fontWeight:700,borderBottom:`1px solid ${c.border}`,letterSpacing:.3 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((t,i)=>(
                    <tr key={t.name} style={{ background:i%2===0?c.card:c.borderSoft }}>
                      <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}`,fontWeight:600,color:c.text900 }}>{t.name}</td>
                      <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}`,textAlign:"center",fontWeight:700,color:c.text500 }}>{t.total}</td>
                      <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}`,textAlign:"center",fontWeight:700,color:c.green }}>{t.done}</td>
                      <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}`,textAlign:"center" }}>
                        <span style={{ background:tint(c.green,"14"),color:c.green,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700 }}>
                          {t.total>0?Math.round(t.done/t.total*100):0}%
                        </span>
                      </td>
                      <td style={{ padding:"6px 10px",borderBottom:`1px solid ${c.borderSoft}`,textAlign:"center",fontWeight:700,color:t.pending>0?c.red:c.text400 }}>{t.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* กราฟเคสรายเดือน */}
        {(() => {
          const months = [];
          for (let m=1; m<=12; m++) {
            const mk = `${new Date().getFullYear()}-${String(m).padStart(2,"0")}`;
            const count = filtered.filter(cs=>cs.date&&cs.date.startsWith(mk)).length;
            months.push({ m, label:`${m}`, count });
          }
          const max = Math.max(...months.map(m=>m.count), 1);
          if (months.every(m=>m.count===0)) return null;
          const MONTH_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
          return (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:12,paddingBottom:6,borderBottom:`1px solid ${c.border}` }}>📊 เคสรายเดือน</div>
              <div style={{ display:"flex",alignItems:"flex-end",gap:4,height:100,padding:"0 4px" }}>
                {months.map(m=>(
                  <div key={m.m} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                    {m.count>0 && <span style={{ fontSize:9,fontWeight:700,color:c.blue }}>{m.count}</span>}
                    <div style={{ width:"100%",background:m.count>0?c.blue:c.border,borderRadius:"3px 3px 0 0",
                      height:`${Math.round((m.count/max)*80)+4}px`,minHeight:4,transition:"height .2s" }}/>
                    <span style={{ fontSize:8,color:c.text400,fontWeight:500 }}>{MONTH_SHORT[m.m-1]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ประเภทงานที่เยอะสุด */}
        {(() => {
          const typeMap = {};
          filtered.forEach(cs=>{ if(cs.type){ typeMap[cs.type]=(typeMap[cs.type]||0)+1; } });
          const types = Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
          if (types.length===0) return null;
          const maxT = types[0][1];
          return (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${c.border}` }}>🔧 ประเภทงานที่พบบ่อย</div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {types.map(([type,count])=>(
                  <div key={type} style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:110,fontSize:11,color:c.text500,fontWeight:500,flexShrink:0,textAlign:"right" }}>{type}</div>
                    <div style={{ flex:1,background:c.borderSoft,borderRadius:4,height:16,overflow:"hidden" }}>
                      <div style={{ width:`${Math.round(count/maxT*100)}%`,height:"100%",background:c.purple,borderRadius:4 }}/>
                    </div>
                    <div style={{ width:28,fontSize:11,fontWeight:700,color:c.purple,textAlign:"right" }}>{count}</div>
                    <div style={{ width:32,fontSize:10,color:c.text400 }}>{filtered.length>0?Math.round(count/filtered.length*100):0}%</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
