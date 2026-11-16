import { useState } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import EyeIcon from "./components/EyeIcon.jsx";

const IS = (x={}) => ({
  width:"100%", background:"#fff", border:"1px solid #e4e4e7",
  borderRadius:8, color:"#27272a", padding:"12px 14px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  transition:"border-color .15s", ...x,
});

export default function Auth() {
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleResetPassword() {
    setError(""); setResetSent(false);
    if (!email.trim()) return setError("กรุณาใส่อีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้ง");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      setError(errMsg(err.code));
    }
    setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(errMsg(err.code));
    }
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(""); 
    if (!name.trim()) return setError("กรุณาใส่ชื่อ");
    if (password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (password !== confirmPw) return setError("รหัสผ่านไม่ตรงกัน");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      // Save user to Firestore with role "pending" — admin must approve
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        email: email.toLowerCase(),
        role: "pending",
        createdAt: new Date().toISOString(),
      });
      // Notify all admins about new registration
      const adminsSnap = await getDocs(query(collection(db,"users"), where("role","in",["admin","dev"])));
      for(const adminDoc of adminsSnap.docs) {
        await setDoc(doc(db,"notifications",`newuser-${cred.user.uid}-${adminDoc.id}`), {
          type:      "new_user",
          toUid:     adminDoc.id,
          toName:    name.trim(),
          fromName:  name.trim(),
          caseTitle: "",
          note:      email.toLowerCase(),
          createdAt: new Date().toISOString(),
          read:      false,
        });
      }
    } catch (err) {
      setError(errMsg(err.code));
    }
    setLoading(false);
  }

  function errMsg(code) {
    switch(code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      case "auth/email-already-in-use": return "อีเมลนี้ถูกใช้งานแล้ว";
      case "auth/invalid-email": return "รูปแบบอีเมลไม่ถูกต้อง";
      case "auth/missing-email": return "กรุณาใส่อีเมล";
      case "auth/too-many-requests": return "ลองใหม่อีกครั้งในภายหลัง";
      default: return "เกิดข้อผิดพลาด กรุณาลองใหม่";
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#fafafa",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Geist','Noto Sans Thai',system-ui,sans-serif", padding:16 }}>
      <style>{`
        
        *{box-sizing:border-box}
        input:focus{border-color:#a1a1aa !important;box-shadow:0 0 0 3px #f4f4f5 !important;outline:none}
        .tab-btn:hover{background:#f4f4f5}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12,
            background:"#18181b",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize:20, color:"#fafafa", fontWeight:600, marginBottom:16,
            boxShadow:"none" }}>S</div>
          <div style={{ fontSize:22, fontWeight:600, color:"#09090b" }}>ServiceLog</div>
          <div style={{ fontSize:13, color:"#a1a1aa", marginTop:4 }}>ระบบบันทึกการเซอร์วิสโครงการ</div>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:12, padding:24,
          boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e4e4e7" }}>

          {/* Tab */}
          <div style={{ display:"flex", background:"#fafafa", borderRadius:8,
            padding:4, marginBottom:24, border:"1px solid #e4e4e7" }}>
            {[{v:"login",l:"เข้าสู่ระบบ"},{v:"register",l:"สมัครสมาชิก"}].map(t=>(
              <button key={t.v} className="tab-btn" onClick={()=>{ setMode(t.v); setError(""); }}
                style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none",
                  background: mode===t.v?"#fff":"transparent",
                  color: mode===t.v?"#09090b":"#a1a1aa",
                  fontWeight: mode===t.v?700:500, fontSize:14, cursor:"pointer",
                  fontFamily:"inherit", transition:"all .15s",
                  boxShadow: mode===t.v?"0 1px 4px rgba(0,0,0,.08)":"none" }}>
                {t.l}
              </button>
            ))}
          </div>

          <form onSubmit={mode==="login"?handleLogin:handleRegister}>

            {/* Name (register only) */}
            {mode==="register" && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>ชื่อ-นามสกุล *</div>
                <input style={IS()} value={name} onChange={e=>setName(e.target.value)}
                  placeholder="ชื่อที่แสดงในระบบ" required/>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>อีเมล *</div>
              <input type="email" style={IS()} value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="example@email.com" required/>
            </div>

            {/* Password */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>รหัสผ่าน *</div>
              <div style={{ position:"relative" }}>
                <input type={showPw?"text":"password"} style={IS({ paddingRight:44 })}
                  value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder={mode==="register"?"อย่างน้อย 6 ตัวอักษร":"รหัสผ่าน"} required/>
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#a1a1aa" }}>
                  <EyeIcon off={showPw} size={18}/>
                </button>
              </div>
              {/* Forgot password (login only) */}
              {mode==="login" && (
                <div style={{ textAlign:"right",marginTop:8 }}>
                  <button type="button" onClick={handleResetPassword}
                    style={{ background:"none",border:"none",color:"#2563eb",fontSize:12,
                      cursor:"pointer",fontFamily:"inherit",fontWeight:600,padding:0 }}>
                    ลืมรหัสผ่าน?
                  </button>
                </div>
              )}
            </div>

            {/* Confirm Password (register only) */}
            {mode==="register" && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>ยืนยันรหัสผ่าน *</div>
                <input type={showPw?"text":"password"} style={IS()}
                  value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง" required/>
              </div>
            )}

            {/* Register notice */}
            {mode==="register" && (
              <div style={{ background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,
                padding:"10px 12px",marginBottom:16,fontSize:12,color:"#3b82f6",lineHeight:1.6 }}>
                ⚠️ หลังสมัครแล้ว Admin ต้องอนุมัติบัญชีก่อนจึงจะเข้าใช้งานได้
              </div>
            )}

            {/* Reset email sent */}
            {resetSent && (
              <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,
                padding:"10px 12px",marginBottom:16,fontSize:13,color:"#16a34a",
                fontWeight:500,lineHeight:1.6 }}>
                ✅ ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาเช็คกล่องจดหมาย (และโฟลเดอร์ Spam)
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
                padding:"10px 12px",marginBottom:16,fontSize:13,color:"#ef4444",fontWeight:500 }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ width:"100%",background: loading?"#a1a1aa":"#18181b",
                border:"none",color:"#fff",borderRadius:8,padding:"13px",fontSize:15,
                fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",
                boxShadow:"none",transition:"all .2s" }}>
              {loading ? "กำลังดำเนินการ..." : mode==="login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </form>
        </div>

        <div style={{ textAlign:"center",marginTop:16,fontSize:12,color:"#d4d4d8" }}>
          ServiceLog © 2026
        </div>
      </div>
    </div>
  );
}
