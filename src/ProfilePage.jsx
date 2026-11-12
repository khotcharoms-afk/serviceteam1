import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { useTheme } from "./theme.js";
import { IS as inputBase } from "./utils.js";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";

// แปลงรูปลายเซ็น → PNG พื้นโปร่งใส ตัดขอบ ย่อ (สูงไม่เกิน 160px)
// ปฏิเสธรูปพื้นดำ/พื้นเข้ม เพราะจะเป็นกล่องดำในใบ OR
function processSignature(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
      const id = cx.getImageData(0, 0, W, H), d = id.data;
      // ตรวจพื้นหลังจากขอบภาพ
      let sum = 0, n = 0;
      const sample = (x, y) => { const i = (y*W + x)*4; if (d[i+3] > 200) { sum += (d[i]+d[i+1]+d[i+2])/3; n++; } };
      for (let x = 0; x < W; x += Math.max(1, W>>6)) { sample(x, 0); sample(x, H-1); }
      for (let y = 0; y < H; y += Math.max(1, H>>6)) { sample(0, y); sample(W-1, y); }
      if (n > 0 && sum/n < 140) return reject(new Error("พื้นหลังเป็นสีเข้ม/ดำ — ใช้รูปพื้นขาวหรือโปร่งใสเท่านั้น"));
      // ขาว → โปร่งใส + หาขอบเขตลายเซ็น
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y*W + x)*4, l = (d[i]+d[i+1]+d[i+2])/3;
        if (l > 225) d[i+3] = 0;
        if (d[i+3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return reject(new Error("ไม่พบลายเซ็นในรูป"));
      cx.putImageData(id, 0, 0);
      const pad = 4; x0 = Math.max(0, x0-pad); y0 = Math.max(0, y0-pad); x1 = Math.min(W-1, x1+pad); y1 = Math.min(H-1, y1+pad);
      const w = x1-x0+1, h = y1-y0+1, k = Math.min(1, 160/h, 480/w);
      const out = document.createElement("canvas"); out.width = Math.round(w*k); out.height = Math.round(h*k);
      out.getContext("2d").drawImage(cv, x0, y0, w, h, 0, 0, out.width, out.height);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("อ่านไฟล์รูปไม่ได้"));
    const fr = new FileReader(); fr.onload = () => { img.src = fr.result; }; fr.onerror = () => reject(fr.error); fr.readAsDataURL(file);
  });
}

export default function ProfilePage({ onBack, currentUser, onSignOut }) {
  const { c } = useTheme();
  const [tab, setTab] = useState("info");

  // Info
  const [displayName, setDisplayName] = useState(currentUser?.name || "");
  const [infoSaving, setInfoSaving]   = useState(false);
  const [infoMsg, setInfoMsg]         = useState("");

  // OT Profile
  const [otProfile, setOtProfile] = useState({
    nameTH:"", empId:"", position:"", dept:"", division:"",
    supervisor:"", supervisorOT:"", staff:""
  });
  const [otSaving, setOtSaving] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [sigMsg, setSigMsg] = useState("");
  const [otMsg, setOtMsg]       = useState("");

  // Password
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState("");
  const [pwError, setPwError]       = useState("");
  const [showPw, setShowPw]         = useState(false);

  const IS = inputBase({ padding:"10px 12px" });
  const LB = { fontSize:11, color:c.text400, fontWeight:700, textTransform:"uppercase",
    letterSpacing:.5, marginBottom:4, display:"block" };

  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    getDoc(doc(db,"otProfiles",uid)).then(d => {
      if (d.exists()) {
        const data = d.data();
        setOtProfile({
          nameTH: data.nameTH||"",
          empId: data.empId||"",
          position: data.position||"",
          dept: data.dept||"",
          division: data.division||"",
          supervisor: data.supervisor||"",
          supervisorOT: data.supervisorOT||"",
          staff: data.staff||"",
        });
        setSignatures(Array.isArray(data.signatures) ? data.signatures : []);
      }
    });
  }, [currentUser]);

  async function saveInfo() {
    if (!displayName.trim()) return;
    setInfoSaving(true); setInfoMsg("");
    try {
      await updateDoc(doc(db, "users", currentUser.uid || currentUser.id), {
        name: displayName.trim()
      });
      setInfoMsg("✅ บันทึกแล้ว");
    } catch(err) { setInfoMsg("❌ " + err.message); }
    setInfoSaving(false);
  }

  async function saveOT() {
    setOtSaving(true); setOtMsg("");
    try {
      const uid = currentUser?.uid || currentUser?.id;
      // อ่าน profile เดิมก่อน เพื่อไม่ให้ทับ period fields
      const existing = await getDoc(doc(db,"otProfiles",uid));
      const prev = existing.exists() ? existing.data() : {};
      await setDoc(doc(db,"otProfiles",uid), {
        ...prev,
        ...otProfile,
        name: displayName || currentUser?.name || "",
        updatedAt: new Date().toISOString(),
      });
      setOtMsg("✅ บันทึกแล้ว");
    } catch(err) { setOtMsg("❌ " + err.message); }
    setOtSaving(false);
  }

  async function saveSignatures(list) {
    const uid = currentUser?.uid || currentUser?.id;
    await setDoc(doc(db,"otProfiles",uid), { signatures: list, updatedAt: new Date().toISOString() }, { merge:true });
    setSignatures(list);
  }
  async function onSigFiles(files) {
    setSigMsg("");
    const add = [];
    for (const f of files) {
      try { add.push(await processSignature(f)); }
      catch(err) { setSigMsg(`❌ ${f.name}: ${err.message}`); }
    }
    if (!add.length) return;
    try { await saveSignatures([...signatures, ...add].slice(0, 6)); setSigMsg(`✅ เพิ่ม ${add.length} ลายเซ็น`); }
    catch(err) { setSigMsg("❌ " + err.message); }
  }

  async function changePassword() {
    setPwError(""); setPwMsg("");
    if (!currentPw) return setPwError("กรุณาใส่รหัสผ่านปัจจุบัน");
    if (newPw.length < 6) return setPwError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
    if (newPw !== confirmPw) return setPwError("รหัสผ่านใหม่ไม่ตรงกัน");
    setPwSaving(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwMsg("✅ เปลี่ยนรหัสผ่านสำเร็จ");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch(err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPwError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      } else { setPwError(err.message); }
    }
    setPwSaving(false);
  }

  const initials = (currentUser?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div style={{ minHeight:"100vh", background:c.bg, fontFamily:"'Noto Sans Thai','Sora',sans-serif" }}>
      <header style={{ background:c.card, borderBottom:`1px solid ${c.border}`,
        padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ background:c.borderSoft, border:"none", borderRadius:8,
          padding:"6px 12px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:c.text500 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:15, fontWeight:700, color:c.text900 }}>โปรไฟล์</div>
      </header>

      <div style={{ maxWidth:520, margin:"32px auto", padding:"0 16px" }}>
        {/* Avatar */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ width:72, height:72, borderRadius:"50%",
            background:"linear-gradient(135deg,#F97316,#6B21A8)",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize:28, color:"#fff", fontWeight:800, marginBottom:8 }}>
            {initials}
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:c.text900 }}>{currentUser?.name}</div>
          <div style={{ fontSize:13, color:c.text400 }}>{auth.currentUser?.email}</div>
          <div style={{ display:"inline-block", marginTop:6, padding:"2px 10px",
            background: currentUser?.role==="dev"?`${c.teal}1a`:currentUser?.role==="admin"?`${c.purple}1a`:`${c.blue}1a`,
            border:`1px solid ${currentUser?.role==="dev"?`${c.teal}55`:currentUser?.role==="admin"?`${c.purple}55`:`${c.blue}55`}`,
            borderRadius:20, fontSize:11, fontWeight:700,
            color: currentUser?.role==="dev"?c.teal:currentUser?.role==="admin"?c.purple:c.blue }}>
            {currentUser?.role==="dev"?"Dev":currentUser?.role==="admin"?"Admin":"User"}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:c.borderSoft, borderRadius:10,
          padding:4, marginBottom:20, gap:4 }}>
          {[
            {v:"info",l:"ข้อมูลส่วนตัว"},
            {v:"ot",l:"ข้อมูล OT"},
            {v:"password",l:"รหัสผ่าน"},
          ].map(t=>(
            <button key={t.v} onClick={()=>{ setTab(t.v); setInfoMsg(""); setPwMsg(""); setPwError(""); setOtMsg(""); }}
              style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                background:tab===t.v?c.card:"transparent",
                color:tab===t.v?c.text900:c.text400,
                fontWeight:tab===t.v?700:500, fontSize:12, cursor:"pointer",
                fontFamily:"inherit", boxShadow:tab===t.v?"0 1px 4px rgba(0,0,0,.08)":"none" }}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ background:c.card, borderRadius:16, padding:24,
          boxShadow:"0 4px 24px rgba(0,0,0,.06)", border:`1px solid ${c.border}` }}>

          {/* Tab: ข้อมูลส่วนตัว */}
          {tab === "info" && (
            <>
              <div style={{ marginBottom:16 }}>
                <label style={LB}>ชื่อ-นามสกุล</label>
                <input value={displayName} onChange={e=>setDisplayName(e.target.value)}
                  style={IS} placeholder="ชื่อที่แสดงในระบบ"/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={LB}>อีเมล</label>
                <input value={auth.currentUser?.email||""} disabled
                  style={{ ...IS, background:c.borderSoft, color:c.text400 }}/>
              </div>
              {infoMsg && <div style={{ marginBottom:12, fontSize:13,
                color:infoMsg.startsWith("✅")?c.green:c.red }}>{infoMsg}</div>}
              <button onClick={saveInfo} disabled={infoSaving||!displayName.trim()}
                style={{ width:"100%", background:"#F97316", border:"none", color:"#fff",
                  borderRadius:10, padding:12, fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", opacity:infoSaving?0.6:1 }}>
                {infoSaving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </>
          )}

          {/* Tab: ข้อมูล OT */}
          {tab === "ot" && (
            <>
              <div style={{ fontSize:12, color:c.text500, marginBottom:16,
                background:`${c.orange}1a`, border:`1px solid ${c.orange}55`, borderRadius:8, padding:"8px 12px" }}>
                ℹ️ ข้อมูลนี้จะถูกใส่ใน Excel หน้าปก OT และใบ OR อัตโนมัติ
              </div>
              {[
                { key:"nameTH",      label:"ชื่อ-นามสกุล (ภาษาไทย)",   placeholder:"เช่น นายสายัญห์ คชรมย์" },
              { key:"empId",       label:"รหัสพนักงาน",               placeholder:"เช่น MT260101" },
                { key:"position",    label:"ตำแหน่ง",                   placeholder:"เช่น เจ้าหน้าที่บริการลูกค้า" },
                { key:"dept",        label:"แผนก",                      placeholder:"เช่น ศูนย์บริการ" },
                { key:"division",    label:"ฝ่าย",                      placeholder:"เช่น โครงการและการจัดการบริการ" },
                { key:"supervisor",  label:"ชื่อผู้บังคับบัญชา (ใบ OR)", placeholder:"เช่น นายณัฐพงศ์ รัตนไชย" },
                { key:"supervisorOT",label:"ผู้บังคับบัญชา (หน้าปก OT)", placeholder:"เช่น นายณัฐพงศ์ รัตนไชย" },
                { key:"staff",       label:"Staff (ผู้ร่วมงาน)",         placeholder:"เช่น nuttapong sayan.kho" },
              ].map(f=>(
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={LB}>{f.label}</label>
                  <input value={otProfile[f.key]||""} placeholder={f.placeholder}
                    onChange={e=>setOtProfile(p=>({...p,[f.key]:e.target.value}))}
                    style={IS}/>
                </div>
              ))}
              <div style={{ marginBottom:16 }}>
                <label style={LB}>ลายเซ็นสำหรับใบ OR (วนใช้ทีละหน้า · สูงสุด 6)</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                  {signatures.map((s,i)=>(
                    <div key={i} style={{ position:"relative", border:`1px solid ${c.border}`, borderRadius:8,
                      background:"#fff", padding:6, height:64, display:"flex", alignItems:"center" }}>
                      <img src={s} alt={`ลายเซ็น ${i+1}`} style={{ maxHeight:50, maxWidth:140 }}/>
                      <span style={{ position:"absolute", left:4, top:2, fontSize:10, color:"#94a3b8" }}>{i+1}</span>
                      <button onClick={()=>saveSignatures(signatures.filter((_,j)=>j!==i)).catch(e=>setSigMsg("❌ "+e.message))}
                        title="ลบ" style={{ position:"absolute", right:-6, top:-6, width:20, height:20, borderRadius:"50%",
                          border:"none", background:"#ef4444", color:"#fff", fontSize:11, cursor:"pointer" }}>✕</button>
                    </div>
                  ))}
                  {signatures.length < 6 && (
                    <label style={{ border:`1px dashed ${c.border}`, borderRadius:8, height:64, padding:"0 14px",
                      display:"flex", alignItems:"center", fontSize:12, color:c.text500, cursor:"pointer" }}>
                      + อัปโหลด PNG/JPG
                      <input type="file" accept="image/*" multiple style={{ display:"none" }}
                        onChange={e=>{ onSigFiles([...e.target.files]); e.target.value=""; }}/>
                    </label>
                  )}
                </div>
                <div style={{ fontSize:11, color:c.text400 }}>พื้นขาวหรือโปร่งใสเท่านั้น — ระบบลบพื้นขาวและตัดขอบให้อัตโนมัติ</div>
                {sigMsg && <div style={{ marginTop:6, fontSize:12, color:sigMsg.startsWith("✅")?c.green:c.red }}>{sigMsg}</div>}
              </div>
              {otMsg && <div style={{ marginBottom:12, fontSize:13,
                color:otMsg.startsWith("✅")?c.green:c.red }}>{otMsg}</div>}
              <button onClick={saveOT} disabled={otSaving}
                style={{ width:"100%", background:"#F97316", border:"none", color:"#fff",
                  borderRadius:10, padding:12, fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", opacity:otSaving?0.6:1 }}>
                {otSaving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล OT"}
              </button>
            </>
          )}

          {/* Tab: รหัสผ่าน */}
          {tab === "password" && (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={LB}>รหัสผ่านปัจจุบัน</label>
                <input type={showPw?"text":"password"} value={currentPw}
                  onChange={e=>setCurrentPw(e.target.value)} style={IS}
                  placeholder="รหัสผ่านปัจจุบัน"/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={LB}>รหัสผ่านใหม่</label>
                <input type={showPw?"text":"password"} value={newPw}
                  onChange={e=>setNewPw(e.target.value)} style={IS}
                  placeholder="อย่างน้อย 6 ตัวอักษร"/>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={LB}>ยืนยันรหัสผ่านใหม่</label>
                <input type={showPw?"text":"password"} value={confirmPw}
                  onChange={e=>setConfirmPw(e.target.value)} style={IS}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"/>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:6,
                fontSize:12, color:c.text500, marginBottom:16, cursor:"pointer" }}>
                <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)}
                  style={{ accentColor:"#F97316" }}/>
                แสดงรหัสผ่าน
              </label>
              {pwError && <div style={{ marginBottom:12, fontSize:13, color:c.red,
                background:`${c.red}1a`, border:`1px solid ${c.red}55`, borderRadius:8,
                padding:"8px 12px" }}>⚠ {pwError}</div>}
              {pwMsg && <div style={{ marginBottom:12, fontSize:13, color:c.green,
                background:`${c.green}1a`, border:`1px solid ${c.green}55`, borderRadius:8,
                padding:"8px 12px" }}>{pwMsg}</div>}
              <button onClick={changePassword} disabled={pwSaving}
                style={{ width:"100%", background:"#F97316", border:"none", color:"#fff",
                  borderRadius:10, padding:12, fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", opacity:pwSaving?0.6:1 }}>
                {pwSaving ? "กำลังเปลี่ยน..." : "🔑 เปลี่ยนรหัสผ่าน"}
              </button>
            </>
          )}
        </div>

        <button onClick={onSignOut}
          style={{ width:"100%", marginTop:16, background:c.card,
            border:`1px solid ${c.red}55`, color:c.red, borderRadius:10,
            padding:12, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
