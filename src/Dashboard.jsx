import { useState } from "react";
import { daysLeft, fmtDate, today } from "./utils.js";
import CaseSummaryReport from "./CaseSummaryReport.jsx";
import { useTheme } from "./theme.js";

const tint = (hex, alpha = "22") => `${hex}${alpha}`;

export default function Dashboard({ onBack, cases, projects, users, deletedCases=[], onsiteRecords=[] }) {
  const { c } = useTheme();
  const [showReport, setShowReport] = useState(false);
  const [showDeleteLog, setShowDeleteLog] = useState(false);
  if(showReport) return <CaseSummaryReport onBack={()=>setShowReport(false)} cases={cases} projects={projects}/>;
  if(showDeleteLog) return <DeleteLog onBack={()=>setShowDeleteLog(false)} deletedCases={deletedCases}/>;

  // ── สถิติเคสแต่ละสถานะ ──
  const statusStats = [
    { label:"เปิดเคส",        color:c.amber, bg:tint(c.amber), val: cases.filter(c=>c.status==="open").length },
    { label:"กำลังดำเนินการ", color:c.blue,  bg:tint(c.blue),  val: cases.filter(c=>c.status==="inprogress").length },
    { label:"เสร็จสิ้น",      color:c.green, bg:tint(c.green), val: cases.filter(c=>c.status==="done").length },
    { label:"รอดำเนินการ",    color:c.red,   bg:tint(c.red),   val: cases.filter(c=>c.status==="hold").length },
  ];

  // ── งานค้างอยู่กับใคร (status ไม่ใช่ done) ──
  const pendingCases = cases.filter(c=>c.status!=="done");
  const byTech = {};
  pendingCases.forEach(cs=>{
    const techs = cs.techs?.length ? cs.techs : (cs.tech ? [cs.tech] : ["ไม่ระบุ"]);
    techs.forEach(t=>{
      if(!byTech[t]) byTech[t] = [];
      byTech[t].push(cs);
    });
  });
  const techList = Object.entries(byTech).sort((a,b)=>b[1].length-a[1].length);

  // ── ประกันใกล้หมด (≤ 30 วัน) ──
  const warrantyExpiring = cases.filter(cs=>{
    const d = daysLeft(cs.warrantyEnd);
    return d !== null && d >= 0 && d <= 30;
  }).sort((a,b)=>daysLeft(a.warrantyEnd)-daysLeft(b.warrantyEnd));

  // ── ประกันหมดแล้ว ──
  const warrantyExpired = cases.filter(cs=>{
    const d = daysLeft(cs.warrantyEnd);
    return d !== null && d < 0;
  });

  // ── สัญญาเช่าใกล้หมด (≤ 30 วัน) ──
  const leaseExpiring = cases.filter(cs=>{
    const d = daysLeft(cs.leaseEnd);
    return d !== null && d >= 0 && d <= 30;
  }).sort((a,b)=>daysLeft(a.leaseEnd)-daysLeft(b.leaseEnd));

  // ── สัญญาหมดแล้ว ──
  const leaseExpired = cases.filter(cs=>{
    const d = daysLeft(cs.leaseEnd);
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
  const casesThisMonth = cases.filter(cs=>{
    const d = new Date(cs.createdAt?.seconds?cs.createdAt.seconds*1000:cs.createdAt);
    return d>=_startOfMonth;
  }).length;
  const doneCases = cases.filter(cs=>cs.status==="done");
  const closeRate = cases.length>0?Math.round((doneCases.length/cases.length)*100):0;
  const closedWithDates = doneCases.filter(cs=>(_toMs(cs.createdAt)??Number(cs.id))&&_toMs(cs.updatedAt));
  const avgDays = closedWithDates.length>0
    ? Math.round(closedWithDates.reduce((sum,cs)=>{
        const cr = _toMs(cs.createdAt) ?? Number(cs.id);
        const up = _toMs(cs.updatedAt);
        return sum+(up-cr)/(1000*60*60*24);
      },0)/closedWithDates.length)
    : null;
  const longestPending = pendingCases.reduce((max,cs)=>{
    const ms = _toMs(cs.updatedAt) ?? _toMs(cs.createdAt) ?? Number(cs.id) ?? null;
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
  const _nowMonth = today().slice(0,7);
  const onsiteThisMonth = onsiteMonthly[_nowMonth]?.total || 0;
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const fmtMonth = m => { const [y,mo]=m.split("-"); return `${MONTH_TH[parseInt(mo)-1]} ${(parseInt(y)+543)%100}`; };

  // ── สถิติต่อโครงการ ──
  const projStats = projects.map(p=>{
    const pc = cases.filter(cs=>cs.projectId===p.id);
    return {
      ...p,
      total: pc.length,
      open: pc.filter(cs=>cs.status==="open").length,
      inprogress: pc.filter(cs=>cs.status==="inprogress").length,
      done: pc.filter(cs=>cs.status==="done").length,
      hold: pc.filter(cs=>cs.status==="hold").length,
    };
  }).filter(p=>p.total>0).sort((a,b)=>b.total-a.total).slice(0,8);

  return (
    <div style={{ minHeight:"100vh",background:c.bg,fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:c.borderSoft,border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:c.text500,fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:c.text900 }}>📊 Dashboard</div>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:12,color:c.text400 }}>เคสทั้งหมด {cases.length} รายการ</span>
          <button onClick={()=>setShowDeleteLog(true)}
            style={{ background:tint(c.red,"1a"),border:`1px solid ${tint(c.red,"55")}`,color:c.red,borderRadius:8,
              padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            🗑 ประวัติลบเคส {deletedCases.length>0&&`(${deletedCases.length})`}
          </button>
          <button onClick={()=>setShowReport(true)}
            style={{ background:c.blue,border:"none",color:"#fff",borderRadius:8,
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
            { icon:"📋", label:"เคสเดือนนี้",  value:casesThisMonth, unit:"รายการ", color:c.blue,  bg:tint(c.blue,"14"),  border:tint(c.blue,"40"),  sub:null },
            { icon:"✅", label:"อัตราปิดงาน",  value:closeRate,       unit:"%",      color:c.green, bg:tint(c.green,"14"), border:tint(c.green,"40"), sub:`${doneCases.length}/${cases.length} เคส` },
            { icon:"⏱️", label:"เฉลี่ยปิดงาน", value:avgDays!==null?avgDays:"—", unit:avgDays!==null?"วัน":"", color:c.amber, bg:tint(c.amber,"14"), border:tint(c.amber,"40"), sub:avgDays!==null?`${closedWithDates.length} เคส`:"ยังไม่มีข้อมูล" },
            { icon:"🔥", label:"ค้างนานสุด",   value:pendingCases.length>0?longestPending:"—", unit:pendingCases.length>0?"วัน":"", color:longestPending>=7?c.red:c.text500, bg:longestPending>=7?tint(c.red,"14"):c.borderSoft, border:longestPending>=7?tint(c.red,"40"):c.border, sub:`${pendingCases.length} งานค้าง` },
          ].map(k=>(
            <div key={k.label} style={{ background:k.bg,border:`1px solid ${k.border}`,borderRadius:12,padding:"12px 14px" }}>
              <div style={{ fontSize:16,marginBottom:4 }}>{k.icon}</div>
              <div style={{ fontSize:10,color:c.text400,fontWeight:600,letterSpacing:.3,marginBottom:2 }}>{k.label.toUpperCase()}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:3 }}>
                <span style={{ fontSize:22,fontWeight:800,color:k.color,lineHeight:1 }}>{k.value}</span>
                {k.unit&&<span style={{ fontSize:11,color:k.color,fontWeight:600 }}>{k.unit}</span>}
              </div>
              {k.sub&&<div style={{ fontSize:10,color:c.text400,marginTop:2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Bar Chart สถิติเคส */}
        <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:14,
          padding:"16px 20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:16 }}>สถิติเคสแต่ละสถานะ</div>
          {(()=>{
            const max = Math.max(...statusStats.map(s=>s.val), 1);
            return statusStats.map(s=>(
              <div key={s.label} style={{ marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:13,color:c.text500,fontWeight:500 }}>{s.label}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:s.color }}>{s.val}</span>
                </div>
                <div style={{ background:c.borderSoft,borderRadius:99,height:10,overflow:"hidden" }}>
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
          <div style={{ display:"flex",gap:12,marginTop:16,paddingTop:12,borderTop:`1px solid ${c.borderSoft}`,flexWrap:"wrap" }}>
            {statusStats.map(s=>(
              <div key={s.label} style={{ display:"flex",alignItems:"center",gap:5 }}>
                <div style={{ width:10,height:10,borderRadius:3,background:s.color,flexShrink:0 }}/>
                <span style={{ fontSize:11,color:c.text500 }}>{s.label} ({s.val})</span>
              </div>
            ))}
          </div>
        </div>

        </div>{/* end column ซ้าย */}

        {/* งานค้างอยู่กับใคร — column ขวา */}
        <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:"16px 20px" }}>
        <Section title="👤 งานค้างอยู่กับใคร" count={pendingCases.length}>
          {techList.length===0 ? (
            <Empty text="ไม่มีงานค้าง 🎉"/>
          ) : techList.map(([name, cs])=>(
            <div key={name} style={{ background:c.card,border:`1px solid ${c.border}`,
              borderRadius:10,padding:"12px 14px",marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <div style={{ fontSize:14,fontWeight:700,color:c.text900 }}>👤 {name}</div>
                <span style={{ background:tint(c.blue,"22"),color:c.blue,borderRadius:20,
                  padding:"2px 10px",fontSize:12,fontWeight:700 }}>{cs.length} งาน</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                {cs.map(cc=>{
                  const proj = projects.find(p=>p.id===cc.projectId);
                  return (
                    <div key={cc.id} style={{ display:"flex",alignItems:"center",gap:8,
                      padding:"6px 10px",background:c.bg,borderRadius:8,
                      borderLeft:`3px solid ${proj?.color||c.border}` }}>
                      <div style={{ flex:1,fontSize:13,color:c.text900,fontWeight:500 }}>{cc.title}</div>
                      <StatusBadge status={cc.status}/>
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
            {warrantyExpired.map(cs=>(
              <ExpiryRow key={cs.id} c={cs} projects={projects} days={daysLeft(cs.warrantyEnd)} type="warranty" expired/>
            ))}
            {warrantyExpiring.map(cs=>(
              <ExpiryRow key={cs.id} c={cs} projects={projects} days={daysLeft(cs.warrantyEnd)} type="warranty"/>
            ))}
          </Section>
        )}

        {/* สัญญาเช่าใกล้หมด */}
        {(leaseExpiring.length>0||leaseExpired.length>0) && (
          <Section title="📋 สัญญาเช่าใกล้หมด / หมดแล้ว" count={leaseExpiring.length+leaseExpired.length}>
            {leaseExpired.map(cs=>(
              <ExpiryRow key={cs.id} c={cs} projects={projects} days={daysLeft(cs.leaseEnd)} type="lease" expired/>
            ))}
            {leaseExpiring.map(cs=>(
              <ExpiryRow key={cs.id} c={cs} projects={projects} days={daysLeft(cs.leaseEnd)} type="lease"/>
            ))}
          </Section>
        )}

        {/* ─── Onsite Cost ─── */}
        {approvedOnsite.length>0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900 }}>📍 ค่าใช้จ่าย Onsite</div>
              <span style={{ background:tint(c.orange,"1a"),color:c.orange,borderRadius:20,
                padding:"1px 8px",fontSize:11,fontWeight:700 }}>{approvedOnsite.length} ครั้ง</span>
            </div>

            {/* KPI cards */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
              <div style={{ background:c.card,border:`1px solid ${tint(c.orange,"55")}`,borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:c.text400,fontWeight:700,marginBottom:4 }}>เดือนนี้</div>
                <div style={{ fontSize:20,fontWeight:800,color:c.orange }}>{onsiteThisMonth.toLocaleString()}</div>
                <div style={{ fontSize:10,color:c.text400 }}>บาท</div>
              </div>
              <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:c.text400,fontWeight:700,marginBottom:4 }}>รวมทั้งหมด</div>
                <div style={{ fontSize:20,fontWeight:800,color:c.orange }}>{onsiteTotalAll.toLocaleString()}</div>
                <div style={{ fontSize:10,color:c.text400 }}>บาท</div>
              </div>
              <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:"14px 16px" }}>
                <div style={{ fontSize:10,color:c.text400,fontWeight:700,marginBottom:4 }}>เฉลี่ย/ครั้ง</div>
                <div style={{ fontSize:20,fontWeight:800,color:c.green }}>{approvedOnsite.length>0?Math.round(onsiteTotalAll/approvedOnsite.length).toLocaleString():0}</div>
                <div style={{ fontSize:10,color:c.text400 }}>บาท</div>
              </div>
            </div>

            {/* กราฟรายเดือน */}
            <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:"16px 20px",marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:16 }}>ค่าใช้จ่ายรายเดือน</div>
              <div style={{ display:"flex",alignItems:"flex-end",gap:10,height:140,paddingTop:10 }}>
                {onsiteMonths.map(m=>{
                  const d = onsiteMonthly[m];
                  const h = Math.round((d.total/maxMonthTotal)*100);
                  return (
                    <div key={m} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%" }}>
                      <div style={{ flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",width:"100%",alignItems:"center" }}>
                        <div style={{ fontSize:10,color:c.orange,fontWeight:700,marginBottom:4 }}>{(d.total/1000).toFixed(1)}k</div>
                        <div style={{ width:"70%",maxWidth:40,background:c.orange,
                          borderRadius:"6px 6px 0 0",height:`${h}%`,minHeight:4,transition:"height .3s" }}/>
                      </div>
                      <div style={{ fontSize:10,color:c.text500,fontWeight:600,whiteSpace:"nowrap" }}>{fmtMonth(m)}</div>
                      <div style={{ fontSize:9,color:c.text400 }}>{d.count} ครั้ง</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 โครงการ */}
            <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:"16px 20px" }}>
              <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:12 }}>โครงการที่มีค่าใช้จ่ายสูงสุด</div>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {onsiteProjTop.map(([pid,d])=>{
                  const proj = projects.find(p=>p.id===pid);
                  const pct = onsiteTotalAll>0?Math.round((d.total/onsiteTotalAll)*100):0;
                  return (
                    <div key={pid}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                        <span style={{ display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1 }}>
                          <span style={{ width:8,height:8,borderRadius:2,background:proj?.color||c.text400,flexShrink:0 }}/>
                          <span style={{ fontSize:12,fontWeight:600,color:c.text900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{proj?.name||d.name||pid}</span>
                        </span>
                        <span style={{ fontSize:12,fontWeight:700,color:c.orange,marginLeft:8,flexShrink:0 }}>{d.total.toLocaleString()} บ.</span>
                      </div>
                      <div style={{ background:c.borderSoft,borderRadius:99,height:6,overflow:"hidden" }}>
                        <div style={{ height:"100%",borderRadius:99,background:c.orange,width:`${pct}%` }}/>
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
            <div style={{ fontSize:13,fontWeight:700,color:c.text900 }}>◆ สถิติต่อโครงการ <span style={{ fontSize:11,color:c.text400,fontWeight:400 }}>(Top 8)</span></div>
            <span style={{ background:c.borderSoft,color:c.text500,borderRadius:20,
              padding:"1px 8px",fontSize:11,fontWeight:700 }}>{projects.length}</span>
          </div>
          <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,overflow:"hidden" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed" }}>
              <thead>
                <tr style={{ background:c.borderSoft }}>
                  <th style={{ padding:"7px 14px",textAlign:"left",fontSize:10,color:c.text400,fontWeight:700,width:"40%",borderBottom:`1px solid ${c.border}` }}>โครงการ</th>
                  {[
                    {l:"ทั้งหมด",c:c.text500},
                    {l:"เปิดเคส",c:c.amber},
                    {l:"กำลังทำ",c:c.blue},
                    {l:"เสร็จ",  c:c.green},
                    {l:"รอ",     c:c.red},
                  ].map(h=>(
                    <th key={h.l} style={{ padding:"7px 8px",textAlign:"center",fontSize:10,
                      color:h.c,fontWeight:700,borderBottom:`1px solid ${c.border}` }}>{h.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projStats.map((p,i)=>{
                  const isEmpty = p.total===0;
                  return (
                    <tr key={p.id} style={{ background:i%2===0?c.card:c.bg,
                      borderBottom:`1px solid ${c.borderSoft}`,opacity:isEmpty?0.45:1 }}>
                      <td style={{ padding:"8px 14px" }}>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
                          <span style={{ width:8,height:8,borderRadius:2,
                            background:p.color,flexShrink:0 }}/>
                          <span style={{ fontWeight:600,color:c.text900,
                            fontSize:12,overflow:"hidden",textOverflow:"ellipsis",
                            whiteSpace:"nowrap" }}>{p.name}</span>
                        </span>
                      </td>
                      {[
                        {v:p.total,col:c.text500},
                        {v:p.open,col:c.amber},
                        {v:p.inprogress,col:c.blue},
                        {v:p.done,col:c.green},
                        {v:p.hold,col:c.red},
                      ].map((x,j)=>(
                        <td key={j} style={{ padding:"8px",textAlign:"center",
                          fontWeight:700,color:x.v>0?x.col:c.text400,fontSize:13 }}>{x.v}</td>
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
  const { c } = useTheme();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(deletedCases.length / PAGE_SIZE));
  const paged = deletedCases.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div style={{ minHeight:"100vh",background:c.bg,fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <div style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:c.borderSoft,border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:c.text500,fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:c.text900 }}>🗑 ประวัติการลบเคส</div>
        <span style={{ background:tint(c.red,"22"),color:c.red,borderRadius:20,
          padding:"2px 10px",fontSize:12,fontWeight:700,marginLeft:4 }}>{deletedCases.length} รายการ</span>
      </div>
      <div style={{ padding:"20px",maxWidth:900,margin:"0 auto" }}>
        {deletedCases.length===0 ? (
          <div style={{ textAlign:"center",color:c.text400,padding:"48px 0",fontSize:14 }}>ยังไม่มีประวัติการลบเคส</div>
        ) : (
          <>
            <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,overflow:"hidden",marginBottom:16 }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed" }}>
                <thead>
                  <tr style={{ background:c.borderSoft }}>
                    <th style={{ padding:"8px 14px",textAlign:"left",fontSize:10,color:c.text400,fontWeight:700,borderBottom:`1px solid ${c.border}`,width:"20%" }}>ผู้ลบ</th>
                    <th style={{ padding:"8px 10px",textAlign:"left",fontSize:10,color:c.text400,fontWeight:700,borderBottom:`1px solid ${c.border}`,width:"35%" }}>ชื่อเคส</th>
                    <th style={{ padding:"8px 10px",textAlign:"left",fontSize:10,color:c.text400,fontWeight:700,borderBottom:`1px solid ${c.border}`,width:"25%" }}>โครงการ</th>
                    <th style={{ padding:"8px 10px",textAlign:"right",fontSize:10,color:c.text400,fontWeight:700,borderBottom:`1px solid ${c.border}`,width:"20%" }}>วันเวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d,i)=>(
                    <tr key={d.id} style={{ background:i%2===0?c.card:c.bg,borderBottom:`1px solid ${c.borderSoft}` }}>
                      <td style={{ padding:"8px 14px",fontWeight:600,color:c.text900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.deletedBy}</td>
                      <td style={{ padding:"8px 10px",color:c.text500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.caseTitle}</td>
                      <td style={{ padding:"8px 10px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                        <span style={{ fontSize:11,color:c.text500 }}>◆ {d.projectName}</span>
                      </td>
                      <td style={{ padding:"8px 10px",textAlign:"right",color:c.text400,whiteSpace:"nowrap" }}>
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
                  style={{ background:c.borderSoft,border:`1px solid ${c.border}`,borderRadius:8,
                    padding:"6px 14px",fontSize:12,fontWeight:600,cursor:page===1?"default":"pointer",
                    color:page===1?c.text400:c.text500,fontFamily:"inherit" }}>← ก่อนหน้า</button>
                <span style={{ fontSize:13,color:c.text500 }}>หน้า {page} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ background:c.borderSoft,border:`1px solid ${c.border}`,borderRadius:8,
                    padding:"6px 14px",fontSize:12,fontWeight:600,cursor:page===totalPages?"default":"pointer",
                    color:page===totalPages?c.text400:c.text500,fontFamily:"inherit" }}>ถัดไป →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  const { c } = useTheme();
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <div style={{ fontSize:13,fontWeight:700,color:c.text900 }}>{title}</div>
        <span style={{ background:c.borderSoft,color:c.text500,borderRadius:20,
          padding:"1px 8px",fontSize:11,fontWeight:700 }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const { c } = useTheme();
  const map = {
    open:       { label:"เปิดเคส",        color:c.amber, bg:tint(c.amber) },
    inprogress: { label:"กำลังดำเนินการ", color:c.blue,  bg:tint(c.blue)  },
    done:       { label:"เสร็จสิ้น",      color:c.green, bg:tint(c.green) },
    hold:       { label:"รอดำเนินการ",    color:c.red,   bg:tint(c.red)   },
  };
  const s = map[status]||map.open;
  return (
    <span style={{ background:s.bg,color:s.color,borderRadius:20,
      padding:"2px 8px",fontSize:11,fontWeight:600,flexShrink:0 }}>{s.label}</span>
  );
}

function ExpiryRow({ c: caseObj, projects, days, type, expired }) {
  const { c } = useTheme();
  const proj = projects.find(p=>p.id===caseObj.projectId);
  const date = type==="warranty" ? caseObj.warrantyEnd : caseObj.leaseEnd;
  const stateColor = expired ? c.red : c.amber;
  return (
    <div style={{ background: tint(stateColor,"14"),
      border:`1px solid ${tint(stateColor,"55")}`,
      borderRadius:10,padding:"10px 14px",marginBottom:6,
      display:"flex",alignItems:"center",gap:10 }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:13,fontWeight:700,color:c.text900,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{caseObj.title}</div>
        {proj && <div style={{ fontSize:11,color:proj.color,marginTop:2,fontWeight:600 }}>◆ {proj.name}</div>}
      </div>
      <div style={{ textAlign:"right",flexShrink:0 }}>
        <div style={{ fontSize:12,fontWeight:700,color:stateColor }}>
          {expired ? `หมดแล้ว ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}
        </div>
        <div style={{ fontSize:11,color:c.text400 }}>{fmtDate(date)}</div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  const { c } = useTheme();
  return (
    <div style={{ textAlign:"center",color:c.text400,padding:"24px 0",fontSize:14 }}>{text}</div>
  );
}
