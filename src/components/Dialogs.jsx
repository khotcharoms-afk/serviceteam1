import { useEffect, useRef, useState } from "react";

// ── หน้าต่างยืนยัน / แจ้งเตือน ตามธีมของแอป (แทน confirm()/alert() ของเบราว์เซอร์) ──
// ใช้: if (!(await uiConfirm("ลบรายการนี้?\n\nลบแล้วกู้คืนไม่ได้"))) return;
//      uiAlert("บันทึกไม่สำเร็จ");
// ย่อหน้าแรกของข้อความเป็นหัวข้อ ที่เหลือเป็นคำอธิบาย
// ถ้าข้อความขึ้นต้นด้วย ลบ/ระงับ ปุ่มยืนยันจะเป็นสีแดงอัตโนมัติ

let push = null;
const queue = [];

function open(kind, message, opts = {}) {
  return new Promise(resolve => {
    const item = { kind, message: String(message ?? ""), opts, resolve };
    if (push) push(item); else queue.push(item);
  });
}
export const uiConfirm = (message, opts) => open("confirm", message, opts);
export const uiAlert = (message, opts) => open("alert", message, opts);
// คืนค่าข้อความที่พิมพ์ (ตัดช่องว่างหน้า-หลัง) หรือ null ถ้ากดยกเลิก
export const uiPrompt = (message, defaultValue = "", opts) => open("prompt", message, { ...opts, defaultValue });

export function DialogHost() {
  const [items, setItems] = useState([]);
  const okRef = useRef(null);

  useEffect(() => {
    push = item => setItems(list => [...list, item]);
    if (queue.length) setItems(list => [...list, ...queue.splice(0)]);
    return () => { push = null; };
  }, []);

  const cur = items[0];
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (!cur) return;
    setText(cur.opts.defaultValue ?? "");
    setTimeout(() => (cur.kind === "prompt" ? inputRef.current?.select() : okRef.current?.focus()), 0);
  }, [cur]);

  if (!cur) return null;
  const close = val => { cur.resolve(val); setItems(list => list.slice(1)); };
  const [head, ...rest] = cur.message.split(/\n\s*\n/);
  const body = rest.join("\n\n");
  const danger = cur.opts.danger ?? /^\s*(ยืนยัน\s*)?(ลบ|ระงับ|เคลียร์)/.test(head);
  const okText = cur.opts.okText || (cur.kind === "alert" ? "ตกลง" : /^\s*(ยืนยัน\s*)?ลบ/.test(head) ? "ลบ" : /^\s*ระงับ/.test(head) ? "ระงับ" : "ยืนยัน");
  const isConfirm = cur.kind !== "alert";
  const isPrompt = cur.kind === "prompt";
  const cancelVal = isPrompt ? null : isConfirm ? false : undefined;
  const okVal = () => isPrompt ? text.trim() : isConfirm ? true : undefined;

  const btn = { height: 36, padding: "0 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div role="presentation" onClick={() => close(cancelVal)}
      onKeyDown={e => { if (e.key === "Escape") close(cancelVal); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="ui-dlg-title" onClick={e => e.stopPropagation()}
        style={{ background: "var(--c-card)", color: "var(--c-text900)", border: "1px solid var(--c-border)", borderRadius: 12,
          width: "100%", maxWidth: 400, padding: 24, boxShadow: "0 16px 48px rgba(0,0,0,.2)", boxSizing: "border-box",
          fontFamily: "'Geist','Noto Sans Thai',system-ui,sans-serif" }}>
        <div id="ui-dlg-title" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{head}</div>
        {body && <div style={{ fontSize: 14, color: "var(--c-text500)", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</div>}
        {isPrompt && (
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") close(okVal()); }}
            style={{ marginTop: 16, width: "100%", boxSizing: "border-box", height: 40, padding: "0 12px", fontSize: 14,
              fontFamily: "inherit", border: "1px solid var(--c-border)", borderRadius: 8, background: "var(--c-card)",
              color: "var(--c-text900)", outline: "none" }}/>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          {isConfirm && (
            <button onClick={() => close(cancelVal)}
              style={{ ...btn, background: "var(--c-card)", color: "var(--c-text900)", border: "1px solid var(--c-border)" }}>ยกเลิก</button>
          )}
          <button ref={okRef} onClick={() => close(okVal())}
            style={{ ...btn, border: "none", color: "#fff", background: danger ? "#dc2626" : "#2563eb" }}>{okText}</button>
        </div>
      </div>
    </div>
  );
}
