import { useState } from "react";
import { daysLeft, fmtDate } from "./utils.js";
import CaseSummaryReport from "./CaseSummaryReport.jsx";

export default function Dashboard({ onBack, cases, projects, users, deletedCases=[], onsiteRecords=[] }) {
  const [showReport, setShowReport] = useState(false);
  const [showDeleteLog, setShowDeleteLog] = useState(false);
  if(showReport) return <CaseSummaryReport onBack={()=>setShowReport(false)} cases={cases} projects={projects}/>;
  if(showDeleteLog) return <DeleteLog onBack={()=>setShowDeleteLog(false)} deletedCases={deletedCases}/>;

  // ── สถิติเคสแต่ละสถานะ ──
  const statusStats = [
    { label:"เปิดเคส",        color:"#f59e0b", bg:"#fef3c7", val: cases.filter(c=>c.status==="open").length },
    { label:"กำลังดำเนินการ", color:"#3b82f6", bg:"#dbeafe", val: cases.filter(c=>c.status==="inprogress").length },
    { label:"เสร็จสิ้น",      color:"#10b981", bg:"#d1fae5", val: cases.filter(c=>c.status==="done").length },
    { label:"รอดำเนินการ",    color:"#ef4444", bg:"#fee2e2", val: cases.filter(c=>c.status==="hold").length },
  ];

  // ── งานค้างอยู่กับใคร (status ไม่ใช่ done) ──
  const pendingCases = cases.filter(c=>c.status!=="done");
  const byTech = {};
  pendingCases.forEach(c=>{
    const techs = c.techs?.length ? c.techs : (c.tech ? [c.tech] : ["ไม่ระบุ"]);
    techs.forEach(t=>{
      if(!byTech[t]) byTech[t] = [];
      byTech[t].push(c);
    });
  });
  const techList = Object.entries(byTech).sort((a,b)=>b[1].length-a[1].length);

  // ── ประกันใกล้หมด (≤ 30 วัน) ──
  const warrantyExpiring = cases.filter(c=>{
    const d = daysLeft(c.warrantyEnd);
    return d !== null && d >= 0 && d <= 30;
  }).sort((a,b)=>daysLeft(a.warrantyEnd)-daysLeft(b.warrantyEnd));

  // ── ประกันหมดแล้ว ──
  const warrantyExpired = cases.filter(c=>{
    const d = daysLeft(c.warrantyEnd);
    return d !== null && d < 0;
  });

  // ── สัญญาเช่าใกล้หมด (≤ 30 วัน) ──
  const leaseExpiring = cases.filter(c=>{
    const d = daysLeft(c.leaseEnd);
    return d !== null && d >= 0 && d <= 30;
  }).sort((a,b)=>daysLeft(a.leaseEnd)-daysLeft(b.leaseEnd));

  // ── สัญญาหมดแล้ว ──
  const leaseExpired = cases.filter(c=>{
    const d = daysLeft(c.leaseEnd);
    return d !== null && d < 0;
  });

  // ── KPI ──
  const _now = new Date();
  const _toMs = ts => {
    if (!ts) return null;
    if (ts?.toDate) return ts.toDate().getTime();
    if (ts?.seconds) return ts.seconds * 1000;
    if (typeof ts === "string") { const d = new Date(ts); return isNaN(d) ? null : d.getTime(); }
    const n = Number(ts);
    return isNaN(n) ? null : n;
  };
  const _startOfMonth = new Date(_now.getFullYear(), _now.getMonth(), 1);
  const casesThisMonth = cases.filter(c=>{
    const d = new Date(c.createdAt?.seconds?c.createdAt.seconds*1000:c.createdAt);
    return d>=_startOfMonth;
  }).length;
  const doneCases = cases.filter(c=>c.status==="done");
  const closeRate = cases.length>0?Math.round((doneCases.length/cases.length)*100):0;
  const closedWithDates = doneCases.filter(c=>(_toMs(c.createdAt)??Number(c.id))&&_toMs(c.updatedAt));
  const avgDays = closedWithDates.length>0
    ? Math.round(closedWithDates.reduce((sum,c)=>{
        const cr = _toMs(c.createdAt) ?? Number(c.id);
        const up = _toMs(c.updatedAt);
        return sum+(up-cr)/(1000*60*60*24);
      },0)/closedWithDates.length)
    : null;
  const longestPending = pendingCases.reduce((max,c)=>{
    const ms = _toMs(c.updatedAt) ?? _toMs(c.createdAt) ?? Number(c.id) ?? null;
    if (!ms || isNaN(ms)) return max;
    const days = Math.floor((_now.getTime() - ms) / (1000*60*60*24));
    return days > 0 && days > max ? days : max;
  }, 0);

  // ── สถิติ Onsite (เฉพาะ approved) ──
  const approvedOnsite = (onsiteRecords||[]).filter(r => r.status === "approved").map(r => {
    const laborCost = (r.techs||[]).reduce((sum,name)=>{
      const u = (users||[]).find(u=>u.name===name);
      return sum + (u?.onsiteRate||0);
    },0);
    return { ...r, laborCost, totalCost:(r.travelCost||0)+(r.shippingCost||0)+(r.partsCost||0)+laborCost };
  });
  // รายเดือน (6 เดือนล่าสุด)
  const onsiteMonthly = {};
  approvedOnsite.forEach(r => {
    const m = (r.date||"").slice(0,7); // YYYY-MM
    if (!m) return;
    if (!onsiteMonthly[m]) onsiteMonthly[m] = { count:0, total:0 };
    onsiteMonthly[m].count += 1;
    onsiteMonthly[m].total += (r.totalCost||0);
  });
  const onsiteMonths = Object.keys(onsiteMonthly).sort().slice(-6);
  const maxMonthTotal = Math.max(...onsiteMonths.map(m=>onsiteMonthly[m].total), 1);
  // รายโครงการ (top 5)
  const onsiteByProj = {};
  approvedOnsite.forEach(r => {
    const key = r.projectId||"unknown";
    if (!onsiteByProj[key]) onsiteByProj[key] = { count:0, total:0, name:r.projectName||"" };
    onsiteByProj[key].count += 1;
    onsiteByProj[key].total += (r.totalCost||0);
  });
  const onsiteProjTop = Object.entries(onsiteByProj).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const onsiteTotalAll = approvedOnsite.reduce((s,r)=>s+(r.totalCost||0),0);
  const _nowMonth = new Date().toISOString().slice(0,7);
  const onsiteThisMonth = onsiteMonthly[_nowMonth]?.total || 0;
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const fmtMonth = m => { const [y,mo]=m.split("-"); return `${MONTH_TH[parseInt(mo)-1]} ${(parseInt(y)+543)%100}`; };

  // ── สถิติต่อโครงการ ──
  const projStats = projects.map(p=>{
    const pc = cases.filter(c=>c.projectId===p.id);
    return {
      ...p,
      total: pc.length,
      open: pc.filter(c=>c.status==="open").length,
      inprogress: pc.filter(c=>c.status==="inprogress").length,
      done: pc.filter(c=>c.status==="done").length,
      hold: pc.filter(c=>c.status==="hold").length,
    };
  }).filter(p=>p.total>0).sort((a,b)=>b.total-a.total).slice(0,8);

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>📊 Dashboard</div>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:12,color:"#94a3b8" }}>เคสทั้งหมด {cases.length} รายการ</span>
          <button onClick={()=>setShowDeleteLog(true)}
            style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",borderRadius:8,
              padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            🗑 ประวัติลบเคส {deletedCases.length>0&&`(${deletedCases.length})`}
          </button>
          <button onClick={()=>setShowReport(true)}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,
              padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            📄 สรุปเคส
          </button>
        </div>
      </div>

      <div style={{ padding:"20px 20px 48px",maxWidth:1200,margin:"0 auto" }}>

        {/* 2-column layout — desktop only */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))",gap:16,marginBottom:20,alignItems:"start" }}>

        {/* Column ซ้าย */}
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

        {/* KPI 2×2 */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {[
            { icon:"📋", label:"เคสเดือนนี้",  value:casesThisMonth, unit:"รายการ", color:"#6366f1", bg:"#eef2ff", border:"#c7d2fe", sub:null },
            { icon:"✅", label:"อัตราปิดงาน",  value:closeRate,       unit:"%",      color:"#10b981", bg:"#ecfdf5", border:"#a7f3d0", sub:`${doneCases.length}/${cases.length} เคส` },
            { icon:"⏱️", label:"เฉลี่ยปิดงาน", value:avgDays!==null?avgDays:"—", unit:avgDays!==null?"วัน":"", color:"#f59e0b", bg:"#fffbeb", border:"#fde68a", sub:avgDays!==null?`${closedWithDates.length} เคส`:"ยังไม่มีข้อมูล" },
            { icon:"🔥", label:"ค้างนานสุด",   value:pendingCases.length>0?longestPending:"—", unit:pendingCases.length>0?"วัน":"", color:longestPending>=7?"#ef4444":"#64748b", bg:longestPending>=7?"#fff5f5":"#f8fafc", border:longestPending>=7?"#fecaca":"#e2e8f0", sub:`${pendingCases.length} งานค้าง` },
          ].map(k=>(
            <div key={k.label} style={{ background:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ fontSize:16,marginBottom:4 }}>{k.icon}</div>
              <div style={{ fontSize:10,color:"#94a3b8",fontWeight:600,letterSpacing:.3,marginBottom:2 }}>{k.label.toUpperCase()}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:3 }}>
                <span style={{ fontSize:22,fontWeight:800,color:k.color,lineHeight:1 }}>{k.value}</span>
                {k.unit&&<span style={{ fontSize:11,color:k.color,fontWeight:600 }}>{k.unit}</span>}
              </div>
              {k.sub&&<div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Bar Chart สถิติเคส */}
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,
          padding:"16px 20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:16 }}>สถิติเคสแต่ละสถานะ</div>
          {(()=>{
            const max = Math.max(...statusStats.map(s=>s.val), 1);
            return statusStats.map(s=>(
              <div key={s.label} style={{ marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:13,color:"#475569",fontWeight:500 }}>{s.label}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:s.color }}>{s.val}</span>
                </div>
                <div style={{ background:"#f1f5f9",borderRadius:99,height:10,overflow:"hidden" }}>
                  <div style={{
                    width:`${(s.val/max)*100}%`,
                    minWidth: s.val>0?"8px":"0",
                    background:s.color,
                    height:"100%",
                    borderRadius:99,
                    transition:"width .4s ease"
                  }}/>
                </div>
              </div>
            ));
          })()}
          <div style={{ display:"flex",gap:12,marginTop:16,paddingTop:12,borderTop:"1px solid #f1f5f9",flexWrap:"wrap" }}>
            {statusStats.map(s=>(
              <div key={s.label} style={{ display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:10,height:10,borderRadius:3,background:s.color,flexShrink:0 }}/>
                <span style={{ fontSize:11,color:"#64748b" }}>{s.label} ({s.val})</span>
              </div>
            ))}
          </div>
        </div>

        </div>{/* end column ซ้าย */}

        {/* งานค้างอยู่กับใคร — column ขวา */}
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"16px 20px" }}>
        <Section title="👤 งานค้างอยู่กับใคร" count={pendingCases.length}>
          {techList.length===0 ? (
            <Empty text="ไม่มีงานค้าง 🎉"/>
          ) : techList.map(([name, cs])=>(
            <div key={name} style={{ background:"#fff",border:"1px solid #e2e8f0",
              borderRadius:10,padding:"12px 14px",marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>👤 {name}</div>
                <span style={{ background:"#dbeafe",color:"#2563eb",borderRadius:20,
                  padding:"2px 10px",fontSize:12,fontWeight:700 }}>{cs.length} งาน</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                {cs.map(c=>{
                  const proj = projects.find(p=>p.id===c.projectId);
                  return (
                    <div key={c.id} style={{ display:"flex",alignItems:"center",gap:8,
                      padding:"6px 10px",background:"#f8fafc",borderRadius:8,
                      borderLeft:`3px solid ${proj?.color||"#e2e8f0"}` }}>
                      <div style={{ flex:1,fontSize:13,color:"#1e293b",fontWeight:500 }}>{c.title}</div>
                      <StatusBadge status={c.status}/>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Section>
        </div>
        </div>{/* end 2-column grid */}

        {/* ประกันใกล้หมด */}
        {(warrantyExpiring.length>0||warrantyExpired.length>0) && (
          <Section title="🛡 ประกันใกล้หมด / หมดแล้ว" count={warrantyExpiring.length+warrantyExpired.length}>
            {warrantyExpired.map(c=>(
              <ExpiryRow key={c.id} c={c} projects={projects} days={daysLeft(c.warrantyEnd)} type="warranty" expired/>
            ))}
            {warrantyExpiring.map(c=>(
              <ExpiryRow key={c.id} c={c} projects={projects} days={daysLeft(c.warrantyEnd)} type="warranty"/>
            ))}
          </Section>
        )}

        {/* สัญญาเช่าใกล้หมด */}
        {(leaseExpiring.length>0||leaseExpired.length>0) && (
          <Section title="📋 สัญญาเช่าใกล้หมด / หมดแล้ว" count={leaseExpiring.length+leaseExpired.length}>
            {leaseExpired.map(c=>(
              <ExpiryRow key={c.id} c={c} projects={projects} days={daysLeft(c.leaseEnd)} type="lease" expired/>
            ))}
            {leaseExpiring.map(c=>(
              <ExpiryRow key={c.id} c={c} projects={projects} days={daysLeft(c.leaseEnd)} type="lease"/>
            ))}
          </Section>
        )}

        {/* ─── Onsite Cost ─── */}
        {approvedOnsite.length>0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>📍 ค่าใช้จ่าย Onsite</div>
              <span style={{ background:"#fff7ed",color:"#ea580c",borderRadius:20,
                padding:"1px 8px",fontSize:11,fontWeight:700 }}>{approvedOnsite.length} ครั้ง</span>
            </div>

            {/* KPI cards */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
              <div style={{ background:"#fff",border:"1px solid #fed7aa",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>เดือนนี้</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#ea580c" }}>{onsiteThisMonth.toLocaleString()}</div>
                <div style={{ fontSize:10,color:"#94a3b8" }}>บาท</div>
              </div>
              <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>รวมทั้งหมด</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#f97316" }}>{onsiteTotalAll.toLocaleString()}</div>
                <div style={{ fontSize:10,color:"#94a3b8" }}>บาท</div>
              </div>
              <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>เฉลี่ย/ครั้ง</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#16a34a" }}>{approvedOnsite.length>0?Math.round(onsiteTotalAll/approvedOnsite.length).toLocaleString():0}</div>
                <div style={{ fontSize:10,color:"#94a3b8" }}>บาท</div>
              </div>
            </div>

            {/* กราฟรายเดือน */}
            <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"16px 20px",marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:16 }}>ค่าใช้จ่ายรายเดือน</div>
              <div style={{ display:"flex",alignItems:"flex-end",gap:10,height:140,paddingTop:10 }}>
                {onsiteMonths.map(m=>{
                  const d = onsiteMonthly[m];
                  const h = Math.round((d.total/maxMonthTotal)*100);
                  return (
                    <div key={m} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%" }}>
                      <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",width:"100%",alignItems:"center" }}>
                        <div style={{ fontSize:10,color:"#ea580c",fontWeight:700,marginBottom:4 }}>{(d.total/1000).toFixed(1)}k</div>
                        <div style={{ width:"70%",maxWidth:40,background:"linear-gradient(180deg,#fb923c,#f97316)",
                          borderRadius:"6px 6px 0 0",height:`${h}%`,minHeight:4,transition:"height .3s" }}/>
                      </div>
                      <div style={{ fontSize:10,color:"#64748b",fontWeight:600,whiteSpace:"nowrap" }}>{fmtMonth(m)}</div>
                      <div style={{ fontSize:9,color:"#cbd5e1" }}>{d.count} ครั้ง</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 โครงการ */}
            <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"16px 20px" }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:12 }}>โครงการที่มีค่าใช้จ่ายสูงสุด</div>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {onsiteProjTop.map(([pid,d])=>{
                  const proj = projects.find(p=>p.id===pid);
                  const pct = onsiteTotalAll>0?Math.round((d.total/onsiteTotalAll)*100):0;
                  return (
                    <div key={pid}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                        <span style={{ display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1 }}>
                          <span style={{ width:8,height:8,borderRadius:2,background:proj?.color||"#94a3b8",flexShrink:0 }}/>
                          <span style={{ fontSize:12,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj?.name||d.name||pid}</span>
                        </span>
                        <span style={{ fontSize:12,fontWeight:700,color:"#f97316",marginLeft:8,flexShrink:0 }}>{d.total.toLocaleString()} บ.</span>
                      </div>
                      <div style={{ background:"#f1f5f9",borderRadius:99,height:6,overflow:"hidden" }}>
                        <div style={{ height:"100%",borderRadius:99,background:"#f97316",width:`${pct}%` }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* สถิติต่อโครงการ — compact table */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <div style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>◆ สถิติต่อโครงการ <span style={{ fontSize:11,color:"#94a3b8",fontWeight:400 }}>(Top 8)</span></div>
            <span style={{ background:"#f1f5f9",color:"#64748b",borderRadius:20,
              padding:"1px 8px",fontSize:11,fontWeight:700 }}>{projects.length}</span>
          </div>
          <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  <th style={{ padding:"7px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,width:"40%",borderBottom:"1px solid #e2e8f0" }}>โครงการ</th>
                  {[
                    {l:"ทั้งหมด",c:"#64748b"},
                    {l:"เปิดเคส",c:"#f59e0b"},
                    {l:"กำลังทำ",c:"#3b82f6"},
                    {l:"เสร็จ",  c:"#10b981"},
                    {l:"รอ",     c:"#ef4444"},
                  ].map(h=>(
                    <th key={h.l} style={{ padding:"7px 8px",textAlign:"center",fontSize:10,
                      color:h.c,fontWeight:700,borderBottom:"1px solid #e2e8f0" }}>{h.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projStats.map((p,i)=>{
                  const isEmpty = p.total===0;
                  return (
                    <tr key={p.id} style={{ background:i%2===0?"#fff":"#f8fafc",
                      borderBottom:"1px solid #f1f5f9",opacity:isEmpty?0.45:1 }}>
                      <td style={{ padding:"8px 14px" }}>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                          <span style={{ width:8,height:8,borderRadius:2,
                            background:p.color,flexShrink:0 }}/>
                          <span style={{ fontWeight:600,color:"#0f172a",
                            fontSize:12,overflow:"hidden",textOverflow:"ellipsis",
                            whiteSpace:"nowrap" }}>{p.name}</span>
                        </span>
                      </td>
                      {[
                        {v:p.total,c:"#64748b"},
                        {v:p.open,c:"#f59e0b"},
                        {v:p.inprogress,c:"#3b82f6"},
                        {v:p.done,c:"#10b981"},
                        {v:p.hold,c:"#ef4444"},
                      ].map((x,j)=>(
                        <td key={j} style={{ padding:"8px",textAlign:"center",
                          fontWeight:700,color:x.v>0?x.c:"#cbd5e1",fontSize:13 }}>{x.v}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>



      </div>
    </div>
  );
}

function DeleteLog({ onBack, deletedCases }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(deletedCases.length / PAGE_SIZE));
  const paged = deletedCases.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>🗑 ประวัติการลบเคส</div>
        <span style={{ background:"#fee2e2",color:"#ef4444",borderRadius:20,
          padding:"2px 10px",fontSize:12,fontWeight:700,marginLeft:4 }}>{deletedCases.length} รายการ</span>
      </div>
      <div style={{ padding:"20px",maxWidth:900,margin:"0 auto" }}>
        {deletedCases.length===0 ? (
          <div style={{ textAlign:"center",color:"#cbd5e1",padding:"48px 0",fontSize:14 }}>ยังไม่มีประวัติการลบเคส</div>
        ) : (
          <>
            <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden",marginBottom:16 }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed" }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    <th style={{ padding:"8px 14px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0",width:"20%" }}>ผู้ลบ</th>
                    <th style={{ padding:"8px 10px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0",width:"35%" }}>ชื่อเคส</th>
                    <th style={{ padding:"8px 10px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0",width:"25%" }}>โครงการ</th>
                    <th style={{ padding:"8px 10px",textAlign:"right",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0",width:"20%" }}>วันเวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d,i)=>(
                    <tr key={d.id} style={{ background:i%2===0?"#fff":"#f8fafc",borderBottom:"1px solid #f1f5f9" }}>
                      <td style={{ padding:"8px 14px",fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.deletedBy}</td>
                      <td style={{ padding:"8px 10px",color:"#475569",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.caseTitle}</td>
                      <td style={{ padding:"8px 10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        <span style={{ fontSize:11,color:"#64748b" }}>◆ {d.projectName}</span>
                      </td>
                      <td style={{ padding:"8px 10px",textAlign:"right",color:"#94a3b8",whiteSpace:"nowrap" }}>
                        {d.deletedAt ? new Date(d.deletedAt).toLocaleString("th-TH",{
                          day:"2-digit",month:"2-digit",year:"numeric",
                          hour:"2-digit",minute:"2-digit"
                        }) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display:"flex",justifyContent:"center",alignItems:"center",gap:8 }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
                    padding:"6px 14px",fontSize:12,fontWeight:600,cursor:page===1?"default":"pointer",
                    color:page===1?"#cbd5e1":"#475569",fontFamily:"inherit" }}>← ก่อนหน้า</button>
                <span style={{ fontSize:13,color:"#64748b" }}>หน้า {page} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
                    padding:"6px 14px",fontSize:12,fontWeight:600,cursor:page===totalPages?"default":"pointer",
                    color:page===totalPages?"#cbd5e1":"#475569",fontFamily:"inherit" }}>ถัดไป →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <div style={{ fontSize:13,fontWeight:700,color:"#0f172a" }}>{title}</div>
        <span style={{ background:"#f1f5f9",color:"#64748b",borderRadius:20,
          padding:"1px 8px",fontSize:11,fontWeight:700 }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    open:       { label:"เปิดเคส",        color:"#f59e0b", bg:"#fef3c7" },
    inprogress: { label:"กำลังดำเนินการ", color:"#3b82f6", bg:"#dbeafe" },
    done:       { label:"เสร็จสิ้น",      color:"#10b981", bg:"#d1fae5" },
    hold:       { label:"รอดำเนินการ",    color:"#ef4444", bg:"#fee2e2" },
  };
  const s = map[status]||map.open;
  return (
    <span style={{ background:s.bg,color:s.color,borderRadius:20,
      padding:"2px 8px",fontSize:11,fontWeight:600,flexShrink:0 }}>{s.label}</span>
  );
}

function ExpiryRow({ c, projects, days, type, expired }) {
  const proj = projects.find(p=>p.id===c.projectId);
  const date = type==="warranty" ? c.warrantyEnd : c.leaseEnd;
  return (
    <div style={{ background: expired?"#fff5f5":"#fffbeb",
      border:`1px solid ${expired?"#fecaca":"#fde68a"}`,
      borderRadius:10,padding:"10px 14px",marginBottom:6,
      display:"flex",alignItems:"center",gap:10 }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.title}</div>
        {proj && <div style={{ fontSize:11,color:proj.color,marginTop:2,fontWeight:600 }}>◆ {proj.name}</div>}
      </div>
      <div style={{ textAlign:"right",flexShrink:0 }}>
        <div style={{ fontSize:12,fontWeight:700,color:expired?"#ef4444":"#f59e0b" }}>
          {expired ? `หมดแล้ว ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}
        </div>
        <div style={{ fontSize:11,color:"#94a3b8" }}>{fmtDate(date)}</div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign:"center",color:"#cbd5e1",padding:"24px 0",fontSize:14 }}>{text}</div>
  );
}
