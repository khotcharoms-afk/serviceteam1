// วางไฟล์นี้ไว้ในโฟลเดอร์เดียวกับ RobotStatsPage.jsx (เช่น src/pages/ หรือ src/)
// แล้วเพิ่มเมนู + route ตามคำแนะนำท้ายไฟล์นี้ (ในคอมเมนต์)
//
// ปรับสี/ธีมให้ตรงกับระบบเดิมของ ServiceLog ได้ตามสบาย — ไฟล์นี้ตั้งใจเขียนแบบ
// self-contained (ไม่ผูกกับ theme.js/useTheme ของโปรเจกต์ เพราะไม่มีไฟล์ต้นฉบับ
// ให้ดูตอนเขียน) ใช้สี Metthier ตรงๆ (ส้ม #F97316 / ม่วง #6B21A8) ไปก่อน

import React, { useEffect, useState, useCallback } from "react";

const ORANGE = "#F97316";
const PURPLE = "#6B21A8";

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

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || "#6B7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        background: color,
      }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PriorityDot({ priority }) {
  if (!priority) return null;
  const isUrgent = priority === "urgent";
  return (
    <span style={{ color: isUrgent ? "#DC2626" : "#16A34A", fontWeight: 700, fontSize: 13 }}>
      {isUrgent ? "🔴 ด่วน" : "🟢 ปกติ"}
    </span>
  );
}

function AttachmentGallery({ imageUrls = [], videoUrls = [] }) {
  const [lightbox, setLightbox] = useState(null); // { type, url } | null

  if (!imageUrls.length && !videoUrls.length) return null;

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {imageUrls.map((url, i) => (
          <img
            key={`img-${i}`}
            src={url}
            alt={`แนบ ${i + 1}`}
            onClick={() => setLightbox({ type: "image", url })}
            style={{
              width: 84,
              height: 84,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              cursor: "pointer",
            }}
          />
        ))}
        {videoUrls.map((url, i) => (
          <div
            key={`vid-${i}`}
            onClick={() => setLightbox({ type: "video", url })}
            style={{
              width: 84,
              height: 84,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              background: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
            }}
            title="เปิดดูวิดีโอ"
          >
            ▶
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          {lightbox.type === "image" ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }} />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay
              style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}

function IssueCard({ issue, onUpdateStatus }) {
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
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {CATEGORY_LABEL[issue.category] || issue.category} · #{issue.ticketNo}
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{createdLabel}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <StatusBadge status={issue.status} />
          <div style={{ marginTop: 4 }}>
            <PriorityDot priority={issue.priority} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
        <div>
          🏢 <b>สาขา:</b> {issue.branch || "-"}
        </div>
        <div>
          ❗ <b>อาการ/สาเหตุ:</b> {issue.issueType || "-"}
        </div>
        {issue.description && (
          <div>
            📝 <b>รายละเอียด:</b> {issue.description}
          </div>
        )}
        {issue.incidentDate && (
          <div>
            📅 <b>วันที่เกิดเหตุ:</b> {issue.incidentDate}
          </div>
        )}
        <div>
          👤 <b>แจ้งโดย:</b> {issue.displayName || "-"}
        </div>
      </div>

      <AttachmentGallery imageUrls={issue.imageUrls} videoUrls={issue.videoUrls} />

      {issue.category === "repair" && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["acknowledged", "in_progress", "resolved"].map((s) => (
            <button
              key={s}
              disabled={updating || issue.status === s}
              onClick={() => handleStatusChange(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${issue.status === s ? PURPLE : "#D1D5DB"}`,
                background: issue.status === s ? PURPLE : "#fff",
                color: issue.status === s ? "#fff" : "#374151",
                fontSize: 13,
                cursor: issue.status === s ? "default" : "pointer",
                opacity: updating ? 0.6 : 1,
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RobotIssuesPage() {
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

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: ORANGE }}>
        แจ้งเหตุ/แจ้งซ่อมจาก LINE Bot
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        ข้อมูลจากระบบบอทแยกต่างหาก (robot-report-bot) — หน้านี้แค่แสดงผล/อัปเดตสถานะ ไม่กระทบระบบบอท
      </p>

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
        <button onClick={load} style={{ ...selectStyle, cursor: "pointer", background: "#fff" }}>
          🔄 รีเฟรช
        </button>
      </div>

      {loading && <div style={{ color: "#6B7280" }}>กำลังโหลด...</div>}
      {error && <div style={{ color: "#DC2626" }}>{error}</div>}
      {!loading && !error && issues.length === 0 && (
        <div style={{ color: "#6B7280" }}>ไม่พบเคสตามเงื่อนไขที่เลือก</div>
      )}

      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} onUpdateStatus={handleUpdateStatus} />
      ))}
    </div>
  );
}

const selectStyle = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #D1D5DB",
  fontSize: 13,
  background: "#fff",
};

/*
─────────────────────────────────────────────────────────────
วิธีเชื่อมเข้าโปรเจกต์ ServiceLog หลัก (ปรับตามโครงสร้างจริงของคุณ)
─────────────────────────────────────────────────────────────

1) Drawer.jsx — เพิ่มเมนู (วางใกล้ๆ รายการ "📊 สถิติหุ่นยนต์" เดิม):

   <MenuItem
     icon="🛠️"
     label="แจ้งเหตุ/แจ้งซ่อม (LINE Bot)"
     onClick={() => navigateTo("robotIssues")}  // ปรับให้ตรงกับ pattern navigate เดิมของคุณ
   />

2) App.jsx — เพิ่ม branch แสดงหน้านี้ (ปรับตาม pattern routing เดิม เช่น ถ้าใช้
   React Router ก็เป็น <Route path="/robot-issues" element={<RobotIssuesPage />} />
   ถ้าใช้ state-based tab switching ก็เพิ่มเงื่อนไขคล้ายหน้าอื่นๆ ที่มีอยู่แล้ว):

   import RobotIssuesPage from "./RobotIssuesPage"; // ปรับ path ตามที่วางไฟล์จริง
   ...
   {currentPage === "robotIssues" && <RobotIssuesPage />}

หมายเหตุ: ไม่มีไฟล์ App.jsx/Drawer.jsx ตัวจริงให้ดูตอนเขียนโค้ดนี้ เลยให้แค่โครงตัวอย่าง
ถ้า pattern ไม่ตรงกับที่ใช้จริง ส่งส่วนที่เกี่ยวกับเมนู/routing ของทั้ง 2 ไฟล์มาให้ดู
จะแก้ snippet ให้ตรงเป๊ะได้เลย
*/
