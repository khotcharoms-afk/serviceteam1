// src/assistantTools.js — เครื่องมือที่ผู้ช่วย AI เรียกได้ รันในเบราว์เซอร์กับ cases/projects
// ที่ useFirestore โหลดไว้แล้ว (ไม่มี Firestore reads เพิ่ม)
// ชื่อเครื่องมือ/สิทธิ์ต้องตรงกับ TOOL_DEFS/ROLE_TOOLS ใน api/assistant.js

import { daysLeft } from "./utils.js";
import { deviceSearchText, sortDevices } from "./deviceImport.js";
import { SOPS, parseFFM, awbCheckOk, sqlTemplates, amendSql, warehouseCheckSql } from "./WmsToolkit.jsx";

const STATUS_LABEL = { open: "เปิดเคส", inprogress: "กำลังดำเนินการ", hold: "รอดำเนินการ", done: "เสร็จสิ้น" };
const ACTIVE = new Set(["open", "inprogress", "hold"]);

const ROLE_TOOLS = {
  user: ["search_cases", "get_case", "list_projects", "pending_work", "expiring_contracts", "search_knowledge", "search_devices", "wms_search_sop", "wms_check_ffm", "wms_make_sql"],
  admin: ["search_cases", "get_case", "list_projects", "pending_work", "expiring_contracts", "search_knowledge", "search_devices", "case_stats", "wms_search_sop", "wms_check_ffm", "wms_make_sql"],
  dev: ["search_cases", "get_case", "list_projects", "pending_work", "expiring_contracts", "search_knowledge", "search_devices", "case_stats", "wms_search_sop", "wms_check_ffm", "wms_make_sql"],
};

const lc = (s) => (s == null ? "" : String(s)).toLowerCase();
const techsOf = (c) => (c.techs?.length ? c.techs : c.tech ? [c.tech] : []);
const clampLimit = (n, d = 20) => Math.max(1, Math.min(50, Number.isFinite(n) ? Math.floor(n) : d));

function lastActivity(c) {
  return c.activityAt || c.updatedAt || (/^\d{13}$/.test(c.id) ? new Date(+c.id).toISOString() : c.date) || "";
}
function ageDays(c) {
  const start = c.date || lastActivity(c);
  if (!start) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(start)) / 86400000));
}

function makeCtx({ cases, projects, currentUser, role }) {
  const isAdminOrDev = role === "admin" || role === "dev";
  const projById = new Map(projects.map((p) => [p.id, p]));

  function findProjects(q) {
    const s = lc(q).trim();
    if (!s) return null;
    return projects.filter((p) => p.id === q || lc(p.code) === s ||
      [p.name, p.code, p.customer, p.contactName].some((x) => lc(x).includes(s)));
  }

  function caseSummary(c) {
    const p = projById.get(c.projectId);
    return {
      id: c.id,
      title: c.title || "",
      project: p ? `${p.code ? p.code + " " : ""}${p.name}` : "",
      site: c.site || "",
      type: c.type || "",
      status: STATUS_LABEL[c.status] || c.status || "",
      techs: techsOf(c),
      date: c.date || "",
      lastActivity: lastActivity(c).slice(0, 10),
    };
  }

  function applyCommonFilters(list, { project, tech, assignedToMe, dateFrom, dateTo }) {
    let out = list;
    if (project) {
      const ps = findProjects(project) || [];
      const ids = new Set(ps.map((p) => p.id));
      out = out.filter((c) => ids.has(c.projectId));
    }
    if (tech) {
      const t = lc(tech);
      out = out.filter((c) => techsOf(c).some((x) => lc(x).includes(t)));
    }
    if (assignedToMe) {
      const me = lc(currentUser?.name);
      out = me ? out.filter((c) => techsOf(c).some((x) => lc(x) === me)) : [];
    }
    if (dateFrom) out = out.filter((c) => !c.date || c.date >= dateFrom);
    if (dateTo) out = out.filter((c) => !c.date || c.date <= dateTo);
    return out;
  }

  return { isAdminOrDev, projById, findProjects, caseSummary, applyCommonFilters };
}

const TOOLS = {
  search_cases(input, { cases }, ctx) {
    let list = ctx.applyCommonFilters(cases, input);
    if (input.status === "active") list = list.filter((c) => ACTIVE.has(c.status));
    else if (input.status) list = list.filter((c) => c.status === input.status);
    if (input.query) {
      const q = lc(input.query);
      list = list.filter((c) => {
        const p = ctx.projById.get(c.projectId);
        return [c.title, c.site, c.note, c.type, ...techsOf(c), p?.name, p?.code].some((x) => lc(x).includes(q));
      });
    }
    list = [...list].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
    const limit = clampLimit(input.limit);
    return { total: list.length, truncated: list.length > limit, cases: list.slice(0, limit).map(ctx.caseSummary) };
  },

  get_case(input, { cases }, ctx) {
    const c = cases.find((x) => x.id === String(input.caseId));
    if (!c) return { error: "ไม่พบเคสนี้" };
    const p = ctx.projById.get(c.projectId);
    const out = {
      ...ctx.caseSummary(c),
      note: (c.note || "").slice(0, 2000),
      customer: p?.customer || "",
      warrantyEnd: c.warrantyEnd || p?.warrantyEnd || null,
      updateLog: (c.updateLog || []).slice(-15).map((u) => ({
        date: u.date || "", time: u.time || "", by: u.by || "",
        status: STATUS_LABEL[u.status] || u.status || "", text: (u.text || "").slice(0, 500),
      })),
      handoverLog: (c.handoverLog || []).slice(-10).map((h) => ({
        date: h.date || "", time: h.time || "", from: h.from || h.fromName || "", to: h.to || h.toName || "",
        reason: (h.reason || h.note || "").slice(0, 300),
      })),
    };
    if (ctx.isAdminOrDev) {
      out.leaseEnd = c.leaseEnd || p?.leaseEnd || null;
      out.hirePurchaseEnd = c.hirePurchaseEnd || p?.hirePurchaseEnd || null;
    }
    return out;
  },

  list_projects(input, { cases, projects }, ctx) {
    const list = (input.query ? ctx.findProjects(input.query) : projects) || [];
    return {
      total: list.length,
      projects: list.slice(0, 100).map((p) => {
        const pc = cases.filter((c) => c.projectId === p.id);
        const row = {
          id: p.id, code: p.code || "", name: p.name || "", customer: p.customer || "",
          contactName: p.contactName || "", contactPhone: p.contactPhone || "", location: p.location || "",
          projectStatus: p.projectStatus || "",
          sites: (p.sites || []).map((s) => (typeof s === "object" ? s.name : s)).filter(Boolean),
          warrantyEnd: p.warrantyEnd || null,
          totalCases: pc.length,
          activeCases: pc.filter((c) => ACTIVE.has(c.status)).length,
        };
        if (ctx.isAdminOrDev) {
          Object.assign(row, {
            contractType: p.contractType || "", contractStart: p.contractStart || null,
            leaseEnd: p.leaseEnd || null, hirePurchaseEnd: p.hirePurchaseEnd || null,
          });
        }
        return row;
      }),
    };
  },

  pending_work(input, { cases }, ctx) {
    let list = ctx.applyCommonFilters(cases.filter((c) => ACTIVE.has(c.status)), input);
    if (Number.isFinite(input.olderThanDays)) list = list.filter((c) => (ageDays(c) ?? 0) > input.olderThanDays);
    list = [...list].sort((a, b) => (ageDays(b) ?? 0) - (ageDays(a) ?? 0));

    const byStatus = {}, byTech = {};
    for (const c of list) {
      const s = STATUS_LABEL[c.status] || c.status;
      byStatus[s] = (byStatus[s] || 0) + 1;
      for (const t of techsOf(c).length ? techsOf(c) : ["(ไม่ระบุช่าง)"]) byTech[t] = (byTech[t] || 0) + 1;
    }
    const limit = clampLimit(input.limit);
    return {
      total: list.length, byStatus, byTech, truncated: list.length > limit,
      cases: list.slice(0, limit).map((c) => ({ ...ctx.caseSummary(c), daysOpen: ageDays(c) })),
    };
  },

  expiring_contracts(input, { cases, projects }, ctx) {
    const within = Math.max(1, Math.min(730, input.withinDays || 90));
    let kinds = ["warranty"];
    if (ctx.isAdminOrDev) {
      const k = input.kind || "all";
      kinds = k === "all" ? ["warranty", "lease", "hirePurchase"] : [k];
    } else if (input.kind && input.kind !== "warranty") {
      return { error: "บทบาทนี้ดูได้เฉพาะวันหมดประกัน" };
    }
    const FIELD = { warranty: "warrantyEnd", lease: "leaseEnd", hirePurchase: "hirePurchaseEnd" };
    const LABEL = { warranty: "ประกัน", lease: "สัญญาเช่า", hirePurchase: "สัญญาเช่าซื้อ" };

    const rows = [];
    for (const p of projects) {
      for (const k of kinds) {
        const end = p[FIELD[k]];
        const d = daysLeft(end);
        if (d === null) continue;
        if (d > within) continue;
        if (d < 0 && (!input.includeExpired || d < -within)) continue;
        rows.push({
          kind: LABEL[k], project: `${p.code ? p.code + " " : ""}${p.name}`, customer: p.customer || "",
          endDate: end, daysLeft: d, expired: d < 0,
          activeCases: cases.filter((c) => c.projectId === p.id && ACTIVE.has(c.status)).length,
        });
      }
    }
    rows.sort((a, b) => a.daysLeft - b.daysLeft);
    return { withinDays: within, total: rows.length, items: rows.slice(0, 100) };
  },

  // knowledge = บทความจาก Firestore "knowledge" (AssistantPage โหลดให้ครั้งแรกที่ใช้เครื่องมือนี้)
  search_knowledge(input, { knowledge = [] }) {
    const limit = Math.max(1, Math.min(10, input.limit || 5));
    const q = lc(input.query).trim();
    const words = q.split(/[\s,]+/).filter((w) => w.length >= 2);
    let list = knowledge;
    if (input.tag) list = list.filter((a) => (a.tags || []).some((t) => lc(t).includes(lc(input.tag))));

    const scored = list.map((a) => {
      const title = lc(a.title), tags = lc([...(a.tags || []), a.category || ""].join(" ")), body = lc(`${a.problem || ""} ${a.cause || ""} ${a.solution || ""}`);
      let score = 0;
      if (q && (title.includes(q))) score += 10;
      if (q && body.includes(q)) score += 4;
      for (const w of words) {
        if (title.includes(w)) score += 3;
        if (tags.includes(w)) score += 2;
        if (body.includes(w)) score += 1;
      }
      return { a, score: q ? score : 1 };
    }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score);

    const out = {
      totalArticles: knowledge.length,
      found: scored.length,
      articles: scored.slice(0, limit).map(({ a }) => ({
        id: a.id, title: a.title || "", category: a.category || "", tags: a.tags || [],
        problem: (a.problem || "").slice(0, 800), cause: (a.cause || "").slice(0, 600), solution: (a.solution || "").slice(0, 2500),
        by: a.createdBy || "", date: (a.updatedAt || a.createdAt || "").slice(0, 10),
      })),
    };
    if (!scored.length) {
      // ไม่พบ → ส่งรายชื่อบทความ/แท็กทั้งหมด ให้ AI เลือกคำค้นใหม่หรือบทความที่ใกล้เคียง
      out.allTitles = knowledge.slice(0, 80).map((a) => a.title).filter(Boolean);
      out.allTags = [...new Set(knowledge.flatMap((a) => a.tags || []))].slice(0, 40);
    }
    return out;
  },

  // devices = Firestore "devices" (หน้าอุปกรณ์/รีโมท) — AssistantPage โหลดให้ครั้งแรกที่ใช้เครื่องมือนี้
  // ไม่ส่งรหัสผ่านให้ AI (ดูได้ในหน้าอุปกรณ์/รีโมทเท่านั้น)
  search_devices(input, { devices = [] }) {
    const limit = clampLimit(input.limit);
    const norm = (s) => lc(s).replace(/[\s_\-()]+/g, "");
    let list = sortDevices(devices);
    if (input.project) list = list.filter((d) => norm(d.project).includes(norm(input.project)));
    if (input.type) list = list.filter((d) => norm(`${d.type} ${d.model}`).includes(norm(input.type)));
    const words = lc(input.query).split(/[\s,]+/).filter(Boolean);
    let matched = list;
    let partial = false;
    if (words.length) {
      const text = (d) => deviceSearchText(d) + " " + norm(deviceSearchText(d));
      matched = list.filter((d) => words.every((w) => text(d).includes(w) || text(d).includes(norm(w))));
      if (!matched.length) {
        // ไม่พบครบทุกคำ → เอาที่ตรงบางคำ เรียงตามจำนวนคำที่ตรง
        partial = true;
        matched = list.map((d) => ({ d, n: words.filter((w) => text(d).includes(norm(w))).length }))
          .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.d);
      }
    }
    const byType = {};
    matched.forEach((d) => { byType[d.type || "อุปกรณ์"] = (byType[d.type || "อุปกรณ์"] || 0) + 1; });
    const out = {
      totalDevices: devices.length,
      found: matched.length,
      ...(partial ? { partialMatch: true } : {}),
      countByType: byType,
      devices: matched.slice(0, limit).map((d) => {
        const r = {
          project: d.project, site: d.site, type: d.type, name: d.name, model: d.model, serial: d.serial,
          ip: d.ip ? (d.port ? `${d.ip}:${d.port}` : d.ip) : "", publicIp: d.publicIp ? (d.publicPort ? `${d.publicIp}:${d.publicPort}` : d.publicIp) : "",
          anydesk: d.anydesk, rustdesk: d.rustdesk, username: d.username, note: d.note,
          hasPassword: Boolean(d.password),
        };
        return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "" && v != null));
      }),
    };
    if (matched.length > limit) out.truncated = true;
    if (!matched.length) {
      const sites = {};
      devices.forEach((d) => { (sites[d.project || "(ไม่ระบุ)"] ||= new Set()).add(d.site || ""); });
      out.allProjectsAndSites = Object.fromEntries(Object.entries(sites).map(([p, s]) => [p, [...s].filter(Boolean).slice(0, 60)]));
    }
    return out;
  },

  case_stats(input, { cases }, ctx) {
    const list = ctx.applyCommonFilters(cases, input);
    const keyOf = {
      status: (c) => [STATUS_LABEL[c.status] || c.status || "(ไม่ระบุ)"],
      tech: (c) => (techsOf(c).length ? techsOf(c) : ["(ไม่ระบุช่าง)"]),
      project: (c) => [ctx.projById.get(c.projectId)?.name || "(ไม่ระบุโครงการ)"],
      type: (c) => [c.type || "(ไม่ระบุ)"],
      month: (c) => [(c.date || "").slice(0, 7) || "(ไม่ระบุ)"],
    }[input.groupBy];
    if (!keyOf) return { error: "groupBy ไม่ถูกต้อง" };

    const groups = {};
    for (const c of list) {
      for (const k of keyOf(c)) {
        const g = (groups[k] ||= { total: 0, active: 0, done: 0 });
        g.total++;
        if (c.status === "done") g.done++;
        else if (ACTIVE.has(c.status)) g.active++;
      }
    }
    const rows = Object.entries(groups).map(([key, v]) => ({ key, ...v }));
    rows.sort(input.groupBy === "month" ? (a, b) => a.key.localeCompare(b.key) : (a, b) => b.total - a.total);
    return { totalCases: list.length, groupBy: input.groupBy, groups: rows.slice(0, 60) };
  },

  // ── WMS (ระบบคลังสินค้า air cargo) — ใช้ SOP/ตัวตรวจ FFM/ตัวสร้าง SQL เดียวกับแท็บ WMS Toolkit ──
  wms_search_sop(input) {
    const q = lc(input.query).trim();
    const words = q.split(/[\s,]+/).filter((w) => w.length >= 2);
    // ภาษาไทยไม่เว้นวรรค → นับทั้ง "คำค้นอยู่ในหัวข้อ" และ "คำในหัวข้ออยู่ในคำค้น"
    const keyTokens = (str) => lc(str).replace(/[()—:·,]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !/^[^a-z0-9\u0E00-\u0E7F]+$/.test(w));
    const scored = SOPS.map((s) => {
      const title = lc(s.title), when = lc(s.when || ""), body = lc(s.steps.join(" "));
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 4;
        if (when.includes(w)) score += 3;
        if (body.includes(w)) score += 1;
      }
      for (const t of keyTokens(`${s.title} ${s.when || ""}`)) if (q.includes(t)) score += 3;
      return { s, score };
    }).sort((a, b) => b.score - a.score);
    const hits = scored.filter((x) => x.score > 0).slice(0, 3);
    return {
      found: hits.length,
      sops: hits.map(({ s }) => ({ title: s.title, when: s.when || "", steps: s.steps })),
      allTitles: SOPS.map((s) => s.title),
    };
  },

  wms_check_ffm(input) {
    const r = parseFFM(String(input.message || ""));
    return {
      header: r.header, unloading: r.unloading, ulds: r.ulds, ended: r.ended, problems: r.problems,
      awbs: r.awbs.map((a) => ({
        awb: `${a.prefix}-${a.awb}`, route: `${a.orig}-${a.dest}`, shipmentCode: a.code, piece: a.pcs, weight: a.wt, volume: a.vol,
        nature: a.nature, shc: a.shc, uld: a.uld, ok: a.issues.length === 0, issues: a.issues, checkDigitCandidates: a.cands.map((x) => `${a.prefix}-${x}`),
      })),
    };
  },

  // คืน SQL ให้หน้าแชทแสดงเป็นการ์ดพร้อมปุ่มคัดลอก (ไม่มีชนิด "ลบ" — งานลบต้องให้ admin/dev ทำ)
  wms_make_sql(input) {
    const m = String(input.awb || "").replace(/\s/g, "").match(/^(\d{3})-?(\d{8})$/);
    if (!m) return { error: "เลข AWB ต้องเป็น prefix 3 หลัก + 8 หลัก เช่น 217-75613171" };
    const [, prefix, awb] = m;
    const warn = awbCheckOk(awb) ? null : `เลข ${prefix}-${awb} ไม่ผ่าน check digit — ตรวจเลขกับหน้างานอีกครั้ง`;
    const t = sqlTemplates(prefix, awb);
    const num = (x) => x !== undefined && x !== null && String(x).trim() !== "" && /^\d+(\.\d+)?$/.test(String(x).trim());
    let title, note, sql;
    switch (input.kind) {
      case "find_import": ({ title, sql } = t.find((x) => x.key === "find-in")); note = "รันแล้ววางผลกลับมาในแชท เพื่อให้ช่วยอ่านว่าแถวไหนผิด"; break;
      case "find_export": ({ title, sql } = t.find((x) => x.key === "find-ex")); note = "รันแล้ววางผลกลับมาในแชท เพื่อให้ช่วยอ่านว่าแถวไหนผิด"; break;
      case "warehouse_check": title = "เช็กแถวรับเข้าคลังซ้ำ (ขาออก)"; sql = warehouseCheckSql(prefix, awb); note = "ถ้ามีมากกว่า 1 แถวค่าเท่ากัน = กดรับเข้าคลังซ้ำ ต้องให้ admin/dev ลบแถวซ้ำ"; break;
      case "flight": {
        const no = String(input.flight_no || "").replace(/^[A-Z]{2}\s*/i, "").trim();
        if (!/^\d{1,4}[A-Z]?$/i.test(no) || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.flight_date || ""))) return { error: "ต้องมี flight_no (เช่น 221) และ flight_date (YYYY-MM-DD)" };
        title = "หาเที่ยวบิน + message FFM ของเที่ยวบิน"; sql = t.find((x) => x.key === "flight").sql({ no: no.toUpperCase(), date: input.flight_date }); note = "ได้ flight id / message / manifest ของเที่ยวนั้น"; break;
      }
      case "amend_import":
      case "amend_export": {
        if (!/^\d+$/.test(String(input.piece ?? "").trim()) || !num(input.weight)) return { error: "ต้องมี piece (จำนวนเต็ม) และ weight ที่ถูกต้อง" };
        if (input.volume !== undefined && input.volume !== null && String(input.volume).trim() !== "" && !num(input.volume)) return { error: "volume ต้องเป็นตัวเลข" };
        if (!/^\d+$/.test(String(input.wms_user_id ?? "").trim())) return { error: "ต้องมี wms_user_id (user id ของผู้แก้ในระบบ WMS เป็นตัวเลข) — ถามผู้ใช้ก่อน" };
        const dir = input.kind === "amend_import" ? "in" : "ex";
        title = `แก้ชิ้น/น้ำหนัก ${dir === "in" ? "ขาเข้า" : "ขาออก"} เป็น ${input.piece} ชิ้น / ${input.weight} กก.`;
        sql = amendSql(dir, prefix, awb, String(input.piece).trim(), String(input.weight).trim(), input.volume == null ? "" : String(input.volume).trim(), String(input.wms_user_id).trim());
        note = "แก้ทุกตารางในคำสั่งเดียว ผลจะบอกจำนวนแถวที่แก้ — ถ้าได้ 0 ทั้งหมด = ไม่ได้แก้ (มีหลาย shipment ต้องให้ admin/dev ทำ) แก้เสร็จให้ค้นซ้ำ";
        break;
      }
      default: return { error: "kind ไม่ถูกต้อง" };
    }
    return { shownToUser: true, kind: input.kind, awb: `${prefix}-${awb}`, title, note, warning: warn, sql };
  },
};

// รันเครื่องมือหนึ่งตัว → คืน string JSON สำหรับ tool_result
export function runAssistantTool(name, input, { cases = [], projects = [], knowledge = [], devices = [], currentUser, role }) {
  if (!(ROLE_TOOLS[role] || []).includes(name) || !TOOLS[name]) {
    return { content: JSON.stringify({ error: "ไม่มีสิทธิ์ใช้เครื่องมือนี้" }), isError: true };
  }
  try {
    const data = { cases, projects, knowledge, devices };
    const ctx = makeCtx({ cases, projects, currentUser, role });
    const result = TOOLS[name](input || {}, data, ctx);
    return { content: JSON.stringify(result), isError: !!result?.error };
  } catch (e) {
    console.error("assistant tool error:", name, e);
    return { content: JSON.stringify({ error: "รันเครื่องมือไม่สำเร็จ" }), isError: true };
  }
}

export const TOOL_LABELS = {
  search_cases: "ค้นหาเคส",
  get_case: "เปิดดูรายละเอียดเคส",
  list_projects: "ดูรายชื่อโครงการ",
  pending_work: "ดูงานที่ค้าง",
  expiring_contracts: "ตรวจประกัน/สัญญาใกล้หมด",
  case_stats: "สรุปสถิติเคส",
  search_knowledge: "ค้น Knowledge Hub",
  search_devices: "ค้นอุปกรณ์/รีโมท",
  wms_search_sop: "ค้น SOP ของ WMS",
  wms_check_ffm: "ตรวจ FFM",
  wms_make_sql: "เตรียม SQL ของ WMS",
};
