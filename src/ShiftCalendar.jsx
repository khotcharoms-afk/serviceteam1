import { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, collection, addDoc } from "firebase/firestore";

const DAY_NAMES = ["อา","จ","อ","พ","พฤ","ศ","ส"];
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

export default function ShiftCalendar({ onBack, currentUser, users, shiftTypes, shifts, userSchedules=[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editDay, setEditDay] = useState(null); // date string "YYYY-MM-DD"
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showScheduleManager, setShowScheduleManager] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const approvedUsers = users.filter(u => u.role !== "pending");

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

  return (
    <div style={{ minHeight:"100vh",background:"#f8fafc",fontFamily:"'Noto Sans Thai',sans-serif" }}>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9",border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:"#475569",fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>📅 ตารางกะ</div>
        <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
          {isAdmin && (
            <button onClick={()=>setShowScheduleManager(true)}
              style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
                padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#475569" }}>
              📋 วันหยุดทีม
            </button>
          )}
          {isAdmin && (
            <button onClick={()=>setShowTypeManager(true)}
              style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
                padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#475569" }}>
              ⚙ จัดการกะ
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
        <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>

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
                    return (
                      <td key={di} onClick={() => isAdmin && setEditDay(dk)}
                        style={{ border:"0.5px solid #f1f5f9",height:90,verticalAlign:"top",
                          padding:4,cursor:isAdmin?"pointer":"default",
                          background:isToday?"#eff6ff":"#fff",
                          transition:"background .15s" }}>
                        <div style={{ fontSize:11,fontWeight:isToday?700:500,
                          color:isToday?"#1d4ed8":"#475569",marginBottom:3,padding:"1px 3px" }}>{day}</div>
                        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                          {dayEntries.map((e, ei) => {
                            if (e.isOff) return (
                              <div key={ei} style={{ background:"#f1f5f9",borderRadius:3,
                                padding:"1px 4px",fontSize:10,color:"#94a3b8",
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {e.userName.split(" ")[0]} · หยุด
                              </div>
                            );
                            const typeIdx = shiftTypes.findIndex(t => t.id === e.shiftTypeId);
                            const c = getColorForType(typeIdx >= 0 ? typeIdx : 0);
                            const type = shiftTypes.find(t => t.id === e.shiftTypeId);
                            const firstName = e.userName.split(" ")[0];
                            return (
                              <div key={ei} style={{ background:c.bg,borderRadius:3,
                                padding:"1px 4px",fontSize:10,color:c.text,
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                {firstName} · {type ? `${type.startTime}–${type.endTime}` : ""}
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
        {isAdmin && (
          <div style={{ textAlign:"center",marginTop:8,fontSize:12,color:"#94a3b8" }}>
            กดที่วันเพื่อจัดกะ
          </div>
        )}
        </div>

        {/* ตารางวันหยุด */}
        <div style={{ width:160,flexShrink:0 }}>
          <div style={{ background:"#1E3A5F",padding:"8px 12px",borderRadius:"12px 12px 0 0",textAlign:"center" }}>
            <span style={{ fontSize:12,fontWeight:700,color:"#fff" }}>ตารางวันหยุด</span>
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
                  const sch = userSchedules.find(s=>s.userName===u.name);
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
      {editDay && (
        <EditDayModal
          date={editDay}
          entries={shiftMap[editDay] || []}
          users={approvedUsers}
          shiftTypes={shiftTypes}
          onClose={() => setEditDay(null)}
        />
      )}

      {showScheduleManager && (
        <ScheduleManager
          users={approvedUsers}
          userSchedules={userSchedules}
          onClose={()=>setShowScheduleManager(false)}
        />
      )}

      {/* Shift Type Manager Modal */}
      {showTypeManager && (
        <ShiftTypeManager
          shiftTypes={shiftTypes}
          onClose={() => setShowTypeManager(false)}
        />
      )}
    </div>
  );
}

// ── Modal จัดการวันหยุดประจำ ──
function ScheduleManager({ users, userSchedules, onClose }) {
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState(
    users.map(u => {
      const existing = userSchedules.find(s=>s.userName===u.name);
      return { userName: u.name, offDays: existing?.offDays||[] };
    })
  );
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
        const docId = sch.userName.replace(/ /g,"_");
        await setDoc(doc(db,"userSchedules",docId), {
          userName: sch.userName, offDays: sch.offDays,
        });
      }
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  }
  const DAY_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:520,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",maxHeight:"80vh",overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div style={{ fontSize:15,fontWeight:700,color:"#0f172a" }}>📋 กำหนดวันหยุดประจำ</div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",width:30,height:30,borderRadius:8,fontSize:14 }}>✕</button>
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
            {saving?"กำลังบันทึก…":"บันทึก"}
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
