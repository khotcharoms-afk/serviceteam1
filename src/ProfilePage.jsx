import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";

export default function ProfilePage({ onBack, currentUser, onSignOut }) {
  const [tab, setTab] = useState("info");

  // Info
  const [displayName, setDisplayName] = useState(currentUser?.name || "");
  const [infoSaving, setInfoSaving]   = useState(false);
  const [infoMsg, setInfoMsg]         = useState("");

  // OT Profile
  const [otProfile, setOtProfile] = useState({
    empId:"", position:"", dept:"", division:"",
    supervisor:"", supervisorOT:"", staff:""
  });
  const [otSaving, setOtSaving] = useState(false);
  const [otMsg, setOtMsg]       = useState("");

  // Password
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState("");
  const [pwError, setPwError]       = useState("");
  const [showPw, setShowPw]         = useState(false);

  const IS = { width:"100%", border:"1px solid #e2e8f0", borderRadius:8,
    padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", background:"#f8fafc" };
  const LB = { fontSize:11, color:"#94a3b8", fontWeight:700, textTransform:"uppercase",
    letterSpacing:.5, marginBottom:4, display:"block" };

  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    getDoc(doc(db,"otProfiles",uid)).then(d => {
      if (d.exists()) {
        const data = d.data();
        setOtProfile({
          empId: data.empId||"",
          position: data.position||"",
          dept: data.dept||"",
          division: data.division||"",
          supervisor: data.supervisor||"",
          supervisorOT: data.supervisorOT||"",
          staff: data.staff||"",
        });
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
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Noto Sans Thai','Sora',sans-serif" }}>
      <header style={{ background:"#fff", borderBottom:"1px solid #e2e8f0",
        padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ background:"#f1f5f9", border:"none", borderRadius:8,
          padding:"6px 12px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"#475569" }}>
          ← กลับ
        </button>
        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>โปรไฟล์</div>
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
          <div style={{ fontSize:18, fontWeight:700, color:"#0f172a" }}>{currentUser?.name}</div>
          <div style={{ fontSize:13, color:"#94a3b8" }}>{auth.currentUser?.email}</div>
          <div style={{ display:"inline-block", marginTop:6, padding:"2px 10px",
            background: currentUser?.role==="dev"?"#f0fdfa":currentUser?.role==="admin"?"#f5f3ff":"#eff6ff",
            border:`1px solid ${currentUser?.role==="dev"?"#99f6e4":currentUser?.role==="admin"?"#e9d5ff":"#bfdbfe"}`,
            borderRadius:20, fontSize:11, fontWeight:700,
            color: currentUser?.role==="dev"?"#0f766e":currentUser?.role==="admin"?"#7c3aed":"#2563eb" }}>
            {currentUser?.role==="dev"?"Dev":currentUser?.role==="admin"?"Admin":"User"}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10,
          padding:4, marginBottom:20, gap:4 }}>
          {[
            {v:"info",l:"ข้อมูลส่วนตัว"},
            {v:"ot",l:"ข้อมูล OT"},
            {v:"password",l:"รหัสผ่าน"},
          ].map(t=>(
            <button key={t.v} onClick={()=>{ setTab(t.v); setInfoMsg(""); setPwMsg(""); setPwError(""); setOtMsg(""); }}
              style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                background:tab===t.v?"#fff":"transparent",
                color:tab===t.v?"#0f172a":"#94a3b8",
                fontWeight:tab===t.v?700:500, fontSize:12, cursor:"pointer",
                fontFamily:"inherit", boxShadow:tab===t.v?"0 1px 4px rgba(0,0,0,.08)":"none" }}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ background:"#fff", borderRadius:16, padding:24,
          boxShadow:"0 4px 24px rgba(0,0,0,.06)", border:"1px solid #e2e8f0" }}>

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
                  style={{ ...IS, background:"#f1f5f9", color:"#94a3b8" }}/>
              </div>
              {infoMsg && <div style={{ marginBottom:12, fontSize:13,
                color:infoMsg.startsWith("✅")?"#16a34a":"#ef4444" }}>{infoMsg}</div>}
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
              <div style={{ fontSize:12, color:"#64748b", marginBottom:16,
                background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:8, padding:"8px 12px" }}>
                ℹ️ ข้อมูลนี้จะถูกใส่ใน Excel หน้าปก OT และใบ OR อัตโนมัติ
              </div>
              {[
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
              {otMsg && <div style={{ marginBottom:12, fontSize:13,
                color:otMsg.startsWith("✅")?"#16a34a":"#ef4444" }}>{otMsg}</div>}
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
                fontSize:12, color:"#64748b", marginBottom:16, cursor:"pointer" }}>
                <input type="checkbox" checked={showPw} onChange={e=>setShowPw(e.target.checked)}
                  style={{ accentColor:"#F97316" }}/>
                แสดงรหัสผ่าน
              </label>
              {pwError && <div style={{ marginBottom:12, fontSize:13, color:"#ef4444",
                background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8,
                padding:"8px 12px" }}>⚠ {pwError}</div>}
              {pwMsg && <div style={{ marginBottom:12, fontSize:13, color:"#16a34a",
                background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8,
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
          style={{ width:"100%", marginTop:16, background:"#fff",
            border:"1px solid #fecaca", color:"#ef4444", borderRadius:10,
            padding:12, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
