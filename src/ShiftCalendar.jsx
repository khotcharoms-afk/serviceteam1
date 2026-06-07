import { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, collection, addDoc, getDocs } from "firebase/firestore";

const DAY_NAMES = ["อา","จ","อ","พ","พฤ","ศ","ส"];

// วันหยุดนักขัตฤกษ์ไทย 2568-2570
const THAI_HOLIDAYS = {
  "2568-01-01": "วันขึ้นปีใหม่",
  "2568-02-12": "วันมาฆบูชา",
  "2568-04-06": "วันจักรี",
  "2568-04-13": "วันสงกรานต์",
  "2568-04-14": "วันสงกรานต์",
  "2568-04-15": "วันสงกรานต์",
  "2568-05-01": "วันแรงงาน",
  "2568-05-05": "วันฉัตรมงคล",
  "2568-05-12": "วันวิสาขบูชา",
  "2568-06-03": "วันเฉลิมพระชนมพรรษา ร.10",
  "2568-07-10": "วันอาสาฬหบูชา",
  "2568-07-11": "วันเข้าพรรษา",
  "2568-07-28": "วันเฉลิมพระชนมพรรษา ร.10",
  "2568-08-12": "วันแม่แห่งชาติ",
  "2568-10-13": "วันนวมินทรมหาราช",
  "2568-10-23": "วันปิยมหาราช",
  "2568-12-05": "วันพ่อแห่งชาติ",
  "2568-12-10": "วันรัฐธรรมนูญ",
  "2568-12-31": "วันสิ้นปี",
  "2569-01-01": "วันขึ้นปีใหม่",
  "2569-03-03": "วันมาฆบูชา",
  "2569-04-06": "วันจักรี",
  "2569-04-13": "วันสงกรานต์",
  "2569-04-14": "วันสงกรานต์",
  "2569-04-15": "วันสงกรานต์",
  "2569-05-01": "วันแรงงาน",
  "2569-05-05": "วันฉัตรมงคล",
  "2569-05-31": "วันวิสาขบูชา",
  "2569-06-03": "วันเฉลิมพระชนมพรรษา ร.10",
  "2569-06-29": "วันอาสาฬหบูชา",
  "2569-06-30": "วันเข้าพรรษา",
  "2569-07-28": "วันเฉลิมพระชนมพรรษา ร.10",
  "2569-08-12": "วันแม่แห่งชาติ",
  "2569-10-13": "วันนวมินทรมหาราช",
  "2569-10-23": "วันปิยมหาราช",
  "2569-12-05": "วันพ่อแห่งชาติ",
  "2569-12-10": "วันรัฐธรรมนูญ",
  "2569-12-31": "วันสิ้นปี",
  "2570-01-01": "วันขึ้นปีใหม่",
};

function thaiDateKey(year, month, day) {
  const buddhistYear = year + 543;
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${buddhistYear}-${m}-${d}`;
}
const MONTH_NAMES = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

// สีแต่ละกะ (bg, text)
const SHIFT_COLORS = [
  { bg:"#dbeafe", text:"#1e40af" },
  { bg:"#d1fae5", text:"#065f46" },
  { bg:"#fde68a", text:"#78350f" },
  { bg:"#fecaca", text:"#7f1d1d" },
  { bg:"#e9d5ff", text:"#4c1d95" },
  { bg:"#fed7aa", text:"#7c2d12" },
];

function getColorForType(idx) {
  return SHIFT_COLORS[idx % SHIFT_COLORS.length];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function dateKey(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function ShiftCalendar({ onBack, currentUser, users, shiftTypes, shifts, userSchedules=[], shiftMembers=[], refreshSchedules, refreshShiftTypes, refreshShiftMembers }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editDay, setEditDay] = useState(null);
  const [viewDay, setViewDay] = useState(null); // popup ดูกะ (ทุกคน)
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showClearShift, setShowClearShift] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [showScheduleManager, setShowScheduleManager] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const canEditShift = isAdmin || currentUser?.canEditShift === true;
  const isMobile = window.innerWidth < 640;
  const sortedMembers = [...shiftMembers].sort((a,b)=>(a.order||0)-(b.order||0));
  const memberNames = sortedMembers.map(m=>m.userName);
  const approvedUsers = memberNames.length > 0
    ? memberNames.map(n=>users.find(u=>u.name===n)).filter(Boolean)
    : users.filter(u => u.role !== "pending");

  // สร้าง map: dateKey -> [{ userName, shiftTypeId, isOff }] เรียงตาม startTime
  const shiftMap = {};
  shifts.forEach(s => {
    if (!shiftMap[s.date]) shiftMap[s.date] = [];
    shiftMap[s.date].push(s);
  });
  Object.keys(shiftMap).forEach(dk => {
    shiftMap[dk].sort((a, b) => {
      if (a.isOff && !b.isOff) return 1;
      if (!a.isOff && b.isOff) return -1;
      const typeA = shiftTypes.find(t => t.id === a.shiftTypeId);
      const typeB = shiftTypes.find(t => t.id === b.shiftTypeId);
      const startA = typeA?.startTime || "99";
      const startB = typeB?.startTime || "99";
      if (startA !== startB) return startA.localeCompare(startB);
      // startTime เท่ากัน → เรียงตาม endTime (00:xx ถือว่าดึกกว่า 23:xx)
      const endA = typeA?.endTime || "99";
      const endB = typeB?.endTime || "99";
      const normA = endA < "06" ? "z" + endA : endA;
      const normB = endB < "06" ? "z" + endB : endB;
      return normA.localeCompare(normB);
    });
  });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // สร้าง grid cells
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function exportCalendarPDF() {
    const monthLabel = MONTH_NAMES[month] + " " + (year + 543);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const colorMap = {};
    shiftTypes.forEach((t, i) => {
      const c = getColorForType(i);
      colorMap[t.id] = c;
    });

    const dayNames = ["อา","จ","อ","พ","พฤ","ศ","ส"];

    const weeksHTML = weeks.map(week => {
      const cells = week.map(day => {
        if (!day) return `<td style="border:0.5px solid #f1f5f9;background:#fafafa;height:60px;vertical-align:top;padding:3px"></td>`;
        const dk = dateKey(year, month, day);
        const buddhistKey = thaiDateKey(year, month, day);
        const holiday = THAI_HOLIDAYS[buddhistKey];
        const entries = (shiftMap[dk] || []).filter(e => !e.isOff);
        const isToday = dk === todayKey;
        const bg = isToday ? "#eff6ff" : holiday ? "#fff5f5" : "#fff";
        const border = isToday ? "2px solid #2563eb" : "0.5px solid #f1f5f9";
        const dayColor = isToday ? "#1d4ed8" : holiday ? "#ef4444" : "#475569";

        const pills = entries.map(e => {
          const type = shiftTypes.find(t => t.id === e.shiftTypeId);
          const ci = shiftTypes.findIndex(t => t.id === e.shiftTypeId);
          const c = getColorForType(ci >= 0 ? ci : 0);
          const name = e.userName.split(" ")[0];
          return `<div style="background:${c.bg};border-radius:2px;padding:1px 3px;font-size:7px;color:${c.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:1px">${name}</div>`;
        }).join("");

        return `<td style="border:${border};height:60px;vertical-align:top;padding:3px;background:${bg};border-radius:${isToday?"4px":"0"}">
          <div style="font-size:8px;font-weight:${isToday?"700":"500"};color:${dayColor};margin-bottom:1px">${day}${holiday ? ` <span style="font-size:7px;color:#ef4444"> ${holiday.substring(0,6)}</span>` : ""}</div>
          ${pills}
        </td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    // Legend
    const legendHTML = shiftTypes.map((t, i) => {
      const c = getColorForType(i);
      return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:${c.text};margin-right:12px">
        <span style="width:10px;height:10px;border-radius:2px;background:${c.bg};display:inline-block"></span>
        ${t.name} (${t.startTime}–${t.endTime})
      </span>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<title>ตารางกะ ${monthLabel}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:'Noto Sans Thai',sans-serif; padding:10mm; background:#fff; }
  @page { size:A4 landscape; margin:0; }
  @media print { .no-print { display:none !important; } body { padding:5mm; } * { font-size:90%; } }
  table { width:100%; border-collapse:collapse; }
</style>
</head>
<body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#f8fafc;padding:8px 14px;display:flex;gap:10px;border-bottom:1px solid #e2e8f0;z-index:99">
  <button onclick="window.close()" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-family:inherit">← ปิด</button>
  <button onclick="window.print()" style="background:#16a34a;border:none;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:12px;font-family:inherit;color:#fff;margin-left:auto">🖨 พิมพ์ / Export PDF</button>
</div>
<div style="margin-top:36px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <div style="font-size:16pt;font-weight:700;color:#1E3A5F">ตารางกะ — ${monthLabel}</div>
    <div style="font-size:9px;color:#94a3b8">บริษัท เมทเธียร์ จำกัด · ServiceLog</div>
  </div>
  <div style="margin-bottom:10px">${legendHTML}</div>
  <table style="table-layout:fixed">
    <thead>
      <tr>${dayNames.map(d => `<th style="padding:6px 4px;text-align:center;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:14.28%">${d}</th>`).join("")}</tr>
    </thead>
    <tbody>${weeksHTML}</tbody>
  </table>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`.shift-layout { display:flex; gap:14px; align-items:flex-start; } @media(max-width:600px){ .shift-layout { flex-direction:column; } .shift-holiday-table { width:100% !important; } }`}</style>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>📅 ตารางกะ</div>
        <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>

          <button onClick={exportCalendarPDF}
            style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,
              padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#16a34a" }}>
            📄 Export PDF
          </button>
          {canEditShift && (
            <button onClick={()=>setShowBulkEdit(true)}
              style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,
                padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#2563eb" }}>
              📆 ลงกะหลายวัน
            </button>
          )}
          {canEditShift && (
            <button onClick={()=>setShowClearShift(true)}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
                padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#ef4444" }}>
              🗑 เคลียร์กะ
            </button>
          )}
          {canEditShift && (
            <button onClick={()=>setShowSettings(true)}
              style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
                padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#475569" }}>
              ⚙ ตั้งค่า
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:"20px",maxWidth:1100,margin:"0 auto" }}>

        {/* Month nav */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
          <button onClick={prevMonth} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
            padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#475569" }}>← ก่อนหน้า</button>
          <div style={{ fontSize:18,fontWeight:800,color:"#0f172a" }}>
            {MONTH_NAMES[month]} {year + 543}
          </div>
          <button onClick={nextMonth} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,
            padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#475569" }}>ถัดไป →</button>
        </div>

        {/* Legend */}
        {shiftTypes.length > 0 && (
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:14 }}>
            {shiftTypes.map((t,i) => {
              const c = getColorForType(i);
              return (
                <span key={t.id} style={{ display:"inline-flex",alignItems:"center",gap:5,
                  fontSize:11,color:c.text }}>
                  <span style={{ width:10,height:10,borderRadius:2,background:c.bg,
                    border:`1px solid ${c.text}30`,display:"inline-block" }}/>
                  {t.name} ({t.startTime}–{t.endTime})
                </span>
              );
            })}
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#94a3b8" }}>
              <span style={{ width:10,height:10,borderRadius:2,background:"#f1f5f9",
                border:"1px solid #e2e8f0",display:"inline-block" }}/>หยุด
            </span>
          </div>
        )}

        {/* Calendar + ตารางวันหยุด */}
        <div className="shift-layout">

        {/* Calendar */}
        <div style={{ flex:1,minWidth:0 }}>
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",tableLayout:"fixed" }}>
            <thead>
              <tr>
                {DAY_NAMES.map(d => (
                  <th key={d} style={{ padding:"8px 4px",textAlign:"center",fontSize:12,
                    fontWeight:600,color:"#64748b",borderBottom:"1px solid #e2e8f0",
                    background:"#f8fafc" }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    if (!day) return (
                      <td key={di} style={{ border:"0.5px solid #f1f5f9",background:"#fafafa",
                        height:90,verticalAlign:"top",padding:4 }}/>
                    );
                    const dk = dateKey(year, month, day);
                    const dayEntries = shiftMap[dk] || [];
                    const isToday = dk === todayKey;
                    const holidayKey = thaiDateKey(year, month, day);
                    const holiday = THAI_HOLIDAYS[holidayKey];
                    return (
                      <td key={di} onClick={() => setViewDay(dk)}
                        style={{ border:isToday?"2px solid #2563eb":"0.5px solid #f1f5f9",
                          height:90,verticalAlign:"top",
                          padding:isToday?3:4,cursor:"pointer",
                          background:isToday?"#eff6ff":holiday?"#fff5f5":"#fff",
                          borderRadius:isToday?6:0,
                          transition:"background .15s" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:3,marginBottom:2,padding:"1px 3px" }}>
                          <span style={{ fontSize:11,fontWeight:isToday?700:500,
                            color:isToday?"#1d4ed8":holiday?"#ef4444":"#475569" }}>{day}</span>
                          {holiday && <span style={{ fontSize:8,color:"#ef4444",fontWeight:600,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>
                            {holiday}
                          </span>}
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                          {dayEntries.map((e, ei) => {
                            if (e.isOff) return null;
                            const typeIdx = shiftTypes.findIndex(t => t.id === e.shiftTypeId);
                            const c = getColorForType(typeIdx >= 0 ? typeIdx : 0);
                            const type = shiftTypes.find(t => t.id === e.shiftTypeId);
                            const displayName = isMobile ? e.userName.charAt(0) : e.userName.split(" ")[0];
                            const timeLabel = isMobile ? "" : ` · ${type ? `${type.startTime}–${type.endTime}` : ""}`;
                            return (
                              <div key={ei} style={{ background:c.bg,borderRadius:3,
                                padding:"1px 4px",fontSize:10,color:c.text,
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {displayName}{timeLabel}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign:"center",marginTop:8,fontSize:12,color:"#94a3b8" }}>
          กดที่วันเพื่อดูกะ
        </div>
        </div>

        {/* ตารางวันหยุด */}
        <div className="shift-holiday-table" style={{ width:160,flexShrink:0 }}>
          <div style={{ background:"#1E3A5F",padding:"8px 12px",borderRadius:"12px 12px 0 0" }}>
            <div style={{ fontSize:12,fontWeight:700,color:"#fff",textAlign:"center" }}>ตารางวันหยุด</div>
            <div style={{ fontSize:10,color:"#93C5FD",textAlign:"center",marginTop:2 }}>{MONTH_NAMES[month].slice(0,3)}. {year+543}</div>
          </div>
          <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:"0 0 12px 12px",overflow:"hidden" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  <th style={{ padding:"6px 10px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0" }}>ชื่อ</th>
                  <th style={{ padding:"6px 8px",textAlign:"left",fontSize:10,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0" }}>วันหยุด</th>
                </tr>
              </thead>
              <tbody>
                {approvedUsers.map((u,i)=>{
                  const monthKey = `${year}-${String(month+1).padStart(2,"0")}`;
                  const sch = userSchedules.find(s=>s.userName===u.name && s.monthKey===monthKey)
                    || userSchedules.find(s=>s.userName===u.name && !s.monthKey); // fallback legacy
                  const offDays = (sch?.offDays||[]).sort();
                  const dayLabel = offDays.length>0 ? offDays.map(d=>DAY_NAMES[d]).join("-") : "-";
                  return (
                    <tr key={u.id} style={{ background:i%2===0?"#fff":"#f8fafc",borderBottom:"1px solid #f1f5f9" }}>
                      <td style={{ padding:"6px 10px",fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.name.split(" ")[0]}</td>
                      <td style={{ padding:"6px 8px",color:"#64748b",whiteSpace:"nowrap" }}>{dayLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        </div>{/* end flex */}
      </div>

      {/* Edit Day Modal */}
      {showClearShift && (
        <ClearShiftModal
          year={year} month={month}
          users={approvedUsers}
          daysInMonth={getDaysInMonth(year, month)}
          onClose={()=>setShowClearShift(false)}
        />
      )}

      {showBulkEdit && (
        <BulkEditModal
          year={year} month={month}
          users={approvedUsers}
          shiftTypes={shiftTypes}
          userSchedules={userSchedules}
          daysInMonth={getDaysInMonth(year, month)}
          onClose={()=>setShowBulkEdit(false)}
        />
      )}

      {viewDay && (
        <ViewDayModal
          date={viewDay}
          entries={shiftMap[viewDay] || []}
          shiftTypes={shiftTypes}
          isAdmin={canEditShift}
          onEdit={()=>{ setEditDay(viewDay); setViewDay(null); }}
          onClose={() => setViewDay(null)}
        />
      )}

      {editDay && (
        <EditDayModal
          date={editDay}
          entries={shiftMap[editDay] || []}
          users={approvedUsers}
          shiftTypes={shiftTypes}
          onClose={() => setEditDay(null)}
        />
      )}

      {showSettings && (
        <SettingsMenu
          onClose={()=>setShowSettings(false)}
          onMembers={()=>{ setShowSettings(false); setShowMemberManager(true); }}
          onSchedule={()=>{ setShowSettings(false); setShowScheduleManager(true); }}
          onTypes={()=>{ setShowSettings(false); setShowTypeManager(true); }}
        />
      )}

      {showMemberManager && (
        <MemberManager
          users={users.filter(u=>u.role!=="pending")}
          shiftMembers={shiftMembers}
          onClose={()=>setShowMemberManager(false)}
          onSaved={refreshShiftMembers}
        />
      )}

      {showScheduleManager && (
        <ScheduleManager
          users={approvedUsers}
          userSchedules={userSchedules}
          initYear={year}
          initMonth={month}
          onClose={()=>setShowScheduleManager(false)}
          onSaved={refreshSchedules}
        />
      )}

      {/* Shift Type Manager Modal */}
      {showTypeManager && (
        <ShiftTypeManager
          shiftTypes={shiftTypes}
          onClose={() => setShowTypeManager(false)}
          onSaved={refreshShiftTypes}
        />
      )}
    </div>
  );
}

// ── Modal เลือกสมาชิกทีม ──
function MemberManager({ users, shiftMembers, onClose }) {
  const [saving, setSaving] = useState(false);

  const initSelected = () => {
    const sorted = [...shiftMembers].sort((a,b)=>(a.order||0)-(b.order||0));
    if (sorted.length > 0) return sorted.map(m=>m.userName);
    return users.map(u=>u.name);
  };
  const initUnselected = () => {
    const sorted = [...shiftMembers].sort((a,b)=>(a.order||0)-(b.order||0));
    if (sorted.length > 0) return users.filter(u=>!sorted.find(m=>m.userName===u.name)).map(u=>u.name);
    return [];
  };

  const [selected, setSelected] = useState(initSelected);
  const [unselected, setUnselected] = useState(initUnselected);

  function remove(name) {
    setSelected(p=>p.filter(n=>n!==name));
    setUnselected(p=>[...p, name]);
  }
  function add(name) {
    setUnselected(p=>p.filter(n=>n!==name));
    setSelected(p=>[...p, name]);
  }
  function moveUp(i) {
    if (i===0) return;
    setSelected(p=>{ const n=[...p]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; });
  }
  function moveDown(i) {
    setSelected(p=>{ if(i>=p.length-1) return p; const n=[...p]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; });
  }

  async function save() {
    setSaving(true);
    try {
      const { getDocs } = await import("firebase/firestore");
      const snap = await getDocs(collection(db,"shiftMembers"));
      for (const d of snap.docs) await deleteDoc(d.ref);
      for (let i=0; i<selected.length; i++) {
        await setDoc(doc(db,"shiftMembers",selected[i].replace(/ /g,"_")), {
          userName: selected[i], order: i
        });
      }
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:380,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>👥 สมาชิกทีม CS</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>
        <div style={{ fontSize:11,color:"#94a3b8",marginBottom:10 }}>กด ↑↓ เรียงลำดับ · กด ✕ เอาออก</div>
        <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:10 }}>
          {selected.map((name,i)=>(
            <div key={name} style={{ display:"flex",alignItems:"center",gap:8,
              padding:"7px 10px",background:"#eff6ff",
              borderRadius:8,border:"1px solid #bfdbfe" }}>
              <span style={{ flex:1,fontSize:13,fontWeight:600,color:"#0f172a" }}>{name}</span>
              <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                <button onClick={()=>moveUp(i)} disabled={i===0}
                  style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,
                    width:26,height:26,cursor:"pointer",fontSize:13,opacity:i===0?0.3:1 }}>↑</button>
                <button onClick={()=>moveDown(i)} disabled={i===selected.length-1}
                  style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,
                    width:26,height:26,cursor:"pointer",fontSize:13,opacity:i===selected.length-1?0.3:1 }}>↓</button>
                <button onClick={()=>remove(name)}
                  style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:6,
                    width:26,height:26,cursor:"pointer",fontSize:13,color:"#ef4444" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
        {unselected.length > 0 && (
          <div style={{ borderTop:"1px dashed #e2e8f0",paddingTop:8,marginBottom:14 }}>
            <div style={{ fontSize:10,color:"#94a3b8",marginBottom:6 }}>กด + เพื่อเพิ่ม</div>
            <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
              {unselected.map(name=>(
                <div key={name} style={{ display:"flex",alignItems:"center",gap:8,
                  padding:"7px 10px",background:"#f8fafc",
                  borderRadius:8,border:"1px solid #e2e8f0" }}>
                  <span style={{ flex:1,fontSize:13,color:"#64748b" }}>{name}</span>
                  <button onClick={()=>add(name)}
                    style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,
                      width:26,height:26,cursor:"pointer",fontSize:14,color:"#16a34a" }}>+</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex:2,background:"#2563eb",border:"none",
            color:"#fff",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
            {saving?"กำลังบันทึก…":"บันทึก"}
          </button>
        </div>
        <button onClick={()=>setSchedules(s=>s.map(x=>({...x,offDays:[]})))}
          style={{ width:"100%",marginTop:8,background:"#fff5f5",border:"1px solid #fecaca",
            color:"#ef4444",borderRadius:10,padding:"9px",fontSize:13,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
          🗑 เคลียร์วันหยุดทั้งหมด
        </button>
      </div>
    </div>
  );
}

// ── Modal จัดการวันหยุดประจำ ──
function ScheduleManager({ users, userSchedules, onClose, initYear, initMonth, onSaved }) {
  const now = new Date();
  const [selYear, setSelYear] = useState(initYear||now.getFullYear());
  const [selMonth, setSelMonth] = useState(initMonth!==undefined?initMonth:now.getMonth());
  const [saving, setSaving] = useState(false);

  const monthKey = `${selYear}-${String(selMonth+1).padStart(2,"0")}`;

  const [schedules, setSchedules] = useState(
    users.map(u => {
      const existing = userSchedules.find(s=>s.userName===u.name && s.monthKey===monthKey)
        || userSchedules.find(s=>s.userName===u.name && !s.monthKey);
      return { userName: u.name, offDays: existing?.offDays||[] };
    })
  );

  // reload when month changes
  function loadMonth(y, m) {
    const mk = `${y}-${String(m+1).padStart(2,"0")}`;
    setSchedules(users.map(u => {
      const existing = userSchedules.find(s=>s.userName===u.name && s.monthKey===mk)
        || userSchedules.find(s=>s.userName===u.name && !s.monthKey);
      return { userName: u.name, offDays: existing?.offDays||[] };
    }));
  }

  function prevMonth() {
    const y = selMonth===0?selYear-1:selYear;
    const m = selMonth===0?11:selMonth-1;
    setSelYear(y); setSelMonth(m); loadMonth(y,m);
  }
  function nextMonth() {
    const y = selMonth===11?selYear+1:selYear;
    const m = selMonth===11?0:selMonth+1;
    setSelYear(y); setSelMonth(m); loadMonth(y,m);
  }

  function toggleDay(userIdx, day) {
    setSchedules(prev => prev.map((s,i) => {
      if (i !== userIdx) return s;
      const has = s.offDays.includes(day);
      return { ...s, offDays: has ? s.offDays.filter(d=>d!==day) : [...s.offDays, day] };
    }));
  }
  async function save() {
    setSaving(true);
    try {
      for (const sch of schedules) {
        const docId = `${sch.userName.replace(/ /g,"_")}_${monthKey}`;
        await setDoc(doc(db,"userSchedules",docId), {
          userName: sch.userName, offDays: sch.offDays, monthKey,
        });
      }
      if (onSaved) onSaved();
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }
  const DAY_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const MONTH_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:520,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"80vh",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>📋 กำหนดวันหยุดประจำ</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8,background:"#f8fafc",
          borderRadius:8,padding:"8px 12px",marginBottom:14 }}>
          <button onClick={prevMonth} style={{ background:"#fff",border:"0.5px solid #e2e8f0",
            borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
            ← {MONTH_SHORT[selMonth===0?11:selMonth-1]}
          </button>
          <span style={{ flex:1,textAlign:"center",fontSize:13,fontWeight:600,color:"#1E3A5F" }}>
            {MONTH_TH[selMonth]} {selYear+543}
          </span>
          <button onClick={nextMonth} style={{ background:"#fff",border:"0.5px solid #e2e8f0",
            borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
            {MONTH_SHORT[selMonth===11?0:selMonth+1]} →
          </button>
        </div>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:18 }}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              <th style={{ padding:"7px 10px",textAlign:"left",fontSize:11,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0" }}>ชื่อ</th>
              {DAY_SHORT.map(d=>(
                <th key={d} style={{ padding:"7px 6px",textAlign:"center",fontSize:11,color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #e2e8f0" }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map((sch,i)=>(
              <tr key={sch.userName} style={{ borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc" }}>
                <td style={{ padding:"7px 10px",fontWeight:600,color:"#0f172a" }}>{sch.userName.split(" ")[0]}</td>
                {[0,1,2,3,4,5,6].map(d=>(
                  <td key={d} style={{ padding:"6px",textAlign:"center" }}>
                    <input type="checkbox" checked={sch.offDays.includes(d)}
                      onChange={()=>toggleDay(i,d)}
                      style={{ width:16,height:16,accentColor:"#ef4444",cursor:"pointer" }}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex:2,background:"#2563eb",border:"none",
            color:"#fff",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
            {saving?"กำลังบันทึก…":`บันทึก ${MONTH_TH[selMonth]} ${selYear+543}`}
          </button>
        </div>
        <button onClick={()=>setSchedules(s=>s.map(x=>({...x,offDays:[]})))}
          style={{ width:"100%",marginTop:8,background:"#fff5f5",border:"1px solid #fecaca",
            color:"#ef4444",borderRadius:10,padding:"9px",fontSize:13,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
          🗑 เคลียร์วันหยุดทั้งหมด
        </button>
      </div>
    </div>
  );
}

// ── Modal ดูกะในวันนั้น (ทุกคน) ──
function ViewDayModal({ date, entries, shiftTypes, isAdmin, onEdit, onClose }) {
  const [d, m, y] = [
    parseInt(date.split("-")[2]),
    parseInt(date.split("-")[1]) - 1,
    parseInt(date.split("-")[0]),
  ];
  const label = `${d} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][m]} ${y+543}`;
  const buddhistKey = `${y+543}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const holiday = THAI_HOLIDAYS[buddhistKey];

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:400,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:holiday?8:16 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>📅 {label}</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>
        {holiday && (
          <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
            padding:"5px 10px",marginBottom:12,fontSize:12,color:"#ef4444",fontWeight:600 }}>
            🎌 {holiday}
          </div>
        )}
        {(()=>{ const activeEntries = entries.filter(e=>!e.isOff); return activeEntries.length===0 ? (
          <div style={{ textAlign:"center",color:"#cbd5e1",padding:"24px 0",fontSize:13 }}>ยังไม่มีกะในวันนี้</div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
            {activeEntries.map((e,i)=>{
              const type = shiftTypes.find(t=>t.id===e.shiftTypeId);
              const COLORS = [
                {bg:"#dbeafe",text:"#1e40af"},{bg:"#d1fae5",text:"#065f46"},
                {bg:"#fde68a",text:"#78350f"},{bg:"#fecaca",text:"#7f1d1d"},
                {bg:"#e9d5ff",text:"#4c1d95"},{bg:"#fed7aa",text:"#7c2d12"},
              ];
              const ci = shiftTypes.findIndex(t=>t.id===e.shiftTypeId) % COLORS.length;
              const c = e.isOff ? {bg:"#f1f5f9",text:"#94a3b8"} : COLORS[Math.max(0,ci)];
              return (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10,
                  padding:"10px 12px",background:c.bg,borderRadius:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:c.text }}>{e.userName}</div>
                    <div style={{ fontSize:12,color:c.text,opacity:.8 }}>
                      {e.isOff ? "หยุด" : type ? `${type.name} · ${type.startTime}–${type.endTime}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ); })()}
        {isAdmin && (
          <button onClick={onEdit} style={{ width:"100%",background:"#2563eb",border:"none",
            color:"#fff",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
            ✎ แก้ไขกะวันนี้
          </button>
        )}
      </div>
    </div>
  );
}

// ── Settings Menu ──
function SettingsMenu({ onClose, onMembers, onSchedule, onTypes }) {
  const items = [
    { icon:"👥", label:"สมาชิกทีม CS", desc:"เลือกและเรียงลำดับสมาชิก", action:onMembers },
    { icon:"📋", label:"วันหยุดประจำ", desc:"กำหนดวันหยุดของแต่ละคน", action:onSchedule },
    { icon:"⚙", label:"จัดการกะ", desc:"เพิ่ม/ลบประเภทกะและเวลา", action:onTypes },
  ];
  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:340,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>⚙ ตั้งค่าตารางกะ</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {items.map(item=>(
            <button key={item.label} onClick={item.action}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,
                cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%" }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>{item.label}</div>
                <div style={{ fontSize:11,color:"#94a3b8",marginTop:1 }}>{item.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal เคลียร์กะ ──
function ClearShiftModal({ year, month, users, daysInMonth, onClose }) {
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(1);
  const [dateTo, setDateTo] = useState(daysInMonth);
  const [selectedUsers, setSelectedUsers] = useState(users.map(u => u.name));
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

  function toggleUser(name) {
    setSelectedUsers(prev =>
      prev.includes(name) ? prev.filter(n=>n!==name) : [...prev, name]
    );
  }

  async function clear() {
    if (dateFrom > dateTo || selectedUsers.length === 0) return;
    if (!confirm(`ยืนยันเคลียร์กะวันที่ ${dateFrom}–${dateTo} ${MONTH_TH[month]} ของ ${selectedUsers.length} คน?`)) return;
    setSaving(true);
    try {
      const { getDocs, collection, query, where, deleteDoc } = await import("firebase/firestore");
      for (let d = dateFrom; d <= dateTo; d++) {
        const m = String(month + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const date = `${year}-${m}-${dd}`;
        for (const name of selectedUsers) {
          const docId = `${date}_${name.replace(/ /g, "_")}`;
          try { await deleteDoc(doc(db,"shifts",docId)); } catch(e) {}
        }
      }
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:420,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"85vh",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>🗑 เคลียร์กะ</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>

        {/* Date range */}
        <div style={{ background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:14 }}>
          <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:8 }}>
            ช่วงวันที่ — {MONTH_TH[month]} {year+543}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>จากวันที่</div>
              <select value={dateFrom} onChange={e=>setDateFrom(Number(e.target.value))}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize:16,color:"#94a3b8",paddingTop:18 }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>ถึงวันที่</div>
              <select value={dateTo} onChange={e=>setDateTo(Number(e.target.value))}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontSize:11,color:"#64748b",marginTop:6 }}>
            จะเคลียร์ {Math.max(0,dateTo-dateFrom+1)} วัน ({dateFrom}–{dateTo} {MONTH_TH[month]})
          </div>
        </div>

        {/* User selection */}
        <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:8 }}>
          เลือกคนที่จะเคลียร์กะ
          <button onClick={()=>setSelectedUsers(users.map(u=>u.name))}
            style={{ background:"none",border:"none",color:"#2563eb",cursor:"pointer",
              fontSize:11,marginLeft:8,fontFamily:"inherit" }}>เลือกทั้งหมด</button>
          <button onClick={()=>setSelectedUsers([])}
            style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",
              fontSize:11,marginLeft:4,fontFamily:"inherit" }}>ล้าง</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:16 }}>
          {users.map(u=>(
            <label key={u.name} style={{ display:"flex",alignItems:"center",gap:10,
              padding:"8px 12px",background:selectedUsers.includes(u.name)?"#fff5f5":"#f8fafc",
              borderRadius:8,border:`1px solid ${selectedUsers.includes(u.name)?"#fecaca":"#e2e8f0"}`,
              cursor:"pointer" }}>
              <input type="checkbox" checked={selectedUsers.includes(u.name)}
                onChange={()=>toggleUser(u.name)}
                style={{ width:16,height:16,accentColor:"#ef4444",cursor:"pointer" }}/>
              <span style={{ fontSize:13,fontWeight:selectedUsers.includes(u.name)?600:400,
                color:"#0f172a" }}>{u.name}</span>
            </label>
          ))}
        </div>

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={clear}
            disabled={saving||dateFrom>dateTo||selectedUsers.length===0}
            style={{ flex:2,background:"#ef4444",border:"none",color:"#fff",borderRadius:10,
              padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:(saving||dateFrom>dateTo||selectedUsers.length===0)?0.5:1 }}>
            {saving?"กำลังเคลียร์…":`เคลียร์กะ ${Math.max(0,dateTo-dateFrom+1)} วัน`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal ลงกะหลายวัน ──
function BulkEditModal({ year, month, users, shiftTypes, userSchedules=[], daysInMonth, onClose }) {
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(1);
  const [dateTo, setDateTo] = useState(daysInMonth);
  const [rows, setRows] = useState(
    users.map(u => ({ userName: u.name, shiftTypeId: "__none" }))
  );
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

  async function save() {
    if (dateFrom > dateTo) return;
    setSaving(true);
    try {
      for (let d = dateFrom; d <= dateTo; d++) {
        const m = String(month + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const date = `${year}-${m}-${dd}`;
        const dayOfWeek = new Date(year, month, d).getDay(); // 0=อา 1=จ ... 6=ส
        for (const row of rows) {
          if (row.shiftTypeId === "__none") continue;
          // เช็ควันหยุดประจำ (รายเดือนก่อน fallback legacy)
          const monthKey = `${year}-${String(month+1).padStart(2,"0")}`;
          const sch = userSchedules.find(s=>s.userName===row.userName && s.monthKey===monthKey)
            || userSchedules.find(s=>s.userName===row.userName && !s.monthKey);
          const offDays = sch?.offDays || [];
          if (offDays.includes(dayOfWeek)) continue; // ข้ามวันหยุด
          const docId = `${date}_${row.userName.replace(/ /g, "_")}`;
          if (row.shiftTypeId === "__off") {
            await setDoc(doc(db,"shifts",docId), { date, userName:row.userName, isOff:true, shiftTypeId:null });
          } else {
            await setDoc(doc(db,"shifts",docId), { date, userName:row.userName, isOff:false, shiftTypeId:row.shiftTypeId });
          }
        }
      }
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:480,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"85vh",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>📆 ลงกะหลายวัน</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>

        {/* Date range */}
        <div style={{ background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
          <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:8 }}>
            ช่วงวันที่ — {MONTH_TH[month]} {year+543}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>จากวันที่</div>
              <select value={dateFrom} onChange={e=>setDateFrom(Number(e.target.value))}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize:16,color:"#94a3b8",paddingTop:18 }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>ถึงวันที่</div>
              <select value={dateTo} onChange={e=>setDateTo(Number(e.target.value))}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none" }}>
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          {dateFrom > dateTo && (
            <div style={{ fontSize:11,color:"#ef4444",marginTop:6 }}>⚠ วันเริ่มต้องน้อยกว่าหรือเท่ากับวันสิ้นสุด</div>
          )}
          <div style={{ fontSize:11,color:"#64748b",marginTop:6 }}>
            จะลงกะ {Math.max(0, dateTo-dateFrom+1)} วัน ({dateFrom}–{dateTo} {MONTH_TH[month]})
          </div>
        </div>

        {/* Per-user shift selection */}
        <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:8 }}>กะของแต่ละคน</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:18 }}>
          {rows.map((row,i) => (
            <div key={row.userName} style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ fontSize:13,fontWeight:600,color:"#0f172a",width:140,flexShrink:0 }}>
                👤 {row.userName}
                {(()=>{
                  const DAY_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
                  const sch = userSchedules.find(s=>s.userName===row.userName);
                  const offDays = sch?.offDays||[];
                  return offDays.length>0 && (
                    <div style={{ fontSize:10,color:"#ef4444",fontWeight:400 }}>
                      หยุด {offDays.sort().map(d=>DAY_TH[d]).join("–")}
                    </div>
                  );
                })()}
              </div>
              <select value={row.shiftTypeId}
                onChange={e=>setRows(r=>r.map((x,j)=>j===i?{...x,shiftTypeId:e.target.value}:x))}
                style={{ flex:1,border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer" }}>
                <option value="__none">— ไม่เปลี่ยน —</option>
                <option value="__off">หยุด</option>
                {shiftTypes.map(t=>(
                  <option key={t.id} value={t.id}>{t.name} ({t.startTime}–{t.endTime})</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,
          padding:"8px 12px",marginBottom:16,fontSize:12,color:"#854d0e" }}>
          💡 เลือก "— ไม่เปลี่ยน —" หมายถึงข้ามคนนั้นไป ไม่แตะข้อมูลเดิม
        </div>

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving||dateFrom>dateTo}
            style={{ flex:2,background:"#2563eb",border:"none",color:"#fff",borderRadius:10,
              padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:(saving||dateFrom>dateTo)?0.5:1 }}>
            {saving?`กำลังบันทึก…`:`บันทึก ${Math.max(0,dateTo-dateFrom+1)} วัน`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal แก้ไขกะในวันนั้น ──
function EditDayModal({ date, entries, users, shiftTypes, onClose }) {
  const [rows, setRows] = useState(
    users.map(u => {
      const existing = entries.find(e => e.userName === u.name);
      return {
        userName: u.name,
        shiftTypeId: existing?.isOff ? "__off" : (existing?.shiftTypeId || "__none"),
      };
    })
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      for (const row of rows) {
        const docId = `${date}_${row.userName.replace(/\s/g,"_")}`;
        if (row.shiftTypeId === "__none") {
          await deleteDoc(doc(db, "shifts", docId));
        } else if (row.shiftTypeId === "__off") {
          await setDoc(doc(db, "shifts", docId), {
            date, userName: row.userName, isOff: true, shiftTypeId: null,
          });
        } else {
          await setDoc(doc(db, "shifts", docId), {
            date, userName: row.userName, isOff: false, shiftTypeId: row.shiftTypeId,
          });
        }
      }
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  const [d, m, y] = [
    parseInt(date.split("-")[2]),
    parseInt(date.split("-")[1]) - 1,
    parseInt(date.split("-")[0]),
  ];
  const label = `${d} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][m]} ${y + 543}`;

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"80vh",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>📅 จัดกะ — {label}</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:18 }}>
          {rows.map((row, i) => (
            <div key={row.userName} style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ fontSize:13,fontWeight:600,color:"#0f172a",width:140,flexShrink:0 }}>
                👤 {row.userName}
              </div>
              <select value={row.shiftTypeId}
                onChange={e => setRows(r => r.map((x,j) => j===i ? {...x,shiftTypeId:e.target.value} : x))}
                style={{ flex:1,border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer" }}>
                <option value="__none">— ไม่มีกะ —</option>
                <option value="__off">หยุด</option>
                {shiftTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.startTime}–{t.endTime})</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex:2,background:"#2563eb",border:"none",
            color:"#fff",borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal จัดการประเภทกะ ──
function ShiftTypeManager({ shiftTypes, onClose }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  async function addType() {
    if (!name.trim() || !start || !end) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "shiftTypes"), {
        name: name.trim(), startTime: start, endTime: end,
        createdAt: new Date().toISOString(),
      });
      setName(""); setStart(""); setEnd("");
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function removeType(id) {
    try { await deleteDoc(doc(db, "shiftTypes", id)); }
    catch(e) { console.error(e); }
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:420,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>⚙ จัดการประเภทกะ</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
        </div>

        {/* รายการกะที่มีอยู่ */}
        <div style={{ marginBottom:16 }}>
          {shiftTypes.length === 0 ? (
            <div style={{ textAlign:"center",color:"#cbd5e1",padding:"16px 0",fontSize:13 }}>ยังไม่มีกะ</div>
          ) : shiftTypes.map((t, i) => {
            const c = getColorForType(i);
            return (
              <div key={t.id} style={{ display:"flex",alignItems:"center",gap:10,
                padding:"8px 10px",background:c.bg,borderRadius:8,marginBottom:6 }}>
                <div style={{ flex:1,fontSize:13,fontWeight:600,color:c.text }}>
                  {t.name}
                </div>
                <div style={{ fontSize:12,color:c.text }}>{t.startTime} – {t.endTime}</div>
                <button onClick={()=>removeType(t.id)}
                  style={{ background:"none",border:"none",color:c.text,cursor:"pointer",
                    fontSize:14,padding:"2px 6px",borderRadius:4 }}>✕</button>
              </div>
            );
          })}
        </div>

        {/* เพิ่มกะใหม่ */}
        <div style={{ borderTop:"1px solid #f1f5f9",paddingTop:14 }}>
          <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:8 }}>เพิ่มกะใหม่</div>
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder="ชื่อกะ เช่น กะเช้า OT"
            style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",
              fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:8,boxSizing:"border-box" }}/>
          <div style={{ display:"flex",gap:8,marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>เริ่ม</div>
              <input type="time" value={start} onChange={e=>setStart(e.target.value)}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,color:"#94a3b8",marginBottom:4 }}>สิ้นสุด</div>
              <input type="time" value={end} onChange={e=>setEnd(e.target.value)}
                style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 10px",
                  fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }}/>
            </div>
          </div>
          <button onClick={addType} disabled={saving||!name.trim()||!start||!end}
            style={{ width:"100%",background:"#2563eb",border:"none",color:"#fff",borderRadius:10,
              padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:(!name.trim()||!start||!end)?0.5:1 }}>
            {saving ? "กำลังเพิ่ม…" : "+ เพิ่มกะ"}
          </button>
        </div>
      </div>
    </div>
  );
}
