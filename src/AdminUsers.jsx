import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";

const ROLE_OPTS = [
  { value:"admin",   label:"Admin",      color:"#7c3aed", bg:"#f5f3ff" },
  { value:"user",    label:"User",       color:"#2563eb", bg:"#eff6ff" },
  { value:"pending", label:"รออนุมัติ",  color:"#f59e0b", bg:"#fef3c7" },
];

export default function AdminUsers({ onBack }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editUser, setEditUser] = useState(null);

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

  async function saveUserSettings(uid, data) {
    await updateDoc(doc(db,"users",uid), data);
    setEditUser(null);
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

        {/* Pending */}
        {pending.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ fontSize:12,color:"#f59e0b",fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>รออนุมัติ</div>
              <span style={{ background:"#fef3c7",color:"#f59e0b",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700 }}>{pending.length}</span>
            </div>
            {pending.map(u=>(
              <UserCard key={u.id} user={u} onRole={changeRole} onRemove={removeUser} onEdit={setEditUser}/>
            ))}
          </div>
        )}

        {/* Active */}
        <div>
          <div style={{ fontSize:12,color:"#94a3b8",fontWeight:700,letterSpacing:1,
            textTransform:"uppercase",marginBottom:12 }}>ผู้ใช้ทั้งหมด ({active.length})</div>
          {loading && <div style={{ textAlign:"center",color:"#94a3b8",padding:32 }}>กำลังโหลด...</div>}
          {active.map(u=>(
            <UserCard key={u.id} user={u} onRole={changeRole} onRemove={removeUser} onEdit={setEditUser}/>
          ))}
          {!loading && active.length===0 && (
            <div style={{ textAlign:"center",color:"#cbd5e1",padding:32,fontSize:14 }}>ยังไม่มีผู้ใช้</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal user={editUser} onClose={()=>setEditUser(null)} onSave={saveUserSettings}/>
      )}
    </div>
  );
}

function UserCard({ user, onRole, onRemove, onEdit }) {
  const roleOpt = ROLE_OPTS.find(r=>r.value===user.role)||ROLE_OPTS[2];
  return (
    <div style={{ background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,
      padding:"14px 16px",marginBottom:10 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        <div style={{ width:40,height:40,borderRadius:"50%",flexShrink:0,
          background:`hsl(${user.name?.charCodeAt(0)*7%360},60%,70%)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:16,fontWeight:700,color:"#fff" }}>
          {user.name?.charAt(0)||"?"}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{user.name||"ไม่ระบุชื่อ"}</div>
          <div style={{ fontSize:12,color:"#94a3b8",marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
        </div>
        <select value={user.role} onChange={e=>onRole(user.id,e.target.value)}
          style={{ background:roleOpt.bg,border:`1px solid ${roleOpt.color}30`,
            color:roleOpt.color,borderRadius:8,padding:"5px 10px",fontSize:12,
            fontWeight:700,cursor:"pointer",fontFamily:"inherit",outline:"none" }}>
          {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {user.role !== "pending" && (
          <button onClick={()=>onEdit(user)}
            style={{ background:"#eff6ff",border:"1px solid #bfdbfe",color:"#2563eb",
              borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 }}>
            ✏️
          </button>
        )}
        <button onClick={()=>onRemove(user.id)}
          style={{ background:"#fff5f5",border:"1px solid #fecaca",color:"#ef4444",
            borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>
          ✕
        </button>
      </div>
      {/* แสดง summary เล็กๆ */}
      {user.role !== "pending" && (
        <div style={{ marginTop:8,display:"flex",gap:12,flexWrap:"wrap" }}>
          {user.onsiteRate > 0 && (
            <span style={{ fontSize:11,color:"#16a34a" }}>💰 {user.onsiteRate.toLocaleString()} บ./ครั้ง</span>
          )}
          {user.role==="user" && (
            <span style={{ fontSize:11,color:user.canEditShift?"#2563eb":"#94a3b8" }}>
              📅 {user.canEditShift?"แก้ตารางกะได้":"ไม่สามารถแก้ตารางกะ"}
            </span>
          )}
          {user.leaveQuota?.vacation > 0 && (
            <span style={{ fontSize:11,color:"#7c3aed" }}>📋 พักผ่อน {user.leaveQuota.vacation} วัน/ปี</span>
          )}
        </div>
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }) {
  const [onsiteRate, setOnsiteRate] = useState(user.onsiteRate?.toString()||"");
  const [canEditShift, setCanEditShift] = useState(!!user.canEditShift);
  const q = user.leaveQuota || {};
  const [quota, setQuota] = useState({
    vacation: q.vacation?.toString()||"",
    personal: q.personal?.toString()||"",
    sick:     q.sick?.toString()||"",
    other:    q.other?.toString()||"",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(user.id, {
      onsiteRate: parseFloat(onsiteRate)||0,
      canEditShift,
      leaveQuota: {
        vacation: parseFloat(quota.vacation)||0,
        personal: parseFloat(quota.personal)||0,
        sick:     parseFloat(quota.sick)||0,
        other:    parseFloat(quota.other)||0,
      },
    });
    setSaving(false);
  }

  const IS = { width:"100%",border:"1px solid #e2e8f0",borderRadius:8,
    padding:"8px 12px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#f8fafc" };
  const LB = { fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",
    letterSpacing:.5,marginBottom:4,display:"block" };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:460,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:24 }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",
              background:`hsl(${user.name?.charCodeAt(0)*7%360},60%,70%)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,fontWeight:700,color:"#fff" }}>
              {user.name?.charAt(0)||"?"}
            </div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#0f172a" }}>{user.name}</div>
              <div style={{ fontSize:12,color:"#94a3b8" }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",color:"#64748b",
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* ค่าแรง Onsite */}
        <div style={{ marginBottom:16 }}>
          <label style={LB}>💰 ค่าแรง Onsite (บาท/ครั้ง)</label>
          <input type="number" min="0" value={onsiteRate}
            onChange={e=>setOnsiteRate(e.target.value)} style={IS} placeholder="0"/>
        </div>

        {/* สิทธิ์ตารางกะ (เฉพาะ user) */}
        {user.role === "user" && (
          <div style={{ marginBottom:16,padding:"12px 14px",background:"#f8fafc",
            border:"1px solid #e2e8f0",borderRadius:10,
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:"#0f172a" }}>📅 สิทธิ์ลงตารางกะ</div>
              <div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>อนุญาตให้แก้ไขตารางกะได้</div>
            </div>
            <button onClick={()=>setCanEditShift(v=>!v)}
              style={{ background:canEditShift?"#2563eb":"#f1f5f9",
                border:`1px solid ${canEditShift?"#2563eb":"#e2e8f0"}`,
                color:canEditShift?"#fff":"#64748b",
                borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit" }}>
              {canEditShift ? "เปิด ✓" : "ปิด"}
            </button>
          </div>
        )}

        {/* วันลาที่ได้รับ */}
        <div style={{ marginBottom:20 }}>
          <label style={LB}>📋 วันลาที่ได้รับต่อปี (วัน)</label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[
              { key:"vacation", label:"ลาพักร้อน" },
              { key:"personal", label:"ลากิจ" },
              { key:"sick",     label:"ลาป่วย" },
              { key:"other",    label:"อื่นๆ" },
            ].map(t => (
              <div key={t.key}>
                <div style={{ fontSize:12,color:"#64748b",marginBottom:4 }}>{t.label}</div>
                <input type="number" min="0" value={quota[t.key]}
                  onChange={e=>setQuota(prev=>({...prev,[t.key]:e.target.value}))}
                  placeholder="0" style={IS}/>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
          <button onClick={onClose}
            style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
              borderRadius:10,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:10,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:saving?0.7:1 }}>
            {saving?"กำลังบันทึก...":"💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
