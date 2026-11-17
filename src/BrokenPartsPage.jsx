import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase.js";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, query, orderBy,
} from "firebase/firestore";
import { useTheme } from "./theme.js";
import Icon from "./components/Icon.jsx";

// ── อะไหล่เสียรับคืน ─────────────────────────────────────────────
// เก็บใน Firestore: brokenParts/{id}  (+ รูปเต็มใน brokenParts/{id}/photos/{photoId})
// รูปถูกย่อในเครื่องก่อนบันทึก (ด้านยาวสุด 1280px, JPEG) เพื่อให้แต่ละรูปไม่เกินขนาดเอกสารของ Firestore
// ตัวเอกสารหลักเก็บรูปย่อ (thumb) ไว้แสดงในรายการ ไม่ต้องโหลดรูปเต็มทุกครั้ง

export const PART_STATUS = [
  { value: "received",  label: "รับคืนแล้ว",       color: "#2563eb" },
  { value: "repairing", label: "ส่งซ่อม",           color: "#d97706" },
  { value: "claim",     label: "ส่งเคลมผู้ผลิต",    color: "#7c3aed" },
  { value: "repaired",  label: "ซ่อมเสร็จ/พร้อมใช้", color: "#16a34a" },
  { value: "scrapped",  label: "จำหน่าย/ทิ้ง",      color: "#71717a" },
];
const statusOf = v => PART_STATUS.find(s => s.value === v) || PART_STATUS[0];
const MAX_PHOTOS = 6;

const todayISO = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const fmtTH = iso => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${Number(y) + 543}`;
};

// ย่อรูปในเครื่อง → data URL (JPEG)
function shrinkImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์นี้ไม่ใช่รูปภาพ"));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        let q = quality, out = cv.toDataURL("image/jpeg", q);
        while (out.length > 700_000 && q > 0.4) { q -= 0.1; out = cv.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export default function BrokenPartsPage({ onBack, currentUser, projects = [], isAdminOrDev }) {
  const { c } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);   // null | {} (ใหม่) | item
  const [viewing, setViewing] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => onSnapshot(query(collection(db, "brokenParts"), orderBy("returnDate", "desc")), snap => {
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false);
  }, err => { console.error("brokenParts", err); setLoading(false); }), []);

  const counts = useMemo(() => {
    const m = { all: items.length }; PART_STATUS.forEach(s => m[s.value] = 0);
    items.forEach(i => { m[i.status || "received"] = (m[i.status || "received"] || 0) + 1; });
    return m;
  }, [items]);

  const shown = items.filter(i => {
    if (filter !== "all" && (i.status || "received") !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [i.partName, i.serial, i.site, i.projectName, i.equipment, i.symptom, i.returnedBy, i.note]
      .some(v => (v || "").toLowerCase().includes(s));
  });

  const btnGhost = { background:"transparent",border:"none",color:c.text500,borderRadius:8,height:32,padding:"0 8px",
    fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap" };
  const btnPrimary = { background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:32,padding:"0 12px",
    fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap" };

  return (
    <div style={{ minHeight:"100vh",background:c.bg,color:c.text900 }}>
      <div style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:isMobile?"0 12px":"0 24px",height:56,
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} aria-label="กลับ" style={btnGhost}>← กลับ</button>
        <span style={{ width:1,height:16,background:c.border }}/>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:15,fontWeight:600 }}>อะไหล่เสียรับคืน</div>
          {!isMobile && <div style={{ fontSize:12,color:c.text500 }}>บันทึกอะไหล่ที่ถอดกลับจากหน้างาน พร้อมรูป และติดตามสถานะซ่อม/เคลม</div>}
        </div>
        <button onClick={()=>setEditing({})} style={{ ...btnPrimary,marginLeft:"auto" }}>
          <Icon name="plus" size={14}/>{isMobile?"เพิ่ม":"บันทึกอะไหล่เสีย"}
        </button>
      </div>

      <div style={{ padding:isMobile?"16px 12px 48px":"24px 24px 48px",maxWidth:1100,margin:"0 auto" }}>
        {/* สถานะ */}
        <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:12 }}>
          <div style={{ display:"inline-flex",alignItems:"center",height:32,background:c.borderSoft,borderRadius:8,padding:2,gap:2,flexShrink:0 }}>
            {[{ value:"all",label:"ทั้งหมด" }, ...PART_STATUS].map(s => {
              const on = filter === s.value;
              return (
                <button key={s.value} onClick={()=>setFilter(s.value)}
                  style={{ height:28,padding:"0 12px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"inherit",
                    fontSize:13,fontWeight:500,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,
                    background:on?c.card:"transparent",color:on?c.ink:c.text500,boxShadow:on?"0 1px 2px rgba(0,0,0,.08)":"none" }}>
                  {s.label}<span style={{ color:c.text400,fontWeight:400 }}>{counts[s.value] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ position:"relative",marginBottom:16 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:c.text400,display:"inline-flex" }}><Icon name="search" size={16}/></span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาชื่ออะไหล่ Serial ไซต์ อาการ..."
            style={{ width:"100%",height:40,boxSizing:"border-box",border:`1px solid ${c.border}`,borderRadius:8,background:c.card,color:c.text900,
              padding:"0 12px 0 36px",fontSize:14,fontFamily:"inherit",outline:"none" }}/>
        </div>

        {loading ? (
          <div style={{ textAlign:"center",color:c.text500,padding:48,fontSize:14 }}>กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div style={{ background:c.card,border:`1px dashed ${c.border}`,borderRadius:12,textAlign:"center",color:c.text500,padding:48,fontSize:14 }}>
            {items.length === 0 ? "ยังไม่มีอะไหล่เสียที่บันทึกไว้" : "ไม่พบรายการที่ตรงกับตัวกรอง"}
            {items.length === 0 && <div style={{ marginTop:16 }}>
              <button onClick={()=>setEditing({})} style={btnPrimary}><Icon name="plus" size={14}/>บันทึกรายการแรก</button>
            </div>}
          </div>
        ) : (
          <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:8,overflow:"hidden" }}>
            {shown.map((it, i) => {
              const st = statusOf(it.status);
              return (
                <div key={it.id} onClick={()=>setViewing(it)}
                  onMouseEnter={e=>e.currentTarget.style.background=c.borderSoft}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  style={{ display:"flex",gap:12,padding:isMobile?12:16,cursor:"pointer",alignItems:"center",
                    borderTop:i>0?`1px solid ${c.border}`:"none" }}>
                  <div style={{ width:56,height:56,borderRadius:8,flexShrink:0,overflow:"hidden",background:c.borderSoft,
                    display:"flex",alignItems:"center",justifyContent:"center",color:c.text400,position:"relative" }}>
                    {it.thumb ? <img src={it.thumb} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/> : <Icon name="camera" size={20}/>}
                    {(it.photoCount||0) > 1 && <span style={{ position:"absolute",right:2,bottom:2,background:"rgba(0,0,0,.6)",color:"#fff",
                      fontSize:10,borderRadius:4,padding:"0 4px",lineHeight:"16px" }}>{it.photoCount}</span>}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {it.partName}{it.qty > 1 && <span style={{ color:c.text500,fontWeight:400 }}> × {it.qty}</span>}
                    </div>
                    <div style={{ fontSize:12,color:c.text500,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {[it.serial && `S/N ${it.serial}`, it.site || it.projectName, it.symptom].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ fontSize:12,color:c.text400,marginTop:4 }}>
                      {fmtTH(it.returnDate)}{it.returnedBy && ` · ${it.returnedBy}`}
                    </div>
                  </div>
                  <span style={{ flexShrink:0,fontSize:12,fontWeight:500,color:st.color,background:`${st.color}14`,
                    border:`1px solid ${st.color}33`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap" }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <PartForm initial={editing} onClose={()=>setEditing(null)} currentUser={currentUser} projects={projects}
          onSaved={saved => { setEditing(null); if (saved && viewing) setViewing(saved); }}/>
      )}
      {viewing && !editing && (
        <PartDetail item={items.find(i=>i.id===viewing.id) || viewing} onClose={()=>setViewing(null)}
          onEdit={it=>setEditing(it)} currentUser={currentUser} isAdminOrDev={isAdminOrDev}/>
      )}
    </div>
  );
}

// ── หน้าต่างเพิ่ม/แก้ไข ───────────────────────────────────────────
function PartForm({ initial, onClose, onSaved, currentUser, projects }) {
  const { c } = useTheme();
  const isNew = !initial.id;
  const [f, setF] = useState({
    returnDate: initial.returnDate || todayISO(),
    partName: initial.partName || "", serial: initial.serial || "", qty: initial.qty || 1,
    projectId: initial.projectId || "", site: initial.site || "", equipment: initial.equipment || "",
    symptom: initial.symptom || "", returnedBy: initial.returnedBy || currentUser?.name || "",
    status: initial.status || "received", note: initial.note || "",
  });
  const [oldPhotos, setOldPhotos] = useState([]);     // [{id,data}] จาก subcollection (ตอนแก้ไข)
  const [removeIds, setRemoveIds] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);     // data URL
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (isNew) return;
    getDocs(query(collection(db, "brokenParts", initial.id, "photos"), orderBy("idx")))
      .then(s => setOldPhotos(s.docs.map(d => ({ id: d.id, data: d.data().data }))))
      .catch(() => {});
  }, [isNew, initial.id]);

  const keptOld = oldPhotos.filter(p => !removeIds.includes(p.id));
  const total = keptOld.length + newPhotos.length;

  async function addFiles(files) {
    setErr("");
    const room = MAX_PHOTOS - total;
    const list = [...files].slice(0, Math.max(0, room));
    if (files.length > room) setErr(`แนบได้สูงสุด ${MAX_PHOTOS} รูป`);
    for (const file of list) {
      try { const d = await shrinkImage(file, 1280, 0.75); setNewPhotos(p => [...p, d]); }
      catch (e) { setErr(`${file.name}: ${e.message}`); }
    }
  }

  async function save() {
    if (!f.partName.trim()) return setErr("กรุณาใส่ชื่ออะไหล่");
    setBusy(true); setErr("");
    try {
      const proj = projects.find(p => p.id === f.projectId);
      const now = new Date().toISOString();
      const firstPhoto = keptOld[0]?.data || newPhotos[0] || null;
      const thumb = firstPhoto ? await shrinkImageFromDataUrl(firstPhoto, 200, 0.6) : null;
      const data = {
        ...f, partName: f.partName.trim(), serial: f.serial.trim(), qty: Math.max(1, Number(f.qty) || 1),
        projectName: proj?.name || "", thumb, photoCount: total, updatedAt: now,
        updatedBy: currentUser?.name || "",
      };
      let id = initial.id;
      if (isNew) {
        const ref = await addDoc(collection(db, "brokenParts"), {
          ...data, createdAt: now, createdBy: currentUser?.id || "", createdByName: currentUser?.name || "",
          history: [{ at: now, by: currentUser?.name || "", status: f.status }],
        });
        id = ref.id;
      } else {
        const hist = initial.history || [];
        await updateDoc(doc(db, "brokenParts", id), {
          ...data, history: f.status !== initial.status ? [...hist, { at: now, by: currentUser?.name || "", status: f.status }] : hist,
        });
      }
      // รูป: ลบที่เอาออก + เพิ่มรูปใหม่ (เอกสารละรูป)
      const batch = writeBatch(db);
      removeIds.forEach(pid => batch.delete(doc(db, "brokenParts", id, "photos", pid)));
      await batch.commit();
      let idx = keptOld.length;
      for (const d of newPhotos) {
        await addDoc(collection(db, "brokenParts", id, "photos"), { data: d, idx: idx++, createdAt: now });
      }
      onSaved({ id, ...data });
    } catch (e) {
      setErr(e.code === "permission-denied" ? "ไม่มีสิทธิ์บันทึก (ต้องอัปเดต Firestore rules)" : e.message);
      setBusy(false);
    }
  }

  const IS = { width:"100%",boxSizing:"border-box",border:`1px solid ${c.border}`,borderRadius:8,background:c.card,color:c.text900,
    minHeight:36,padding:"8px 12px",fontSize:14,fontFamily:"inherit",outline:"none" };
  const LB = { fontSize:12,color:c.text500,fontWeight:500,marginBottom:8,display:"block" };
  const row = { display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 };

  return (
    <Overlay onClose={busy ? null : onClose}>
      <div style={{ fontSize:16,fontWeight:600,marginBottom:20 }}>{isNew ? "บันทึกอะไหล่เสีย" : "แก้ไขรายการ"}</div>

      <div style={{ marginBottom:16 }}>
        <label style={LB}>ชื่ออะไหล่ *</label>
        <input value={f.partName} onChange={e=>set("partName",e.target.value)} style={IS} placeholder="เช่น มอเตอร์ล้อขวา, บอร์ดควบคุม, แบตเตอรี่" autoFocus={isNew}/>
      </div>
      <div style={row}>
        <div><label style={LB}>Serial / รหัสอะไหล่</label>
          <input value={f.serial} onChange={e=>set("serial",e.target.value)} style={IS}/></div>
        <div><label style={LB}>จำนวน</label>
          <input type="number" min={1} value={f.qty} onChange={e=>set("qty",e.target.value)} style={IS}/></div>
      </div>
      <div style={row}>
        <div><label style={LB}>วันที่รับคืน</label>
          <input type="date" value={f.returnDate} onChange={e=>set("returnDate",e.target.value)} style={IS}/></div>
        <div><label style={LB}>ผู้ส่งคืน</label>
          <input value={f.returnedBy} onChange={e=>set("returnedBy",e.target.value)} style={IS}/></div>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={LB}>โครงการ</label>
        <ProjectPicker projects={projects} value={f.projectId} onChange={id=>set("projectId",id)} IS={IS}/>
      </div>
      <div style={row}>
        <div><label style={LB}>ไซต์ / สถานที่</label>
          <input value={f.site} onChange={e=>set("site",e.target.value)} style={IS}/></div>
        <div><label style={LB}>ถอดจากอุปกรณ์</label>
          <input value={f.equipment} onChange={e=>set("equipment",e.target.value)} style={IS} placeholder="เช่น SC50 #3, กล้อง A-12"/></div>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={LB}>อาการเสีย</label>
        <textarea value={f.symptom} onChange={e=>set("symptom",e.target.value)} rows={3} style={{ ...IS,resize:"vertical" }}/>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={LB}>สถานะ</label>
        <select value={f.status} onChange={e=>set("status",e.target.value)} style={IS}>
          {PART_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={LB}>หมายเหตุ</label>
        <input value={f.note} onChange={e=>set("note",e.target.value)} style={IS} placeholder="เช่น เลขใบส่งซ่อม, ร้านที่ส่ง"/>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={LB}>รูปภาพ ({total}/{MAX_PHOTOS})</label>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          {keptOld.map(p => (
            <Thumb key={p.id} src={p.data} onRemove={()=>setRemoveIds(r=>[...r,p.id])}/>
          ))}
          {newPhotos.map((d, i) => (
            <Thumb key={`n${i}`} src={d} onRemove={()=>setNewPhotos(p=>p.filter((_,j)=>j!==i))}/>
          ))}
          {total < MAX_PHOTOS && (
            <label style={{ width:72,height:72,borderRadius:8,border:`1px dashed ${c.border}`,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:4,color:c.text500,fontSize:12,cursor:"pointer" }}>
              <Icon name="camera" size={18}/>เพิ่มรูป
              <input type="file" accept="image/*" multiple style={{ display:"none" }}
                onChange={e=>{ addFiles(e.target.files); e.target.value=""; }}/>
            </label>
          )}
        </div>
      </div>

      {err && <div style={{ fontSize:13,color:c.danger,marginBottom:12 }}>{err}</div>}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
        <button onClick={onClose} disabled={busy} style={{ background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,
          height:40,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
        <button onClick={save} disabled={busy} style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:40,
          fontSize:14,fontWeight:500,cursor:busy?"default":"pointer",fontFamily:"inherit",opacity:busy?.7:1 }}>
          {busy ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </Overlay>
  );
}

// ช่องเลือกโครงการแบบพิมพ์ค้นหาได้ (ชื่อ หรือ รหัสโครงการ)
function ProjectPicker({ projects, value, onChange, IS }) {
  const { c } = useTheme();
  const sel = projects.find(p => p.id === value);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const s = q.trim().toLowerCase();
  const list = projects.filter(p => !s || (p.name||"").toLowerCase().includes(s) || (p.code||"").toLowerCase().includes(s)).slice(0, 50);
  return (
    <div style={{ position:"relative" }}>
      {sel && !open ? (
        <div style={{ ...IS, display:"flex",alignItems:"center",gap:8,cursor:"pointer" }} onClick={()=>{ setOpen(true); setQ(""); }}>
          <span style={{ width:6,height:6,borderRadius:"50%",background:sel.color||c.text400,flexShrink:0 }}/>
          <span style={{ flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{sel.name}</span>
          <button type="button" onClick={e=>{ e.stopPropagation(); onChange(""); }} aria-label="ล้างโครงการ"
            style={{ background:"none",border:"none",color:c.text400,cursor:"pointer",padding:0,display:"inline-flex" }}><Icon name="x" size={14}/></button>
        </div>
      ) : (
        <input value={q} autoFocus={open} placeholder="พิมพ์ค้นหาชื่อหรือรหัสโครงการ..."
          onChange={e=>{ setQ(e.target.value); setOpen(true); }} onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),150)} style={IS}/>
      )}
      {open && (
        <div style={{ position:"absolute",left:0,right:0,top:"calc(100% + 4px)",zIndex:5,background:c.card,border:`1px solid ${c.border}`,
          borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:240,overflowY:"auto" }}>
          {list.length === 0 ? (
            <div style={{ padding:12,fontSize:13,color:c.text500,textAlign:"center" }}>ไม่พบโครงการ</div>
          ) : list.map(p => (
            <div key={p.id} onMouseDown={()=>{ onChange(p.id); setOpen(false); setQ(""); }}
              onMouseEnter={e=>e.currentTarget.style.background=c.borderSoft}
              onMouseLeave={e=>e.currentTarget.style.background=p.id===value?c.inkSoft:"transparent"}
              style={{ padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:14,
                background:p.id===value?c.inkSoft:"transparent" }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:p.color||c.text400,flexShrink:0 }}/>
              <span style={{ flex:1,minWidth:0 }}>{p.name}</span>
              {p.code && <span style={{ fontSize:12,color:c.text400 }}>{p.code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shrinkImageFromDataUrl(dataUrl, maxSide, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function Thumb({ src, onRemove, onClick }) {
  const { c } = useTheme();
  return (
    <div style={{ position:"relative",width:72,height:72,borderRadius:8,overflow:"hidden",border:`1px solid ${c.border}`,cursor:onClick?"zoom-in":"default" }}
      onClick={onClick}>
      <img src={src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }}/>
      {onRemove && (
        <button type="button" onClick={e=>{ e.stopPropagation(); onRemove(); }} aria-label="ลบรูป"
          style={{ position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(0,0,0,.6)",
            color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
          <Icon name="x" size={12}/>
        </button>
      )}
    </div>
  );
}

// ── รายละเอียด ─────────────────────────────────────────────────
function PartDetail({ item, onClose, onEdit, currentUser, isAdminOrDev }) {
  const { c } = useTheme();
  const [photos, setPhotos] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = statusOf(item.status);
  const canDelete = isAdminOrDev || item.createdBy === currentUser?.id;

  useEffect(() => {
    if (!item.photoCount) { setPhotos([]); return; }
    getDocs(query(collection(db, "brokenParts", item.id, "photos"), orderBy("idx")))
      .then(s => setPhotos(s.docs.map(d => d.data().data))).catch(() => setPhotos([]));
  }, [item.id, item.photoCount]);

  async function changeStatus(v) {
    if (v === item.status) return;
    setBusy(true);
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, "brokenParts", item.id), {
        status: v, updatedAt: now, updatedBy: currentUser?.name || "",
        history: [...(item.history || []), { at: now, by: currentUser?.name || "", status: v }],
      });
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`ลบรายการ "${item.partName}" และรูปทั้งหมด?\n\nลบแล้วกู้คืนไม่ได้`)) return;
    setBusy(true);
    try {
      const s = await getDocs(collection(db, "brokenParts", item.id, "photos"));
      const b = writeBatch(db); s.docs.forEach(d => b.delete(d.ref)); await b.commit();
      await deleteDoc(doc(db, "brokenParts", item.id));
      onClose();
    } catch (e) { alert(e.message); setBusy(false); }
  }

  const Row = ({ k, v }) => v ? (
    <div style={{ display:"grid",gridTemplateColumns:"112px 1fr",gap:12,padding:"8px 0",borderTop:`1px solid ${c.borderSoft}`,fontSize:14 }}>
      <span style={{ color:c.text500 }}>{k}</span><span style={{ whiteSpace:"pre-wrap" }}>{v}</span>
    </div>
  ) : null;

  return (
    <Overlay onClose={onClose}>
      <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:16 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:16,fontWeight:600 }}>{item.partName}{item.qty > 1 && <span style={{ color:c.text500,fontWeight:400 }}> × {item.qty}</span>}</div>
          <div style={{ fontSize:12,color:c.text500,marginTop:4 }}>รับคืน {fmtTH(item.returnDate)}{item.returnedBy && ` · ${item.returnedBy}`}</div>
        </div>
        <span style={{ fontSize:12,fontWeight:500,color:st.color,background:`${st.color}14`,border:`1px solid ${st.color}33`,
          borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap" }}>{st.label}</span>
      </div>

      <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:16,minHeight:72 }}>
        {photos === null ? <span style={{ fontSize:13,color:c.text500 }}>กำลังโหลดรูป...</span> :
         photos.length === 0 ? <span style={{ fontSize:13,color:c.text400 }}>ไม่มีรูป</span> :
         photos.map((p, i) => <Thumb key={i} src={p} onClick={()=>setLightbox(p)}/>)}
      </div>

      <Row k="Serial / รหัส" v={item.serial}/>
      <Row k="โครงการ" v={item.projectName}/>
      <Row k="ไซต์" v={item.site}/>
      <Row k="ถอดจาก" v={item.equipment}/>
      <Row k="อาการเสีย" v={item.symptom}/>
      <Row k="หมายเหตุ" v={item.note}/>

      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:12,color:c.text500,fontWeight:500,marginBottom:8 }}>เปลี่ยนสถานะ</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          {PART_STATUS.map(s => {
            const on = s.value === (item.status || "received");
            return (
              <button key={s.value} disabled={busy} onClick={()=>changeStatus(s.value)}
                style={{ height:32,padding:"0 12px",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",
                  background:on?`${s.color}14`:c.card,color:on?s.color:c.text500,border:`1px solid ${on?s.color:c.border}` }}>{s.label}</button>
            );
          })}
        </div>
      </div>

      {(item.history || []).length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12,color:c.text500,fontWeight:500,marginBottom:8 }}>ประวัติ</div>
          {[...item.history].reverse().map((h, i) => (
            <div key={i} style={{ fontSize:12,color:c.text500,padding:"4px 0" }}>
              {new Date(h.at).toLocaleString("th-TH",{ dateStyle:"short",timeStyle:"short" })} · {statusOf(h.status).label}{h.by && ` · ${h.by}`}
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex",gap:8,marginTop:24 }}>
        {canDelete && <button onClick={remove} disabled={busy} style={{ background:"transparent",border:"none",color:c.danger,borderRadius:8,
          height:40,padding:"0 12px",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>ลบ</button>}
        <button onClick={onClose} style={{ marginLeft:"auto",background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,
          height:40,padding:"0 16px",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>ปิด</button>
        <button onClick={()=>onEdit(item)} style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,
          height:40,padding:"0 16px",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>แก้ไข</button>
      </div>

      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{ position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.85)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:16,cursor:"zoom-out" }}>
          <img src={lightbox} alt="" style={{ maxWidth:"100%",maxHeight:"100%",borderRadius:8 }}/>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  const { c } = useTheme();
  return (
    <div onClick={onClose || undefined} style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:c.card,color:c.text900,border:`1px solid ${c.border}`,borderRadius:12,
        width:"100%",maxWidth:560,maxHeight:"92vh",overflowY:"auto",padding:24,boxShadow:"0 16px 48px rgba(0,0,0,.16)",boxSizing:"border-box" }}>
        {children}
      </div>
    </div>
  );
}
