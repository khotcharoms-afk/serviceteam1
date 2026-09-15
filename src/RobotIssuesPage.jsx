// วางไฟล์นี้ในโฟลเดอร์เดียวกับ RobotStatsPage.jsx (root ของ src)
// ใช้ theme system เดียวกับหน้าอื่นๆ ของ ServiceLog (useTheme จาก ./theme.js)
// รับ prop onBack เหมือน OnsitePage/RobotStatsPage/ฯลฯ — เรียก setRobotIssuesPage(false)

import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "./theme.js";

const ORANGE = "#F97316";
const PURPLE = "#6B21A8";
const RED = "#DC2626";
const GREEN = "#16A34A";

const STATUS_META = {
  new:          { label: "ใหม่",             color: RED },
  acknowledged: { label: "รับทราบแล้ว",       color: "#D97706" },
  in_progress:  { label: "กำลังดำเนินการ",     color: "#2563EB" },
  resolved:     { label: "เสร็จสิ้น",          color: GREEN },
  cancelled:    { label: "ยกเลิก",            color: "#6B7280" },
  logged:       { label: "บันทึกแล้ว",         color: "#6B7280" },
};

const CATEGORY_META = {
  repair:    { label: "แจ้งซ่อม", icon: "🔧" },
  exception: { label: "แจ้งเหตุ", icon: "📋" },
};

// map รหัสอาการ/สาเหตุ → ข้อความไทย ต้อง sync กับ ISSUE_TYPES ใน lib/repairFlow.js
// และ REASON_OPTIONS ใน lib/exceptionFlow.js ของฝั่งบอทเสมอ (คนละ repo กัน)
const ISSUE_TYPE_LABEL = {
  stopped: "หยุดทำงาน/ไม่วิ่ง",
  error: "Error/มีเสียงเตือน",
  not_clean: "ทำความสะอาดไม่สะอาด",
  battery: "แบตเตอรี่/ชาร์จมีปัญหา",
  part_damage: "อะไหล่ชำรุด",
  event: "มีอีเว้นต์ในพื้นที่",
  rain: "ฝนตก/พื้นเปียก",
  closed: "พื้นที่ปิด/ปรับปรุง",
  other: "อื่นๆ",
};

const STATUS_STEPS = [
  { key: "acknowledged", label: "รับทราบแล้ว" },
  { key: "in_progress", label: "กำลังดำเนินการ" },
  { key: "resolved", label: "เสร็จสิ้น" },
];

function Pill({ children, color, filled }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      color: filled ? "#fff" : color,
      background: filled ? color : color + "16",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function InfoRow({ label, value, c, strong }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, padding: "3px 0" }}>
      <div style={{ fontSize: 12, color: c.text400, width: 88, flexShrink: 0, paddingTop: 1 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: c.text900, fontWeight: strong ? 700 : 500, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function AttachmentGallery({ imageUrls = [], videoUrls = [], c }) {
  const [lightbox, setLightbox] = useState(null);
  if (!imageUrls.length && !videoUrls.length) return null;

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {imageUrls.map((url, i) => (
          <img key={`img-${i}`} src={url} alt={`แนบ ${i + 1}`}
            onClick={() => setLightbox({ type: "image", url })}
            style={{
              width: 72, height: 72, objectFit: "cover", borderRadius: 10,
              border: `1px solid ${c.border}`, cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,.06)", transition: "transform .12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
        ))}
        {videoUrls.map((url, i) => (
          <div key={`vid-${i}`} onClick={() => setLightbox({ type: "video", url })}
            style={{
              width: 72, height: 72, borderRadius: 10, cursor: "pointer",
              background: "linear-gradient(135deg,#1F2937,#111827)", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18,
              boxShadow: "0 1px 3px rgba(0,0,0,.15)",
            }}
            title="เปิดดูวิดีโอ">▶</div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          {lightbox.type === "image" ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 10 }} />
          ) : (
            <video src={lightbox.url} controls autoPlay
              style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 10 }}
              onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  );
}

function StatusSteps({ status, onChange, c, updating }) {
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
      {STATUS_STEPS.map((s) => {
        const active = status === s.key;
        return (
          <button key={s.key} disabled={updating || active}
            onClick={() => onChange(s.key)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 13px", borderRadius: 999, fontFamily: "inherit",
              border: `1.5px solid ${active ? PURPLE : c.border}`,
              background: active ? PURPLE : "transparent",
              color: active ? "#fff" : c.text500,
              fontSize: 12.5, fontWeight: active ? 700 : 500,
              cursor: active ? "default" : "pointer",
              opacity: updating ? 0.55 : 1,
              transition: "all .12s ease",
            }}>
            {active && "✓ "}{s.label}
          </button>
        );
      })}
    </div>
  );
}

function IssueCard({ issue, onUpdateStatus, onDelete, canDelete, c }) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleStatusChange(newStatus) {
    setUpdating(true);
    await onUpdateStatus(issue.id, newStatus);
    setUpdating(false);
  }

  async function handleDelete() {
    const ok = window.confirm(
      `ยืนยันลบเคส #${issue.ticketNo}?\n\nการลบนี้ถาวร กู้คืนไม่ได้ (รูป/วิดีโอที่แนบไว้จะยังอยู่ใน Storage แต่จะหาเคสนี้ไม่เจออีก)`
    );
    if (!ok) return;
    setDeleting(true);
    await onDelete(issue.id);
    // ไม่ต้อง setDeleting(false) เพราะการ์ดนี้จะหายไปจากลิสต์หลัง reload สำเร็จอยู่แล้ว
  }

  const createdLabel = issue.createdAt
    ? new Date(issue.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "-";
  const cat = CATEGORY_META[issue.category] || { label: issue.category, icon: "📄" };
  const statusMeta = STATUS_META[issue.status] || { label: issue.status, color: "#6B7280" };
  const isUrgent = issue.priority === "urgent";
  const accentColor = isUrgent ? RED : (c.border || "#E5E7EB");

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 16px 16px 18px",
      marginBottom: 12, background: c.card, boxShadow: "0 1px 2px rgba(0,0,0,.04)",
    }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accentColor }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: (issue.category === "repair" ? ORANGE : PURPLE) + "18",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>{cat.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: c.text900 }}>
              {cat.label} · #{issue.ticketNo}
            </div>
            <div style={{ fontSize: 11.5, color: c.text400, marginTop: 1 }}>{createdLabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Pill color={statusMeta.color} filled>{statusMeta.label}</Pill>
            {canDelete && (
              <button onClick={handleDelete} disabled={deleting} title="ลบเคสนี้"
                style={{
                  border: "none", background: "transparent", cursor: deleting ? "default" : "pointer",
                  color: c.text400, fontSize: 14, padding: 3, lineHeight: 1,
                  opacity: deleting ? 0.4 : 1,
                }}>
                🗑️
              </button>
            )}
          </div>
          {issue.priority && (
            <Pill color={isUrgent ? RED : GREEN}>{isUrgent ? "🔴 ด่วน" : "ปกติ"}</Pill>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.borderSoft || c.border}` }}>
        <InfoRow label="สาขา" value={issue.branch} c={c} strong />
        <InfoRow label="อาการ/สาเหตุ" value={ISSUE_TYPE_LABEL[issue.issueType] || issue.issueType} c={c} />
        <InfoRow label="รายละเอียด" value={issue.description} c={c} />
        <InfoRow label="วันที่เกิดเหตุ" value={issue.incidentDate} c={c} />
        <InfoRow label="แจ้งโดย" value={issue.displayName} c={c} />
      </div>

      <AttachmentGallery imageUrls={issue.imageUrls} videoUrls={issue.videoUrls} c={c} />

      {issue.category === "repair" && (
        <StatusSteps status={issue.status} onChange={handleStatusChange} c={c} updating={updating} />
      )}
    </div>
  );
}

export default function RobotIssuesPage({ onBack, currentUser }) {
  const { c } = useTheme();
  const canDelete = ["admin", "dev"].includes(currentUser?.role);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/robot-issues-proxy?${params.toString()}`);
      if (!res.ok) throw new Error("fetch-failed");
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (err) {
      console.error(err);
      setError("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateStatus(issueId, newStatus) {
    try {
      const res = await fetch("/api/robot-issues-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, newStatus }),
      });
      if (!res.ok) throw new Error("update-failed");
      await load();
    } catch (err) {
      console.error(err);
      alert("อัปเดตสถานะไม่สำเร็จ");
    }
  }

  async function handleDelete(issueId) {
    try {
      const res = await fetch(`/api/robot-issues-proxy?issueId=${encodeURIComponent(issueId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete-failed");
      await load();
    } catch (err) {
      console.error(err);
      alert("ลบเคสไม่สำเร็จ");
    }
  }

  const selectStyle = {
    padding: "8px 14px", borderRadius: 999, border: `1px solid ${c.border}`,
    fontSize: 13, background: c.card, color: c.text900, fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
      `}</style>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
        borderBottom: `1px solid ${c.border}`, background: c.card,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", fontSize: 18, color: c.text500,
          cursor: "pointer", padding: 4, lineHeight: 1,
        }}>←</button>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: RED + "16",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>🛠️</div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>แจ้งเหตุ/แจ้งซ่อม</div>
          <div style={{ fontSize: 11.5, color: c.text400 }}>ข้อมูลจาก LINE Bot (robot-report-bot)</div>
        </div>
      </div>

      <div style={{ padding: "18px 20px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
            <option value="">ทุกประเภท</option>
            <option value="repair">🔧 แจ้งซ่อม</option>
            <option value="exception">📋 แจ้งเหตุ</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">ทุกสถานะ</option>
            <option value="new">ใหม่</option>
            <option value="acknowledged">รับทราบแล้ว</option>
            <option value="in_progress">กำลังดำเนินการ</option>
            <option value="resolved">เสร็จสิ้น</option>
          </select>
          <button onClick={load} style={{ ...selectStyle, cursor: "pointer", fontWeight: 600, color: PURPLE }}>
            🔄 รีเฟรช
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: c.text400, fontSize: 13 }}>กำลังโหลด...</div>
        )}
        {error && (
          <div style={{ background: RED + "10", color: RED, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}
        {!loading && !error && issues.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: c.text400, fontSize: 13 }}>
            ไม่พบเคสตามเงื่อนไขที่เลือก
          </div>
        )}

        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onUpdateStatus={handleUpdateStatus}
            onDelete={handleDelete} canDelete={canDelete} c={c} />
        ))}
      </div>
    </div>
  );
}
