// สร้างสไลด์รายสัปดาห์ (1920×1080) แบบเดียวกับใน Weekly Update ของ Canva: ตาราง + กราฟแท่ง
// วาดด้วย canvas ล้วน ๆ ได้ PNG คมชัด ลากใส่ Canva ได้เลย — ไม่แตะไฟล์ Canva หลัก

export const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const W = 1920, H = 1080;
const PURPLE = "#46336b";
const FONT = "'Noto Sans Thai', sans-serif";
const BAR_COLORS = ["#4f7ff5", "#ad91f3", "#f3b56c", "#ffd84f", "#ef7178", "#e87cc6", "#5ad2d4", "#5fc77f", "#8f6bd8", "#ff9f43"];

// จัดกลุ่มคอลัมน์จากชีตเป็นชุดสไลด์ (เรียงตามลำดับที่เจอในชีต) — กลุ่มเกิน 8 ไซต์แบ่งเป็นหลายชุด
const GROUPS = [
  { re: /^ARL/i, title: (n) => `ARL ${n} STATION` },
  { re: /THAMC/i, title: () => "ศูนย์การแพทย์ธรรมศาสตร์" },
  { re: /^SET/i, title: () => "SET" },
  { re: /AOTGA/i, title: () => "AOTGA" },
  { re: /^SCB/i, title: () => "SCB" },
  { re: /^PDR|PANDORA/i, title: () => "PANDORA ลำพูน" },
  { re: /VIBHA|AMATA/i, title: () => "วิภาราม" },
];
export function groupColumns(columns) {
  const groups = [];
  const byKey = {};
  for (const col of columns) {
    const gi = GROUPS.findIndex((g) => g.re.test(col.name));
    const key = gi >= 0 ? gi : "other";
    if (!byKey[key]) { byKey[key] = { key, cols: [] }; groups.push(byKey[key]); }
    byKey[key].cols.push(col);
  }
  const out = [];
  for (const g of groups) {
    const base = g.key === "other" ? "ไซต์อื่น ๆ" : GROUPS[g.key].title(g.cols.length);
    const parts = Math.ceil(g.cols.length / 8);
    for (let p = 0; p < parts; p++) {
      const cols = g.cols.slice(Math.ceil((g.cols.length / parts) * p), Math.ceil((g.cols.length / parts) * (p + 1)));
      out.push({ title: `METTBOT - ${base}${parts > 1 ? ` (${p + 1}/${parts})` : ""}`, cols });
    }
  }
  return out;
}

export const below = (col, i) => col.target !== null && col.cells[i].value !== null && col.cells[i].value < col.target;

let logoImg = null;
function loadLogo() {
  if (logoImg) return Promise.resolve(logoImg);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { logoImg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = "/templates/metthier-logo.png";
  });
}
export async function prepare() {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 20px ${FONT}`), document.fonts.load(`600 20px ${FONT}`)]); } catch { /* ใช้ฟอนต์สำรอง */ }
  await loadLogo();
}

function frame(ctx, title) {
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  if (logoImg) { const w = 230, h = (logoImg.height / logoImg.width) * w; ctx.drawImage(logoImg, 55, 38, w, h); }
  ctx.fillStyle = PURPLE; ctx.font = `700 54px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(title, W / 2, 132);
}

function fitText(ctx, text, maxW, size, weight = 600) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 12);
}

// ── ตาราง ──
export function drawTable(ctx, group, marks = {}) {
  frame(ctx, group.title);
  const cols = group.cols;
  const hasTarget = cols.some((c) => c.target !== null);
  const x0 = 190, x1 = W - 190, dayW = 230;
  const cw = (x1 - x0 - dayW) / cols.length;
  const y0 = 205, hh = 96, rh = hasTarget ? 68 : 74;
  const rows = DAYS.length + (hasTarget ? 1 : 0);
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#555";
  const cell = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); };
  // หัวตาราง
  cell(x0, y0, dayW, hh, "#cfcfcf");
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  fitText(ctx, "สถานี / ไซต์", dayW - 20, 26, 700); ctx.fillText("สถานี / ไซต์", x0 + dayW / 2, y0 + hh / 2);
  cols.forEach((c, i) => {
    const x = x0 + dayW + i * cw;
    cell(x, y0, cw, hh, "#cfcfcf");
    const [a, b] = c.name.includes(" - ") ? c.name.split(/\s+-\s+/, 2) : [c.name, ""];
    ctx.fillStyle = "#111";
    if (b) {
      fitText(ctx, a, cw - 16, 22); ctx.fillText(a, x + cw / 2, y0 + hh / 2 - 16);
      fitText(ctx, b, cw - 16, 22); ctx.fillText(b, x + cw / 2, y0 + hh / 2 + 16);
    } else { fitText(ctx, a, cw - 16, 22); ctx.fillText(a, x + cw / 2, y0 + hh / 2); }
  });
  // วัน
  DAYS.forEach((d, di) => {
    const y = y0 + hh + di * rh;
    cell(x0, y, dayW, rh, "#0b4f8f");
    ctx.fillStyle = "#fff"; ctx.font = `700 24px ${FONT}`; ctx.fillText(d, x0 + dayW / 2, y + rh / 2);
    cols.forEach((c, i) => {
      const x = x0 + dayW + i * cw;
      cell(x, y, cw, rh, "#fff");
      const v = c.cells[di].value;
      const mk = marks[`${c.name}|${di}`] ?? c.cells[di].mark ?? "";
      ctx.fillStyle = below(c, di) ? "#e01b1b" : "#111";
      ctx.font = `700 25px ${FONT}`;
      ctx.fillText(v === null ? "-" : `${mk}${v}`, x + cw / 2, y + rh / 2);
    });
  });
  // target
  if (hasTarget) {
    const y = y0 + hh + DAYS.length * rh;
    cell(x0, y, dayW, rh, "#00f000");
    ctx.fillStyle = "#111"; ctx.font = `700 24px ${FONT}`; ctx.fillText("TARGET", x0 + dayW / 2, y + rh / 2);
    cols.forEach((c, i) => {
      const x = x0 + dayW + i * cw;
      cell(x, y, cw, rh, "#00f000");
      ctx.fillStyle = "#111"; ctx.font = `700 27px ${FONT}`;
      ctx.fillText(c.target === null ? "-" : String(c.target), x + cw / 2, y + rh / 2);
    });
  }
  // คำอธิบายใต้ตาราง
  let y = y0 + hh + rows * rh + 42;
  ctx.fillStyle = PURPLE; ctx.font = `400 30px ${FONT}`;
  ctx.fillText("สรุปผลการทำงานของหุ่นยนต์ของแต่ละไซต์ (หน่วยเป็นตร.ม.)", W / 2, y);
  const used = new Set(cols.flatMap((c) => c.cells.map((_, di) => marks[`${c.name}|${di}`] ?? c.cells[di].mark ?? "")).filter(Boolean));
  ctx.fillStyle = "#e01b1b";
  if (used.has("*")) { y += 42; ctx.fillText("หมายเหตุ * = Operation ติดหน้างาน", W / 2, y); }
  if (used.has("**")) { y += 42; ctx.fillText(`${used.has("*") ? "" : "หมายเหตุ "}** = สภาพอากาศแปรปรวน`, W / 2, y); }
}

// ── กราฟแท่ง: วัน dayIdx (เช่น [0,1,2]) แต่ละวันมีแท่งของทุกไซต์ ──
export function drawChart(ctx, group, dayIdx) {
  frame(ctx, group.title);
  const cols = group.cols;
  const px0 = 120, px1 = W - 60, py0 = 330, py1 = 1000;
  // legend
  ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.font = `400 21px ${FONT}`;
  const items = cols.map((c, i) => ({ c, w: ctx.measureText(c.name).width + 46, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const lines = [[]]; let lw = 0;
  for (const it of items) { if (lw + it.w > px1 - px0 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(it); lw += it.w; }
  lines.forEach((line, li) => {
    const total = line.reduce((s, it) => s + it.w, 0);
    let x = (W - total) / 2; const y = 240 + li * 34;
    for (const it of line) {
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x + 9, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#333"; ctx.fillText(it.c.name, x + 24, y); x += it.w;
    }
  });
  // สเกล
  const maxV = Math.max(1, ...cols.flatMap((c) => dayIdx.map((d) => c.cells[d].value || 0)));
  const step = [500, 1000, 2000, 2500, 5000, 10000, 20000].find((s) => maxV / s <= 6) || 50000;
  const top = Math.ceil(maxV / step) * step;
  const yOf = (v) => py1 - (v / top) * (py1 - py0);
  ctx.textAlign = "right"; ctx.font = `400 20px ${FONT}`;
  for (let v = 0; v <= top; v += step) {
    const y = yOf(v);
    ctx.strokeStyle = "#e6e6e6"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.fillText(v >= 1000 ? `${v / 1000}K` : String(v), px0 - 14, y);
  }
  // แท่ง
  const gw = (px1 - px0) / dayIdx.length;
  const bw = Math.min(64, (gw * 0.86) / cols.length - 6);
  dayIdx.forEach((d, gi) => {
    const gx = px0 + gi * gw + (gw - cols.length * (bw + 6)) / 2;
    cols.forEach((c, i) => {
      const v = c.cells[d].value || 0;
      const x = gx + i * (bw + 6), y = yOf(v);
      ctx.fillStyle = BAR_COLORS[i % BAR_COLORS.length];
      const r = Math.min(6, bw / 2, (py1 - y) / 2);
      ctx.beginPath(); ctx.moveTo(x, py1); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo(x + bw - r, y); ctx.arcTo(x + bw, y, x + bw, y + r, r); ctx.lineTo(x + bw, py1); ctx.closePath(); ctx.fill();
      if (c.cells[d].value !== null) {
        ctx.fillStyle = "#222"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = `400 ${bw < 40 ? 15 : 18}px ${FONT}`; ctx.fillText(v.toLocaleString(), x + bw / 2, y - 6);
      }
    });
    ctx.fillStyle = "#222"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `700 21px ${FONT}`;
    ctx.fillText(DAYS[d], px0 + gi * gw + gw / 2, py1 + 12);
  });
  ctx.strokeStyle = "#999"; ctx.beginPath(); ctx.moveTo(px0, py1); ctx.lineTo(px1, py1); ctx.stroke();
}

// รายการสไลด์ทั้งหมดของสัปดาห์: ต่อกลุ่ม = ตาราง + กราฟ จ.–พ. + กราฟ พฤ.–อา.
export function slideList(groups) {
  return groups.flatMap((g, gi) => [
    { id: `${gi}-t`, group: g, kind: "table", label: `${g.title} · ตาราง` },
    { id: `${gi}-a`, group: g, kind: "chart", days: [0, 1, 2], label: `${g.title} · กราฟ จ.–พ.` },
    { id: `${gi}-b`, group: g, kind: "chart", days: [3, 4, 5, 6], label: `${g.title} · กราฟ พฤ.–อา.` },
  ]);
}
export function renderSlide(canvas, slide, marks) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (slide.kind === "table") drawTable(ctx, slide.group, marks); else drawChart(ctx, slide.group, slide.days);
}
