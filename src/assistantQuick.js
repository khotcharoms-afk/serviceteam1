// src/assistantQuick.js — "ถามด่วน ⚡" ตอบคำถามที่ใช้บ่อยทันทีโดยไม่เรียก AI
// ใช้เครื่องมือชุดเดียวกับ AI (assistantTools.js) รันในเบราว์เซอร์ แล้วจัดรูปแบบคำตอบเอง
// → ใช้ได้เสมอแม้โควต้า AI หมด ไม่เสีย reads เพิ่ม และข้อมูลไม่ออกจากเครื่อง

import { runAssistantTool } from "./assistantTools.js";

const fmt = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};
const bangkokToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD

function run(name, input, ctx) {
  return JSON.parse(runAssistantTool(name, input, ctx).content);
}

function caseLine(c, extra = "") {
  const where = [c.project, c.site].filter(Boolean).join(" / ");
  const techs = c.techs?.length ? ` · 👤 ${c.techs.join(", ")}` : "";
  return `- **${c.title || "(ไม่มีชื่อเคส)"}**${where ? ` — ${where}` : ""}\n  ${c.status}${extra}${techs}`;
}

function moreNote(total, shown) {
  return total > shown ? `\n\nแสดง ${shown} จาก ${total} เคส — ดูทั้งหมดได้ในหน้าเคส` : "";
}

const QUICK = {
  myPending: {
    label: "งานค้างของฉัน",
    run(ctx) {
      const r = run("pending_work", { assignedToMe: true, limit: 20 }, ctx);
      if (!r.total) return `ไม่มีงานค้างที่คุณเป็นผู้รับผิดชอบ 🎉`;
      return `งานค้างของคุณ **${r.total} เคส** (เรียงจากค้างนานสุด)\n\n` +
        r.cases.map((c) => caseLine(c, ` · ค้าง ${c.daysOpen ?? "?"} วัน`)).join("\n") + moreNote(r.total, r.cases.length);
    },
  },
  old14: {
    label: "เคสค้างเกิน 14 วัน",
    run(ctx) {
      const r = run("pending_work", { olderThanDays: 14, limit: 20 }, ctx);
      if (!r.total) return "ไม่มีเคสที่ค้างนานเกิน 14 วัน 👍";
      return `เคสที่ค้างนานเกิน 14 วัน **${r.total} เคส**\n\n` +
        r.cases.map((c) => caseLine(c, ` · ค้าง ${c.daysOpen ?? "?"} วัน · เปิด ${fmt(c.date)}`)).join("\n") + moreNote(r.total, r.cases.length);
    },
  },
  pendingByTech: {
    label: "งานค้างแยกตามช่าง",
    run(ctx) {
      const r = run("pending_work", { limit: 1 }, ctx);
      if (!r.total) return "ตอนนี้ไม่มีงานค้าง 🎉";
      const techs = Object.entries(r.byTech).sort((a, b) => b[1] - a[1]);
      const statuses = Object.entries(r.byStatus).map(([s, n]) => `${s} ${n}`).join(" · ");
      return `งานค้างทั้งหมด **${r.total} เคส** (${statuses})\n\n` +
        techs.map(([t, n]) => `- **${t}** — ${n} เคส`).join("\n");
    },
  },
  expiring90: {
    label: "ประกันใกล้หมดใน 90 วัน",
    run(ctx) {
      const r = run("expiring_contracts", { withinDays: 90 }, ctx);
      if (r.error) return r.error;
      if (!r.total) return "ไม่มีประกัน/สัญญาที่จะหมดภายใน 90 วัน";
      return `ใกล้หมดภายใน 90 วัน **${r.total} รายการ** (เรียงจากใกล้หมดสุด)\n\n` +
        r.items.map((x) => `- **${x.project}** — ${x.kind} หมด ${fmt(x.endDate)} (อีก ${x.daysLeft} วัน)` +
          (x.customer ? `\n  ลูกค้า: ${x.customer}` : "") + (x.activeCases ? ` · งานค้าง ${x.activeCases} เคส` : "")).join("\n");
    },
  },
  monthByType: {
    label: "เดือนนี้เปิดเคสกี่เคส",
    adminOnly: true,
    run(ctx) {
      const today = bangkokToday();
      const r = run("case_stats", { groupBy: "type", dateFrom: today.slice(0, 8) + "01", dateTo: today }, ctx);
      if (r.error) return r.error;
      const [y, m] = today.split("-");
      const head = `เดือน ${m}/${y} เปิดเคสทั้งหมด **${r.totalCases} เคส**`;
      if (!r.totalCases) return head;
      return `${head} แยกตามประเภท\n\n` +
        r.groups.map((g) => `- **${g.key}** — ${g.total} เคส (เสร็จ ${g.done}, ค้าง ${g.active})`).join("\n");
    },
  },
};

export function quickActionsFor(role) {
  const isAdminOrDev = role === "admin" || role === "dev";
  const order = isAdminOrDev
    ? ["pendingByTech", "old14", "expiring90", "monthByType", "myPending"]
    : ["myPending", "old14", "expiring90"];
  return order.filter((k) => !QUICK[k].adminOnly || isAdminOrDev).map((k) => ({ key: k, label: QUICK[k].label }));
}

// คืนข้อความ markdown แบบเดียวกับที่ AI ตอบ
export function runQuickAction(key, ctx) {
  const q = QUICK[key];
  if (!q) return "ไม่รู้จักคำสั่งนี้";
  try {
    return q.run(ctx);
  } catch (e) {
    console.error("quick action error:", key, e);
    return "ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}

// ── ค้นเองเมื่อ AI ไม่ว่าง ─────────────────────────────────────
// ตัดคำทั่วไปในคำถามออก (เช่น "แก้ยังไง", "เคส") เหลือคำสำคัญ แล้วค้น Knowledge Hub + เคส
const FILLER_PHRASES = ["แก้ยังไง", "แก้ไขยังไง", "แก้ไง", "ทำยังไง", "ทำไง", "ยังไง", "อย่างไร", "วิธีแก้"];
const STOPWORDS = new Set(["วิธี", "ปัญหา", "หน่อย", "ครับ", "ค่ะ", "คะ", "ไหม", "มั้ย", "อะไร", "บ้าง", "ขอ", "ดู", "หา", "ค้น",
  "เกี่ยวกับ", "เรื่อง", "เคส", "งาน", "มี", "ที่", "ของ", "การ", "ไม่", "ได้", "ให้", "แก้", "แก้ไข", "ไง", "จะ", "ว่า", "และ", "หรือ", "กับ", "ใน", "เป็น"]);

// แยกคำ: ใช้ตัวตัดคำภาษาไทยของเบราว์เซอร์ (Intl.Segmenter) ถ้ามี ไม่งั้นแยกด้วยเว้นวรรค
function splitWords(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    const out = [];
    // คำที่มีตัวอักษรอังกฤษ/ตัวเลข/สัญลักษณ์ (เช่น t/s, E12) เก็บทั้งก้อนตามเว้นวรรค ไม่ให้ตัวตัดคำแยก
    for (const chunk of text.split(/\s+/)) {
      if (!chunk) continue;
      if (/[a-z0-9]/i.test(chunk) && !/[\u0E00-\u0E7F]/.test(chunk)) { out.push(chunk); continue; }
      for (const s of seg.segment(chunk)) if (s.isWordLike) out.push(s.segment);
    }
    return out;
  }
  return text.split(/\s+/);
}

export function extractKeywords(question) {
  let q = ` ${String(question || "").toLowerCase()} `;
  for (const f of FILLER_PHRASES) q = q.split(f).join(" ");
  const words = splitWords(q.replace(/[,?!]+/g, " "))
    .map((w) => w.trim())
    // ตัดเศษคำที่ขึ้นต้นด้วยสระบน/ล่างหรือวรรณยุกต์ (เช่น "ย์" ที่ตัวตัดคำแยกออกมา)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(w) && !/^.[\u0E4C]$/.test(w));
  const uniq = [...new Set(words)];
  return uniq.length ? uniq : [String(question || "").trim()].filter(Boolean);
}

export function localSearchAnswer(question, ctx) {
  const words = extractKeywords(question);
  const query = words.join(" ");
  const parts = [`⚠️ ตอนนี้ AI ไม่ว่าง (โควต้าฟรีหมดชั่วคราว) — ค้นจาก "${String(question).trim()}" ให้แทน`];

  const k = run("search_knowledge", { query, limit: 3 }, ctx);
  if (k.found) {
    parts.push(`\n**📚 Knowledge Hub (${k.found} บทความ)**`);
    for (const a of k.articles) {
      parts.push(`- **${a.title}**${a.tags?.length ? ` (${a.tags.join(", ")})` : ""}`);
      if (a.problem) parts.push(`  ปัญหา: ${a.problem.replace(/\s+/g, " ").slice(0, 200)}`);
      if (a.solution) parts.push(`  วิธีแก้: ${a.solution.replace(/\s+/g, " ").slice(0, 400)}`);
    }
  }

  // ค้นเคสด้วยแต่ละคำ แล้วเรียงตามจำนวนคำที่ตรง (คำไทยไม่มีเว้นวรรค ค้นทั้งประโยคมักไม่เจอ)
  const hits = new Map(); // id → { c, n }
  for (const w of words.slice(0, 6)) {
    const r = run("search_cases", { query: w, limit: 50 }, ctx);
    for (const c of r.cases || []) {
      const e = hits.get(c.id) || { c, n: 0 };
      e.n++;
      hits.set(c.id, e);
    }
  }
  const ranked = [...hits.values()].sort((a, b) => b.n - a.n);
  const best = ranked[0]?.n || 0;
  // ถ้ามีเคสที่ตรงหลายคำ ตัดเคสที่ตรงแค่คำเดียวทิ้ง (ลดผลที่ไม่เกี่ยว)
  const relevant = ranked.filter((x) => best <= 1 || x.n >= 2);
  const cases = relevant.slice(0, 5).map((x) => x.c);
  const seen = { size: relevant.length };
  if (cases.length) {
    parts.push(`\n**🗂️ เคสที่เกี่ยวข้อง (${seen.size} เคส)**`);
    for (const c of cases) parts.push(caseLine(c, ` · ${fmt(c.date)}`));
  }

  if (!k.found && !cases.length) {
    parts.push("\nไม่พบบทความหรือเคสที่ตรงกับคำนี้ ลองใช้คำอื่น หรือกดปุ่ม ⚡ ด้านล่าง");
  } else {
    parts.push("\nถาม AI ใหม่ได้อีกครั้งในอีกสักพัก");
  }
  return parts.join("\n");
}
