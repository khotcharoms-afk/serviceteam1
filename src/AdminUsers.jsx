import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { useTheme } from "./theme.js";
import { IS as inputBase, FEATURE_SHIFT } from "./utils.js";
import { collection, onSnapshot, doc, updateDoc, getDocs, query, where, writeBatch, setDoc, getFirestore } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut } from "firebase/auth";

// สร้างบัญชีให้ผู้ใช้ใหม่โดยไม่ทำให้ admin หลุดจากระบบ:
// ใช้ Firebase app ตัวที่สอง (เก็บ session ในหน่วยความจำ) สร้างบัญชีด้วยรหัสสุ่มที่ไม่มีใครเห็น
// แล้วส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านเอง
async function createUserAccount({ name, email, role }) {
  const sec = initializeApp(db.app.options, `adduser-${Date.now()}`);
  try {
    const secAuth = initializeAuth(sec, { persistence: inMemoryPersistence });
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const tmp = Array.from(bytes, b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"[b % 61]).join("");
    const cred = await createUserWithEmailAndPassword(secAuth, email, tmp);
    await updateProfile(cred.user, { displayName: name });
    // เขียนเอกสารผู้ใช้ในนามบัญชีใหม่ (rules อนุญาตให้สร้างของตัวเอง) เป็น pending ก่อน
    await setDoc(doc(getFirestore(sec), "users", cred.user.uid), {
      name, email, role: "pending", createdAt: new Date().toISOString(), createdByAdmin: true,
    });
    await sendPasswordResetEmail(secAuth, email);
    await signOut(secAuth);
    // admin ตั้ง role จริงด้วยบัญชีตัวเอง
    await updateDoc(doc(db, "users", cred.user.uid), { role });
    return cred.user.uid;
  } finally {
    await deleteApp(sec).catch(() => {});
  }
}

const AUTH_ERR = {
  "auth/email-already-in-use": "อีเมลนี้มีบัญชีอยู่แล้ว",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/network-request-failed": "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง",
  "auth/too-many-requests": "ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่",
};

// tone = ชื่อสีใน theme.js — แปลงเป็นสีจริงตอนเรนเดอร์ ให้เปลี่ยนตามโหมดมืด/สว่าง
const ROLE_OPTS = [
  { value:"dev",     label:"Dev",        tone:"teal"    },
  { value:"admin",   label:"Admin",      tone:"purple"  },
  { value:"user",    label:"User",       tone:"blue"    },
  { value:"pending", label:"รออนุมัติ",  tone:"amber"   },
  { value:"disabled",label:"ระงับใช้งาน", tone:"text500" },
];

export default function AdminUsers({ onBack, currentUser }) {
  const { c } = useTheme();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editUser, setEditUser]     = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [cleaning, setCleaning]     = useState(false);
  const [cleanResult, setCleanResult] = useState(null);

  useEffect(() => {
    const u = onSnapshot(collection(db,"users"), snap => {
      setUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return u;
  }, []);

  async function changeRole(uid, role) {
    const target = users.find(u=>u.id===uid);
    // ห้าม non-dev เปลี่ยน role ของ dev หรือเปลี่ยนเป็น dev
    if (currentUser?.role !== "dev" && (target?.role === "dev" || role === "dev")) {
      return alert("เฉพาะ Dev เท่านั้นที่จัดการสิทธิ์ระดับ Dev ได้");
    }
    if (uid === currentUser?.id) return alert("เปลี่ยนสิทธิ์ของตัวเองไม่ได้");
    await updateDoc(doc(db,"users",uid), { role });
  }

  // ไม่ลบ doc ทิ้ง เพราะบัญชีใน Firebase Authentication ลบจากฝั่ง client ไม่ได้
  // ถ้าลบแต่ doc อีเมลจะยังถูกจอง สมัครใหม่ไม่ได้ และบัญชีนั้นยังล็อกอินค้างได้
  async function disableUser(uid) {
    const target = users.find(u => u.id === uid);
    if (currentUser?.role !== "dev" && target?.role === "dev") {
      return alert("เฉพาะ Dev เท่านั้นที่ระงับบัญชี Dev ได้");
    }
    if (uid === currentUser?.id) return alert("ระงับบัญชีตัวเองไม่ได้");
    if (!confirm(`ระงับการใช้งานของ "${target?.name || "ผู้ใช้นี้"}"?\n\nผู้ใช้จะเข้าระบบไม่ได้ แต่ข้อมูลและประวัติเคสยังอยู่ครบ\nคืนสิทธิ์ภายหลังได้`)) return;
    await updateDoc(doc(db,"users",uid), {
      role:"disabled", prevRole:target?.role || "user", disabledAt:new Date().toISOString(),
    });
  }

  async function restoreUser(uid) {
    const target = users.find(u => u.id === uid);
    // คืน role เดิมที่เก็บไว้ตอนระงับ — ถ้าเดิมเป็น dev ต้องเป็น dev เท่านั้นที่คืนได้
    const back = target?.prevRole || "user";
    if (currentUser?.role !== "dev" && back === "dev") {
      return alert("เฉพาะ Dev เท่านั้นที่คืนสิทธิ์ระดับ Dev ได้");
    }
    const roleLabel = ROLE_OPTS.find(r=>r.value===back)?.label || back;
    if (!confirm(`คืนสิทธิ์ให้ "${target?.name || "ผู้ใช้นี้"}" เป็น ${roleLabel}?`)) return;
    await updateDoc(doc(db,"users",uid), { role:back, prevRole:null, disabledAt:null });
  }

  async function cleanNotifications(days) {
    setCleaning(true); setCleanResult(null);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const snap = await getDocs(collection(db,"notifications"));
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const created = new Date(data.createdAt||0);
        if (data.read && created < cutoff) {
          batch.delete(doc(db,"notifications",d.id));
          count++;
        }
      });
      if (count > 0) await batch.commit();
      setCleanResult({ type:"success", msg:`ลบ notification ที่อ่านแล้วเกิน ${days} วัน จำนวน ${count} รายการ` });
    } catch(e) {
      setCleanResult({ type:"error", msg:"เกิดข้อผิดพลาด: "+e.message });
    }
    setCleaning(false);
  }

  async function saveUserSettings(uid, data) {
    await updateDoc(doc(db,"users",uid), data);
    setEditUser(null);
  }

  const pending  = users.filter(u=>u.role==="pending");
  const disabled = users.filter(u=>u.role==="disabled");
  const active   = users.filter(u=>u.role!=="pending" && u.role!=="disabled").sort((a,b)=>{
    const order = { dev:0, admin:1, user:2 };
    return (order[a.role]??1) - (order[b.role]??1);
  });

  return (
    <div style={{ minHeight:"100vh",background:c.bg,fontFamily:"'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background:c.card,borderBottom:`1px solid ${c.border}`,padding:"14px 20px",
        display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10 }}>
        <button onClick={onBack} aria-label="กลับ" style={{ background:"transparent",border:"none",borderRadius:8,height:32,padding:"0 8px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:c.text500,fontWeight:500,display:"inline-flex",alignItems:"center",gap:4,flexShrink:0,whiteSpace:"nowrap" }}>← กลับ</button>
        <div style={{ fontSize:16,fontWeight:600,color:c.text900 }}>จัดการผู้ใช้</div>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:13,color:c.text500 }}>{users.length} คน</span>
          <button onClick={()=>setShowAdd(true)}
            style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:32,padding:"0 12px",
              fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>+ เพิ่มผู้ใช้</button>
        </div>
      </div>

      <div style={{ padding:"20px 20px 48px",maxWidth:640,margin:"0 auto" }}>

        {/* Pending */}
        {pending.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ fontSize:12,color:c.amber,fontWeight:600,letterSpacing:1,textTransform:"uppercase" }}>รออนุมัติ</div>
              <span style={{ background:`${c.amber}1a`,color:c.amber,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:600 }}>{pending.length}</span>
            </div>
            {pending.map(u=>(
              <UserCard key={u.id} user={u} onRole={changeRole} onDisable={disableUser} onRestore={restoreUser} onEdit={setEditUser} currentUser={currentUser}/>
            ))}
          </div>
        )}

        {/* Active */}
        <div>
          <div style={{ fontSize:12,color:c.text400,fontWeight:600,letterSpacing:1,
            textTransform:"uppercase",marginBottom:12 }}>ผู้ใช้ทั้งหมด ({active.length})</div>
          {loading && <div style={{ textAlign:"center",color:c.text400,padding:32 }}>กำลังโหลด...</div>}
          {active.map(u=>(
            <UserCard key={u.id} user={u} onRole={changeRole} onDisable={disableUser} onRestore={restoreUser} onEdit={setEditUser} currentUser={currentUser}/>
          ))}
          {!loading && active.length===0 && (
            <div style={{ textAlign:"center",color:c.text400,padding:32,fontSize:14 }}>ยังไม่มีผู้ใช้</div>
          )}
        </div>

        {/* ถูกระงับ */}
        {disabled.length>0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ fontSize:12,color:c.text500,fontWeight:600,letterSpacing:1,textTransform:"uppercase" }}>ระงับใช้งาน</div>
              <span style={{ background:c.borderSoft,color:c.text500,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:600 }}>{disabled.length}</span>
            </div>
            <div style={{ fontSize:11,color:c.text400,marginBottom:10,lineHeight:1.6 }}>
              อีเมลเหล่านี้ยังถูกจองอยู่ใน Firebase Authentication — ถ้าต้องการปล่อยอีเมลให้สมัครใหม่ได้ ต้องลบบัญชีใน Firebase Console → Authentication
            </div>
            {disabled.map(u=>(
              <UserCard key={u.id} user={u} onRole={changeRole} onDisable={disableUser} onRestore={restoreUser} onEdit={setEditUser} currentUser={currentUser}/>
            ))}
          </div>
        )}
      </div>

      {/* บำรุงรักษาระบบ */}
      <div style={{ padding:"0 20px 48px",maxWidth:640,margin:"0 auto" }}>
        <div style={{ fontSize:12,color:c.text400,fontWeight:600,letterSpacing:1,
          textTransform:"uppercase",marginBottom:12 }}>บำรุงรักษาระบบ</div>
        <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:13,fontWeight:600,color:c.text900,marginBottom:4 }}>ล้าง Notifications เก่า</div>
          <div style={{ fontSize:12,color:c.text500,marginBottom:14 }}>
            ลบ notifications ที่อ่านแล้วออกจาก Firestore เพื่อลด reads quota
          </div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {[
              { label:"เกิน 7 วัน",  days:7  },
              { label:"เกิน 30 วัน", days:30 },
              { label:"เกิน 60 วัน", days:60 },
            ].map(opt=>(
              <button key={opt.days} onClick={()=>cleanNotifications(opt.days)} disabled={cleaning}
                style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
                  borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,
                  cursor:cleaning?"not-allowed":"pointer",fontFamily:"inherit",
                  opacity:cleaning?0.6:1 }}>
                {cleaning?"กำลังล้าง...":opt.label}
              </button>
            ))}
          </div>
          {cleanResult && (
            <div style={{ marginTop:12,padding:"10px 14px",borderRadius:8,fontSize:12,fontWeight:600,
              background:cleanResult.type==="success"?`${c.green}1a`:`${c.red}1a`,
              color:cleanResult.type==="success"?c.green:c.red,
              border:`1px solid ${cleanResult.type==="success"?`${c.green}55`:`${c.red}55`}` }}>
              {cleanResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showAdd && (
        <AddUserModal currentUser={currentUser} existing={users} onClose={()=>setShowAdd(false)}/>
      )}

      {editUser && (
        <EditUserModal user={editUser} onClose={()=>setEditUser(null)} onSave={saveUserSettings}/>
      )}
    </div>
  );
}

function UserCard({ user, onRole, onDisable, onRestore, onEdit, currentUser }) {
  const { c } = useTheme();
  const roleOpt = ROLE_OPTS.find(r=>r.value===user.role)||ROLE_OPTS[2];
  const roleColor = c[roleOpt.tone];
  const isDisabled = user.role === "disabled";
  // non-dev แตะบัญชี dev ไม่ได้ (รวมถึง dev ที่ถูกระงับไว้)
  const targetIsDev = user.role === "dev" || (isDisabled && user.prevRole === "dev");
  const locked = currentUser?.role !== "dev" && targetIsDev;
  const isSelf = user.id === currentUser?.id;
  const visibleOpts = currentUser?.role==="dev" ? ROLE_OPTS : ROLE_OPTS.filter(r=>r.value!=="dev");
  return (
    <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,
      padding:"14px 16px",marginBottom:10,opacity:isDisabled?0.65:1 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
        <div style={{ width:40,height:40,borderRadius:"50%",flexShrink:0,
          background:`hsl(${user.name?.charCodeAt(0)*7%360},60%,70%)`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:16,fontWeight:600,color:"#fff" }}>
          {user.name?.charAt(0)||"?"}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:14,fontWeight:600,color:c.text900 }}>{user.name||"ไม่ระบุชื่อ"}</div>
          <div style={{ fontSize:12,color:c.text400,marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
        </div>
        <select value={user.role} onChange={e=>onRole(user.id,e.target.value)}
          disabled={locked || isSelf}
          title={locked ? "เฉพาะ Dev เท่านั้นที่จัดการสิทธิ์ Dev ได้" : isSelf ? "เปลี่ยนสิทธิ์ตัวเองไม่ได้" : ""}
          style={{ background:`${roleColor}1a`,border:`1px solid ${roleColor}40`,
            color:roleColor,borderRadius:8,padding:"5px 10px",fontSize:12,
            fontWeight:600,cursor:(locked||isSelf)?"not-allowed":"pointer",
            fontFamily:"inherit",outline:"none",opacity:(locked||isSelf)?0.55:1 }}>
          {(locked ? ROLE_OPTS : visibleOpts).map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {user.role !== "pending" && !isDisabled && !locked && (
          <button onClick={()=>onEdit(user)}
            style={{ background:`${c.blue}1a`,border:`1px solid ${c.blue}55`,color:c.blue,
              borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 }}>
            แก้ไข
          </button>
        )}
        {locked ? (
          <span title="เฉพาะ Dev เท่านั้นที่จัดการบัญชี Dev ได้"
            style={{ fontSize:12, color:c.text400, padding:"6px 10px" }}>ล็อก</span>
        ) : isDisabled ? (
          <button onClick={()=>onRestore(user.id)} title="คืนสิทธิ์การใช้งาน"
            style={{ background:`${c.green}1a`,border:`1px solid ${c.green}55`,color:c.green,
              borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 }}>
            ↩ คืนสิทธิ์
          </button>
        ) : isSelf ? (
          <span title="ระงับบัญชีตัวเองไม่ได้"
            style={{ fontSize:11, color:c.text400, padding:"6px 10px" }}>(คุณ)</span>
        ) : (
          <button onClick={()=>onDisable(user.id)} title="ระงับการใช้งาน"
            style={{ background:`${c.red}1a`,border:`1px solid ${c.red}55`,color:c.red,
              borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit" }}>
            ระงับ
          </button>
        )}
      </div>
      {/* แสดง summary เล็กๆ */}
      {user.role !== "pending" && !isDisabled && (
        <div style={{ marginTop:8,display:"flex",gap:12,flexWrap:"wrap" }}>
          {user.onsiteRate > 0 && (
            <span style={{ fontSize:11,color:c.green }}>{user.onsiteRate.toLocaleString()} บ./ครั้ง</span>
          )}
          {FEATURE_SHIFT && user.role==="user" && (
            <span style={{ fontSize:11,color:user.canEditShift?c.blue:c.text400 }}>
              📅 {user.canEditShift?"แก้ตารางกะได้":"ไม่สามารถแก้ตารางกะ"}
            </span>
          )}
          {user.leaveQuota?.vacation > 0 && (
            <span style={{ fontSize:11,color:c.purple }}>พักผ่อน {user.leaveQuota.vacation} วัน/ปี</span>
          )}
        </div>
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }) {
  const { c } = useTheme();
  const [resetState, setResetState] = useState("");   // "" | "sending" | "sent" | ข้อความ error
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwState, setPwState] = useState("");   // "" | "saving" | "done" | ข้อความ error
  function genPw() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const b = crypto.getRandomValues(new Uint8Array(10));
    setNewPw(Array.from(b, x => chars[x % chars.length]).join("")); setShowPw(true); setPwState("");
  }
  async function setPassword() {
    if (newPw.length < 8) return setPwState("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (!confirm(`ตั้งรหัสผ่านใหม่ให้ ${user.name||user.email}?\n\nผู้ใช้จะถูกออกจากระบบทุกเครื่อง และต้องเข้าด้วยรหัสใหม่`)) return;
    setPwState("saving");
    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch("/api/admin-set-password", { method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid:user.id, password:newPw }) });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPwState("done");
    } catch (ex) { setPwState(ex.message); }
  }
  async function sendReset() {
    if (!user.email) return setResetState("ผู้ใช้นี้ไม่มีอีเมลในระบบ");
    if (!confirm(`ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${user.email}?\n\nรหัสเดิมยังใช้ได้จนกว่าผู้ใช้จะตั้งรหัสใหม่`)) return;
    setResetState("sending");
    try { await sendPasswordResetEmail(auth, user.email); setResetState("sent"); }
    catch (ex) { setResetState(AUTH_ERR[ex.code] || ex.message); }
  }
  const [name, setName] = useState(user.name||"");
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
    const newName = name.trim().replace(/\s+/g," ");
    if (!newName) { alert("กรุณาใส่ชื่อ"); return; }
    if (newName !== user.name && !confirm(`เปลี่ยนชื่อ "${user.name||"-"}" เป็น "${newName}"?\n\nเคส งาน Onsite และ OT ที่บันทึกไว้แล้วจะยังแสดงชื่อเดิม`)) return;
    setSaving(true);
    await onSave(user.id, {
      ...(newName !== user.name ? { name: newName } : {}),
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

  const IS = inputBase({ padding:"8px 12px", fontSize:13 });
  const LB = { fontSize:11,color:c.text400,fontWeight:600,textTransform:"uppercase",
    letterSpacing:.5,marginBottom:4,display:"block" };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:c.card,borderRadius:12,width:"100%",maxWidth:460,
        boxShadow:"0 20px 60px rgba(0,0,0,.15)",padding:24 }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",
              background:`hsl(${user.name?.charCodeAt(0)*7%360},60%,70%)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,fontWeight:600,color:"#fff" }}>
              {user.name?.charAt(0)||"?"}
            </div>
            <div>
              <div style={{ fontSize:14,fontWeight:600,color:c.text900 }}>{user.name}</div>
              <div style={{ fontSize:12,color:c.text400 }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:c.borderSoft,border:"none",color:c.text500,
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* ชื่อที่แสดง */}
        <div style={{ marginBottom:16 }}>
          <label style={LB}>ชื่อผู้ใช้ (ชื่อที่แสดงในระบบ)</label>
          <input value={name} onChange={e=>setName(e.target.value)} style={IS} placeholder="ชื่อ-นามสกุล"/>
          {name.trim() && name.trim() !== (user.name||"") && (
            <div style={{ fontSize:12,color:c.warn,marginTop:6,lineHeight:1.5 }}>
              ข้อมูลที่บันทึกไปแล้ว (เคส งานที่มอบหมาย Onsite OT) ยังผูกกับชื่อเดิม — งานที่มอบหมายไว้ด้วยชื่อเดิมจะไม่ขึ้นเป็นของคนนี้จนกว่าจะแก้ในงานนั้น
            </div>
          )}
        </div>

        {/* ตั้งรหัสผ่านใหม่ทันที */}
        <div style={{ marginBottom:8,padding:12,background:c.bg,border:`1px solid ${c.border}`,borderRadius:8 }}>
          <div style={{ fontSize:13,fontWeight:500,color:c.text900,marginBottom:8 }}>ตั้งรหัสผ่านใหม่</div>
          <div style={{ display:"flex",gap:8 }}>
            <div style={{ position:"relative",flex:1 }}>
              <input type={showPw?"text":"password"} value={newPw} autoComplete="new-password"
                onChange={e=>{ setNewPw(e.target.value); setPwState(""); }}
                placeholder="อย่างน้อย 8 ตัวอักษร" style={{ ...IS, height:32, padding:"0 56px 0 10px" }}/>
              <button type="button" onClick={()=>setShowPw(v=>!v)}
                style={{ position:"absolute",right:4,top:4,height:24,padding:"0 6px",border:"none",background:"transparent",
                  color:c.text500,fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>{showPw?"ซ่อน":"แสดง"}</button>
            </div>
            <button type="button" onClick={genPw}
              style={{ background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,height:32,padding:"0 10px",
                fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>สุ่ม</button>
            <button type="button" onClick={setPassword} disabled={pwState==="saving"||!newPw}
              style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:32,padding:"0 12px",
                fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",opacity:(pwState==="saving"||!newPw)?.6:1 }}>
              {pwState==="saving"?"กำลังตั้ง...":"ตั้งรหัส"}
            </button>
          </div>
          <div style={{ fontSize:12,marginTop:6,lineHeight:1.5,
            color:pwState==="done"?c.ok:(pwState&&pwState!=="saving"?c.danger:c.text500) }}>
            {pwState==="done" ? "ตั้งรหัสใหม่แล้ว — แจ้งรหัสให้ผู้ใช้ทางช่องทางส่วนตัว และให้เปลี่ยนเองที่หน้าโปรไฟล์" :
             pwState && pwState!=="saving" ? pwState :
             "ใช้ได้ทันที ผู้ใช้จะถูกออกจากระบบทุกเครื่อง"}
          </div>
        </div>

        {/* รีเซ็ตรหัสผ่านทางอีเมล */}
        <div style={{ marginBottom:16,padding:12,background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,
          display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:500,color:c.text900 }}>หรือส่งลิงก์ทางอีเมล</div>
            <div style={{ fontSize:12,color:resetState==="sent"?c.ok:(resetState&&resetState!=="sending"?c.danger:c.text500),marginTop:2,lineHeight:1.5 }}>
              {resetState==="sent" ? `ส่งลิงก์ไปที่ ${user.email} แล้ว` :
               resetState && resetState!=="sending" ? resetState :
               "ส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านใหม่เอง"}
            </div>
          </div>
          <button type="button" onClick={sendReset} disabled={resetState==="sending"||resetState==="sent"}
            style={{ background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,height:32,padding:"0 12px",
              fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
              opacity:(resetState==="sending"||resetState==="sent")?.6:1 }}>
            {resetState==="sending"?"กำลังส่ง...":resetState==="sent"?"ส่งแล้ว":"ส่งลิงก์"}
          </button>
        </div>

        {/* ค่าแรง Onsite */}
        <div style={{ marginBottom:16 }}>
          <label style={LB}>ค่าแรง Onsite (บาท/ครั้ง)</label>
          <input type="number" min="0" value={onsiteRate}
            onChange={e=>setOnsiteRate(e.target.value)} style={IS} placeholder="0"/>
        </div>

        {/* สิทธิ์ตารางกะ (เฉพาะ user) — ซ่อนเมื่อปิดฟีเจอร์ตารางกะ */}
        {FEATURE_SHIFT && user.role === "user" && (
          <div style={{ marginBottom:16,padding:"12px 14px",background:c.bg,
            border:`1px solid ${c.border}`,borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:c.text900 }}>สิทธิ์ลงตารางกะ</div>
              <div style={{ fontSize:11,color:c.text400,marginTop:2 }}>อนุญาตให้แก้ไขตารางกะได้</div>
            </div>
            <button onClick={()=>setCanEditShift(v=>!v)}
              style={{ background:canEditShift?"#2563eb":c.borderSoft,
                border:`1px solid ${canEditShift?"#2563eb":c.border}`,
                color:canEditShift?"#fff":c.text500,
                borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,
                cursor:"pointer",fontFamily:"inherit" }}>
              {canEditShift ? "เปิด ✓" : "ปิด"}
            </button>
          </div>
        )}

        {/* วันลาที่ได้รับ */}
        <div style={{ marginBottom:20 }}>
          <label style={LB}>วันลาที่ได้รับต่อปี (วัน)</label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[
              { key:"vacation", label:"ลาพักร้อน" },
              { key:"personal", label:"ลากิจ" },
              { key:"sick",     label:"ลาป่วย" },
              { key:"other",    label:"อื่นๆ" },
            ].map(t => (
              <div key={t.key}>
                <div style={{ fontSize:12,color:c.text500,marginBottom:4 }}>{t.label}</div>
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
            style={{ background:c.bg,border:`1px solid ${c.border}`,color:c.text500,
              borderRadius:8,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:"#2563eb",border:"none",color:"#fff",borderRadius:8,
              padding:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              opacity:saving?0.7:1 }}>
            {saving?"กำลังบันทึก...":"บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ currentUser, existing, onClose }) {
  const { c } = useTheme();
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState("user");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [done, setDone]   = useState(null);
  const IS = inputBase({ padding:"8px 12px", fontSize:14 });
  const LB = { fontSize:12,color:c.text500,fontWeight:500,marginBottom:8,display:"block" };
  const roles = [{ value:"user",label:"User" },{ value:"admin",label:"Admin" },
    ...(currentUser?.role==="dev" ? [{ value:"dev",label:"Dev" }] : [])];

  async function submit() {
    const n = name.trim().replace(/\s+/g," "), e = email.trim().toLowerCase();
    setErr("");
    if (!n) return setErr("กรุณาใส่ชื่อ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr("รูปแบบอีเมลไม่ถูกต้อง");
    if (existing.some(u => (u.email||"").toLowerCase() === e)) return setErr("อีเมลนี้มีในระบบแล้ว");
    setBusy(true);
    try {
      await createUserAccount({ name:n, email:e, role });
      setDone({ name:n, email:e });
    } catch (ex) {
      setErr(AUTH_ERR[ex.code] || ex.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={busy?undefined:onClose}>
      <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,width:"100%",maxWidth:420,
        boxShadow:"0 16px 48px rgba(0,0,0,.16)",padding:24 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:16,fontWeight:600,color:c.text900,marginBottom:4 }}>เพิ่มผู้ใช้</div>
        {done ? (<>
          <div style={{ fontSize:14,color:c.text900,lineHeight:1.6,margin:"16px 0" }}>
            สร้างบัญชี <b>{done.name}</b> แล้ว ระบบส่งอีเมลให้ตั้งรหัสผ่านไปที่ <b>{done.email}</b>
          </div>
          <div style={{ fontSize:13,color:c.text500,lineHeight:1.6,marginBottom:16 }}>
            ให้ผู้ใช้เปิดอีเมล (ดูในโฟลเดอร์สแปมด้วย) กดลิงก์ตั้งรหัสผ่าน แล้วเข้าสู่ระบบได้เลย
          </div>
          <button onClick={onClose} style={{ width:"100%",background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:40,
            fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>เสร็จ</button>
        </>) : (<>
          <div style={{ fontSize:13,color:c.text500,marginBottom:20,lineHeight:1.5 }}>
            ระบบจะส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านเอง — admin ไม่ต้องรู้รหัสผ่าน
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={LB}>ชื่อ-นามสกุล</label>
            <input value={name} onChange={e=>setName(e.target.value)} style={IS} autoFocus/>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={LB}>อีเมล</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={IS} placeholder="name@metthier.co.th"/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={LB}>สิทธิ์</label>
            <div style={{ display:"flex",gap:8 }}>
              {roles.map(r=>(
                <button key={r.value} type="button" onClick={()=>setRole(r.value)}
                  style={{ flex:1,height:36,borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500,
                    background:role===r.value?c.inkSoft:c.card,color:role===r.value?c.ink:c.text500,
                    border:`1px solid ${role===r.value?c.ink:c.border}` }}>{r.label}</button>
              ))}
            </div>
          </div>
          {err && <div style={{ fontSize:13,color:c.danger,marginBottom:12 }}>{err}</div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
            <button onClick={onClose} disabled={busy}
              style={{ background:c.card,border:`1px solid ${c.border}`,color:c.text900,borderRadius:8,height:40,
                fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit" }}>ยกเลิก</button>
            <button onClick={submit} disabled={busy}
              style={{ background:c.ink,border:"none",color:c.onInk,borderRadius:8,height:40,
                fontSize:14,fontWeight:500,cursor:busy?"default":"pointer",fontFamily:"inherit",opacity:busy?.7:1 }}>
              {busy?"กำลังสร้างบัญชี...":"สร้างบัญชีและส่งอีเมล"}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
