import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import App from "./App.jsx";
import Auth from "./Auth.jsx";

export default function Root() {
  const [authUser, setAuthUser]   = useState(undefined); // undefined = loading
  const [userDoc,  setUserDoc]    = useState(null);
  const [unsub,    setUnsub]      = useState(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (unsub) unsub();
      if (user) {
        // Listen to user's Firestore doc for role
        const u = onSnapshot(doc(db, "users", user.uid), snap => {
          setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        });
        setUnsub(() => u);
      } else {
        setUserDoc(null);
      }
    });
    return () => { off(); if (unsub) unsub(); };
  }, []);

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

  // Logged in but pending approval
  if (!userDoc || userDoc.role === "pending") return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Noto Sans Thai',sans-serif", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px",
        maxWidth:400, width:"100%", textAlign:"center",
        boxShadow:"0 4px 24px rgba(0,0,0,.08)", border:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⏳</div>
        <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginBottom:8 }}>
          รอการอนุมัติ
        </div>
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

  // Logged in and approved
  return <App currentUser={userDoc} onSignOut={() => signOut(auth)} />;
}
