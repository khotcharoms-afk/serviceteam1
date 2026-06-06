import { daysLeft, fmtDate } from "./utils.js";

export default function Dashboard({ onBack, cases, projects, users }) {

  // ── สถิติเคสแต่ละสถานะ ──
  const statusStats = [
    { label:"เปิดเคส",        color:"#f59e0b", bg:"#fef3c7", val: cases.filter(c=>c.status==="open").length },
    { label:"กำลังดำเนินการ", color:"#3b82f6", bg:"#dbeafe", val: cases.filter(c=>c.status==="inprogress").length },
    { label:"เสร็จสิ้น",      color:"#10b981", bg:"#d1fae5", val: cases.filter(c=>c.status==="done").length },
    { label:"รอดำเนินการ",    color:"#ef4444", bg:"#fee2e2", val: cases.filter(c=>c.status==="hold").length },
  ];

  // ── งานค้าง (status ไม่ใช่ done) ──
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
  });

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
        <div style={{ marginLeft:"auto",fontSize:12,color:"#94a3b8" }}>เคสทั้งหมด {cases.length} รายการ</div>
      </div>

      <div style={{ padding:"20px 16px 48px",maxWidth:720,margin:"0 auto" }}>

        {/* Bar Chart สถิติเคส */}
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,
          padding:"16px 20px",marginBottom:20 }}>
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

        {/* งานค้าง */}
        <Section title="👤 งานค้าง" count={pendingCases.length}>
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

        {/* สถิติต่อโครงการ */}
        <Section title="◆ สถิติต่อโครงการ" count={projects.length}>
          {projStats.map(p=>(
            <div key={p.id} style={{ background:"#fff",border:`1px solid ${p.color}30`,
              borderRadius:10,padding:"12px 14px",marginBottom:8,
              borderLeft:`4px solid ${p.color}` }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:8 }}>{p.name}</div>
              <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                {[
                  {l:"ทั้งหมด",  v:p.total,      c:"#64748b"},
                  {l:"เปิดเคส",  v:p.open,       c:"#f59e0b"},
                  {l:"กำลังทำ",  v:p.inprogress, c:"#3b82f6"},
                  {l:"เสร็จ",    v:p.done,       c:"#10b981"},
                  {l:"รอ",       v:p.hold,       c:"#ef4444"},
                ].map(x=>(
                  <div key={x.l} style={{ textAlign:"center",minWidth:40 }}>
                    <div style={{ fontSize:18,fontWeight:800,color:x.c,lineHeight:1 }}>{x.v}</div>
                    <div style={{ fontSize:10,color:"#94a3b8",marginTop:2 }}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

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
