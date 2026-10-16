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
