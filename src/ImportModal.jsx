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
  return (<>
    {/* ── Import เคส ── */}
    {importCaseModal && (
      <div style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(15,23,42,.5)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
        onClick={()=>setImportCaseModal(false)}>
        <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:600,
          maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:24 }}
          onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
              📋 Import เคส ({importCaseRows.length} รายการ)
            </h2>
            <button onClick={()=>setImportCaseModal(false)}
              style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
                fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
          </div>
          <div style={{ fontSize:12,color:"#64748b",marginBottom:12 }}>
            เลือกเคสที่ต้องการ import — โครงการจะจับคู่อัตโนมัติจากชื่อ
          </div>
          {(()=>{
            const dupCount = importCaseRows.filter(r=>{
              const proj=projects.find(p=>p.name?.toLowerCase().includes(r.projectName?.toLowerCase())||r.projectName?.toLowerCase().includes(p.name?.toLowerCase()));
              const key=`${(r.title||"").trim().toLowerCase()}|${(proj?.id||"").trim()}|${(r.date||"").slice(0,10)}`;
              return (cases||[]).some(c=>`${(c.title||"").trim().toLowerCase()}|${(c.projectId||"").trim()}|${(c.date||"").slice(0,10)}`===key);
            }).length;
            return dupCount>0 && (
              <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
                padding:"8px 12px",marginBottom:12,fontSize:12,color:"#b91c1c" }}>
                ⚠️ พบ {dupCount} รายการที่มีอยู่ในระบบแล้ว
              </div>
            );
          })()}
          <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
            <button onClick={()=>{ const s={}; importCaseRows.forEach(r=>s[r.key]=true); setImportCaseSel(s); }}
              style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              เลือกทั้งหมด
            </button>
            <button onClick={()=>setImportCaseSel({})}
              style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
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
            }} style={{ background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",
              borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ✕ ไม่เลือกรายการซ้ำ
            </button>
            <span style={{ marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"center" }}>
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
                  background:isDupCase?"#fff5f5":importCaseSel[r.key]?"#f0fdf4":"#f8fafc",
                  border:`1px solid ${isDupCase?"#fecaca":importCaseSel[r.key]?"#bbf7d0":"#e2e8f0"}` }}>
                  <input type="checkbox" checked={!!importCaseSel[r.key]}
                    onChange={e=>setImportCaseSel(p=>({...p,[r.key]:e.target.checked}))}
                    style={{ marginTop:2,accentColor:"#16a34a",flexShrink:0 }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ fontSize:13,fontWeight:600,color:isDupCase?"#ef4444":"#0f172a",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.title}</span>
                      {isDupCase && <span style={{ fontSize:10,background:"#fef2f2",color:"#ef4444",
                        border:"1px solid #fecaca",borderRadius:4,padding:"1px 6px",flexShrink:0,fontWeight:700 }}>ซ้ำ</span>}
                    </div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:2 }}>
                      {r.site&&<span style={{ fontSize:11,color:"#64748b" }}>📍 {r.site}</span>}
                      {proj ? <span style={{ fontSize:11,color:proj.color||"#2563eb",fontWeight:600 }}>◆ {proj.name}</span>
                        : <span style={{ fontSize:11,color:"#f59e0b" }}>⚠ ไม่พบโครงการ: {r.projectName}</span>}
                      <span style={{ fontSize:11,color:"#64748b" }}>{r.date}</span>
                      <span style={{ fontSize:11,color:"#64748b" }}>{r.type}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
            <button onClick={()=>setImportCaseModal(false)}
              style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิก
            </button>
            <button onClick={doImportCases} disabled={saving||Object.values(importCaseSel).filter(Boolean).length===0}
              style={{ background:"#16a34a",border:"none",color:"#fff",borderRadius:10,
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
        <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:600,
          maxHeight:"88vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:"24px" }}
          onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
              📥 Import โครงการ ({importRows.length} รายการ)
            </h2>
            <button onClick={()=>setImportModal(false)}
              style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
                fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
          </div>
          <div style={{ fontSize:12,color:"#64748b",marginBottom:12 }}>
            เลือกโครงการที่ต้องการ import — กดเลือกทั้งหมดหรือเลือกทีละรายการ
          </div>
          {(()=>{
            const dupCount = importRows.filter(r=>
              projects.some(p=>(p.name||"").trim().toLowerCase()===(r.name||"").trim().toLowerCase() ||
                (r.code && (p.code||"").trim().toLowerCase()===(r.code||"").trim().toLowerCase()))
            ).length;
            return dupCount>0 && (
              <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
                padding:"8px 12px",marginBottom:12,fontSize:12,color:"#b91c1c" }}>
                ⚠️ พบ {dupCount} รายการที่มีอยู่ในระบบแล้ว (ชื่อหรือรหัสโครงการตรงกัน)
              </div>
            );
          })()}
          <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
            <button onClick={()=>{ const s={}; importRows.forEach(r=>s[r.key]=true); setImportSelected(s); }}
              style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              เลือกทั้งหมด
            </button>
            <button onClick={()=>setImportSelected({})}
              style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
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
            }} style={{ background:"#fff7ed",border:"1px solid #fed7aa",color:"#ea580c",
              borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ✕ ไม่เลือกรายการซ้ำ
            </button>
            <span style={{ marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"center" }}>
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
                  background:isDup?"#fff5f5":importSelected[r.key]?"#f0fdf4":"#f8fafc",
                  border:`1px solid ${isDup?"#fecaca":importSelected[r.key]?"#bbf7d0":"#e2e8f0"}` }}>
                  <input type="checkbox" checked={!!importSelected[r.key]}
                    onChange={e=>setImportSelected(p=>({...p,[r.key]:e.target.checked}))}
                    style={{ marginTop:2,accentColor:"#16a34a",flexShrink:0 }}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                      <span style={{ fontSize:13,fontWeight:600,color:isDup?"#ef4444":"#0f172a" }}>{r.name}</span>
                      {isDup && <span style={{ fontSize:10,background:"#fef2f2",color:"#ef4444",
                        borderRadius:20,padding:"1px 7px",fontWeight:700 }}>มีอยู่แล้ว</span>}
                    </div>
                    <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginTop:2 }}>
                      {r.code && <span style={{ fontSize:11,color:"#64748b" }}>{r.code}</span>}
                      {r.customer && <span style={{ fontSize:11,color:"#475569" }}>👤 {r.customer}</span>}
                      {r.contractType && <span style={{ fontSize:11,
                        color:r.contractType==="เช่า"?"#8b5cf6":r.contractType==="ขายขาด"?"#16a34a":"#0891b2",
                        fontWeight:600 }}>{r.contractType}</span>}
                      {r.warrantyEnd && <span style={{ fontSize:11,color:"#64748b" }}>🛡 {r.warrantyEnd}</span>}
                      {r.projectStatus && <span style={{ fontSize:11,color:"#64748b" }}>{r.projectStatus}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
            <button onClick={()=>setImportModal(false)}
              style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
              ยกเลิก
            </button>
            <button onClick={doImport} disabled={saving||Object.values(importSelected).filter(Boolean).length===0}
              style={{ background:"#16a34a",border:"none",color:"#fff",borderRadius:10,
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
