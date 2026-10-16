import { useState, useEffect } from "react";
import { db } from "./firebase";
import { useTheme } from "./theme.js";
import { IS as inputBase, FEATURE_SHIFT } from "./utils.js";
import { collection, onSnapshot, doc, updateDoc, getDocs, query, where, writeBatch } from "firebase/firestore";

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
        <button onClick={onBack} style={{ background:c.borderSoft,border:"none",borderRadius:8,
          padding:"7px 14px",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:c.text500,fontWeight:600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize:16,fontWeight:800,color:c.text900 }}>👥 จัดการผู้ใช้</div>
        <div style={{ marginLeft:"auto",fontSize:12,color:c.text400 }}>{users.length} คน</div>
      </div>

      <div style={{ padding:"20px 20px 48px",maxWidth:640,margin:"0 auto" }}>

        {/* Pending */}
        {pending.length>0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
              <div style={{ fontSize:12,color:c.amber,fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>รออนุมัติ</div>
              <span style={{ background:`${c.amber}1a`,color:c.amber,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700 }}>{pending.length}</span>
            </div>
            {pending.map(u=>(
              <UserCard key={u.id} user={u} onRole={changeRole} onDisable={disableUser} onRestore={restoreUser} onEdit={setEditUser} currentUser={currentUser}/>
            ))}
          </div>
        )}

        {/* Active */}
        <div>
          <div style={{ fontSize:12,color:c.text400,fontWeight:700,letterSpacing:1,
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
              <div style={{ fontSize:12,color:c.text500,fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>ระงับใช้งาน</div>
              <span style={{ background:c.borderSoft,color:c.text500,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700 }}>{disabled.length}</span>
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
        <div style={{ fontSize:12,color:c.text400,fontWeight:700,letterSpacing:1,
          textTransform:"uppercase",marginBottom:12 }}>🛠 บำรุงรักษาระบบ</div>
        <div style={{ background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:"16px 18px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:c.text900,marginBottom:4 }}>🔔 ล้าง Notifications เก่า</div>
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
              {cleanResult.type==="success"?"✅":"❌"} {cleanResult.msg}
            </div>
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
          fontSize:16,fontWeight:700,color:"#fff" }}>
          {user.name?.charAt(0)||"?"}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:14,fontWeight:700,color:c.text900 }}>{user.name||"ไม่ระบุชื่อ"}</div>
          <div style={{ fontSize:12,color:c.text400,marginTop:1,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
        </div>
        <select value={user.role} onChange={e=>onRole(user.id,e.target.value)}
          disabled={locked || isSelf}
          title={locked ? "เฉพาะ Dev เท่านั้นที่จัดการสิทธิ์ Dev ได้" : isSelf ? "เปลี่ยนสิทธิ์ตัวเองไม่ได้" : ""}
          style={{ background:`${roleColor}1a`,border:`1px solid ${roleColor}40`,
            color:roleColor,borderRadius:8,padding:"5px 10px",fontSize:12,
            fontWeight:700,cursor:(locked||isSelf)?"not-allowed":"pointer",
            fontFamily:"inherit",outline:"none",opacity:(locked||isSelf)?0.55:1 }}>
          {(locked ? ROLE_OPTS : visibleOpts).map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {user.role !== "pending" && !isDisabled && !locked && (
          <button onClick={()=>onEdit(user)}
            style={{ background:`${c.blue}1a`,border:`1px solid ${c.blue}55`,color:c.blue,
              borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600 }}>
            ✏️
          </button>
        )}
        {locked ? (
          <span title="เฉพาะ Dev เท่านั้นที่จัดการบัญชี Dev ได้"
            style={{ fontSize:14, color:c.text400, padding:"6px 10px" }}>🔒</span>
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
            🚫
          </button>
        )}
      </div>
      {/* แสดง summary เล็กๆ */}
      {user.role !== "pending" && !isDisabled && (
        <div style={{ marginTop:8,display:"flex",gap:12,flexWrap:"wrap" }}>
          {user.onsiteRate > 0 && (
            <span style={{ fontSize:11,color:c.green }}>💰 {user.onsiteRate.toLocaleString()} บ./ครั้ง</span>
          )}
          {FEATURE_SHIFT && user.role==="user" && (
            <span style={{ fontSize:11,color:user.canEditShift?c.blue:c.text400 }}>
              📅 {user.canEditShift?"แก้ตารางกะได้":"ไม่สามารถแก้ตารางกะ"}
            </span>
          )}
          {user.leaveQuota?.vacation > 0 && (
            <span style={{ fontSize:11,color:c.purple }}>📋 พักผ่อน {user.leaveQuota.vacation} วัน/ปี</span>
          )}
        </div>
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }) {
  const { c } = useTheme();
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

  const IS = inputBase({ padding:"8px 12px", fontSize:13 });
  const LB = { fontSize:11,color:c.text400,fontWeight:700,textTransform:"uppercase",
    letterSpacing:.5,marginBottom:4,display:"block" };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:c.card,borderRadius:16,width:"100%",maxWidth:460,
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
              <div style={{ fontSize:14,fontWeight:700,color:c.text900 }}>{user.name}</div>
              <div style={{ fontSize:12,color:c.text400 }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:c.borderSoft,border:"none",color:c.text500,
            cursor:"pointer",fontSize:14,width:30,height:30,borderRadius:8 }}>✕</button>
        </div>

        {/* ค่าแรง Onsite */}
        <div style={{ marginBottom:16 }}>
          <label style={LB}>💰 ค่าแรง Onsite (บาท/ครั้ง)</label>
          <input type="number" min="0" value={onsiteRate}
            onChange={e=>setOnsiteRate(e.target.value)} style={IS} placeholder="0"/>
        </div>

        {/* สิทธิ์ตารางกะ (เฉพาะ user) — ซ่อนเมื่อปิดฟีเจอร์ตารางกะ */}
        {FEATURE_SHIFT && user.role === "user" && (
          <div style={{ marginBottom:16,padding:"12px 14px",background:c.bg,
            border:`1px solid ${c.border}`,borderRadius:10,
            display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:c.text900 }}>📅 สิทธิ์ลงตารางกะ</div>
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
          <label style={LB}>📋 วันลาที่ได้รับต่อปี (วัน)</label>
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
