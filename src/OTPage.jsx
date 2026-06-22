import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import OTModal from "./OTModal.jsx";
import * as XLSX from "xlsx";

export default function OTPage({ onBack, projects, users, currentUser }) {
  const [tab, setTab]           = useState("list");
  const [records, setRecords]   = useState([]);
  const [profile, setProfile]   = useState({ name:"", empId:"", position:"", dept:"", division:"", supervisor:"" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  const [filterName, setFilterName] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    // โหลด profile ของ user นี้
    const uid = currentUser?.id || currentUser?.uid;
    if (uid) {
      getDoc(doc(db,"otProfiles",uid)).then(d => {
        if (d.exists()) setProfile(d.data());
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const u = onSnapshot(collection(db, "otRecords"), snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      data.sort((a,b) => (b.dateIn||"").localeCompare(a.dateIn||""));
      setRecords(data);
    });
    return u;
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    const uid = currentUser?.id || currentUser?.uid;
    await setDoc(doc(db,"otProfiles",uid), { ...profile, updatedAt: new Date().toISOString() });
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function saveOT(data, id) {
    setSaving(true);
    const docId = id || Date.now().toString();
    await setDoc(doc(db, "otRecords", docId), data, { merge: true });
    setSaving(false);
    setShowModal(false);
    setEditRecord(null);
  }

  async function deleteOT(id) {
    await deleteDoc(doc(db, "otRecords", id));
    setConfirmId(null);
  }

  // filter
  const myRecords = isAdmin ? records : records.filter(r => r.createdBy === currentUser?.id);
  const filtered = myRecords.filter(r => {
    if (filterName !== "all" && r.name !== filterName) return false;
    if (filterMonth && !(r.dateIn||"").startsWith(filterMonth)) return false;
    return true;
  });
  const names = [...new Set(myRecords.map(r=>r.name).filter(Boolean))].sort();
  const totalHours = filtered.reduce((s,r) => s+(r.hours||0), 0);

  // months list
  const months = [...new Set(myRecords.map(r=>(r.dateIn||"").slice(0,7)).filter(Boolean))].sort().reverse();
  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const fmtMonth = m => { const [y,mo]=m.split("-"); return `${MONTH_TH[parseInt(mo)-1]} ${(parseInt(y)+543)%100}`; };
  const fmtDate = d => { if(!d) return ""; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${parseInt(y)+543}`; };

  function exportExcel() {
    const exportRecords = filtered.length > 0 ? filtered : myRecords;
    if (exportRecords.length === 0) return;

    const wb = XLSX.utils.book_new();
    const ws = {};
    const merges = [];

    const C = (r,c,v,bold,sz,align,border) => {
      const addr = XLSX.utils.encode_cell({r,c});
      const bt = {style:"thin"};
      ws[addr] = { v, t:typeof v==="number"?"n":"s",
        s:{ font:{bold:!!bold, sz:sz||20, name:"Angsana New"},
            alignment:{horizontal:align||"left",vertical:"center",wrapText:true},
            border: border?{top:bt,bottom:bt,left:bt,right:bt}:undefined }};
    };
    const M = (r1,c1,r2,c2) => merges.push({s:{r:r1,c:c1},e:{r:r2,c:c2}});

    const groupName = filterName!=="all" ? filterName : profile.name || exportRecords[0]?.name||"";
    const periodMonth = filterMonth||(exportRecords[0]?.dateIn||"").slice(0,7)||"";
    const [py,pm] = (periodMonth||"-").split("-");
    const prevPm = parseInt(pm)-1||12;
    const prevPy = prevPm===12 ? parseInt(py)-1 : parseInt(py);
    const periodStart = periodMonth ? `16/${String(prevPm).padStart(2,"0")}/${prevPy+543}` : "";
    const periodEnd   = periodMonth ? `15/${pm}/${parseInt(py)+543}` : "";

    // Row 1-2: ชื่อบริษัท + ชื่อใบ
    C(0,0,"บริษัท เมทเธียร์ จำกัด",true,20,"left"); M(0,0,0,20);
    C(1,0,"ใบเบิกค่าล่วงเวลา (OT) และค่าเบี้ยเลี้ยง",true,20,"left"); M(1,0,1,20);

    // Row 3: ชื่อพนักงาน (A3:O3)
    C(2,0,`ชื่อพนักงานผู้ขอเบิก .................${groupName}...............................................................  รหัสพนักงาน ........${profile.empId||""}...............  ตำแหน่ง .......${profile.position||""}......................................  แผนก ..................${profile.dept||""}..........................  ฝ่าย ................${profile.division||""}..............................`,true,20,"left");
    M(2,0,2,14);

    // Row 4: รอบ (A4:O4)
    C(3,0,`การปฏิบัติงาน (ตามรอบวันที่ 16 เดือนก่อนหน้า ถึงวันที่ 15 เดือนปัจจุบัน) ตั้งแต่วันที่ ....${periodStart}.................... ถึงวันที่ ...${periodEnd}.................. เบิกประจำงวดเดือน .................. ปี ................`,true,18,"left");
    M(3,0,3,14);

    // Row 5: คำขอ (A5:N5)
    C(4,0,"ขออนุมัติเบิกค่าปฏิบัติงานนอกเวลา (OT) และ/หรือ ค่าเบี้ยเลี้ยง โดยมีรายละเอียดการขอเบิกเป็นดังนี้",true,20,"left");
    M(4,0,4,13);

    // Row 6: empty row

    // Row 7-8: Header (index 6-7)
    // A-J: single cols merge row 7-8
    const hdCols = ["No","Start Date","End Date","Project No.","Project Name (ระบุ)","Description","Location","Group","Division","Position"];
    hdCols.forEach((h,i)=>{ C(6,i,h,true,20,"center",true); M(6,i,7,i); });
    // K7:L7 = "รายการที่ขอเบิก"
    C(6,10,"รายการที่ขอเบิก",true,20,"center",true); M(6,10,6,11);
    // K8, L8
    C(7,10,"ค่านอกเวลา (OT)\n(ชั่วโมง)",true,20,"center",true);
    C(7,11,"ค่าเบี้ยเลี้ยง\n(บาท)",true,20,"center",true);
    // M-R: merge row 7-8
    [["*1",12],["*1.5",13],["*2",14],["*3",15],["ผู้บังคับบัญชา",16],["Staff",17]].forEach(([h,i])=>{
      C(6,i,h,true,20,"center",true); M(6,i,7,i);
    });
    // S7:U8 = "หมายเหตุ"
    C(6,18,"หมายเหตุ",true,20,"center",true); M(6,18,7,20);

    // Data rows: start row 9 (index 8), fixed rows 9-26 (18 rows)
    const MAX_DATA_ROWS = 18;
    for (let i=0; i<MAX_DATA_ROWS; i++) {
      const row = 8 + i;
      const r = exportRecords[i];
      if (r) {
        C(row,0,i+1,false,20,"center",true);
        C(row,1,`${r.dateIn||""} ${r.timeIn||""}`,false,20,"center",true);
        C(row,2,`${r.dateOut||r.dateIn||""} ${r.timeOut||""}`,false,20,"center",true);
        C(row,3,r.projectCode||"",false,20,"left",true);
        C(row,4,r.projectName||"",false,20,"left",true);
        C(row,5,r.desc||"",false,20,"left",true);
        C(row,6,r.location||"",false,20,"left",true);
        C(row,7,"PS",false,20,"center",true);
        C(row,8,"PS",false,20,"center",true);
        C(row,9,"เจ้าหน้าที่บริการลูกค้า",false,20,"left",true);
        C(row,10,r.hours||0,false,20,"center",true);
        C(row,11,"",false,20,"center",true);
        [12,13,14,15].forEach(c=>C(row,c,"",false,20,"center",true));
        C(row,16,"",false,20,"center",true);
        C(row,17,groupName,false,20,"center",true);
        C(row,18,r.remark||"",false,20,"center",true);
        M(row,18,row,20);
      } else {
        // empty rows
        [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].forEach(c=>C(row,c,"",false,20,"center",true));
        M(row,18,row,20);
      }
    }

    // Row 27 (index 26): รวม — A27:J27 merge
    C(26,0,"รวม",true,20,"center",true); M(26,0,26,9);
    C(26,10,exportRecords.reduce((s,r)=>s+(r.hours||0),0),true,20,"center",true);

    // Rows 28-29: empty
    // Row 30 (index 29): ลายเซ็น header
    C(29,0,"พนักงาน (ผู้ขอเบิก)",true,20,"center"); M(29,0,29,4);
    C(29,5,"ผู้บังคับบัญชาต้นสังกัด(ผู้อนุมัติ)",true,20,"center"); M(29,5,29,7);
    C(29,8,"แผนกทรัพยากรบุคคลและธุรการ(ผู้ตรวจสอบ)",true,20,"center"); M(29,8,29,13);
    C(29,14,"ความหมายของประเภทการจ่าย OT/ข้อกำหนด",true,20,"center"); M(29,14,29,20);

    // Row 31 (index 30)
    C(30,14,"  ชั่วโมง OT : การปฏิบัติงานในวันหยุด ช่วงเวลา 9.00-18.00 น.",true,20,"left"); M(30,14,30,20);

    // Row 32 (index 31): เส้น
    C(31,0,"............................................................",false,20,"center"); M(31,0,31,4);
    C(31,5,"............................................................",false,20,"center"); M(31,5,31,7);
    C(31,8,"............................................................",false,20,"center"); M(31,8,31,13);
    C(31,14,"   ชั่วโมง OT : การปฏิบัติงานในวันทำงาน ช่วงเวลาก่อนหรือหลังเวลา 9.00-18.00 น.",true,20,"left"); M(31,14,31,20);

    // Row 33 (index 32): ชื่อ
    C(32,0,`( ...........${groupName}............. )`,true,20,"center");
    C(32,5,`( ${profile.supervisor||"                              "} )`,true,20,"center"); M(32,0,32,4);
    M(32,5,32,7);
    C(32,8,"(                                                                                    )",false,20,"center"); M(32,8,32,13);
    C(32,14,"   ชั่วโมง OT : การปฏิบัติงานในวันหยุดช่วงเวลาก่อนหรือหลังเวลา 9.00-18.00 น.",true,20,"left"); M(32,14,32,20);

    // Row 34 (index 33): วันที่
    const todayTH = (()=>{ const d=new Date(); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`; })();
    C(33,0,`วันที่.............${todayTH}................................`,true,20,"center"); M(33,0,33,4);
    C(33,5,`วันที่.............${todayTH}................................`,true,20,"center"); M(33,5,33,7);
    C(33,8,"วันที่................................................",true,20,"center"); M(33,8,33,13);
    C(33,14,"   ข้อกำหนด : หน่วยชั่วโมงย่อยสุดของการเบิก OT = 0.5 ชั่วโมง",true,20,"left"); M(33,14,33,20);

    ws["!merges"] = merges;
    ws["!ref"] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:34,c:20}});
    ws["!cols"] = [
      {wch:5},{wch:22},{wch:22},{wch:15},{wch:45},
      {wch:35},{wch:15},{wch:10},{wch:8},{wch:22},
      {wch:13},{wch:13},{wch:6},{wch:6},{wch:6},{wch:6},
      {wch:14},{wch:14},{wch:8},{wch:8},{wch:12}
    ];
    ws["!rows"] = Array(35).fill(null).map((_,i)=>({hpt: i===0||i===1?21:i===3?26:i>=8&&i<=25?32:i===6?18:i===7?44:21}));

    XLSX.utils.book_append_sheet(wb, ws, "OT");
    XLSX.writeFile(wb, `OT_${groupName}_${periodMonth||"all"}.xlsx`);
  }

  const inputStyle = { border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 10px",
    fontSize:12,fontFamily:"inherit",background:"#f8fafc",outline:"none" };

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
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>⏰ บันทึก OT</div>
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
          <button onClick={exportExcel}
            style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",
              borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            📥 Export Excel
          </button>
          <button onClick={()=>{ setEditRecord(null); setShowModal(true); }}
            style={{ background:"#F97316",border:"none",color:"#fff",borderRadius:8,
              padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            + บันทึก OT
          </button>
        </div>
      </div>

      <div style={{ padding:isMobile?"12px 14px 48px":"16px 20px 48px",maxWidth:1100,margin:"0 auto" }}>

        {/* Tab bar */}
        <div style={{ display:"flex",gap:6,marginBottom:16,background:"#fff",border:"1px solid #e2e8f0",
          borderRadius:10,padding:6 }}>
          {[{key:"list",label:"📋 รายการ"},{key:"profile",label:"👤 โปรไฟล์"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{ flex:1,padding:"7px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",
                background:tab===t.key?"#F97316":"transparent",
                color:tab===t.key?"#fff":"#64748b" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab==="profile" && (
          <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"20px 20px" }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:4 }}>โปรไฟล์ OT ของฉัน</div>
            <div style={{ fontSize:12,color:"#64748b",marginBottom:16 }}>ข้อมูลนี้จะถูกใส่ใน Excel หน้าปก OT อัตโนมัติ</div>
            {[
              { key:"name",       label:"ชื่อ-นามสกุล (ภาษาไทย) *", placeholder:"เช่น นายสายัญห์ คชรมย์" },
              { key:"empId",      label:"รหัสพนักงาน",                placeholder:"เช่น MT260101" },
              { key:"position",   label:"ตำแหน่ง",                   placeholder:"เช่น เจ้าหน้าที่บริการลูกค้า" },
              { key:"dept",       label:"แผนก",                      placeholder:"เช่น ศูนย์บริการ" },
              { key:"division",   label:"ฝ่าย",                      placeholder:"เช่น โครงการและการจัดการบริการ" },
              { key:"supervisor", label:"ชื่อผู้บังคับบัญชา",        placeholder:"เช่น นายณัฐพงศ์ รัตนไชย" },
            ].map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",
                  letterSpacing:.5,marginBottom:4,display:"block" }}>{f.label}</label>
                <input value={profile[f.key]||""} placeholder={f.placeholder}
                  onChange={e=>setProfile(p=>({...p,[f.key]:e.target.value}))}
                  style={{ width:"100%",border:"1px solid #e2e8f0",borderRadius:8,
                    padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
              </div>
            ))}
            <button onClick={saveProfile} disabled={profileSaving||!profile.name?.trim()}
              style={{ width:"100%",background:profileSaved?"#16a34a":"#F97316",border:"none",color:"#fff",
                borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                opacity:!profile.name?.trim()?0.5:1,marginTop:4 }}>
              {profileSaving?"กำลังบันทึก...":profileSaved?"✅ บันทึกแล้ว":"💾 บันทึกโปรไฟล์"}
            </button>
          </div>
        )}

        {/* KPI */}
        {tab==="list" && <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:16 }}>
          {[
            { label:"รายการทั้งหมด", val:filtered.length, color:"#F97316" },
            { label:"ชั่วโมง OT รวม", val:`${totalHours} ชม.`, color:"#6B21A8" },
            { label:"เฉลี่ยต่อครั้ง", val:`${filtered.length>0?(totalHours/filtered.length).toFixed(1):0} ชม.`, color:"#16a34a" },
          ].map(k=>(
            <div key={k.label} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px" }}>
              <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:20,fontWeight:800,color:k.color }}>{k.val}</div>
            </div>
          ))}
        </div>}

        {/* Filters — เฉพาะ tab รายการ */}
        {tab==="list" && <>
        <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
          padding:"12px 16px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          {isAdmin && (
            <select value={filterName} onChange={e=>setFilterName(e.target.value)} style={inputStyle}>
              <option value="all">ทุกคน</option>
              {names.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={inputStyle}>
            <option value="">ทุกเดือน</option>
            {months.map(m=><option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
          {(filterName!=="all"||filterMonth) && (
            <button onClick={()=>{ setFilterName("all"); setFilterMonth(""); }}
              style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>
              ล้าง
            </button>
          )}
        </div>

        {/* Records */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center",color:"#cbd5e1",padding:48,fontSize:14 }}>
            ยังไม่มีข้อมูล OT
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {filtered.map(r => {
              const proj = projects.find(p=>p.id===r.projectId);
              return (
                <div key={r.id} style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
                  padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start" }}>
                  <div style={{ width:44,height:44,borderRadius:10,background:"#fff7ed",
                    border:"1px solid #fed7aa",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:20,flexShrink:0 }}>⏰</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{r.name}</span>
                      <span style={{ fontSize:13,fontWeight:700,color:"#F97316" }}>{r.hours} ชม.</span>
                    </div>
                    {proj && (
                      <div style={{ fontSize:12,color:"#64748b",display:"flex",alignItems:"center",gap:5,marginBottom:3 }}>
                        <span style={{ width:8,height:8,borderRadius:"50%",background:proj.color||"#94a3b8" }}/>
                        {proj.name}
                      </div>
                    )}
                    <div style={{ fontSize:12,color:"#475569",marginBottom:3 }}>{r.desc}</div>
                    <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                      <span style={{ fontSize:11,color:"#94a3b8" }}>📅 {fmtDate(r.dateIn)} {r.timeIn} - {r.timeOut}</span>
                      {r.location && <span style={{ fontSize:11,color:"#94a3b8" }}>📍 {r.location}</span>}
                      <span style={{ fontSize:11,color:"#94a3b8" }}>{r.remark}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                    <button onClick={()=>{ setEditRecord(r); setShowModal(true); }}
                      style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                        borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>✏️</button>
                    {isAdmin && (
                      <button onClick={()=>setConfirmId(r.id)}
                        style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                          borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>🗑</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}
      </div>

      {/* Confirm delete */}
      {confirmId && (
        <div style={{ position:"fixed",inset:0,zIndex:700,background:"rgba(15,23,42,.5)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:16,padding:24,maxWidth:320,width:"100%",
            textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:32,marginBottom:12 }}>🗑</div>
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:8 }}>ลบรายการ OT นี้?</div>
            <div style={{ fontSize:13,color:"#64748b",marginBottom:20 }}>ไม่สามารถกู้คืนได้</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <button onClick={()=>setConfirmId(null)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={()=>deleteOT(confirmId)}
                style={{ background:"#ef4444",border:"none",color:"#fff",
                  borderRadius:10,padding:"10px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <OTModal onClose={()=>{ setShowModal(false); setEditRecord(null); }}
          onSave={saveOT} saving={saving}
          projects={projects} users={users} currentUser={currentUser}
          editRecord={editRecord}/>
      )}
    </div>
  );
}
