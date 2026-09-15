// วางไฟล์นี้ในโฟลเดอร์เดียวกับ RobotStatsPage.jsx (root ของ src)
// ใช้ theme system เดียวกับหน้าอื่นๆ ของ ServiceLog (useTheme จาก ./theme.js)
// รับ prop onBack เหมือน OnsitePage/RobotStatsPage/ฯลฯ — เรียก setRobotIssuesPage(false)

import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "./theme.js";

const STATUS_LABEL = {
  new: "ใหม่",
  acknowledged: "รับทราบแล้ว",
  in_progress: "กำลังดำเนินการ",
  resolved: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  logged: "บันทึกแล้ว (แจ้งเหตุ)",
};

const STATUS_COLOR = {
  new: "#DC2626",
  acknowledged: "#D97706",
  in_progress: "#2563EB",
  resolved: "#16A34A",
  cancelled: "#6B7280",
  logged: "#6B7280",
};

const CATEGORY_LABEL = {
  repair: "🔧 แจ้งซ่อม",
  exception: "📋 แจ้งเหตุ",
};

// map รหัสอาการ/สาเหตุ → ข้อความไทย ต้อง sync กับ ISSUE_TYPES ใน lib/repairFlow.js
// และ REASON_OPTIONS ใน lib/exceptionFlow.js ของฝั่งบอทเสมอ (คนละ repo กัน)
const ISSUE_TYPE_LABEL = {
  // จาก repairFlow.js (แจ้งซ่อม)
  stopped: "🔴 หยุดทำงาน/ไม่วิ่ง",
  error: "🟡 Error/มีเสียงเตือน",
  not_clean: "🟠 ทำความสะอาดไม่สะอาด",
  battery: "🔵 แบตเตอรี่/ชาร์จมีปัญหา",
  part_damage: "⚙️ อะไหล่ชำรุด",
  // จาก exceptionFlow.js (แจ้งเหตุ)
  event: "🎪 มีอีเว้นต์ในพื้นที่",
  rain: "🌧️ ฝนตก/พื้นเปียก",
  closed: "🚧 พื้นที่ปิด/ปรับปรุง",
  // ใช้ร่วมกันทั้ง 2 flow
  other: "⚪ อื่นๆ",
};

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || "#6B7280";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: "#fff", background: color,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PriorityTag({ priority }) {
  if (!priority) return null;
  const isUrgent = priority === "urgent";
  return (
    <span style={{ color: isUrgent ? "#DC2626" : "#16A34A", fontWeight: 700, fontSize: 12 }}>
      {isUrgent ? "🔴 ด่วน" : "🟢 ปกติ"}
    </span>
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
            style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 8,
              border: `1px solid ${c.border}`, cursor: "pointer" }} />
        ))}
        {videoUrls.map((url, i) => (
          <div key={`vid-${i}`} onClick={() => setLightbox({ type: "video", url })}
            style={{ width: 76, height: 76, borderRadius: 8, border: `1px solid ${c.border}`,
              cursor: "pointer", background: "#111827", display: "flex",
              alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}
            title="เปิดดูวิดีโอ">▶</div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          {lightbox.type === "image" ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }} />
          ) : (
            <video src={lightbox.url} controls autoPlay
              style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  );
}

function IssueCard({ issue, onUpdateStatus, c }) {
  const [updating, setUpdating] = useState(false);
  async function handleStatusChange(newStatus) {
    setUpdating(true);
    await onUpdateStatus(issue.id, newStatus);
    setUpdating(false);
  }
  const createdLabel = issue.createdAt
    ? new Date(issue.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "-";

  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, padding: 14,
      marginBottom: 10, background: c.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: c.text900 }}>
            {CATEGORY_LABEL[issue.category] || issue.category} · #{issue.ticketNo}
          </div>
          <div style={{ fontSize: 12, color: c.text400, marginTop: 2 }}>{createdLabel}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <StatusBadge status={issue.status} />
          <div style={{ marginTop: 4 }}><PriorityTag priority={issue.priority} /></div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: c.text500 }}>
        <div>🏢 <b style={{ color: c.text900 }}>สาขา:</b> {issue.branch || "-"}</div>
        <div>❗ <b style={{ color: c.text900 }}>อาการ/สาเหตุ:</b> {ISSUE_TYPE_LABEL[issue.issueType] || issue.issueType || "-"}</div>
        {issue.description && <div>📝 <b style={{ color: c.text900 }}>รายละเอียด:</b> {issue.description}</div>}
        {issue.incidentDate && <div>📅 <b style={{ color: c.text900 }}>วันที่เกิดเหตุ:</b> {issue.incidentDate}</div>}
        <div>👤 <b style={{ color: c.text900 }}>แจ้งโดย:</b> {issue.displayName || "-"}</div>
      </div>

      <AttachmentGallery imageUrls={issue.imageUrls} videoUrls={issue.videoUrls} c={c} />

      {issue.category === "repair" && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["acknowledged", "in_progress", "resolved"].map((s) => (
            <button key={s} disabled={updating || issue.status === s}
              onClick={() => handleStatusChange(s)}
              style={{
                padding: "5px 11px", borderRadius: 8,
                border: `1px solid ${issue.status === s ? "#6B21A8" : c.border}`,
                background: issue.status === s ? "#6B21A8" : c.bg,
                color: issue.status === s ? "#fff" : c.text500,
                fontSize: 12, fontFamily: "inherit",
                cursor: issue.status === s ? "default" : "pointer",
                opacity: updating ? 0.6 : 1,
              }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RobotIssuesPage({ onBack }) {
  const { c } = useTheme();
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

  const selectStyle = {
    padding: "7px 11px", borderRadius: 8, border: `1px solid ${c.border}`,
    fontSize: 13, background: c.card, color: c.text900, fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px",
        borderBottom: `1px solid ${c.border}`, background: c.card }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", fontSize: 18, color: c.text500,
          cursor: "pointer", padding: 4,
        }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.text900 }}>
          🛠️ แจ้งเหตุ/แจ้งซ่อม (LINE Bot)
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: c.text400, marginBottom: 14 }}>
          ข้อมูลจากระบบบอทแยกต่างหาก (robot-report-bot) — หน้านี้แค่แสดงผล/อัปเดตสถานะ ไม่กระทบระบบบอท
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
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
          <button onClick={load} style={{ ...selectStyle, cursor: "pointer" }}>🔄 รีเฟรช</button>
        </div>

        {loading && <div style={{ color: c.text400 }}>กำลังโหลด...</div>}
        {error && <div style={{ color: "#DC2626" }}>{error}</div>}
        {!loading && !error && issues.length === 0 && (
          <div style={{ color: c.text400 }}>ไม่พบเคสตามเงื่อนไขที่เลือก</div>
        )}

        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onUpdateStatus={handleUpdateStatus} c={c} />
        ))}
      </div>
    </div>
  );
}
