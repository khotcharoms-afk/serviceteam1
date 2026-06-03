import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";

const IS = (x={}) => ({
  width:"100%", background:"#fff", border:"1px solid #e2e8f0",
  borderRadius:10, color:"#1e293b", padding:"12px 14px", fontSize:14,
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
    <div style={{ minHeight:"100vh", background:"#f8fafc",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai','Sora',sans-serif", padding:16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        *{box-sizing:border-box}
        input:focus{border-color:#93c5fd !important;box-shadow:0 0 0 3px #dbeafe !important;outline:none}
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
          <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>ตั้งรหัสผ่านใหม่</div>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:16, padding:"28px",
          boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e2e8f0" }}>

          {verifying ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:14 }}>
              กำลังตรวจสอบลิงก์...
            </div>
          ) : done ? (
            <div style={{ textAlign:"center", padding:"12px 0" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:8 }}>
                ตั้งรหัสผ่านใหม่สำเร็จ
              </div>
              <div style={{ fontSize:13, color:"#64748b", marginBottom:20, lineHeight:1.6 }}>
                คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว
              </div>
              <button onClick={onDone}
                style={{ width:"100%", background:"linear-gradient(135deg,#2563eb,#7c3aed)",
                  border:"none", color:"#fff", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  boxShadow:"0 4px 16px rgba(37,99,235,.3)" }}>
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
                style={{ width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0",
                  color:"#475569", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                กลับหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10,
                padding:"10px 14px", marginBottom:18, fontSize:13, color:"#64748b" }}>
                ตั้งรหัสผ่านใหม่สำหรับ<br/>
                <span style={{ fontWeight:700, color:"#0f172a" }}>{email}</span>
              </div>

              {/* New password */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>รหัสผ่านใหม่ *</div>
                <div style={{ position:"relative" }}>
                  <input type={showPw?"text":"password"} style={IS({ paddingRight:44 })}
                    value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร" required/>
                  <button type="button" onClick={()=>setShowPw(!showPw)}
                    style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8" }}>
                    {showPw?"🙈":"👁"}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12,color:"#64748b",fontWeight:600,marginBottom:5 }}>ยืนยันรหัสผ่านใหม่ *</div>
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
                style={{ width:"100%", background: loading?"#93c5fd":"linear-gradient(135deg,#2563eb,#7c3aed)",
                  border:"none", color:"#fff", borderRadius:10, padding:"13px", fontSize:15,
                  fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit",
                  boxShadow:"0 4px 16px rgba(37,99,235,.3)" }}>
                {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign:"center",marginTop:16,fontSize:12,color:"#cbd5e1" }}>
          ServiceLog © 2026
        </div>
      </div>
    </div>
  );
}
