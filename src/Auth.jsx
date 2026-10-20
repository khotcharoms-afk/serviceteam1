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
  width:"100%", background:"#fff", border:"1px solid #e2e8f0",
  borderRadius:10, color:"#1e293b", padding:"12px 14px", fontSize:14,
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
    <div style={{ minHeight:"100vh", background:"#f8fafc",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai','Sora',sans-serif", padding:16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        *{box-sizing:border-box}
        input:focus{border-color:#93c5fd !important;box-shadow:0 0 0 3px #dbeafe !important;outline:none}
        .tab-btn:hover{background:#f1f5f9}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16,
            background:"linear-gradient(135deg,#2563eb,#7c3aed)",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize:26, color:"#fff", fontWeight:800, marginBottom:12,
            boxShadow:"0 8px 24px rgba(37,99,235,.3)" }}>S</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#0f172a" }}>ServiceLog</div>
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>ระบบบันทึกการเซอร์วิสโครงการ</div>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px",
          boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e2e8f0" }}>

          {/* Tab */}
          <div style={{ display:"flex", background:"#f8fafc", borderRadius:10,
            padding:4, marginBottom:24, border:"1px solid #e2e8f0" }}>
            {[{v:"login",l:"เข้าสู่ระบบ"},{v:"register",l:"สมัครสมาชิก"}].map(t=>(
              <button key={t.v} className="tab-btn" onClick={()=>{ setMode(t.v); setError(""); }}
                style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none",
                  background: mode===t.v?"#fff":"transparent",
                  color: mode===t.v?"#0f172a":"#94a3b8",
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
                <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>ชื่อ-นามสกุล *</div>
                <input style={IS()} value={name} onChange={e=>setName(e.target.value)}
                  placeholder="ชื่อที่แสดงในระบบ" required/>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>อีเมล *</div>
              <input type="email" style={IS()} value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="example@email.com" required/>
            </div>

            {/* Password */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>รหัสผ่าน *</div>
              <div style={{ position:"relative" }}>
                <input type={showPw?"text":"password"} style={IS({ paddingRight:44 })}
                  value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder={mode==="register"?"อย่างน้อย 6 ตัวอักษร":"รหัสผ่าน"} required/>
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8" }}>
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
                <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>ยืนยันรหัสผ่าน *</div>
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
              style={{ width:"100%",background: loading?"#93c5fd":"linear-gradient(135deg,#2563eb,#7c3aed)",
                border:"none",color:"#fff",borderRadius:10,padding:"13px",fontSize:15,
                fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",
                boxShadow:"0 4px 16px rgba(37,99,235,.3)",transition:"all .2s" }}>
              {loading ? "กำลังดำเนินการ..." : mode==="login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </form>
        </div>

        <div style={{ textAlign:"center",marginTop:16,fontSize:12,color:"#cbd5e1" }}>
          ServiceLog © 2026
        </div>
      </div>
    </div>
  );
}
