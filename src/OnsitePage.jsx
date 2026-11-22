import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, query, where
} from "firebase/firestore";
import OnsiteModal from "./OnsiteModal.jsx";
import { uiAlert, uiConfirm } from "./components/Dialogs.jsx";

export default function OnsitePage({ onBack, projects, users, currentUser }) {
  const [tab, setTab]           = useState("list");
  const [records, setRecords]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [filterProj, setFilterProj] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
  }, []);

  // ยืนยันลบด้วยหน้าต่างตามธีม
  useEffect(() => {
    if (!confirmId) return;
    const id = confirmId;
    uiConfirm("ลบรายการ Onsite นี้?\n\nลบแล้วกู้คืนไม่ได้").then(ok => { if (ok) deleteOnsite(id); else setConfirmId(null); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmId]);

  useEffect(() => {
    const u = onSnapshot(collection(db, "onsiteRecords"), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRecords(data);
    });
    return u;
  }, []);

  async function saveOnsite(data, id) {
    setSaving(true);
    try {
      const docId = id || Date.now().toString();
      await setDoc(doc(db, "onsiteRecords", docId), {
        ...data,
        createdBy: currentUser?.id || currentUser?.uid || "",
        updatedAt: new Date().toISOString(),
        ...(id ? {} : { createdAt: new Date().toISOString() }),
      }, { merge: true });
      setShowModal(false);
      setEditRecord(null);
    } catch (err) {
      uiAlert("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function approveRecord(id) {
    await updateDoc(doc(db, "onsiteRecords", id), {
      status: "approved",
      approvedBy: currentUser?.name || "",
      approvedAt: new Date().toISOString(),
    });
  }

  async function rejectRecord(id) {
    await updateDoc(doc(db, "onsiteRecords", id), {
      status: "rejected",
      approvedBy: currentUser?.name || "",
      approvedAt: new Date().toISOString(),
    });
  }

  async function deleteOnsite(id) {
    await deleteDoc(doc(db, "onsiteRecords", id));
    setConfirmId(null);
  }

  const fmtDate = d => {
    if (!d) return "";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${parseInt(y) + 543}`;
  };

  const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const fmtMonth = m => {
    const [y, mo] = m.split("-");
    return `${MONTH_TH[parseInt(mo) - 1]} ${parseInt(y) + 543}`;
  };

  // ---- filtered list ----
  const myRecords = isAdmin ? records : records.filter(r => r.createdBy === (currentUser?.id || currentUser?.uid));

  const filteredList = myRecords.filter(r => {
    if (filterProj !== "all" && r.projectId !== filterProj) return false;
    if (filterMonth && !(r.date || "").startsWith(filterMonth)) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const pendingRecords = records.filter(r => r.status === "pending");

  // ---- machine history ----
  const machineRecords = myRecords.filter(r => r.robotSerial?.trim());
  const byMachine = machineRecords.reduce((acc, r) => {
    const key = r.robotSerial.trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const months = [...new Set(myRecords.map(r => (r.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const projIds = [...new Set(myRecords.map(r => r.projectId).filter(Boolean))];

  const totalCost = filteredList.reduce((s, r) => s + (r.totalCost || 0), 0);

  const inputStyle = {
    border: "1px solid #e4e4e7", borderRadius: 8, padding: "6px 10px",
    fontSize: 12, fontFamily: "inherit", background: "#fafafa", outline: "none",
  };

  const statusBadge = status => {
    const map = {
      approved: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a", label: "อนุมัติแล้ว" },
      pending:  { bg: "#fffbeb", border: "#fde68a", color: "#d97706", label: "รออนุมัติ" },
      rejected: { bg: "#fff5f5", border: "#fecaca", color: "#ef4444", label: "ไม่อนุมัติ" },
    };
    const s = map[status] || map["pending"];
    return (
      <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight:600 }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Noto Sans Thai',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e4e4e7", padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "#f4f4f5", border: "none", borderRadius: 8,
          padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          color: "#52525b", fontWeight: 600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize: 16, fontWeight:600, color: "#09090b" }}>บันทึก Onsite</div>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => { setEditRecord(null); setShowModal(true); }}
            style={{ background: "#F97316", border: "none", color: "#fff", borderRadius:8,
              padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight:600,
              fontFamily: "inherit" }}>
            + บันทึก
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e4e4e7",
        display: "flex", gap: 0, overflowX: "auto" }}>
        {[
          { key: "list",    label: "รายการ" },
          { key: "machine", label: "ประวัติเครื่อง" },
          ...(isAdmin ? [{ key: "approve", label: `✅ อนุมัติ${pendingRecords.length > 0 ? ` (${pendingRecords.length})` : ""}` }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ background: "none", border: "none", borderBottom: tab === t.key ? "3px solid #F97316" : "3px solid transparent",
              color: tab === t.key ? "#F97316" : "#71717a", fontWeight: tab === t.key ? 700 : 500,
              padding: "12px 20px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 16px 80px" }}>

        {/* ============ TAB: รายการ ============ */}
        {tab === "list" && <>
          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "รายการทั้งหมด", val: filteredList.length, color: "#F97316" },
              { label: "ต้นทุนรวม", val: `${totalCost.toLocaleString()} ฿`, color: "#6B21A8" },
              { label: "รออนุมัติ", val: isAdmin ? pendingRecords.length : myRecords.filter(r=>r.status==="pending").length, color: "#d97706" },
            ].map(k => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid #e4e4e7",
                borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#a1a1aa", fontWeight:600, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight:600, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12,
            padding: "12px 16px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={inputStyle}>
              <option value="all">ทุกโครงการ</option>
              {projIds.map(id => {
                const p = projects.find(p => p.id === id);
                return <option key={id} value={id}>{p?.name || id}</option>;
              })}
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={inputStyle}>
              <option value="">ทุกเดือน</option>
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
              <option value="all">ทุกสถานะ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="pending">รออนุมัติ</option>
              <option value="rejected">ไม่อนุมัติ</option>
            </select>
            {(filterProj !== "all" || filterMonth || filterStatus !== "all") && (
              <button onClick={() => { setFilterProj("all"); setFilterMonth(""); setFilterStatus("all"); }}
                style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#ef4444",
                  borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ล้าง
              </button>
            )}
          </div>

          {/* Records */}
          {filteredList.length === 0 ? (
            <div style={{ textAlign: "center", color: "#d4d4d8", padding: 48, fontSize: 14 }}>
              ยังไม่มีข้อมูล Onsite
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredList.map(r => {
                const proj = projects.find(p => p.id === r.projectId);
                return (
                  <div key={r.id} style={{ background: "#fff", border: "1px solid #e4e4e7",
                    borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight:600, color: "#09090b" }}>
                          {r.techs?.join(", ") || "-"}
                        </span>
                        {statusBadge(r.status)}
                      </div>
                      {proj && (
                        <div style={{ fontSize: 12, color: "#71717a", display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: proj.color || "#a1a1aa" }}/>
                          {proj.name}
                        </div>
                      )}
                      {r.site && <div style={{ fontSize: 12, color: "#52525b", marginBottom: 2 }}>{r.site}</div>}
                      {r.scope && <div style={{ fontSize: 12, color: "#71717a", marginBottom: 2 }}>{r.scope}</div>}
                      {r.detail && <div style={{ fontSize: 12, color: "#71717a", marginBottom: 3 }}>{r.detail}</div>}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#a1a1aa" }}>{fmtDate(r.date)}</span>
                        {r.totalCost > 0 && (
                          <span style={{ fontSize: 11, color: "#F97316", fontWeight:600 }}>
                            💰 {r.totalCost.toLocaleString()} ฿
                          </span>
                        )}
                        {r.robotSerial && <span style={{ fontSize: 11, color: "#6B21A8" }}>{r.robotSerial}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditRecord(r); setShowModal(true); }}
                        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb",
                          borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>แก้ไข</button>
                      {isAdmin && (
                        <button onClick={() => setConfirmId(r.id)}
                          style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#ef4444",
                            borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>ลบ</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {/* ============ TAB: ประวัติเครื่อง ============ */}
        {tab === "machine" && <>
          {Object.keys(byMachine).length === 0 ? (
            <div style={{ textAlign: "center", color: "#d4d4d8", padding: 48, fontSize: 14 }}>
              ยังไม่มีข้อมูลหุ่นยนต์/เครื่องจักร
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Object.entries(byMachine).map(([serial, recs]) => {
                const proj = projects.find(p => p.id === recs[0]?.projectId);
                return (
                  <div key={serial} style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#fafafa", borderBottom: "1px solid #e4e4e7",
                      padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                                            <div>
                        <div style={{ fontSize: 14, fontWeight:600, color: "#09090b" }}>{serial}</div>
                        {proj && <div style={{ fontSize: 11, color: "#71717a" }}>{proj.name}</div>}
                      </div>
                      <span style={{ marginLeft: "auto", background: "#fff7ed", border: "1px solid #fed7aa",
                        color: "#F97316", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight:600 }}>
                        {recs.length} ครั้ง
                      </span>
                    </div>
                    <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {recs.map(r => (
                        <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          paddingBottom: 8, borderBottom: "1px solid #f4f4f5" }}>
                          <div style={{ fontSize: 11, color: "#a1a1aa", minWidth: 70, flexShrink: 0 }}>
                            {fmtDate(r.date)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "#52525b", fontWeight: 600 }}>{r.scope}</div>
                            {r.detail && <div style={{ fontSize: 12, color: "#71717a" }}>{r.detail}</div>}
                            {r.techs?.length > 0 && (
                              <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>
                                👤 {r.techs.join(", ")}
                              </div>
                            )}
                          </div>
                          {statusBadge(r.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {/* ============ TAB: อนุมัติ (admin only) ============ */}
        {tab === "approve" && isAdmin && <>
          {pendingRecords.length === 0 ? (
            <div style={{ textAlign: "center", color: "#d4d4d8", padding: 48, fontSize: 14 }}>
              ✅ ไม่มีรายการรออนุมัติ
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingRecords.map(r => {
                const proj = projects.find(p => p.id === r.projectId);
                return (
                  <div key={r.id} style={{ background: "#fff", border: "1px solid #fde68a",
                    borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight:600, color: "#09090b", marginBottom: 2 }}>
                          {r.techs?.join(", ") || "-"}
                        </div>
                        {proj && (
                          <div style={{ fontSize: 12, color: "#71717a", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: proj.color || "#a1a1aa" }}/>
                            {proj.name}
                          </div>
                        )}
                        {r.site && <div style={{ fontSize: 12, color: "#52525b" }}>{r.site}</div>}
                        <div style={{ fontSize: 12, color: "#71717a" }}>{r.scope}</div>
                        {r.detail && <div style={{ fontSize: 12, color: "#71717a" }}>{r.detail}</div>}
                        <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 4 }}>{fmtDate(r.date)}</div>
                        {r.totalCost > 0 && (
                          <div style={{ fontSize: 12, color: "#F97316", fontWeight:600, marginTop: 2 }}>
                            💰 {r.totalCost.toLocaleString()} ฿
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                      <button onClick={() => rejectRecord(r.id)}
                        style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#ef4444",
                          borderRadius:8, padding: "10px", fontSize: 13, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit" }}>
                        ❌ ไม่อนุมัติ
                      </button>
                      <button onClick={() => approveRecord(r.id)}
                        style={{ background: "#16a34a", border: "none", color: "#fff",
                          borderRadius:8, padding: "10px", fontSize: 13, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit" }}>
                        ✅ อนุมัติ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>}

      </div>

      {/* Confirm delete */}

      {showModal && (
        <OnsiteModal
          onClose={() => { setShowModal(false); setEditRecord(null); }}
          onSave={saveOnsite}
          saving={saving}
          projects={projects}
          users={users}
          currentUser={currentUser}
          editRecord={editRecord}
        />
      )}
    </div>
  );
}
