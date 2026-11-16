import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import EyeIcon from "./components/EyeIcon.jsx";

const IS = (x={}) => ({
  width:"100%", background:"#fff", border:"1px solid #e4e4e7",
  borderRadius:10, color:"#27272a", padding:"12px 14px", fontSize:14,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box",
  transition:"border-color .15s", ...x,
});

export default function ResetPassword({ oobCode, onDone }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [verifying, setVerifying] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  // Verify the reset code on mount
  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then(em => { setEmail(em); setVerifying(false); })
      .catch(() => { setError("ลิงก์รีเซ็ตหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่"); setVerifying(false); });
  }, [oobCode]);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (password !== confirmPw) return setError("รหัสผ่านไม่ตรงกัน");
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err) {
      setError("ไม่สามารถตั้งรหัสผ่านใหม่ได้ ลิงก์อาจหมดอายุ");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#fafafa",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Geist','Noto Sans Thai',system-ui,sans-serif", padding:16 }}>
      <style>{`
        
        *{box-sizing:border-box}
        input:focus{border-color:#a1a1aa !important;box-shadow:0 0 0 3px #f4f4f5 !important;outline:none}
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16,
            background:"#18181b",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize:26, color:"#fff", fontWeight:600, marginBottom:12,
            boxShadow:"none" }}>S</div>
          <div style={{ fontSize:22, fontWeight:600, color:"#09090b" }}>ServiceLog</div>
          <div style={{ fontSize:13, color:"#a1a1aa", marginTop:4 }}>ตั้งรหัสผ่านใหม่</div>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:16, padding:"28px",
          boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e4e4e7" }}>

          {verifying ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:"#a1a1aa", fontSize:14 }}>
              กำลังตรวจสอบลิงก์...
            </div>
          ) : done ? (
            <div style={{ textAlign:"center", padding:"12px 0" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#09090b", marginBottom:8 }}>
                ตั้งรหัสผ่านใหม่สำเร็จ
              </div>
              <div style={{ fontSize:13, color:"#71717a", marginBottom:20, lineHeight:1.6 }}>
                คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว
              </div>
              <button onClick={onDone}
                style={{ width:"100%", background:"#18181b",
                  border:"none", color:"#fff", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  boxShadow:"none" }}>
                ไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : error && !email ? (
            <div style={{ textAlign:"center", padding:"12px 0" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
              <div style={{ fontSize:14, color:"#ef4444", marginBottom:20, lineHeight:1.6, fontWeight:500 }}>
                {error}
              </div>
              <button onClick={onDone}
                style={{ width:"100%", background:"#fafafa", border:"1px solid #e4e4e7",
                  color:"#52525b", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                กลับหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ background:"#fafafa", border:"1px solid #e4e4e7", borderRadius:10,
                padding:"10px 14px", marginBottom:18, fontSize:13, color:"#71717a" }}>
                ตั้งรหัสผ่านใหม่สำหรับ<br/>
                <span style={{ fontWeight:700, color:"#09090b" }}>{email}</span>
              </div>

              {/* New password */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>รหัสผ่านใหม่ *</div>
                <div style={{ position:"relative" }}>
                  <input type={showPw?"text":"password"} style={IS({ paddingRight:44 })}
                    value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร" required/>
                  <button type="button" onClick={()=>setShowPw(!showPw)}
                    style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#a1a1aa" }}>
                    <EyeIcon off={showPw} size={18}/>
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12,color:"#71717a",fontWeight:600,marginBottom:5 }}>ยืนยันรหัสผ่านใหม่ *</div>
                <input type={showPw?"text":"password"} style={IS()}
                  value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง" required/>
              </div>

              {error && (
                <div style={{ background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,
                  padding:"10px 12px",marginBottom:16,fontSize:13,color:"#ef4444",fontWeight:500 }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width:"100%", background: loading?"#a1a1aa":"#18181b",
                  border:"none", color:"#fff", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit",
                  boxShadow:"none" }}>
                {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign:"center",marginTop:16,fontSize:12,color:"#d4d4d8" }}>
          ServiceLog © 2026
        </div>
      </div>
    </div>
  );
}
