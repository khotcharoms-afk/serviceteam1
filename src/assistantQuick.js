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

// ── ถามเรื่องอุปกรณ์/หุ่นยนต์ → ตอบทันทีจากหน้าอุปกรณ์/รีโมท ไม่เรียก AI ─────────────
// ทำงานเมื่อคำถามมีคำบ่งบอกว่าถามเรื่องอุปกรณ์ (เบอร์ ติดต่อ AnyDesk IP หุ่นยนต์ รุ่น ฯลฯ)
// หรือมีเลข AnyDesk/IP/VIN ตรงๆ และหาอุปกรณ์ที่ตรงเจอ ไม่งั้นคืน null ให้ไปถาม AI ตามปกติ
const DEVICE_INTENT = ["เบอร์", "โทร", "ติดต่อ", "anydesk", "rustdesk", "รีโมท", "remote", "ip", "vin", "s/n", "serial",
  "หุ่น", "robot", "อุปกรณ์", "เครื่อง", "รุ่น", "sim", "ซิม", "nvr", "router", "กล้อง", "cctv", "รหัส", "พาส", "password", "user",
  "sc50", "sc80", "mix1"];
// คำในคำถามที่ไม่ใช้จับคู่ชื่อไซต์ (บางส่วนของชื่อ)
const DEVICE_Q_STOP = new Set(["เบอร์", "โทร", "ติดต่อ", "ผู้ติดต่อ", "ลูกค้า", "หุ่นยนต์", "หุ่น", "ยนต์", "robot", "anydesk", "rustdesk",
  "รีโมท", "อุปกรณ์", "เครื่อง", "รุ่น", "ไหน", "อยู่", "กี่", "ตัว", "ทั้งหมด", "หน้างาน", "ไซต์", "site", "สาขา", "โรงพยาบาล", "ศูนย์"]);
const normDev = (s) => String(s || "").toLowerCase().replace(/[\s_\-()/.,:]+/g, "");
// คำทั่วไปที่ไม่ใช้จับคู่ชื่อไซต์/เครื่อง
const DEVICE_GENERIC = new Set(["router", "server", "switch", "camera", "นvr", "nvr", "cctv", "pc", "nuc", "web", "vpn",
  "bkk", "plan", "เครื่อง", "อุปกรณ์", "ไม่ระบุชื่อ"].map(normDev));

function deviceTokens(d) {
  const out = new Set();
  const add = (t) => { const n = normDev(t); if (n.length >= 3 && !DEVICE_GENERIC.has(n) && !/^\d{1,3}$/.test(n)) out.add(n); };
  [d.site, d.name].forEach((v) => {
    if (!v) return;
    add(v);
    String(v).split(/[\s()/]+/).forEach(add);
  });
  return out;
}

export function isDeviceQuestion(question) {
  const q = String(question || "").toLowerCase();
  return DEVICE_INTENT.some((w) => q.includes(w)) || /\b\d{9,10}\b|\b\d{1,3}(\.\d{1,3}){3}\b|IDPW/i.test(q);
}

export function localDeviceAnswer(question, devices = []) {
  if (!devices.length || !isDeviceQuestion(question)) return null;
  const raw = String(question || "").toLowerCase();
  const q = normDev(raw);

  // เลข AnyDesk / IP / VIN ที่พิมพ์มาตรงๆ
  const exact = devices.filter((d) => [d.anydesk, d.rustdesk, d.ip, d.publicIp, d.serial]
    .some((v) => v && String(v).length >= 6 && q.includes(normDev(v))));

  // รุ่น/ประเภทที่พูดถึง เช่น SC80, Mix1, NVR
  const typesAll = [...new Set(devices.map((d) => d.type).filter(Boolean))];
  const typesHit = typesAll.filter((t) => {
    const n = normDev(t);
    if (n === "robot") return false; // คำว่า robot/หุ่นยนต์ ใช้บอกว่าถามเรื่องอุปกรณ์ ไม่ใช่กรองประเภท
    if (n.length < 2 || !q.includes(n)) return false;
    // "sc50" ไม่นับถ้าที่ถามคือ "sc50plus"
    return !typesAll.some((o) => o !== t && normDev(o).startsWith(n) && q.includes(normDev(o)));
  });
  let pool = typesHit.length ? devices.filter((d) => typesHit.includes(d.type)) : devices;

  // คำในคำถาม (ตัดคำไทย) ไว้จับคู่บางส่วนของชื่อไซต์ เช่น "ธรรมศาสตร์" ↔ "ศูนย์การแพทย์ธรรมศาสตร์"
  const cleaned = raw.replace(/[,?!]+/g, " ");
  const qWords = [...new Set([...splitWords(cleaned), ...cleaned.split(/\s+/)].map(normDev))]
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w) && !DEVICE_Q_STOP.has(w) && !DEVICE_INTENT.some((x) => w.includes(x)) &&
      !typesAll.some((t) => normDev(t).includes(w) || w.includes(normDev(t))));

  let list = exact;
  if (!list.length) {
    const scored = pool.map((d) => {
      let score = 0;
      deviceTokens(d).forEach((t) => {
        if (q.includes(t)) score = Math.max(score, t.length);
        qWords.forEach((w) => { if (t.includes(w)) score = Math.max(score, w.length); });
      });
      if (d.project && q.includes(normDev(d.project))) score += normDev(d.project).length;
      return { d, score };
    }).filter((x) => x.score > 0);
    const best = Math.max(0, ...scored.map((x) => x.score));
    list = scored.filter((x) => x.score === best).map((x) => x.d);
    if (!list.length && typesHit.length) list = pool; // เช่น "SC80 มีกี่ตัว"
  }
  if (!list.length) return null;

  const wantContact = /เบอร์|โทร|ติดต่อ/.test(raw);
  // หลายเครื่อง (เช่น "SC50 มีกี่ตัว") → แสดงบรรทัดเดียวต่อเครื่อง
  const compact = list.length > 5;
  const shown = list.slice(0, compact ? 30 : 5);
  const lines = [];
  const where = (d) => [d.project, d.site].filter(Boolean).join(" / ");
  if (list.length > 1) {
    const byType = {};
    list.forEach((d) => { byType[d.type || "อุปกรณ์"] = (byType[d.type || "อุปกรณ์"] || 0) + 1; });
    lines.push(`พบ **${list.length} เครื่อง** (${Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(" · ")})\n`);
  }
  for (const d of shown) {
    if (compact) {
      lines.push(`- **${d.name}**${d.type ? ` · ${d.type}` : ""}${where(d) ? ` — ${where(d)}` : ""}` +
        (d.anydesk ? ` · AnyDesk ${d.anydesk}` : d.ip ? ` · IP ${d.ip}` : ""));
      continue;
    }
    lines.push(`- **${d.name}**${d.type ? ` · ${d.type}` : ""}${where(d) ? ` — ${where(d)}` : ""}`);
    const notes = String(d.note || "").split(" · ").filter(Boolean);
    const contact = notes.filter((n) => n.startsWith("ติดต่อหน้างาน:"));
    const other = notes.filter((n) => !n.startsWith("ติดต่อหน้างาน:"));
    if (contact.length) lines.push(`  📞 ${contact.join(" · ").replace("ติดต่อหน้างาน: ", "ติดต่อหน้างาน: ")}`);
    else if (wantContact) lines.push("  📞 ยังไม่ได้บันทึกเบอร์ติดต่อหน้างานของเครื่องนี้");
    const ids = [
      d.anydesk && `AnyDesk ${d.anydesk}`, d.rustdesk && `RustDesk ${d.rustdesk}`,
      d.ip && `IP ${d.ip}${d.port ? ":" + d.port : ""}`, d.publicIp && `Public ${d.publicIp}${d.publicPort ? ":" + d.publicPort : ""}`,
      d.serial && `S/N ${d.serial}`,
    ].filter(Boolean);
    if (ids.length) lines.push(`  ${ids.join(" · ")}`);
    if (other.length) lines.push(`  📝 ${other.join(" · ")}`);
  }
  if (list.length > shown.length) lines.push(`\nแสดง ${shown.length} จาก ${list.length} เครื่อง — ดูทั้งหมดในหน้า "อุปกรณ์/รีโมท"`);
  lines.push(`\n⚡ ตอบจากหน้าอุปกรณ์/รีโมททันที (ไม่ได้ใช้ AI) · รหัสผ่านดูได้ในหน้าอุปกรณ์/รีโมท`);
  return lines.join("\n");
}
