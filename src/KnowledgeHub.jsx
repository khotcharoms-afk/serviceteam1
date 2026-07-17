import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";

const TAGS = ["Robot","CCTV","Access Control","Smart Pole","Network","Software","Hardware","อื่นๆ"];

function KnowledgeModal({ onClose, onSave, saving, editRecord }) {
  const [title,    setTitle]    = useState(editRecord?.title    || "");
  const [problem,  setProblem]  = useState(editRecord?.problem  || "");
  const [solution, setSolution] = useState(editRecord?.solution || "");
  const [tags,     setTags]     = useState(editRecord?.tags     || []);

  const IS = { width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none", background:"#f8fafc" };
  const LB = { fontSize:11, color:"#94a3b8", fontWeight:700, textTransform:"uppercase",
    letterSpacing:.5, marginBottom:4, display:"block" };

  function toggleTag(t) {
    setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  }

  function handleSave() {
    if (!title.trim() || !solution.trim()) return;
    onSave({ title:title.trim(), problem:problem.trim(), solution:solution.trim(), tags }, editRecord?.id||null);
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:540,
        maxHeight:"92vh",overflowY:"auto",padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
            {editRecord ? "✏️ แก้ไขบทความ" : "📝 เพิ่มบทความ"}
          </h2>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={LB}>ชื่อปัญหา / หัวข้อ *</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="เช่น Robot ค้างหน้า Login, CCTV ภาพขาด" style={IS}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={LB}>อาการ / สถานการณ์</label>
          <textarea value={problem} onChange={e=>setProblem(e.target.value)}
            placeholder="อธิบายอาการที่พบ เช่น robot หยุดกลางทาง แสดง error E01..."
            rows={3} style={{ ...IS, resize:"vertical" }}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={LB}>วิธีแก้ไข *</label>
          <textarea value={solution} onChange={e=>setSolution(e.target.value)}
            placeholder="ขั้นตอนการแก้ไข เช่น 1. reboot 2. ตรวจสอบ..."
            rows={5} style={{ ...IS, resize:"vertical" }}/>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={LB}>Tag</label>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {TAGS.map(t=>(
              <button key={t} type="button" onClick={()=>toggleTag(t)}
                style={{ padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,
                  cursor:"pointer",fontFamily:"inherit",border:"1px solid",
                  background:tags.includes(t)?"#6B21A8":"#f8fafc",
                  borderColor:tags.includes(t)?"#6B21A8":"#e2e8f0",
                  color:tags.includes(t)?"#fff":"#64748b" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose} style={{ background:"#f8fafc",border:"1px solid #e2e8f0",
            color:"#475569",borderRadius:10,padding:12,fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving||!title.trim()||!solution.trim()}
            style={{ background:"#6B21A8",border:"none",color:"#fff",borderRadius:10,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:saving||!title.trim()||!solution.trim()?0.5:1 }}>
            {saving?"กำลังบันทึก...":"💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeHub({ onBack, currentUser }) {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [editRec,  setEditRec]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");
  const [filterTag,setFilterTag]= useState("all");
  const [expanded, setExpanded] = useState(null);
  const [confirmId,setConfirmId]= useState(null);

  const isAdmin = ["admin","dev"].includes(currentUser?.role);

  useEffect(()=>{
    const u = onSnapshot(collection(db,"knowledge"), snap=>{
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setArticles(data);
      setLoading(false);
    });
    return u;
  },[]);

  async function saveArticle(data, id) {
    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db,"knowledge",id), { ...data, updatedAt:new Date().toISOString() });
      } else {
        await addDoc(collection(db,"knowledge"), {
          ...data,
          createdBy: currentUser?.name||"",
          createdAt: new Date().toISOString(),
        });
      }
      setShowModal(false); setEditRec(null);
    } catch(e){ console.error(e); }
    setSaving(false);
  }

  async function deleteArticle(id) {
    await deleteDoc(doc(db,"knowledge",id));
    setConfirmId(null);
    if (expanded===id) setExpanded(null);
  }

  const allTags = [...new Set(articles.flatMap(a=>a.tags||[]))].sort();

  const filtered = articles.filter(a=>{
    const q = search.toLowerCase();
    const matchQ = !q || (a.title||"").toLowerCase().includes(q) ||
      (a.problem||"").toLowerCase().includes(q) ||
      (a.solution||"").toLowerCase().includes(q);
    const matchTag = filterTag==="all" || (a.tags||[]).includes(filterTag);
    return matchQ && matchTag;
  });

  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getDate()}/${dt.getMonth()+1}/${dt.getFullYear()+543}`;
  };

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
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>💡 Knowledge Hub</div>
        <button onClick={()=>{ setEditRec(null); setShowModal(true); }}
          style={{ marginLeft:"auto",background:"#6B21A8",border:"none",color:"#fff",
            borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
          + เพิ่มบทความ
        </button>
      </div>

      <div style={{ padding:"16px 16px 80px",maxWidth:800,margin:"0 auto" }}>

        {/* Search + Filter */}
        <div style={{ background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
          padding:"12px 16px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 ค้นหาปัญหา วิธีแก้..."
            style={{ flex:1,minWidth:180,border:"1px solid #e2e8f0",borderRadius:8,
              padding:"7px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}/>
          <select value={filterTag} onChange={e=>setFilterTag(e.target.value)}
            style={{ border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 10px",
              fontSize:12,fontFamily:"inherit",outline:"none",background:"#f8fafc" }}>
            <option value="all">ทุก Tag</option>
            {allTags.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{ fontSize:12,color:"#94a3b8" }}>{filtered.length} บทความ</span>
        </div>

        {/* Articles */}
        {loading ? (
          <div style={{ textAlign:"center",color:"#94a3b8",padding:48 }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center",color:"#cbd5e1",padding:48,fontSize:14 }}>
            {search || filterTag!=="all" ? "ไม่พบบทความที่ตรงกับการค้นหา" : "ยังไม่มีบทความ กด + เพิ่มบทความได้เลย"}
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {filtered.map(a=>(
              <div key={a.id} style={{ background:"#fff",borderRadius:12,
                border:`1px solid ${expanded===a.id?"#ddd6fe":"#e2e8f0"}`,overflow:"hidden" }}>
                {/* Card Header */}
                <div style={{ padding:"14px 16px",cursor:"pointer",
                  background:expanded===a.id?"#faf5ff":"#fff" }}
                  onClick={()=>setExpanded(expanded===a.id?null:a.id)}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                    <span style={{ fontSize:20,flexShrink:0,marginTop:1 }}>💡</span>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:4 }}>
                        {a.title}
                      </div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",alignItems:"center" }}>
                        {(a.tags||[]).map(t=>(
                          <span key={t} style={{ fontSize:10,background:"#f5f3ff",color:"#6B21A8",
                            border:"1px solid #ddd6fe",borderRadius:20,padding:"2px 8px",fontWeight:700 }}>
                            {t}
                          </span>
                        ))}
                        <span style={{ fontSize:11,color:"#94a3b8",marginLeft:4 }}>
                          {a.createdBy} · {fmtDate(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span style={{ color:"#94a3b8",fontSize:12,flexShrink:0,marginTop:2 }}>
                      {expanded===a.id?"▲":"▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded */}
                {expanded===a.id && (
                  <div style={{ borderTop:"1px solid #f1f5f9",padding:"16px 16px 14px" }}>
                    {a.problem && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,
                          textTransform:"uppercase",letterSpacing:.5,marginBottom:6 }}>🔴 อาการ / สถานการณ์</div>
                        <div style={{ fontSize:13,color:"#475569",lineHeight:1.7,
                          whiteSpace:"pre-wrap",background:"#fff5f5",
                          border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px" }}>
                          {a.problem}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,
                        textTransform:"uppercase",letterSpacing:.5,marginBottom:6 }}>✅ วิธีแก้ไข</div>
                      <div style={{ fontSize:13,color:"#0f172a",lineHeight:1.8,
                        whiteSpace:"pre-wrap",background:"#f0fdf4",
                        border:"1px solid #bbf7d0",borderRadius:8,padding:"12px 14px" }}>
                        {a.solution}
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
                      <button onClick={()=>{ setEditRec(a); setShowModal(true); }}
                        style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
                          borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,
                          cursor:"pointer",fontFamily:"inherit" }}>✏️ แก้ไข</button>
                      {isAdmin && (
                        <button onClick={()=>setConfirmId(a.id)}
                          style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
                            borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,
                            cursor:"pointer",fontFamily:"inherit" }}>🗑 ลบ</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
            <div style={{ fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:8 }}>ลบบทความนี้?</div>
            <div style={{ fontSize:13,color:"#64748b",marginBottom:20 }}>ไม่สามารถกู้คืนได้</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              <button onClick={()=>setConfirmId(null)}
                style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
                  borderRadius:10,padding:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ยกเลิก
              </button>
              <button onClick={()=>deleteArticle(confirmId)}
                style={{ background:"#ef4444",border:"none",color:"#fff",
                  borderRadius:10,padding:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <KnowledgeModal
          onClose={()=>{ setShowModal(false); setEditRec(null); }}
          onSave={saveArticle} saving={saving}
          editRecord={editRec}
        />
      )}
    </div>
  );
}
