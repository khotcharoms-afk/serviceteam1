import { useState } from "react";
import { Modal, Field, PrimaryBtn, GhostBtn } from "../UI.jsx";
import { IS, SERVICE_TYPES, STATUS_OPTS, fmtDate, daysLeft } from "../utils.js";

export default function CaseModal({
  open, onClose, editCase, caseForm, setCaseForm,
  projects, users, currentUser, saving, onSubmit
}) {
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!caseForm.projectId) e.projectId = "กรุณาเลือกโครงการ";
    if (!caseForm.title?.trim()) e.title = "กรุณากรอกชื่องาน / รายการเซอร์วิส";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (validate()) onSubmit();
  }

  function handleClose() {
    setErrors({});
    onClose();
  }

  function Err({ field }) {
    if (!errors[field]) return null;
    return <div style={{ color:"#ef4444",fontSize:12,marginTop:4,fontWeight:500 }}>⚠ {errors[field]}</div>;
  }

  return (
    <Modal open={open} onClose={handleClose} title={editCase ? "แก้ไขเคส" : "บันทึกเคสใหม่"}>
      <Field label="โครงการ *">
        <select style={IS({ cursor:"pointer" })} value={caseForm.projectId}
          onChange={e => setCaseForm(f => ({ ...f, projectId:e.target.value }))}>
          <option value="">— เลือกโครงการ —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Err field="projectId"/>
      </Field>
      <Field label="ชื่องาน / รายการเซอร์วิส *">
        <input style={IS()} value={caseForm.title} placeholder="อธิบายงานที่ดำเนินการ..."
          onChange={e => setCaseForm(f => ({ ...f, title:e.target.value }))}/>
        <Err field="title"/>
      </Field>
      <Field label="ไซต์ / สถานที่">
        {(()=>{
          const proj = projects.find(p => p.id === caseForm.projectId);
          const sites = proj?.sites||[];
          const isPreset = sites.includes(caseForm.site);
          const showOther = caseForm.siteOther || (caseForm.site && !isPreset);
          if (sites.length === 0) {
            return <input style={IS()} value={caseForm.site} placeholder="เช่น สาขากรุงเทพ, อาคาร A..."
              onChange={e => setCaseForm(f => ({ ...f, site:e.target.value }))}/>;
          }
          return (
            <>
              <select style={IS({ cursor:"pointer" })}
                value={showOther ? "__other__" : caseForm.site}
                onChange={e => {
                  if (e.target.value === "__other__") {
                    setCaseForm(f => ({ ...f, site:"", siteOther:true }));
                  } else {
                    setCaseForm(f => ({ ...f, site:e.target.value, siteOther:false }));
                  }
                }}>
                <option value="">— เลือกไซต์ —</option>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__other__">อื่นๆ (พิมพ์เอง)</option>
              </select>
              {showOther && (
                <input style={IS({ marginTop:8 })} value={caseForm.site}
                  placeholder="พิมพ์ชื่อไซต์..." autoFocus
                  onChange={e => setCaseForm(f => ({ ...f, site:e.target.value, siteOther:true }))}/>
              )}
            </>
          );
        })()}
      </Field>
      <Field label="ประเภทงาน">
        <select style={IS({ cursor:"pointer" })} value={caseForm.type}
          onChange={e => setCaseForm(f => ({ ...f, type:e.target.value }))}>
          {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="ผู้ดำเนินการ">
        <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 13px" }}>
          {users.filter(u => u.role !== "pending").sort((a,b) => a.name.localeCompare(b.name)).map(u => {
            const isSelf = u.name === (currentUser?.name||"");
            const checked = (caseForm.techs||[]).includes(u.name);
            return (
              <label key={u.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"5px 0",
                cursor:isSelf?"default":"pointer" }}>
                <input type="checkbox" checked={checked} disabled={isSelf}
                  onChange={() => {
                    if (isSelf) return;
                    setCaseForm(f => {
                      const cur = f.techs||[];
                      return { ...f, techs: checked ? cur.filter(x => x !== u.name) : [...cur, u.name] };
                    });
                  }}
                  style={{ width:16,height:16,accentColor:"#2563eb",cursor:isSelf?"default":"pointer" }}/>
                <span style={{ fontSize:14,color:"#1e293b",fontWeight:checked?600:400 }}>{u.name}</span>
                {isSelf && <span style={{ fontSize:11,color:"#94a3b8",marginLeft:4 }}>(คุณ)</span>}
                {u.role === "admin" && <span style={{ fontSize:10,color:"#7c3aed",marginLeft:4 }}>Admin</span>}
              </label>
            );
          })}
        </div>
      </Field>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Field label="วันที่ดำเนินการ">
          <input type="date" style={IS()} value={caseForm.date}
            onChange={e => setCaseForm(f => ({ ...f, date:e.target.value }))}/>
        </Field>
      </div>
      {(()=>{
        const proj = projects.find(p => p.id === caseForm.projectId);
        if (!proj) return null;
        const wd = daysLeft(proj.warrantyEnd);
        const ld = daysLeft(proj.leaseEnd);
        return (
          <div style={{ background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,
            padding:"12px 14px",marginBottom:14 }}>
            <div style={{ fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,
              textTransform:"uppercase",marginBottom:8 }}>ข้อมูลจากโครงการ (อัตโนมัติ)</div>
            <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:10,color:"#94a3b8",marginBottom:2 }}>🛡 ประกัน</div>
                {proj.warrantyEnd ? (
                  <div style={{ fontSize:12,fontWeight:600,
                    color:wd<0?"#ef4444":wd<=90?"#f59e0b":"#3b82f6" }}>
                    {fmtDate(proj.warrantyEnd)} {wd<0?"(หมดแล้ว)":`(เหลือ ${wd} วัน)`}
                  </div>
                ) : <div style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มี</div>}
              </div>
              <div>
                <div style={{ fontSize:10,color:"#94a3b8",marginBottom:2 }}>📋 สัญญาเช่า</div>
                {proj.leaseEnd ? (
                  <div style={{ fontSize:12,fontWeight:600,
                    color:ld<0?"#ef4444":ld<=90?"#f59e0b":"#8b5cf6" }}>
                    {fmtDate(proj.leaseEnd)} {ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`}
                  </div>
                ) : <div style={{ fontSize:12,color:"#cbd5e1" }}>ไม่มี</div>}
              </div>
            </div>
          </div>
        );
      })()}
      <Field label="สถานะ">
        <select style={IS({ cursor:"pointer" })} value={caseForm.status}
          onChange={e => setCaseForm(f => ({ ...f, status:e.target.value }))}>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="หมายเหตุ / รายละเอียด">
        <textarea style={IS({ resize:"vertical",minHeight:80,lineHeight:1.7 })}
          value={caseForm.note} placeholder="รายละเอียดงาน, อุปกรณ์ที่ใช้..."
          onChange={e => setCaseForm(f => ({ ...f, note:e.target.value }))}/>
      </Field>
      <div style={{ display:"flex",gap:10,marginTop:4 }}>
        <GhostBtn onClick={handleClose}>ยกเลิก</GhostBtn>
        <PrimaryBtn onClick={handleSubmit} full>
          {saving ? "กำลังบันทึก…" : (editCase ? "บันทึกการแก้ไข" : "บันทึกเคส")}
        </PrimaryBtn>
      </div>
    </Modal>
  );
}
