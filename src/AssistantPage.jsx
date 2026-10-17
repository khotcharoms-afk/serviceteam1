// src/AssistantPage.jsx — "ผู้ช่วย AI" แชทถามข้อมูลเคส/โครงการ/งานค้าง/ประกันใกล้หมด
// แสดงเป็นแผงด้านซ้าย เปิดจากปุ่มลอย 🤖 มุมซ้ายล่าง (หรือเมนูใน Drawer)
// ซ่อนด้วย open=false แทนการ unmount เพื่อให้บทสนทนายังอยู่เมื่อปิดแล้วเปิดใหม่
// เรียก api/assistant.js (Gemini) ส่วนการค้นข้อมูลรันในเบราว์เซอร์ผ่าน src/assistantTools.js
// กับ cases/projects ที่แอปโหลดไว้แล้ว

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme.js";
import { auth, db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { runAssistantTool, TOOL_LABELS } from "./assistantTools.js";
import { quickActionsFor, runQuickAction, localSearchAnswer } from "./assistantQuick.js";
import { fixThaiText } from "./thaiText.js";

const ORANGE = "#F97316";
const PURPLE = "#6B21A8";
const RED = "#DC2626";
const MAX_TOOL_ROUNDS = 6;

// ตัวอย่างคำถามที่ต้องใช้ AI (กดแล้วใส่ในช่องพิมพ์ให้แก้ต่อ)
const AI_EXAMPLES = [
  "สรุปเคสล่าสุดของโครงการ ",
  "เบอร์ผู้ติดต่อของลูกค้า ",
  "วิธีแก้ปัญหา ",
];

// แสดง markdown แบบง่าย (ตัวหนา, รายการ, หัวข้อ) โดยไม่ใช้ innerHTML
function renderInline(text, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return <code key={key} style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace", fontSize: "0.88em",
        background: "rgba(107,33,168,.08)", padding: "1px 5px", borderRadius: 5, wordBreak: "break-all" }}>{p.slice(1, -1)}</code>;
    }
    return <React.Fragment key={key}>{p}</React.Fragment>;
  });
}
function MarkdownLite({ text, c }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        // บรรทัดย่อยใต้รายการ (ขึ้นต้นด้วยช่องว่าง) → ย่อหน้าเข้าและสีจางลง
        if (/^\s{2,}\S/.test(line) && !/^\s*([-*•]|\d+[.)])\s/.test(line)) {
          return <div key={i} style={{ paddingLeft: 20, fontSize: "0.92em", color: c.text500 }}>{renderInline(t, i)}</div>;
        }
        const h = /^#{1,4}\s+(.*)$/.exec(t);
        if (h) return <div key={i} style={{ fontWeight: 800, marginTop: 4, color: c.text900 }}>{renderInline(h[1], i)}</div>;
        const li = /^([-*•]|\d+[.)])\s+(.*)$/.exec(t);
        if (li) {
          const bullet = /^\d/.test(li[1]) ? li[1] : "•";
          return (
            <div key={i} style={{ display: "flex", gap: 6, paddingLeft: 2 }}>
              <span style={{ color: c.text400, flexShrink: 0, minWidth: 12 }}>{bullet}</span>
              <span>{renderInline(li[2], i)}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line, i)}</div>;
      })}
    </div>
  );
}

export default function AssistantPage({ open = true, onClose, onExpand, onChatChange, currentUser, cases = [], projects = [] }) {
  const { c } = useTheme();
  const isAdminOrDev = ["admin", "dev"].includes(currentUser?.role);
  // history = ข้อความรูปแบบ Anthropic Messages API ที่ส่งไป server
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  // เก็บ cases/projects ล่าสุดไว้ใน ref เผื่อข้อมูลอัปเดตระหว่างที่ AI กำลังทำงาน
  const dataRef = useRef({ cases, projects });
  dataRef.current = { cases, projects };

  // Knowledge Hub โหลดครั้งแรกที่ AI ต้องค้น แล้วเก็บไว้ (อายุ 10 นาที) ไม่เพิ่ม reads ถ้าไม่มีใครถามเรื่องนี้
  const knowledgeRef = useRef({ list: null, at: 0 });
  async function loadKnowledge() {
    const k = knowledgeRef.current;
    if (k.list && Date.now() - k.at < 10 * 60 * 1000) return k.list;
    const snap = await getDocs(collection(db, "knowledge"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    knowledgeRef.current = { list, at: Date.now() };
    return list;
  }

  const inputRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── มือถือ ───────────────────────────────────────────────
  // จอแคบ = แผงเต็มจอ และตามขนาด visualViewport เพื่อให้ช่องพิมพ์อยู่เหนือคีย์บอร์ดเสมอ (iOS ไม่ย่อ layout ให้เอง)
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches);
  const [vv, setVv] = useState(null); // { top, height } ของพื้นที่ที่มองเห็นจริง
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const onMq = () => setIsMobile(mq.matches);
    mq.addEventListener?.("change", onMq);
    const v = window.visualViewport;
    const onVv = () => v && setVv({ top: v.offsetTop, height: v.height });
    onVv();
    v?.addEventListener("resize", onVv);
    v?.addEventListener("scroll", onVv);
    return () => {
      mq.removeEventListener?.("change", onMq);
      v?.removeEventListener("resize", onVv);
      v?.removeEventListener("scroll", onVv);
    };
  }, []);

  // ล็อกการเลื่อนหน้าหลังแผงบนมือถือ
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  // ปุ่มย้อนกลับของมือถือ/เบราว์เซอร์ = ปิดแผง (ไม่ออกจากแอป)
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ aiPanel: true }, "");
    const onPop = () => onCloseRef.current?.();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);
  // พับ = ซ่อนแผงแต่เก็บบทสนทนาไว้ (แสดงเป็นแถบเล็กมุมซ้ายล่าง)
  function handleClose() {
    if (window.history.state?.aiPanel) window.history.back(); // popstate จะเรียก onClose ให้
    else onClose?.();
  }
  // ปิด = จบแชทนี้ (ล้างบทสนทนา) — ถ้ากำลังตอบอยู่ให้แค่พับไว้ก่อน
  function handleEnd() {
    if (!busy) { setHistory([]); setError(""); setUnread(false); }
    handleClose();
  }

  // ตอบเสร็จตอนพับอยู่ → จุดแจ้งเตือนบนแถบ
  const [unread, setUnread] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => { if (open) setUnread(false); }, [open]);

  const hasChat = history.length > 0 || busy;
  useEffect(() => { onChatChange?.(hasChat); }, [hasChat]);
  // แผงถูกถอดออก (เช่นไปหน้าอื่นจากเมนู) → แชทหาย ให้ App กลับไปแสดงปุ่ม 🤖
  useEffect(() => () => onChatChange?.(false), []);

  // ช่องพิมพ์ขยายตามข้อความ (สูงสุด ~5 บรรทัด)
  // scrollHeight ไม่รวมเส้นขอบ (box-sizing: border-box) → ต้องบวกขอบเข้าไป ไม่งั้นช่องจะเตี้ยไปและมีแถบเลื่อน
  // คำนวณเฉพาะตอนแผงเปิดอยู่ (ตอนซ่อน display:none ค่าความสูงเป็น 0)
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !open) return;
    el.style.height = "auto";
    const full = el.scrollHeight + (el.offsetHeight - el.clientHeight);
    el.style.height = Math.min(full, 132) + "px";
    el.style.overflowY = full > 132 ? "auto" : "hidden";
  }, [input, open, isMobile]);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history, activity, open, vv?.height]);

  async function callServer(messages) {
    const user = auth.currentUser;
    if (!user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
    const token = await user.getIdToken();
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "เรียกผู้ช่วย AI ไม่สำเร็จ");
      err.code = data.code;
      throw err;
    }
    return data;
  }

  // ⚡ ถามด่วน — ตอบทันทีจากข้อมูลในเครื่อง ไม่เรียก AI
  function quick(action) {
    if (busy) return;
    setError("");
    const answer = runQuickAction(action.key, { ...dataRef.current, currentUser, role: currentUser?.role });
    setHistory((h) => [
      ...h,
      { role: "user", content: [{ type: "text", text: action.label }] },
      { role: "assistant", content: [{ type: "text", text: answer }], quick: true },
    ]);
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setError("");
    setBusy(true);

    let msgs = [...history, { role: "user", content: [{ type: "text", text: q }] }];
    setHistory(msgs);

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        setActivity(round === 0 ? "กำลังคิด…" : "กำลังสรุปคำตอบ…");
        const data = await callServer(msgs);
        const content = data.content?.length ? data.content : [{ type: "text", text: "(ไม่มีคำตอบ)" }];
        // raw = parts ดิบของ Gemini ต้องเก็บไว้ส่งคืนในรอบถัดไป (มี thoughtSignature)
        msgs = [...msgs, {
          role: "assistant", content,
          ...(data.raw?.length ? { raw: data.raw } : {}),
          ...(data.model ? { model: data.model } : {}),
        }];
        setHistory(msgs);

        const toolUses = content.filter((b) => b.type === "tool_use");
        if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

        if (round === MAX_TOOL_ROUNDS) {
          // ถึงลิมิตรอบแล้ว — ตอบ tool_result ว่าหยุด เพื่อให้ประวัติแชทยังถูกต้องสำหรับคำถามถัดไป
          msgs = [...msgs, {
            role: "user",
            content: toolUses.map((t) => ({ type: "tool_result", tool_use_id: t.id, content: '{"error":"ถึงจำนวนครั้งสูงสุดแล้ว"}', is_error: true })),
          }];
          setHistory(msgs);
          setError("คำถามนี้ต้องค้นหลายขั้นเกินไป ลองถามให้เจาะจงขึ้น");
          break;
        }

        setActivity(toolUses.map((t) => TOOL_LABELS[t.name] || t.name).join(" · ") + "…");
        let knowledge = [];
        if (toolUses.some((t) => t.name === "search_knowledge")) {
          try { knowledge = await loadKnowledge(); } catch (e) { console.error("load knowledge:", e); }
        }
        const results = toolUses.map((t) => {
          const r = runAssistantTool(t.name, t.input, {
            ...dataRef.current, knowledge, currentUser, role: data.role, // role จาก server ที่ตรวจแล้ว
          });
          return { type: "tool_result", tool_use_id: t.id, content: r.content, ...(r.isError ? { is_error: true } : {}) };
        });
        msgs = [...msgs, { role: "user", content: results }];
        setHistory(msgs);
      }
    } catch (e) {
      console.error(e);
      // ตัดประวัติกลับไปก่อนคำถามที่ล้มเหลว (รวมรอบเรียกเครื่องมือที่ค้างอยู่)
      const rollback = (h) => {
        const idx = h.length - 1 - [...h].reverse().findIndex((m) => m.role === "user" && m.content.some((b) => b.type === "text"));
        return idx >= 0 && idx < h.length ? h.slice(0, idx) : h;
      };
      if (e.code === "busy") {
        // AI ไม่ว่าง/โควต้าหมด → ค้น Knowledge Hub + เคสเองจากคำถาม แล้วตอบแทน
        let knowledge = [];
        try { knowledge = await loadKnowledge(); } catch (err) { console.error("load knowledge:", err); }
        const answer = localSearchAnswer(q, { ...dataRef.current, knowledge, currentUser, role: currentUser?.role });
        setHistory((h) => [
          ...rollback(h),
          { role: "user", content: [{ type: "text", text: q }] },
          { role: "assistant", content: [{ type: "text", text: answer }], quick: true },
        ]);
      } else {
        setError(e.message || "เกิดข้อผิดพลาด");
        setHistory(rollback);
        setInput(q);
      }
    } finally {
      setBusy(false);
      setActivity("");
      if (!openRef.current) setUnread(true);
    }
  }

  // แปลง history เป็นฟองแชทที่ผู้ใช้เห็น (ซ่อน tool_result)
  const bubbles = [];
  history.forEach((m, i) => {
    const texts = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (m.role === "user" && texts) bubbles.push({ key: i, who: "me", text: texts });
    if (m.role === "assistant") {
      if (texts) bubbles.push({ key: i, who: "ai", text: fixThaiText(texts) });
      const tools = m.content.filter((b) => b.type === "tool_use");
      if (tools.length) bubbles.push({ key: `${i}-t`, who: "tool", text: tools.map((t) => TOOL_LABELS[t.name] || t.name).join(" · ") });
    }
  });

  const quickActions = quickActionsFor(currentUser?.role);
  const chipStyle = (primary) => ({
    border: `1px solid ${primary ? ORANGE + "55" : PURPLE + "33"}`,
    background: primary ? ORANGE + "12" : PURPLE + "0d",
    color: primary ? "#c2410c" : c.purple, borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
    padding: isMobile ? "9px 14px" : "7px 13px", fontSize: isMobile ? 14 : 13, cursor: busy ? "default" : "pointer",
    fontFamily: "inherit", opacity: busy ? 0.55 : 1,
  });

  // ข้อความล่าสุดของ AI ไว้โชว์บนแถบตอนพับ
  const lastAi = [...bubbles].reverse().find((b) => b.who === "ai")?.text?.replace(/[*#\n]+/g, " ").trim() || "";
  const pillStatus = busy ? (activity || "กำลังตอบ…") : unread ? "มีคำตอบใหม่ — แตะเพื่อดู" : error ? "เกิดข้อผิดพลาด — แตะเพื่อดู" : lastAi || "แตะเพื่อเปิดแชทต่อ";

  return (
    <>
    {!open && hasChat && (
      <div style={{ position: "fixed", left: 16, bottom: "calc(20px + env(safe-area-inset-bottom))", zIndex: 40,
        display: "flex", alignItems: "center", maxWidth: "min(340px, calc(100vw - 110px))",
        background: c.card, border: `1px solid ${PURPLE}33`, borderRadius: 999,
        boxShadow: "0 6px 20px rgba(107,33,168,.25)", fontFamily: "'Noto Sans Thai','Sora',sans-serif" }}>
        <button onClick={onExpand} aria-label="เปิดผู้ช่วย AI"
          style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, background: "none", border: "none",
            padding: "8px 6px 8px 8px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <span style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#6B21A8,#F97316)", color: "#fff", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            🤖
            {(unread || busy) && (
              <span style={{ position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: "50%",
                background: busy ? "#f59e0b" : "#22c55e", border: `2px solid ${c.card}`,
                animation: busy ? "aiDot 1.2s infinite" : "none" }} />
            )}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: c.text900 }}>ผู้ช่วย AI</span>
            <span style={{ display: "block", fontSize: 11.5, color: unread ? "#16a34a" : c.text400, fontWeight: unread ? 700 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pillStatus}</span>
          </span>
        </button>
        {!busy && (
          <button onClick={handleEnd} title="ปิดและล้างแชท" aria-label="ปิดและล้างแชท"
            style={{ background: "none", border: "none", color: c.text400, fontSize: 15, cursor: "pointer",
              width: 36, height: 36, marginRight: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        )}
        <style>{`@keyframes aiDot { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }`}</style>
      </div>
    )}
    <div style={{
      position: "fixed", left: 0, zIndex: 150,
      ...(isMobile && vv
        ? { top: vv.top, height: vv.height, width: "100vw" }
        : { top: 0, bottom: 0, width: isMobile ? "100vw" : "min(420px, 100vw)" }),
      display: open ? "flex" : "none", flexDirection: "column", background: c.bg,
      borderRight: isMobile ? "none" : `1px solid ${c.border}`,
      boxShadow: isMobile ? "none" : "6px 0 28px rgba(15,23,42,.18)",
      fontFamily: "'Noto Sans Thai','Sora',sans-serif", animation: "aiSlide .18s ease-out",
      overscrollBehavior: "contain",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        @keyframes aiDot { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        @keyframes aiSlide { from { transform: translateX(-24px); opacity: 0 } to { transform: none; opacity: 1 } }
      `}</style>

      {/* Header — แบบเดียวกับ RobotIssuesPage */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12,
        padding: isMobile ? "calc(8px + env(safe-area-inset-top)) 8px 8px 12px" : "14px 16px",
        borderBottom: `1px solid ${c.border}`, background: c.card, flexShrink: 0 }}>
        <div style={{ width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: 10, background: PURPLE + "16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 15 : 17, flexShrink: 0 }}>🤖</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: c.text900 }}>ผู้ช่วย AI</div>
          {!isMobile && <div style={{ fontSize: 11.5, color: c.text400 }}>ถามข้อมูลเคส โครงการ งานค้าง และประกันใกล้หมด</div>}
        </div>
        {history.length > 0 && (
          <button onClick={() => { if (!busy) { setHistory([]); setError(""); } }} disabled={busy}
            style={{ border: `1px solid ${c.border}`, background: "transparent", color: c.text500, borderRadius: 999,
              padding: isMobile ? "8px 12px" : "6px 12px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
              cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
            {isMobile ? "＋ ใหม่" : "＋ แชทใหม่"}
          </button>
        )}
        <button onClick={handleClose} title="พับเก็บ (บทสนทนายังอยู่)" aria-label="พับผู้ช่วย AI"
          style={{ background: "none", border: "none", fontSize: 22, color: c.text400, cursor: "pointer",
            width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button onClick={handleEnd} title={busy ? "พับเก็บ" : "ปิดและล้างแชท"} aria-label="ปิดผู้ช่วย AI"
          style={{ background: "none", border: "none", fontSize: 20, color: c.text400, cursor: "pointer",
            width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
        padding: isMobile ? "14px 12px" : "18px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {bubbles.length === 0 && (
            <div style={{ textAlign: "center", padding: isMobile ? "16px 4px 8px" : "28px 8px 8px" }}>
              <div style={{ fontSize: 34 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c.text900, marginTop: 6 }}>สวัสดี {currentUser?.name || ""}</div>
              <div style={{ fontSize: 13, color: c.text400, marginTop: 4 }}>
                ถามเรื่องเคส {cases.length} เคส และ {projects.length} โครงการในระบบได้เลย
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", marginTop: 18, marginBottom: 8 }}>
                ⚡ ถามด่วน — ตอบทันที ไม่ใช้โควต้า AI
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {quickActions.map((a) => (
                  <button key={a.key} onClick={() => quick(a)} disabled={busy}
                    style={{ ...chipStyle(true), ...(isMobile ? { width: "100%" } : {}) }}>⚡ {a.label}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.text400, marginTop: 18, marginBottom: 8 }}>
                🤖 หรือพิมพ์ถาม AI เช่น
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {AI_EXAMPLES.map((t) => (
                  <button key={t} onClick={() => { setInput(t); inputRef.current?.focus(); }}
                    style={chipStyle(false)}>{t.trim()}…</button>
                ))}
              </div>
            </div>
          )}

          {bubbles.map((b) =>
            b.who === "tool" ? (
              <div key={b.key} style={{ fontSize: 11.5, color: c.text400, paddingLeft: 6 }}>🔎 {b.text}</div>
            ) : (
              <div key={b.key} style={{ display: "flex", justifyContent: b.who === "me" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: isMobile ? "90%" : "86%", padding: "10px 14px", borderRadius: 14, fontSize: isMobile ? 15 : 14, lineHeight: 1.65,
                  whiteSpace: b.who === "me" ? "pre-wrap" : "normal", wordBreak: "break-word",
                  background: b.who === "me" ? ORANGE : c.card,
                  color: b.who === "me" ? "#fff" : c.text900,
                  border: b.who === "me" ? "none" : `1px solid ${c.border}`,
                  borderBottomRightRadius: b.who === "me" ? 4 : 14,
                  borderBottomLeftRadius: b.who === "me" ? 14 : 4,
                }}>
                  {b.who === "me" ? b.text : <MarkdownLite text={b.text} c={c} />}
                </div>
              </div>
            )
          )}

          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.text400, paddingLeft: 6 }}>
              <span>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: PURPLE,
                    marginRight: 3, animation: `aiDot 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </span>
              {activity}
            </div>
          )}

          {error && (
            <div style={{ background: RED + "10", color: RED, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${c.border}`, background: c.card, flexShrink: 0,
        padding: isMobile ? "8px 10px calc(8px + env(safe-area-inset-bottom))" : "10px 12px calc(10px + env(safe-area-inset-bottom))" }}>
        {bubbles.length > 0 && (
          <div style={{ maxWidth: 720, margin: "0 auto 8px", display: "flex", gap: 6, overflowX: "auto",
            scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {quickActions.map((a) => (
              <button key={a.key} onClick={() => quick(a)} disabled={busy}
                style={{ ...chipStyle(true), padding: "5px 11px", fontSize: 12.5 }}>⚡ {a.label}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }}
          style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={2000}
            placeholder="พิมพ์คำถาม…"
            enterKeyHint="send"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            style={{ flex: 1, resize: "none", minHeight: 44, maxHeight: 132, overflowY: "hidden", padding: "10px 14px", borderRadius: 12, lineHeight: 1.5,
              fontSize: isMobile ? 16 : 14, // ต่ำกว่า 16px iOS จะซูมหน้าจอตอนแตะช่องพิมพ์
              background: "var(--input-bg, #fff)", color: "var(--input-text, #1e293b)", border: "1px solid var(--input-border, #e2e8f0)",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          <button type="submit" disabled={busy || !input.trim()}
            style={{ background: busy || !input.trim() ? c.border : PURPLE, color: "#fff", border: "none", borderRadius: 12,
              padding: "10px 16px", minHeight: 44, minWidth: 56, fontSize: 15, fontWeight: 700,
              cursor: busy || !input.trim() ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            ส่ง
          </button>
        </form>
        {!(isMobile && vv && vv.height < window.innerHeight * 0.75) && ( // ซ่อนตอนคีย์บอร์ดเปิดบนมือถือ ให้มีที่อ่านแชทมากขึ้น
          <div style={{ maxWidth: 720, margin: "6px auto 0", fontSize: 10.5, color: c.text400, textAlign: "center" }}>
            AI อาจตอบผิดได้ ตรวจสอบกับข้อมูลในหน้าเคสก่อนนำไปใช้
          </div>
        )}
      </div>
    </div>
    </>
  );
}
