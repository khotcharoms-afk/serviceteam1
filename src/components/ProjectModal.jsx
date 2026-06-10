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

  function addSite() {
    if (newSiteInput.trim()) {
      setNewProjSites(s => [...s, newSiteInput.trim()]);
      setNewSiteInput("");
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
        <div style={{ display:"flex",gap:8,marginBottom:8 }}>
          <input style={IS({ flex:1 })} value={newSiteInput} placeholder="ชื่อไซต์ เช่น อาคาร A, สาขานนทบุรี"
            onChange={e => setNewSiteInput(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); addSite(); }}}/>
          <button type="button" onClick={addSite}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,
              padding:"0 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap" }}>+ เพิ่ม</button>
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
          {newProjSites.map((s,i) => (
            <span key={i} style={{ background:"#eff6ff",border:"1px solid #bfdbfe",
              color:"#2563eb",borderRadius:20,padding:"3px 10px",fontSize:12,
              fontWeight:600,display:"inline-flex",alignItems:"center",gap:6 }}>
              📍 {s}
              <button type="button" onClick={() => setNewProjSites(p => p.filter((_,j) => j!==i))}
                style={{ background:"none",border:"none",color:"#93c5fd",cursor:"pointer",
                  fontSize:13,padding:0,lineHeight:1 }}>×</button>
            </span>
          ))}
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
