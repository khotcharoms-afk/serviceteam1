import { useTheme } from "./theme.js";

const tint = (hex, a = "22") => `${hex}${a}`;

export default function ImportModal({
  // Project import
  importModal, setImportModal,
  importRows, importSelected, setImportSelected,
  doImport, saving, projects,
  // Case import
  importCaseModal, setImportCaseModal,
  importCaseRows, importCaseSel, setImportCaseSel,
  doImportCases, cases,
}) {
  const { c } = useTheme();
  return (<>
    {/* ── Import เคส ── */}
    {importCaseModal && (
      <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
        onClick={()=>setImportCaseModal(false)}>
        <div style={{ background:c.card,borderRadius:16,width:"100%",maxWidth:600,
          maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.35)",padding:24 }}
          onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:c.text900 }}>
              📋 Import เคส ({importCaseRows.length} รายการ)
            </h2>
            <button onClick={()=>setImportCaseModal(false)}
              style={{ background:c.borderSoft,border:"none",color:c.text500,cursor:"pointer",
                fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
          </div>
          <div style={{ fontSize:12,color:c.text500,marginBottom:12 }}>
            เลือกเคสที่ต้องการ import — โครงการจะจับคู่อัตโนมัติจากชื่อ
          </div>
          {(()=>{
            const dupCount = importCaseRows.filter(r=>{
              const proj=projects.find(p=>p.name?.toLowerCase().includes(r.projectName?.toLowerCase())||r.projectName?.toLowerCase().includes(p.name?.toLowerCase()));
              const key=`${(r.title||"").trim().toLowerCase()}|${(proj?.id||"").trim()}|${(r.date||"").slice(0,10)}`;
              return (cases||[]).some(c=>`${(c.title||"").trim().toLowerCase()}|${(c.projectId||"").trim()}|${(c.date||"").slice(0,10)}`===key);
            }).length;
            return dupCount>0 && (
              <div style={{ background:tint(c.red,"14"),border:`1px solid ${tint(c.red,"55")}`,borderRadius:8,
                padding:"8px 12px",marginBottom:12,fontSize:12,color:c.red }}>
                ⚠️ พบ {dupCount} รายการที่มีอยู่ในระบบแล้ว
              </div>
            );
          })()}
          <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
            <button onClick={()=>{ const s={}; importCaseRows.forEach(r=>s[r.key]=true); setImportCaseSel(s); }}
              style={{ background:tint(c.blue,"14"),border:`1px solid ${tint(c.blue,"55")}`,color:c.blue,
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              เลือกทั้งหมด
            </button>
            <button onClick={()=>setImportCaseSel({})}
              style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิกทั้งหมด
            </button>
            <button onClick={()=>{
              const s={};
              importCaseRows.forEach(r=>{
                const proj=projects.find(p=>p.name?.toLowerCase().includes(r.projectName?.toLowerCase())||r.projectName?.toLowerCase().includes(p.name?.toLowerCase()));
                const key=`${(r.title||"").trim().toLowerCase()}|${(proj?.id||"").trim()}|${(r.date||"").slice(0,10)}`;
                const isDup=(cases||[]).some(c=>`${(c.title||"").trim().toLowerCase()}|${(c.projectId||"").trim()}|${(c.date||"").slice(0,10)}`===key);
                s[r.key]=!isDup;
              });
              setImportCaseSel(s);
            }} style={{ background:tint(c.orange,"14"),border:`1px solid ${tint(c.orange,"55")}`,color:c.orange,
              borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ✕ ไม่เลือกรายการซ้ำ
            </button>
            <span style={{ marginLeft:"auto",fontSize:12,color:c.text500,alignSelf:"center" }}>
              เลือกแล้ว {Object.values(importCaseSel).filter(Boolean).length} รายการ
            </span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:16 }}>
            {importCaseRows.map(r => {
              const proj = projects.find(p => p.name?.toLowerCase().includes(r.projectName?.toLowerCase()) || r.projectName?.toLowerCase().includes(p.name?.toLowerCase()));
              const dupKey = `${(r.title||"").trim().toLowerCase()}|${(proj?.id||"").trim()}|${(r.date||"").slice(0,10)}`;
              const isDupCase = (cases||[]).some(c=>`${(c.title||"").trim().toLowerCase()}|${(c.projectId||"").trim()}|${(c.date||"").slice(0,10)}`===dupKey);
              return (
                <label key={r.key} style={{ display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
                  padding:"8px 10px",borderRadius:8,
                  background:isDupCase?tint(c.red,"14"):importCaseSel[r.key]?tint(c.green,"14"):c.bg,
                  border:`1px solid ${isDupCase?tint(c.red,"55"):importCaseSel[r.key]?tint(c.green,"55"):c.border}` }}>
                  <input type="checkbox" checked={!!importCaseSel[r.key]}
                    onChange={e=>setImportCaseSel(p=>({...p,[r.key]:e.target.checked}))}
                    style={{ marginTop:2,accentColor:c.green,flexShrink:0 }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:13,fontWeight:600,color:isDupCase?c.red:c.text900,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.title}</span>
                      {isDupCase && <span style={{ fontSize:10,background:tint(c.red,"22"),color:c.red,
                        border:`1px solid ${tint(c.red,"55")}`,borderRadius:4,padding:"1px 6px",flexShrink:0,fontWeight:700 }}>ซ้ำ</span>}
                    </div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:2 }}>
                      {r.site&&<span style={{ fontSize:11,color:c.text500 }}>📍 {r.site}</span>}
                      {proj ? <span style={{ fontSize:11,color:proj.color||c.blue,fontWeight:600 }}>◆ {proj.name}</span>
                        : <span style={{ fontSize:11,color:c.amber }}>⚠ ไม่พบโครงการ: {r.projectName}</span>}
                      <span style={{ fontSize:11,color:c.text500 }}>{r.date}</span>
                      <span style={{ fontSize:11,color:c.text500 }}>{r.type}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
            <button onClick={()=>setImportCaseModal(false)}
              style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
                borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิก
            </button>
            <button onClick={doImportCases} disabled={saving||Object.values(importCaseSel).filter(Boolean).length===0}
              style={{ background:c.green,border:"none",color:"#fff",borderRadius:10,
                padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                opacity:saving?0.7:1 }}>
              {saving?"กำลัง import...":`Import ${Object.values(importCaseSel).filter(Boolean).length} เคส`}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Import โครงการ ── */}
    {importModal && (
      <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
        onClick={()=>setImportModal(false)}>
        <div style={{ background:c.card,borderRadius:16,width:"100%",maxWidth:600,
          maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.35)",padding:"24px" }}
          onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:c.text900 }}>
              📥 Import โครงการ ({importRows.length} รายการ)
            </h2>
            <button onClick={()=>setImportModal(false)}
              style={{ background:c.borderSoft,border:"none",color:c.text500,cursor:"pointer",
                fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
          </div>
          <div style={{ fontSize:12,color:c.text500,marginBottom:12 }}>
            เลือกโครงการที่ต้องการ import — กดเลือกทั้งหมดหรือเลือกทีละรายการ
          </div>
          {(()=>{
            const dupCount = importRows.filter(r=>
              projects.some(p=>(p.name||"").trim().toLowerCase()===(r.name||"").trim().toLowerCase() ||
                (r.code && (p.code||"").trim().toLowerCase()===(r.code||"").trim().toLowerCase()))
            ).length;
            return dupCount>0 && (
              <div style={{ background:tint(c.red,"14"),border:`1px solid ${tint(c.red,"55")}`,borderRadius:8,
                padding:"8px 12px",marginBottom:12,fontSize:12,color:c.red }}>
                ⚠️ พบ {dupCount} รายการที่มีอยู่ในระบบแล้ว (ชื่อหรือรหัสโครงการตรงกัน)
              </div>
            );
          })()}
          <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
            <button onClick={()=>{ const s={}; importRows.forEach(r=>s[r.key]=true); setImportSelected(s); }}
              style={{ background:tint(c.blue,"14"),border:`1px solid ${tint(c.blue,"55")}`,color:c.blue,
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              เลือกทั้งหมด
            </button>
            <button onClick={()=>setImportSelected({})}
              style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิกทั้งหมด
            </button>
            <button onClick={()=>{
              const s={};
              importRows.forEach(r=>{
                const isDup=projects.some(p=>(p.name||"").trim().toLowerCase()===(r.name||"").trim().toLowerCase()||
                  (r.code&&(p.code||"").trim().toLowerCase()===(r.code||"").trim().toLowerCase()));
                s[r.key]=!isDup;
              });
              setImportSelected(s);
            }} style={{ background:tint(c.orange,"14"),border:`1px solid ${tint(c.orange,"55")}`,color:c.orange,
              borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ✕ ไม่เลือกรายการซ้ำ
            </button>
            <span style={{ marginLeft:"auto",fontSize:12,color:c.text500,alignSelf:"center" }}>
              เลือกแล้ว {Object.values(importSelected).filter(Boolean).length} รายการ
            </span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:16 }}>
            {importRows.map(r => {
              const isDup = projects.some(p=>
                (p.name||"").trim().toLowerCase()===(r.name||"").trim().toLowerCase() ||
                (r.code && (p.code||"").trim().toLowerCase()===(r.code||"").trim().toLowerCase())
              );
              return (
                <label key={r.key} style={{ display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
                  padding:"8px 10px",borderRadius:8,
                  background:isDup?tint(c.red,"14"):importSelected[r.key]?tint(c.green,"14"):c.bg,
                  border:`1px solid ${isDup?tint(c.red,"55"):importSelected[r.key]?tint(c.green,"55"):c.border}` }}>
                  <input type="checkbox" checked={!!importSelected[r.key]}
                    onChange={e=>setImportSelected(p=>({...p,[r.key]:e.target.checked}))}
                    style={{ marginTop:2,accentColor:c.green,flexShrink:0 }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                      <span style={{ fontSize:13,fontWeight:600,color:isDup?c.red:c.text900 }}>{r.name}</span>
                      {isDup && <span style={{ fontSize:10,background:tint(c.red,"22"),color:c.red,
                        borderRadius:20,padding:"1px 7px",fontWeight:700 }}>มีอยู่แล้ว</span>}
                    </div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:2 }}>
                      {r.code && <span style={{ fontSize:11,color:c.text500 }}>{r.code}</span>}
                      {r.customer && <span style={{ fontSize:11,color:c.text500 }}>👤 {r.customer}</span>}
                      {r.contractType && <span style={{ fontSize:11,
                        color:r.contractType==="เช่า"?c.purple:r.contractType==="ขายขาด"?c.green:c.blue,
                        fontWeight:600 }}>{r.contractType}</span>}
                      {r.warrantyEnd && <span style={{ fontSize:11,color:c.text500 }}>🛡 {r.warrantyEnd}</span>}
                      {r.projectStatus && <span style={{ fontSize:11,color:c.text500 }}>{r.projectStatus}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
            <button onClick={()=>setImportModal(false)}
              style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
                borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิก
            </button>
            <button onClick={doImport} disabled={saving||Object.values(importSelected).filter(Boolean).length===0}
              style={{ background:c.green,border:"none",color:"#fff",borderRadius:10,
                padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                opacity:saving?0.7:1 }}>
              {saving?"กำลัง import...":`Import ${Object.values(importSelected).filter(Boolean).length} โครงการ`}
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
