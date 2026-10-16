// src/AssistantPage.jsx — "ผู้ช่วย AI" แชทถามข้อมูลเคส/โครงการ/งานค้าง/ประกันใกล้หมด
// แสดงเป็นแผงด้านซ้าย เปิดจากปุ่มลอย 🤖 มุมซ้ายล่าง (หรือเมนูใน Drawer)
// ซ่อนด้วย open=false แทนการ unmount เพื่อให้บทสนทนายังอยู่เมื่อปิดแล้วเปิดใหม่
// เรียก api/assistant.js (Gemini) ส่วนการค้นข้อมูลรันในเบราว์เซอร์ผ่าน src/assistantTools.js
// กับ cases/projects ที่แอปโหลดไว้แล้ว

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme.js";
import { auth } from "./firebase";
import { runAssistantTool, TOOL_LABELS } from "./assistantTools.js";

const ORANGE = "#F97316";
const PURPLE = "#6B21A8";
const RED = "#DC2626";
const MAX_TOOL_ROUNDS = 6;

const SUGGESTIONS_USER = [
  "งานของฉันที่ยังค้างอยู่มีอะไรบ้าง",
  "เคสที่ค้างนานเกิน 14 วัน",
  "โครงการไหนประกันจะหมดใน 60 วัน",
  "สรุปเคสล่าสุดของโครงการ…",
];
const SUGGESTIONS_ADMIN = [
  "สรุปงานค้างแยกตามช่าง",
  "เดือนนี้เปิดเคสไปกี่เคส แยกตามประเภท",
  "ประกันหรือสัญญาเช่าที่จะหมดใน 90 วัน",
  "เคสที่ค้างนานเกิน 14 วัน",
];

// แสดง markdown แบบง่าย (ตัวหนา, รายการ, หัวข้อ) โดยไม่ใช้ innerHTML
function renderInline(text, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>
  );
}
function MarkdownLite({ text, c }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
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

export default function AssistantPage({ open = true, onClose, currentUser, cases = [], projects = [] }) {
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
  function handleClose() {
    if (window.history.state?.aiPanel) window.history.back(); // popstate จะเรียก onClose ให้
    else onClose?.();
  }

  // ช่องพิมพ์ขยายตามข้อความ (สูงสุด ~5 บรรทัด)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }, [input]);

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
    if (!res.ok) throw new Error(data.error || "เรียกผู้ช่วย AI ไม่สำเร็จ");
    return data;
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
        const results = toolUses.map((t) => {
          const r = runAssistantTool(t.name, t.input, {
            ...dataRef.current, currentUser, role: data.role, // role จาก server ที่ตรวจแล้ว
          });
          return { type: "tool_result", tool_use_id: t.id, content: r.content, ...(r.isError ? { is_error: true } : {}) };
        });
        msgs = [...msgs, { role: "user", content: results }];
        setHistory(msgs);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "เกิดข้อผิดพลาด");
      // ตัดประวัติกลับไปก่อนคำถามที่ล้มเหลว เพื่อให้ถามใหม่ได้
      setHistory((h) => {
        const idx = h.length - 1 - [...h].reverse().findIndex((m) => m.role === "user" && m.content.some((b) => b.type === "text"));
        return idx >= 0 && idx < h.length ? h.slice(0, idx) : h;
      });
      setInput(q);
    } finally {
      setBusy(false);
      setActivity("");
    }
  }

  // แปลง history เป็นฟองแชทที่ผู้ใช้เห็น (ซ่อน tool_result)
  const bubbles = [];
  history.forEach((m, i) => {
    const texts = m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (m.role === "user" && texts) bubbles.push({ key: i, who: "me", text: texts });
    if (m.role === "assistant") {
      if (texts) bubbles.push({ key: i, who: "ai", text: texts });
      const tools = m.content.filter((b) => b.type === "tool_use");
      if (tools.length) bubbles.push({ key: `${i}-t`, who: "tool", text: tools.map((t) => TOOL_LABELS[t.name] || t.name).join(" · ") });
    }
  });

  const suggestions = isAdminOrDev ? SUGGESTIONS_ADMIN : SUGGESTIONS_USER;

  return (
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
        <button onClick={handleClose} title="ปิด" aria-label="ปิดผู้ช่วย AI"
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 18 }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => (s.endsWith("…") ? setInput(s.replace("…", "")) : send(s))}
                    style={{ border: `1px solid ${PURPLE}33`, background: PURPLE + "0d", color: c.purple, borderRadius: 999,
                      padding: isMobile ? "10px 14px" : "8px 14px", fontSize: isMobile ? 14 : 13, cursor: "pointer", fontFamily: "inherit",
                      ...(isMobile ? { width: "100%" } : {}) }}>
                    {s}
                  </button>
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
        <form onSubmit={(e) => { e.preventDefault(); send(); }}
          style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={2000}
            placeholder={isMobile ? "พิมพ์คำถาม…" : "พิมพ์คำถาม เช่น งานค้างของฉันมีอะไรบ้าง"}
            enterKeyHint="send"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            style={{ flex: 1, resize: "none", maxHeight: 132, padding: "10px 14px", borderRadius: 12, lineHeight: 1.5,
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
  );
}
