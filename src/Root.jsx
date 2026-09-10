import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, getDocFromServer } from "firebase/firestore";
import App from "./App.jsx";
import Auth from "./Auth.jsx";
import ResetPassword from "./ResetPassword.jsx";

export default function Root() {
  const [authUser, setAuthUser] = useState(undefined);
  const [userDoc,  setUserDoc]  = useState(null);
  const [docErr,   setDocErr]   = useState("");   // listener พัง → บอกผู้ใช้ ไม่ใช่เงียบ
  const [checking, setChecking] = useState(false);
  const unsubRef = useRef(null);

  // อ่าน role จาก server ตรงๆ ข้ามแคชในเครื่อง
  async function checkFromServer() {
    const user = auth.currentUser;
    if (!user) return;
    setChecking(true); setDocErr("");
    try {
      const snap = await getDocFromServer(doc(db, "users", user.uid));
      setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : "missing");
    } catch (e) {
      console.error("getDocFromServer error:", e);
      setDocErr("เชื่อมต่อฐานข้อมูลไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    }
    setChecking(false);
  }

  // ล้าง service worker + cache แล้วโหลดใหม่ (แก้กรณีเครื่องยึด bundle เก่าไว้)
  async function hardReload() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.error("hardReload cleanup failed:", e);
    }
    window.location.reload(true);
  }

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
              setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : "missing");
            },
            (err) => {
              console.error("Firestore error:", err);
              if (mounted) setDocErr("เชื่อมต่อฐานข้อมูลไม่สำเร็จ — ลองกดตรวจสอบสถานะอีกครั้ง");
            }
          );
          unsubRef.current = u;
          // กันกรณีแคชในเครื่องค้างค่าเก่า: บังคับอ่านจาก server หนึ่งรอบ
          getDocFromServer(doc(db, "users", user.uid))
            .then((snap) => {
              if (!mounted) return;
              setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : "missing");
            })
            .catch((e) => console.error("initial server read failed:", e));
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

  // บัญชีถูกระงับ หรือไม่มีข้อมูลผู้ใช้ในระบบแล้ว
  if (userDoc === "missing" || userDoc.role === "disabled") {
    const isMissing = userDoc === "missing";
    return (
      <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'Noto Sans Thai',sans-serif", padding:20 }}>
        <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px",
          maxWidth:400, width:"100%", textAlign:"center",
          boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e2e8f0" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🚫</div>
          <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginBottom:8 }}>
            {isMissing ? "ไม่พบข้อมูลผู้ใช้" : "บัญชีถูกระงับการใช้งาน"}
          </div>
          <div style={{ fontSize:14, color:"#64748b", lineHeight:1.7, marginBottom:20 }}>
            {isMissing
              ? <>บัญชีนี้ไม่มีข้อมูลผู้ใช้ในระบบแล้ว<br/>กรุณาติดต่อ Admin</>
              : <>บัญชีนี้ถูกระงับโดยผู้ดูแลระบบ<br/>ติดต่อ Admin หากต้องการใช้งานต่อ</>}
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
  }

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
          marginBottom:16, fontSize:13, color:"#475569" }}>
          {authUser.email}
        </div>

        {docErr && (
          <div style={{ background:"#fff5f5", border:"1px solid #fecaca", color:"#ef4444",
            borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12.5,
            lineHeight:1.6, textAlign:"left" }}>
            ⚠ {docErr}
          </div>
        )}

        <button onClick={checkFromServer} disabled={checking}
          style={{ width:"100%", background:"#2563eb", border:"none", color:"#fff",
            borderRadius:10, padding:"11px 24px", fontSize:14, fontWeight:700,
            cursor:checking?"default":"pointer", fontFamily:"inherit", marginBottom:10,
            opacity:checking?.6:1 }}>
          {checking ? "กำลังตรวจสอบ…" : "🔄 ตรวจสอบสถานะอีกครั้ง"}
        </button>

        <button onClick={hardReload}
          style={{ width:"100%", background:"#fff", border:"1px solid #e2e8f0", color:"#475569",
            borderRadius:10, padding:"11px 24px", fontSize:13.5, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit", marginBottom:10 }}>
          ล้างแคชแล้วโหลดใหม่
        </button>

        <button onClick={() => signOut(auth)}
          style={{ background:"none", border:"none", color:"#94a3b8",
            padding:"6px 12px", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit" }}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return <App currentUser={userDoc} onSignOut={() => signOut(auth)} />;
}
