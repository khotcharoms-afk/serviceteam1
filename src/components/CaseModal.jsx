import { useState } from "react";
import { Modal, Field, PrimaryBtn, GhostBtn } from "../UI.jsx";
import { IS, SERVICE_TYPES, STATUS_OPTS, fmtDate, daysLeft } from "../utils.js";
import { useTheme } from "../theme.js";

export default function CaseModal({
  open, onClose, editCase, caseForm, setCaseForm,
  projects, users, currentUser, saving, onSubmit
}) {
  const { c } = useTheme();
  const [errors, setErrors] = useState({});
  const [projSearch, setProjSearch] = useState("");
  const [projDropdown, setProjDropdown] = useState(false);

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
    return <div style={{ color:c.red,fontSize:12,marginTop:4,fontWeight:500 }}>⚠ {errors[field]}</div>;
  }

  return (
    <Modal open={open} onClose={handleClose} title={editCase ? "แก้ไขเคส" : "บันทึกเคสใหม่"}>
      <Field label="โครงการ *">
        {(()=>{
          const selProj = projects.find(p=>p.id===caseForm.projectId);
          const filteredProjs = projects.filter(p=>
            !projSearch || p.name?.toLowerCase().includes(projSearch.toLowerCase()) ||
            p.code?.toLowerCase().includes(projSearch.toLowerCase())
          );
          return (
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex",alignItems:"center",
                border:`1px solid ${errors.projectId?c.red:c.border}`,
                borderRadius:8,background:c.bg,overflow:"hidden" }}>
                <input
                  style={{ flex:1,border:"none",background:"transparent",padding:"9px 12px",
                    fontSize:14,fontFamily:"inherit",outline:"none",color:c.text900 }}
                  placeholder="ค้นหาโครงการ..."
                  value={projDropdown ? projSearch : (selProj?.name||"")}
                  onFocus={()=>{ setProjDropdown(true); setProjSearch(""); }}
                  onChange={e=>{ setProjSearch(e.target.value); setProjDropdown(true); }}
                />
                {selProj && !projDropdown && (
                  <button type="button" onClick={()=>{ setCaseForm(f=>({...f,projectId:""})); setProjSearch(""); }}
                    style={{ background:"none",border:"none",color:c.text400,cursor:"pointer",
                      padding:"0 10px",fontSize:14 }}>✕</button>
                )}
              </div>
              {projDropdown && (
                <div style={{ position:"absolute",top:"100%",left:0,right:0,zIndex:100,
                  background:c.card,border:`1px solid ${c.border}`,borderRadius:8,
                  boxShadow:"0 8px 24px rgba(0,0,0,.28)",maxHeight:220,overflowY:"auto",marginTop:4 }}>
                  {filteredProjs.length===0 ? (
                    <div style={{ padding:"12px 14px",fontSize:13,color:c.text400,textAlign:"center" }}>ไม่พบโครงการ</div>
                  ) : filteredProjs.map(p=>(
                    <div key={p.id}
                      onMouseDown={()=>{ setCaseForm(f=>({...f,projectId:p.id})); setProjDropdown(false); setProjSearch(""); }}
                      style={{ padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                        background:caseForm.projectId===p.id?`${c.blue}22`:"transparent",
                        borderBottom:`1px solid ${c.borderSoft}` }}
                      onMouseEnter={e=>{ if(caseForm.projectId!==p.id) e.currentTarget.style.background=c.borderSoft; }}
                      onMouseLeave={e=>{ if(caseForm.projectId!==p.id) e.currentTarget.style.background="transparent"; }}>
                      <span style={{ width:10,height:10,borderRadius:"50%",background:p.color||c.text400,flexShrink:0 }}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:c.text900,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                        {p.code&&<div style={{ fontSize:11,color:c.text400 }}>{p.code}</div>}
                      </div>
                      {caseForm.projectId===p.id && <span style={{ color:c.blue,fontSize:14 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
              {projDropdown && (
                <div style={{ position:"fixed",inset:0,zIndex:99 }}
                  onMouseDown={()=>setProjDropdown(false)}/>
              )}
            </div>
          );
        })()}
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
          const rawSites = proj?.sites||[];
          const sites = rawSites.map(s => typeof s === "object" ? s.name : s);
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
        <div style={{ background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,padding:"10px 13px" }}>
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
                  style={{ width:16,height:16,accentColor:c.blue,cursor:isSelf?"default":"pointer" }}/>
                <span style={{ fontSize:14,color:c.text900,fontWeight:checked?600:400 }}>{u.name}</span>
                {isSelf && <span style={{ fontSize:11,color:c.text400,marginLeft:4 }}>(คุณ)</span>}
                {u.role === "admin" && <span style={{ fontSize:10,color:c.purple,marginLeft:4 }}>Admin</span>}
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
          <div style={{ background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,
            padding:"12px 14px",marginBottom:14 }}>
            <div style={{ fontSize:10,color:c.text400,fontWeight:700,letterSpacing:1,
              textTransform:"uppercase",marginBottom:8 }}>ข้อมูลจากโครงการ (อัตโนมัติ)</div>
            <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:10,color:c.text400,marginBottom:2 }}>🛡 ประกัน</div>
                {proj.warrantyEnd ? (
                  <div style={{ fontSize:12,fontWeight:600,
                    color:wd<0?c.red:wd<=90?c.amber:c.blue }}>
                    {fmtDate(proj.warrantyEnd)} {wd<0?"(หมดแล้ว)":`(เหลือ ${wd} วัน)`}
                  </div>
                ) : <div style={{ fontSize:12,color:c.text400 }}>ไม่มี</div>}
              </div>
              <div>
                <div style={{ fontSize:10,color:c.text400,marginBottom:2 }}>📋 สัญญาเช่า</div>
                {proj.leaseEnd ? (
                  <div style={{ fontSize:12,fontWeight:600,
                    color:ld<0?c.red:ld<=90?c.amber:c.purple }}>
                    {fmtDate(proj.leaseEnd)} {ld<0?"(หมดแล้ว)":`(เหลือ ${ld} วัน)`}
                  </div>
                ) : <div style={{ fontSize:12,color:c.text400 }}>ไม่มี</div>}
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
