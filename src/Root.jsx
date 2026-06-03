import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import App from "./App.jsx";
import Auth from "./Auth.jsx";
import ResetPassword from "./ResetPassword.jsx";

export default function Root() {
  const [authUser, setAuthUser] = useState(undefined);
  const [userDoc,  setUserDoc]  = useState(null);
  const unsubRef = useRef(null);

  // Check URL for Firebase password-reset action
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get("mode");
  const oobCode = params.get("oobCode");
  const [showReset, setShowReset] = useState(urlMode === "resetPassword" && !!oobCode);

  useEffect(() => {
    let mounted = true;

    const off = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;

      // cleanup previous firestore listener
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }

      setAuthUser(user || null);

      if (user) {
        try {
          const u = onSnapshot(
            doc(db, "users", user.uid),
            (snap) => {
              if (!mounted) return;
              setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
            },
            (err) => { console.error("Firestore error:", err); }
          );
          unsubRef.current = u;
        } catch(e) {
          console.error("onSnapshot error:", e);
        }
      } else {
        setUserDoc(null);
      }
    }, (err) => {
      console.error("Auth error:", err);
      if (mounted) setAuthUser(null);
    });

    return () => {
      mounted = false;
      off();
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // Show custom reset password page if URL has reset action
  if (showReset) {
    return <ResetPassword oobCode={oobCode} onDone={() => {
      window.history.replaceState({}, "", window.location.pathname);
      setShowReset(false);
    }} />;
  }

  // Loading
  if (authUser === undefined) return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai',sans-serif", color:"#94a3b8", fontSize:14 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, color:"#2563eb", marginBottom:10 }}>◈</div>
        กำลังโหลด...
      </div>
    </div>
  );

  // Not logged in
  if (!authUser) return <Auth />;

  // Logged in but no userDoc yet (loading role)
  if (userDoc === null) return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai',sans-serif", color:"#94a3b8", fontSize:14 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, color:"#2563eb", marginBottom:10 }}>◈</div>
        กำลังตรวจสอบสิทธิ์...
      </div>
    </div>
  );

  // Pending approval
  if (userDoc.role === "pending") return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai',sans-serif", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px",
        maxWidth:400, width:"100%", textAlign:"center",
        boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⏳</div>
        <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginBottom:8 }}>รอการอนุมัติ</div>
        <div style={{ fontSize:14, color:"#64748b", lineHeight:1.7, marginBottom:24 }}>
          บัญชีของคุณอยู่ระหว่างรอ Admin อนุมัติ<br/>
          กรุณารอสักครู่แล้วลองใหม่อีกครั้ง
        </div>
        <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px",
          marginBottom:20, fontSize:13, color:"#475569" }}>
          {authUser.email}
        </div>
        <button onClick={() => signOut(auth)}
          style={{ background:"#f1f5f9", border:"1px solid #e2e8f0", color:"#64748b",
            borderRadius:10, padding:"10px 24px", fontSize:14, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return <App currentUser={userDoc} onSignOut={() => signOut(auth)} />;
}
