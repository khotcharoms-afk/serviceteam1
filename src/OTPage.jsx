import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import OTModal from "./OTModal.jsx";
import * as XLSX from "xlsx";

export default function OTPage({ onBack, projects, users, currentUser }) {
  const [records, setRecords]   = useState([]);
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
    const u = onSnapshot(collection(db, "otRecords"), snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      data.sort((a,b) => (b.dateIn||"").localeCompare(a.dateIn||""));
      setRecords(data);
    });
    return u;
  }, []);

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

    // สร้าง workbook เหมือน template
    const wb = XLSX.utils.book_new();
    const ws = {};
    const merges = [];

    // helper
    const C = (r,c,v,bold,size,align,border) => {
      const addr = XLSX.utils.encode_cell({r,c});
      ws[addr] = { v, t:typeof v==="number"?"n":"s",
        s:{ font:{ bold:bold||false, sz:size||14, name:"Angsana New" },
            alignment:{ horizontal:align||"left", vertical:"center", wrapText:true },
            border: border ? {
              top:{style:"thin"}, bottom:{style:"thin"},
              left:{style:"thin"}, right:{style:"thin"}
            } : undefined } };
    };
    const M = (r1,c1,r2,c2) => merges.push({s:{r:r1,c:c1},e:{r:r2,c:c2}});

    const groupName = filterName !== "all" ? filterName : exportRecords[0]?.name || "";
    const u = users.find(x=>x.name===groupName);
    const periodMonth = filterMonth || (exportRecords[0]?.dateIn||"").slice(0,7) || "";
    const [py,pm] = periodMonth.split("-");
    const periodStart = periodMonth ? `16/${String(parseInt(pm)-1||12).padStart(2,"0")}/${parseInt(py)+543}` : "";
    const periodEnd = periodMonth ? `15/${pm}/${parseInt(py)+543}` : "";

    // Row 0: ชื่อบริษัท
    C(0,0,"บริษัท เมทเธียร์ จำกัด", true, 20, "left");
    M(0,0,0,20);

    // Row 1: ชื่อใบ
    C(1,0,"ใบเบิกค่าล่วงเวลา (OT) และค่าเบี้ยเลี้ยง", true, 20, "left");
    M(1,0,1,20);

    // Row 2: ชื่อพนักงาน
    C(2,0,`ชื่อพนักงานผู้ขอเบิก .................${groupName}...............................................................  รหัสพนักงาน .....................  ตำแหน่ง ..........................  แผนก ..........................  ฝ่าย ...........................`, true, 16, "left");
    M(2,0,2,20);

    // Row 3: รอบการปฏิบัติงาน
    C(3,0,`การปฏิบัติงาน (ตามรอบวันที่ 16 เดือนก่อนหน้า ถึงวันที่ 15 เดือนปัจจุบัน) ตั้งแต่วันที่ ....${periodStart}............ ถึงวันที่ ...${periodEnd}........... เบิกประจำงวดเดือน .................. ปี ................`, true, 16, "left");
    M(3,0,3,20);

    // Row 4
    C(4,0,"ขออนุมัติเบิกค่าปฏิบัติงานนอกเวลา (OT) และ/หรือ ค่าเบี้ยเลี้ยง โดยมีรายละเอียดการขอเบิกเป็นดังนี้", true, 16, "left");
    M(4,0,4,20);

    // Row 5: empty
    // Row 6: header
    const hdrs = ["No","Start Date","End Date","Project No.","Project Name (ระบุ)","Description","Location","Group","Division","Position","ค่านอกเวลา (OT)\n(ชั่วโมง)","ค่าเบี้ยเลี้ยง\n(บาท)","*1","*1.5","*2","*3","ผู้บังคับบัญชา","Staff","หมายเหตุ"];
    hdrs.forEach((h,i) => C(6,i,h,true,14,"center",true));
    M(6,0,7,0); M(6,1,7,1); M(6,2,7,2); M(6,3,7,3); M(6,4,7,4);
    M(6,5,7,5); M(6,6,7,6); M(6,7,7,7); M(6,8,7,8); M(6,9,7,9);
    M(6,12,7,12); M(6,13,7,13); M(6,14,7,14); M(6,15,7,15);
    M(6,16,7,16); M(6,17,7,17); M(6,18,7,18);
    // row 7 ย่อย K,L
    C(7,10,"ค่านอกเวลา (OT)\n(ชั่วโมง)",true,14,"center",true);
    C(7,11,"ค่าเบี้ยเลี้ยง\n(บาท)",true,14,"center",true);

    // data rows start at row 8
    exportRecords.forEach((r,i) => {
      const row = 8 + i;
      C(row,0,i+1,false,14,"center",true);
      C(row,1,`${r.dateIn||""} ${r.timeIn||""}`,false,14,"center",true);
      C(row,2,`${r.dateOut||r.dateIn||""} ${r.timeOut||""}`,false,14,"center",true);
      C(row,3,r.projectCode||"",false,14,"left",true);
      C(row,4,r.projectName||"",false,14,"left",true);
      C(row,5,r.desc||"",false,14,"left",true);
      C(row,6,r.location||"",false,14,"left",true);
      C(row,7,"PS",false,14,"center",true);
      C(row,8,"PS",false,14,"center",true);
      C(row,9,"เจ้าหน้าที่บริการลูกค้า",false,14,"left",true);
      C(row,10,r.hours||0,false,14,"center",true);
      C(row,11,"",false,14,"center",true);
      C(row,12,"",false,14,"center",true);
      C(row,13,"",false,14,"center",true);
      C(row,14,"",false,14,"center",true);
      C(row,15,"",false,14,"center",true);
      C(row,16,"",false,14,"center",true);
      C(row,17,groupName,false,14,"center",true);
      C(row,18,r.remark||"",false,14,"center",true);
    });

    // รวม row
    const sumRow = 8 + exportRecords.length;
    C(sumRow,0,"รวม",true,14,"center",true);
    M(sumRow,0,sumRow,9);
    C(sumRow,10,totalHours,true,14,"center",true);

    // ลายเซ็น rows
    const sigRow = sumRow + 3;
    C(sigRow,0,"พนักงาน (ผู้ขอเบิก)",true,14,"center");
    M(sigRow,0,sigRow,4);
    C(sigRow,5,"ผู้บังคับบัญชาต้นสังกัด(ผู้อนุมัติ)",true,14,"center");
    M(sigRow,5,sigRow,7);
    C(sigRow,8,"แผนกทรัพยากรบุคคลและธุรการ(ผู้ตรวจสอบ)",true,14,"center");
    M(sigRow,8,sigRow,13);

    C(sigRow+2,0,".................................................................",false,14,"center");
    M(sigRow+2,0,sigRow+2,4);
    C(sigRow+2,5,".................................................................",false,14,"center");
    M(sigRow+2,5,sigRow+2,7);
    C(sigRow+2,8,".................................................................",false,14,"center");
    M(sigRow+2,8,sigRow+2,13);

    C(sigRow+3,0,`( ${groupName} )`,true,14,"center");
    M(sigRow+3,0,sigRow+3,4);
    C(sigRow+3,5,"(                              )",true,14,"center");
    M(sigRow+3,5,sigRow+3,7);

    C(sigRow+4,0,`วันที่.................................................`,true,14,"center");
    M(sigRow+4,0,sigRow+4,4);
    C(sigRow+4,5,"วันที่..................................................",true,14,"center");
    M(sigRow+4,5,sigRow+4,7);
    C(sigRow+4,8,"วันที่..................................................",true,14,"center");
    M(sigRow+4,8,sigRow+4,13);

    ws["!merges"] = merges;
    ws["!ref"] = XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:sigRow+5,c:18}});
    ws["!cols"] = [
      {wch:5},{wch:22},{wch:22},{wch:15},{wch:40},
      {wch:35},{wch:15},{wch:10},{wch:8},{wch:20},
      {wch:12},{wch:12},{wch:6},{wch:6},{wch:6},{wch:6},
      {wch:14},{wch:14},{wch:25}
    ];

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

        {/* KPI */}
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:16 }}>
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
        </div>

        {/* Filters */}
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
