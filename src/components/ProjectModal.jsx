import { useState } from "react";
import { Modal, Field, PrimaryBtn, GhostBtn } from "../UI.jsx";
import { IS, COLOR_OPTS, fmtDate, daysLeft } from "../utils.js";

export default function ProjectModal({
  open, onClose, editProjId,
  newProjCode, setNewProjCode,
  newProjName, setNewProjName,
  newProjColor, setNewProjColor,
  newProjWarranty, setNewProjWarranty,
  newProjLease, setNewProjLease,
  newProjSites, setNewProjSites,
  saving, onSubmit
}) {
  const [newSiteInput, setNewSiteInput] = useState("");
  const [editSiteIndex, setEditSiteIndex] = useState(null);
  const [editSiteName, setEditSiteName] = useState("");
  const [editSiteRef, setEditSiteRef] = useState("");
  const [editSiteTravel, setEditSiteTravel] = useState("");

  function startEditSite(i, s) {
    setEditSiteIndex(i);
    setEditSiteName(typeof s==="object" ? s.name : s);
    setEditSiteRef(typeof s==="object" ? s.refCode||"" : "");
    setEditSiteTravel(typeof s==="object" ? s.travelRate?.toString()||"" : "");
  }

  function saveEditSite(i) {
    if (!editSiteName.trim()) return;
    setNewProjSites(p => p.map((s,j) => j===i ? {
      name: editSiteName.trim(),
      refCode: editSiteRef.trim(),
      travelRate: parseFloat(editSiteTravel)||0,
    } : s));
    setEditSiteIndex(null);
  }
  const [newSiteRef, setNewSiteRef] = useState("");
  const [newSiteTravel, setNewSiteTravel] = useState("");

  function addSite() {
    if (newSiteInput.trim()) {
      setNewProjSites(s => [...s, {
        name: newSiteInput.trim(),
        refCode: newSiteRef.trim(),
        travelRate: parseFloat(newSiteTravel)||0,
      }]);
      setNewSiteInput(""); setNewSiteRef(""); setNewSiteTravel("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editProjId ? "แก้ไขโครงการ" : "เพิ่มโครงการใหม่"}>
      <Field label="เลขโครงการ">
        <input style={IS()} value={newProjCode} placeholder="เช่น PJ-MT26000054"
          onChange={e => setNewProjCode(e.target.value)}/>
      </Field>
      <Field label="ชื่อโครงการ *">
        <input style={IS()} value={newProjName} placeholder="ชื่อโครงการ"
          onChange={e => setNewProjName(e.target.value)}/>
      </Field>
      <Field label="สีโครงการ">
        <div style={{ display:"flex",gap:10 }}>
          {COLOR_OPTS.map(c => (
            <div key={c} onClick={() => setNewProjColor(c)}
              style={{ width:32,height:32,borderRadius:8,background:c,cursor:"pointer",
                border:newProjColor===c?"3px solid #0f172a":"3px solid transparent",
                transform:newProjColor===c?"scale(1.15)":"scale(1)",transition:"transform .15s" }}/>
          ))}
        </div>
      </Field>
      <Field label="วันหมดประกัน (ถ้ามี)">
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <input type="date" style={IS({ flex:1,minWidth:140 })} value={newProjWarranty}
            onChange={e => setNewProjWarranty(e.target.value)}/>
          {[{l:"+1ปี",y:1},{l:"+3ปี",y:3},{l:"+5ปี",y:5}].map(b => {
            const d = new Date(); d.setFullYear(d.getFullYear()+b.y);
            const v = d.toISOString().slice(0,10);
            return <button key={b.l} type="button" onClick={() => setNewProjWarranty(v)}
              style={{ background:newProjWarranty===v?"#3b82f6":"#f1f5f9",
                border:"1px solid #e2e8f0",color:newProjWarranty===v?"#fff":"#475569",
                borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>{b.l}</button>;
          })}
          {newProjWarranty && <button type="button" onClick={() => setNewProjWarranty("")}
            style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
              borderRadius:7,padding:"6px 8px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>}
        </div>
        {newProjWarranty && <div style={{ fontSize:11,color:"#3b82f6",marginTop:4,fontWeight:600 }}>
          🛡 {fmtDate(newProjWarranty)} (เหลือ {daysLeft(newProjWarranty)} วัน)
        </div>}
      </Field>
      <Field label="วันหมดสัญญาเช่า (ถ้ามี)">
        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <input type="date" style={IS({ flex:1,minWidth:140 })} value={newProjLease}
            onChange={e => setNewProjLease(e.target.value)}/>
          {[{l:"+1ปี",y:1},{l:"+3ปี",y:3},{l:"+5ปี",y:5}].map(b => {
            const d = new Date(); d.setFullYear(d.getFullYear()+b.y);
            const v = d.toISOString().slice(0,10);
            return <button key={b.l} type="button" onClick={() => setNewProjLease(v)}
              style={{ background:newProjLease===v?"#8b5cf6":"#f1f5f9",
                border:"1px solid #e2e8f0",color:newProjLease===v?"#fff":"#475569",
                borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>{b.l}</button>;
          })}
          {newProjLease && <button type="button" onClick={() => setNewProjLease("")}
            style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
              borderRadius:7,padding:"6px 8px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ล้าง</button>}
        </div>
        {newProjLease && <div style={{ fontSize:11,color:"#8b5cf6",marginTop:4,fontWeight:600 }}>
          📋 {fmtDate(newProjLease)} (เหลือ {daysLeft(newProjLease)} วัน)
        </div>}
      </Field>
      <Field label="ไซต์ย่อย">
        <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 90px auto",gap:6,marginBottom:6,alignItems:"center" }}>
          <input style={IS()} value={newSiteInput} placeholder="ชื่อไซต์"
            onChange={e => setNewSiteInput(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); addSite(); }}}/>
          <input style={IS()} value={newSiteRef} placeholder="Ref Code"
            onChange={e => setNewSiteRef(e.target.value)}/>
          <input type="number" style={IS()} value={newSiteTravel} placeholder="ค่าเดิน(บ.)"
            onChange={e => setNewSiteTravel(e.target.value)} min="0"/>
          <button type="button" onClick={addSite}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,
              padding:"8px 10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>+</button>
        </div>
        <div style={{ fontSize:10,color:"#94a3b8",marginBottom:8 }}>ชื่อไซต์ · Ref Code · ค่าเดินทาง (บาท)</div>
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          {newProjSites.map((s,i) => {
            const name = typeof s==="object" ? s.name : s;
            const ref  = typeof s==="object" ? s.refCode||"" : "";
            const travel = typeof s==="object" ? s.travelRate||0 : 0;
            if (editSiteIndex === i) {
              return (
                <div key={i} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
                  borderRadius:8,padding:"8px 10px",display:"flex",flexDirection:"column",gap:6 }}>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 90px 80px",gap:6 }}>
                    <input style={{ border:"1px solid #bfdbfe",borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none" }}
                      value={editSiteName} onChange={e=>setEditSiteName(e.target.value)} placeholder="ชื่อไซต์"/>
                    <input style={{ border:"1px solid #bfdbfe",borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none" }}
                      value={editSiteRef} onChange={e=>setEditSiteRef(e.target.value)} placeholder="Ref Code"/>
                    <input type="number" style={{ border:"1px solid #bfdbfe",borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none" }}
                      value={editSiteTravel} onChange={e=>setEditSiteTravel(e.target.value)} placeholder="ค่าเดิน(บ.)" min="0"/>
                  </div>
                  <div style={{ display:"flex",gap:6,justifyContent:"flex-end" }}>
                    <button type="button" onClick={()=>setEditSiteIndex(null)}
                      style={{ background:"#f1f5f9",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
                    <button type="button" onClick={()=>saveEditSite(i)}
                      style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>บันทึก</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
                borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:13,fontWeight:600,color:"#0f172a",flex:1 }}>📍 {name}</span>
                {ref && <span style={{ fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:4,padding:"1px 6px" }}>{ref}</span>}
                {travel>0 && <span style={{ fontSize:11,color:"#16a34a",fontWeight:600 }}>{travel.toLocaleString()} บ.</span>}
                <button type="button" onClick={()=>startEditSite(i,s)}
                  style={{ background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:12,padding:"0 4px" }}>✏️</button>
                <button type="button" onClick={() => setNewProjSites(p => p.filter((_,j) => j!==i))}
                  style={{ background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:14,padding:0 }}>×</button>
              </div>
            );
          })}
          {newProjSites.length===0 && <span style={{ fontSize:12,color:"#cbd5e1" }}>ยังไม่มีไซต์</span>}
        </div>
      </Field>
      <div style={{ display:"flex",gap:10,marginTop:4 }}>
        <GhostBtn onClick={onClose}>ยกเลิก</GhostBtn>
        <PrimaryBtn onClick={onSubmit} full>
          {saving ? "กำลังบันทึก…" : (editProjId ? "บันทึก" : "สร้างโครงการ")}
        </PrimaryBtn>
      </div>
    </Modal>
  );
}
