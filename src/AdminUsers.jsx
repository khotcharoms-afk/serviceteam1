import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";

const ROLE_OPTS = [
  { value:"admin", label:"Admin",  color:"#7c3aed", bg:"#f5f3ff" },
  { value:"user",  label:"User",   color:"#2563eb", bg:"#eff6ff" },
  { value:"pending",label:"รออนุมัติ",color:"#f59e0b",bg:"#fef3c7" },
];

export default function AdminUsers({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = onSnapshot(collection(db,"users"), snap => {
      setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return u;
  }, []);

  async function changeRole(uid, role) {
    await updateDoc(doc(db,"users",uid), { role });
  }

  async function removeUser(uid) {
    if (!confirm("ลบผู้ใช้นี้ออกจากระบบ?")) return;
    await deleteDoc(doc(db,"users",uid));
  }

  async function toggleShift(uid, current) {
    await updateDoc(doc(db,"users",uid), { canEditShift: !current });
  }

  const pending = users.filter(u=>u.role==="pending");
  const active  = users.filter(u=>u.role!=="pending");

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
        <div style={{ fontSize:16,fontWeight:800,color:"#0f172a" }}>👥 จัดการผู้ใช้</div>
        <div style={{ marginLeft:"auto",fontSize:12,color:"#94a3b8" }}>{users.length} คน</div>
      </div>

      <div style={{ padding:"20px 20px 48px",maxWidth:640,margin:"0 auto" }}>

        {/* Pending approval */}
        {pending.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ fontSize:12,color:"#f59e0b",fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>
                รออนุมัติ
              </div>
              <span style={{ background:"#fef3c7",color:"#f59e0b",borderRadius:20,
                padding:"1px 8px",fontSize:11,fontWeight:700 }}>{pending.length}</span>
            </div>
            {pending.map(u=>(
              <UserCard key={u.id} user={u} onRole={changeRole} onRemove={removeUser} onToggleShift={toggleShift}/>
            ))}
          </div>
        )}

        {/* Active users */}
        <div>
          <div style={{ fontSize:12,color:"#94a3b8",fontWeight:700,letterSpacing:1,
            textTransform:"uppercase",marginBottom:12 }}>ผู้ใช้ทั้งหมด ({active.length})</div>
          {loading && <div style={{ textAlign:"center",color:"#94a3b8",padding:32 }}>กำลังโหลด...</div>}
          {active.map(u=>(
            <UserCard key={u.id} user={u} onRole={changeRole} onRemove={removeUser} onToggleShift={toggleShift}/>
          ))}
          {!loading && active.length===0 && (
            <div style={{ textAlign:"center",color:"#cbd5e1",padding:32,fontSize:14 }}>ยังไม่มีผู้ใช้</div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserCard({ user, onRole, onRemove, onToggleShift }) {
  const roleOpt = ROLE_OPTS.find(r=>r.value===user.role)||ROLE_OPTS[2];
  return (
    <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
      padding:"14px 16px",marginBottom:10 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        {/* Avatar */}
        <div style={{ width:40,height:40,borderRadius:"50%",flexShrink:0,
          background:`hsl(${user.name?.charCodeAt(0)*7%360},60%,70%)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:16,fontWeight:700,color:"#fff" }}>
          {user.name?.charAt(0)||"?"}
        </div>
        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{user.name||"ไม่ระบุชื่อ"}</div>
          <div style={{ fontSize:12,color:"#94a3b8",marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
        </div>
        {/* Role selector */}
        <select value={user.role} onChange={e=>onRole(user.id,e.target.value)}
          style={{ background:roleOpt.bg,border:`1px solid ${roleOpt.color}30`,
            color:roleOpt.color,borderRadius:8,padding:"5px 10px",fontSize:12,
            fontWeight:700,cursor:"pointer",fontFamily:"inherit",outline:"none" }}>
          {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {/* Remove */}
        <button onClick={()=>onRemove(user.id)}
          style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
            borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>
          ✕
        </button>
      </div>
      {/* canEditShift toggle — แสดงเฉพาะ user ปกติ */}
      {user.role === "user" && (
        <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #f1f5f9",
          display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <span style={{ fontSize:12,fontWeight:600,color:"#475569" }}>📅 สิทธิ์ลงตารางกะ</span>
            <span style={{ fontSize:11,color:"#94a3b8",marginLeft:8 }}>
              {user.canEditShift ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </span>
          </div>
          <button onClick={()=>onToggleShift(user.id, !!user.canEditShift)}
            style={{ background:user.canEditShift?"#2563eb":"#f1f5f9",
              border:`1px solid ${user.canEditShift?"#2563eb":"#e2e8f0"}`,
              color:user.canEditShift?"#fff":"#64748b",
              borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit" }}>
            {user.canEditShift ? "เปิด ✓" : "ปิด"}
          </button>
        </div>
      )}
    </div>
  );
}
