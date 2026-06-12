import { useState } from "react";
// ─── Templates ───────────────────────────────────────────────
const SMARTPOLE_TEMPLATE = {
  name: "SmartPole",
  sections: [
    {
      title: "อุปกรณ์ IT",
      items: [
        "PC หรือ Laptop",
        "สาย LAN",
      ],
    },
    {
      title: "เครื่องมือช่าง",
      items: [
        "ชุดไขควงอเนกประสงค์",
        "ชุดหกเหลี่ยม L (Allen Key Set)",
        "ชุดประแจจบล็อก",
        "ชุดสว่านไฟฟ้า",
        "คีมตัดสายไฟ",
        "คีมตัดหนีบ",
        "มัลติมิเตอร์ (Multimeter)",
        "ผ้าไมโครไฟเบอร์ (เช็ดเซนเซอร์/เลนส์)",
        "ไฟฉาย",
        "Cable Tie / สายรัด",
        "เทปพันสาย",
      ],
    },
    {
      title: "อุปกรณ์ Safety",
      items: [
        "หมวกนิรภัย (Safety Helmet)",
        "เสื้อสะท้อนแสง (Safety Vest)",
        "ป้ายกั้นพื้นที่ / Safety Cone",
        "ถุงมือนิรภัย",
      ],
    },
    {
      title: "อะไหล่ / Spare Parts",
      items: [
        "สาย LAN (ม้วน)",
        "ฟิวส์สำรอง",
        "แบตเตอรี่สำรอง (UPS)",
        "Camera Module",
        "SIM Card / Router Module",
        "IoT Node สำรอง",
        "Network Switch (สำรอง)",
      ],
    },
  ],
};

const ROBOT_TEMPLATE = {
  name: "Robot",
  sections: [
    {
      title: "อุปกรณ์ IT",
      items: [
        "PC หรือ Laptop",
        "สาย LAN",
      ],
    },
    {
      title: "เครื่องมือช่าง",
      items: [
        "ชุดไขควงอเนกประสงค์",
        "ชุดหกเหลี่ยม ตัว L (Allen Key Set)",
        "ชุดประแจจบล็อก",
        "สว่านไฟฟ้า",
        "คีมตัดสายไฟ",
        "คีมตัดหนีบ",
        "ผ้าไมโครไฟเบอร์ (เช็ดเซนเซอร์/เลนส์)",
        "Cable Tie / สายรัด",
        "เทปพันสาย",
        "สเปรย์ล่อลื่น (WD-40)",
      ],
    },
    {
      title: "อะไหล่ / Spare Parts",
      items: [
        "Roller Brush / แปรงหมุน (สำรอง)",
        "ยางรีดน้ำ / Squeegee (สำรอง)",
        "ไส้กรอง Filter (สำรอง)",
        "ผ้าม็อบ (สำรอง)",
        "สายพาน (สำรอง)",
        "ล้อบังคับทิศทาง (ล้อหน้า)",
        "ล้อขับเคลื่น (ล้อหลัง)",
      ],
    },
  ],
};

const GENERAL_TEMPLATE = {
  name: "ทั่วไป",
  sections: [
    {
      title: "อุปกรณ์ IT",
      items: [
        "PC หรือ Laptop",
        "อุปกรณ์ชาร์จ Laptop / อแดปเตอร์",
        "สาย LAN",
      ],
    },
    {
      title: "เครื่องมือช่าง",
      items: [
       "ชุดไขควงอเนกประสงค์",
        "ชุดหกเหลี่ยม ตัว L (Allen Key Set)",
        "ชุดประแจจบล็อก",
        "สว่านไฟฟ้า",
        "คีมตัดสายไฟ",
        "คีมตัดหนีบ",
        "มัลติมิเตอร์ (Multimeter)",
        "Cable Tie / สายรัด",
        "เทปพันสาย",
      ],
    },
  ],
};

function getTemplate(projName) {
  const n = (projName || "").toLowerCase();
  if (n.includes("smart")) return SMARTPOLE_TEMPLATE;
  if (n.includes("robot") || n.includes("mett")) return ROBOT_TEMPLATE;
  return GENERAL_TEMPLATE;
}

function initChecked(template) {
  const checked = {};
  template.sections.forEach(sec => {
    sec.items.forEach(item => { checked[item] = false; });
  });
  return checked;
}

import { Modal } from "../UI.jsx";

const TEMPLATES = [
  { key:"general",    label:"ทั่วไป",     icon:"📋", template:GENERAL_TEMPLATE },
  { key:"smartpole",  label:"SmartPole",  icon:"🏙", template:SMARTPOLE_TEMPLATE },
  { key:"robot",      label:"Robot",      icon:"🤖", template:ROBOT_TEMPLATE },
];

function detectTemplateKey(projName) {
  const n = (projName||"").toLowerCase();
  if (n.includes("smart")) return "smartpole";
  if (n.includes("robot")||n.includes("mett")) return "robot";
  return "general";
}

// ─── Component ───────────────────────────────────────────────
export default function ChecklistModal({ c, proj, onClose, onSave, saving }) {
  if (!c) return null;

  const defaultKey = c.checklist?.templateKey || detectTemplateKey(proj?.name);
  const [templateKey, setTemplateKey] = useState(defaultKey);
  const template = TEMPLATES.find(t=>t.key===templateKey)?.template || GENERAL_TEMPLATE;

  const [checked, setChecked] = useState(() => {
    if (c.checklist?.items && c.checklist?.templateKey===defaultKey) return c.checklist.items;
    return initChecked(template);
  });
  const [note, setNote] = useState(c.checklist?.note || "");
  const [confirmed, setConfirmed] = useState(c.checklist?.confirmed || false);

  function switchTemplate(key) {
    setTemplateKey(key);
    setChecked(initChecked(TEMPLATES.find(t=>t.key===key)?.template||GENERAL_TEMPLATE));
    setConfirmed(false);
  }

  const totalItems = Object.keys(checked).length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allDone = checkedCount === totalItems;

  function toggle(item) {
    setChecked(prev => ({ ...prev, [item]: !prev[item] }));
  }

  function handleSave() {
    onSave({
      ...c,
      checklist: {
        template: template.name,
        templateKey,
        items: checked,
        note,
        confirmed,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(15,23,42,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:560,
        maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.15)",
        padding:"24px 24px 28px" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:"#0f172a" }}>
            📋 Checklist — {template.name}
          </h2>
          <button onClick={onClose}
            style={{ background:"#f1f5f9",border:"none",color:"#64748b",cursor:"pointer",
              fontSize:14,width:30,height:30,borderRadius:8,display:"flex",
              alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        {/* เลือก Template */}
        <div style={{ display:"flex",gap:6,marginBottom:16,background:"#f8fafc",
          borderRadius:10,padding:6,border:"1px solid #e2e8f0" }}>
          {TEMPLATES.map(t=>(
            <button key={t.key} type="button" onClick={()=>switchTemplate(t.key)}
              style={{ flex:1,padding:"7px 8px",borderRadius:8,border:"none",
                cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,
                display:"flex",alignItems:"center",justifyContent:"center",gap:4,
                background:templateKey===t.key?"#fff":"transparent",
                color:templateKey===t.key?"#0f172a":"#94a3b8",
                boxShadow:templateKey===t.key?"0 1px 3px rgba(0,0,0,.1)":"none",
                transition:"all .15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
          <span style={{ fontSize:12,color:"#64748b",fontWeight:600 }}>ความคืบหน้า</span>
          <span style={{ fontSize:12,fontWeight:700,color: allDone?"#16a34a":"#f97316" }}>
            {checkedCount}/{totalItems} รายการ
          </span>
        </div>
        <div style={{ background:"#f1f5f9",borderRadius:99,height:8,overflow:"hidden" }}>
          <div style={{
            height:"100%", borderRadius:99, transition:"width .3s",
            background: allDone ? "#16a34a" : "#f97316",
            width: `${totalItems > 0 ? (checkedCount/totalItems)*100 : 0}%`,
          }}/>
        </div>
      </div>

      {/* Sections */}
      {template.sections.map(sec => (
        <div key={sec.title} style={{ marginBottom:16 }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#f97316",
            textTransform:"uppercase",letterSpacing:.5,marginBottom:8,
            paddingBottom:4,borderBottom:"1.5px solid #fed7aa" }}>
            {sec.title}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {sec.items.map(item => (
              <label key={item} style={{ display:"flex",alignItems:"center",gap:10,
                cursor:"pointer",padding:"8px 10px",borderRadius:8,
                background: checked[item] ? "#f0fdf4" : "#f8fafc",
                border: `1px solid ${checked[item] ? "#bbf7d0" : "#e2e8f0"}`,
                transition:"all .15s" }}>
                <input type="checkbox" checked={!!checked[item]}
                  onChange={() => toggle(item)}
                  style={{ width:16,height:16,accentColor:"#16a34a",cursor:"pointer",flexShrink:0 }}/>
                <span style={{ fontSize:13,color: checked[item] ? "#166534" : "#475569",
                  fontWeight: checked[item] ? 600 : 400,
                  textDecoration: checked[item] ? "line-through" : "none",
                  transition:"all .15s" }}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {/* หมายเหตุ */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",
          textTransform:"uppercase",letterSpacing:.5,marginBottom:6 }}>
          อุปกรณ์เพิ่มเติม / หมายเหตุ
        </div>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="ระบุอุปกรณ์อื่นๆ หรือหมายเหตุเพิ่มเติม..."
          rows={3}
          style={{ width:"100%",borderRadius:8,border:"1px solid #e2e8f0",
            padding:"10px 12px",fontSize:13,fontFamily:"inherit",resize:"vertical",
            outline:"none",color:"#0f172a",background:"#f8fafc",boxSizing:"border-box" }}/>
      </div>

      {/* ยืนยัน */}
      <label style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer",
        background: confirmed?"#eff6ff":"#f8fafc",
        border:`1.5px solid ${confirmed?"#bfdbfe":"#e2e8f0"}`,
        borderRadius:10,padding:"10px 14px",marginBottom:16 }}>
        <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}
          style={{ width:18,height:18,accentColor:"#2563eb",cursor:"pointer",flexShrink:0 }}/>
        <span style={{ fontSize:13,fontWeight:600,color: confirmed?"#1d4ed8":"#64748b" }}>
          ✅ ยืนยันว่าพร้อมเข้าหน้างานแล้ว
        </span>
      </label>

      {/* Buttons */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:8 }}>
        <button onClick={onClose}
          style={{ background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",
            borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit" }}>
          ยกเลิก
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ background:"#f97316",border:"none",color:"#fff",
            borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,
            cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",
            opacity:saving?0.7:1 }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึก Checklist"}
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}
