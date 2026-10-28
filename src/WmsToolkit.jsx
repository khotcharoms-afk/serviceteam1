// src/WmsToolkit.jsx — เครื่องมือแก้เคส WMS (ทุกคนใช้ได้) อยู่ในแท็บของ Knowledge Hub
// 1) ตรวจ FFM: วาง message แล้วแยกทีละ AWB + เช็กเลข AWB 8 หลัก / check digit (mod 7)
// 2) SOP: ขั้นตอนมาตรฐานที่ใช้แก้เคสจริง
// 3) SQL template: ใส่เลข AWB แล้วได้ query สำหรับค้น / back up / ลบ พร้อมปุ่มคัดลอก
// ทั้งหมดเป็นข้อมูลในโค้ด ไม่ได้อ่าน/เขียนฐานข้อมูล WMS เอง — query ต้องนำไปรันใน Dataflare

import React, { useMemo, useState } from "react";
import { useTheme } from "./theme.js";

// ───────────────────────── FFM parser ─────────────────────────

// check digit ของ AWB: เลข 7 หลักแรก mod 7 = หลักสุดท้าย
export function awbCheckOk(awb) {
  if (!/^\d{8}$/.test(awb)) return false;
  return Number(awb.slice(0, 7)) % 7 === Number(awb[7]);
}

// เลข AWB ที่ยาวเกิน 8 หลัก → ลองตัดออกทีละหลัก แล้วเก็บตัวที่ผ่าน check digit
function awbCandidates(digits) {
  if (digits.length !== 9) return [];
  const out = new Set();
  for (let i = 0; i < digits.length; i++) {
    const cand = digits.slice(0, i) + digits.slice(i + 1);
    if (awbCheckOk(cand)) out.add(cand);
  }
  return [...out];
}

const AWB_RE = /^(\d{3})-(\d+)([A-Z]{3})([A-Z]{3})\/([TPSDM])(\d+)K([\d.]+)(?:MC([\d.]+))?(?:\/(.*))?$/;

export function parseFFM(raw) {
  const lines = String(raw || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const res = { header: null, unloading: [], ulds: [], awbs: [], problems: [], ended: false };
  if (!lines.length) return res;

  if (!/^FFM\/\d+/.test(lines[0])) res.problems.push(`บรรทัดแรกควรขึ้นต้นด้วย FFM/… (ได้ "${lines[0]}")`);
  const h = (lines[1] || "").split("/");
  if (h.length >= 4) {
    res.header = { seq: h[0], flight: h[1], date: h[2], origin: h[3], reg: h[4] || "", extra: h.slice(5).join("/") };
    if (h.length > 5) res.problems.push(`บรรทัดเที่ยวบินมีส่วนต่อท้าย "/${h.slice(5).join("/")}" — ให้หน้างานยืนยันว่าตรงกับต้นฉบับ`);
  } else {
    res.problems.push(`อ่านบรรทัดเที่ยวบินไม่ได้: "${lines[1] || "(ไม่มี)"}" — รูปแบบควรเป็น 1/TG221/27OCT/BKK/HSTEN`);
  }

  let current = null;
  let uld = "BULK";
  for (let i = 2; i < lines.length; i++) {
    const l = lines[i];
    if (l === "LAST" || l === "CONT") { res.ended = l; continue; }
    if (/^[A-Z]{3}$/.test(l)) { res.unloading.push(l); uld = "BULK"; continue; }
    if (/^ULD\//.test(l)) { uld = l.slice(4); res.ulds.push(uld); continue; }
    if (l.startsWith("/") && current) { current.shc.push(...l.slice(1).split("/").filter(Boolean)); continue; }
    const m = l.match(AWB_RE);
    if (m) {
      const [, prefix, awb, orig, dest, code, pcs, wt, vol, nature] = m;
      const issues = [];
      let cands = [];
      if (awb.length !== 8) {
        issues.push(`เลข AWB มี ${awb.length} หลัก (ต้อง 8 หลัก)`);
        cands = awbCandidates(awb);
      } else if (!awbCheckOk(awb)) {
        issues.push(`check digit ไม่ผ่าน (${awb.slice(0, 7)} mod 7 = ${Number(awb.slice(0, 7)) % 7} แต่หลักสุดท้ายคือ ${awb[7]})`);
      }
      current = { line: i + 1, raw: l, prefix, awb, orig, dest, code, pcs: Number(pcs), wt: Number(wt), vol: vol != null ? Number(vol) : null,
        nature: nature || "", shc: [], uld, issues, cands };
      res.awbs.push(current);
      continue;
    }
    if (/^\d{3}-/.test(l)) {
      res.problems.push(`บรรทัด ${i + 1} ดูเหมือนบรรทัด AWB แต่อ่านไม่ได้: "${l}"`);
      current = null;
      continue;
    }
    res.problems.push(`บรรทัด ${i + 1} ไม่รู้จัก: "${l}"`);
  }
  if (!res.ended) res.problems.push("ไม่มีบรรทัด LAST / CONT ปิดท้าย — message อาจไม่ครบ");
  if (!res.awbs.length) res.problems.push("ไม่พบบรรทัด AWB เลย");
  res.awbs.forEach((a) => { if (!a.shc.length) a.issues.push("ไม่มีบรรทัด SHC (/GEN ฯลฯ) ต่อจาก AWB"); });
  return res;
}

// ───────────────────────── SOP ─────────────────────────

// อัปเดต SOP ทุกครั้งที่เคสใหม่สอนอะไรใหม่ — แก้ SOP_UPDATED ด้วย
// when = ใช้เมื่อไหร่ (ภาษาหน้างาน), steps = ทีละขั้น อ้างชื่อปุ่ม/template ในหน้านี้ให้มากที่สุด
const SOP_UPDATED = "28 ต.ค. 2569";

const SOPS = [
  {
    key: "rules", title: "📌 กติกาพื้นฐาน (อ่านก่อนแก้อะไร)",
    when: "ทุกเคส",
    steps: [
      "ค้นดูก่อนเสมอ: แท็บ SQL template → ใส่เลข AWB → คัดลอก 'ค้น AWB ขาเข้า' หรือ 'ค้น AWB ขาออก' → วางใน Dataflare → Ctrl+Enter",
      "ดูคอลัมน์ pcs_wt (ชิ้น / กก.) ทุกแถวต้องตรงกัน — แถวไหนไม่ตรง หรือมีแถวเกินมา = จุดที่ต้องแก้",
      "ขาเข้า (Import) = ตารางชื่อ kn_cargo_in_… / ขาออก (Export) = ตารางที่ไม่มี in_ เช่น kn_cargo_bookings",
      "เราทำ breakdown ให้หน้างาน (ดู SOP 'ทำ breakdown ให้หน้างาน') — ส่วน D/O และบิล หน้างานทำเองในโปรแกรม",
      "จะลบอะไร = back up ก่อนเสมอ แล้วเปิดไฟล์เช็กว่าครบ (ดู SOP 'Back up / คืนข้อมูล')",
      "แก้เสร็จ → ค้นซ้ำอีกรอบให้ทุกแถวถูก → บอกหน้างานให้ปิดหน้าจอแล้วเปิดใหม่ (หรือ refresh) แล้วเช็ก",
      "Dataflare: Ctrl+Enter = รันคำสั่ง · ปุ่มดาวน์โหลดมุมขวาล่าง = เซฟผลลัพธ์เป็นไฟล์ · ถ้าพิมพ์แล้วไม่ติด ให้คลิกหน้าต่าง Dataflare ก่อน (อาจถูกย่ออยู่)",
    ],
  },
  {
    key: "ffm-check", title: "📨 หน้างานส่ง FFM มา — เช็กก่อนทำ",
    when: "ได้ message FFM ใหม่ / หน้างานขอให้ลง AWB จาก FFM",
    steps: [
      "แท็บ 'ตรวจ FFM' → วาง message ทั้งก้อน",
      "ขึ้น ❌ สีแดง (เช่น AWB 9 หลัก, check digit ไม่ผ่าน) → อย่าเพิ่งยิง Postman ส่งกลับหน้างาน บอกให้ชัดว่าผิดตรงไหน เช่น \"เลข AWB 229-826956935 มี 9 หลัก ปกติ 8 หลัก รบกวนเช็กจากเอกสาร AWB\" (ถ้าบอกแค่ 'ขอ message ใหม่' หน้างานจะส่งอันเดิมกลับมา)",
      "ระบบอาจเสนอ 'เลขที่ผ่าน check digit' ให้ — เป็นแค่การเดา ต้องให้หน้างานยืนยันก่อนใช้",
      "ขึ้น ⚠️ บรรทัดเที่ยวบินมีส่วนต่อท้าย → ให้หน้างานยืนยันว่าตรงกับต้นฉบับ",
      "ขึ้น ✅ สีเขียว → ไปต่อ SOP 'ลง AWB ขาเข้าจาก FFM'",
    ],
  },
  {
    key: "ffm", title: "📥 ลง AWB ขาเข้าจาก FFM",
    when: "FFM ผ่านการตรวจแล้ว แต่ AWB ยังไม่มีในระบบ",
    steps: [
      "Postman → wms-message-extraction → FFM → แท็บ Body → ช่อง message วาง FFM ทั้งก้อน → Send (ต้องได้ 200 OK)",
      "JSON ที่ได้มี AWB ทุกใบใน message (API ไม่ได้เช็กว่ามีในระบบแล้วหรือยัง) — เอาไปใช้เฉพาะใบที่ยังไม่มี",
      "SQL template 'ค้น AWB ขาเข้า' ทีละเลข → ใบที่มีผลแล้ว = ข้ามไป",
      "SQL template 'หาเที่ยวบิน' → ใส่เลขเที่ยวบิน (เช่น 221) + วันที่ → ได้ flight id, airline_version และ message/manifest ของเที่ยวนั้น",
      "ถ้าเที่ยวบินมี BULK manifest อยู่แล้ว → ใช้ manifest เดิม ไม่สร้างใหม่ (ไม่งั้นจะมี BULK ซ้ำ 2 อัน)",
      "ข้อมูลที่ต้องสร้างต่อ 1 AWB (ในคำสั่งเดียว): booking → routing (เที่ยวบิน) → booking_flight (เลขเที่ยว, ต้นทาง-ปลายทาง, วันที่) → shipment (manifest, T/P, ชิ้น, กก., ลบ.ม.) → breakdown (ชิ้น/กก./ลบ.ม. จาก shipment, เวลา RCF เดียวกับใบอื่นในเที่ยว) — สถานะ booking และ routing เป็น RCF ทันที",
      "ค้นซ้ำ: ต้องเห็น booking, routing, booking_flight, shipment, breakdown ครบ และสถานะ RCF → แจ้งหน้างานกดรับ D/O → ออกบิลเอง",
    ],
  },
  {
    key: "wrong-awb", title: "🔁 FFM ลง AWB ผิดใบ (ต้องลบใบผิด + ลงใบใหม่)",
    when: "หน้างานบอกว่าของจริงคือ AWB อื่น หรือขอ 'ทำบิล AWB A และ cancel AWB B'",
    steps: [
      "ค้นทั้ง 2 เลขด้วย 'ค้น AWB ขาเข้า' — มักเจอว่าใบผิดมีครบถึง breakdown/D/O แต่ใบที่ถูกไม่มีในระบบเลย",
      "ขอ FFM ฉบับแก้จากหน้างาน (ได้ข้อมูลครบ: ต้นทาง, ชนิดสินค้า, SHC, ลบ.ม.) → ตรวจในแท็บ 'ตรวจ FFM'",
      "ใบผิด → ทำตาม SOP 'ยกเลิก AWB ขาเข้า' (back up ก่อนลบ)",
      "ใบถูก → ทำตาม SOP 'ลง AWB ขาเข้าจาก FFM' โดยใช้ message/manifest เดิมของเที่ยวบิน",
      "ไม่ต้องแก้ข้อความ FFM เก่าใน message ของเที่ยวบิน — ข้อมูลที่ใช้งานจริงอยู่ในตารางอื่นแล้ว",
      "ใบใหม่ลงพร้อม breakdown ในรอบเดียว (สถานะ RCF) แล้วแจ้งหน้างานกดรับ D/O / ออกบิลต่อ",
    ],
  },
  {
    key: "amend-imp", title: "⚖️ แก้จำนวนชิ้น / น้ำหนัก — ขาเข้า (Import)",
    when: "หน้างานแจ้งชิ้น/น้ำหนักผิด งานขาเข้า",
    steps: [
      "ทางลัด: แท็บ '⚖️ แก้น้ำหนัก' → เลือกขาเข้า ใส่ AWB + ค่าที่ถูก → ทำตามขั้นที่ 1–3 (กดคัดลอกไปรันทีละขั้น)",
      "SQL template 'ค้น AWB ขาเข้า' → ดู pcs_wt ทุกแถว",
      "จุดที่ต้องแก้ (ถ้ามี): booking → shipment → breakdown → awb_do (D/O)",
      "ถ้าจำนวนชิ้นเปลี่ยน ลบ.ม. มักต้องแก้ตามด้วย",
      "ค้นซ้ำให้ทุกแถวตรงกัน แล้วให้หน้างานเปิดหน้าจอใหม่เช็ก",
    ],
  },
  {
    key: "amend-exp", title: "⚖️ แก้จำนวนชิ้น / น้ำหนัก — ขาออก (Export) / Document Details ขึ้นผิด",
    when: "หน้างานแจ้งชิ้น/น้ำหนักผิด งานขาออก หรือหน้า Document Details (Handling and Rating) ขึ้นตัวเลขผิด",
    steps: [
      "ทางลัด: แท็บ '⚖️ แก้น้ำหนัก' → เลือกขาออก ใส่ AWB + ค่าที่ถูก → ทำตามขั้นที่ 1–3 (มีขั้นเช็กแถวคลังซ้ำให้ด้วย)",
      "SQL template 'ค้น AWB ขาออก' → ดู booking, warehouse, shipment, rating",
      "⭐ เช็ก warehouse ก่อน: ถ้ามี 2 แถวค่าเท่ากัน สร้างห่างกันไม่กี่วินาที = กดรับเข้าคลังซ้ำ → ยอดรวมเป็น 2 เท่า (เช่น 1/8 กลายเป็น 2/16) — นี่คือต้นเหตุหลักที่ทำให้ Document Details ขึ้นผิด",
      "แถวซ้ำ: เก็บแถวที่ถูกแก้ล่าสุด (มี updated_at ใหม่กว่า) ลบแถวที่ไม่เคยแก้ — back up ก่อนลบ",
      "shipment ขึ้นยอดผิด → แก้ชิ้น / กก. / ลบ.ม. ให้ตรงของจริง",
      "rating (handling_ratings) ขึ้นยอดผิด → แก้ info_piece / info_weight ได้ แต่ถ้า warehouse ยังซ้ำอยู่ หน้าจอก็ยังผิด",
      "E-Weight Slip (kn_cargo_eweights) มีเลข AWB ด้วย — ถ้าค้นแล้วยังหาที่มาไม่เจอให้ดูตัวนี้",
      "ขาออกไม่มี breakdown / AWB delivery (เป็นของขาเข้าเท่านั้น)",
      "แก้เสร็จ → ค้นซ้ำ → ให้หน้างานปิดหน้า Document Details แล้วเปิดใหม่",
    ],
  },
  {
    key: "no-do", title: "🚫 หน้างานกดรับ D/O ไม่ได้ (Select Shipment ว่าง)",
    when: "หน้า D/O เห็น AWB ในตารางบน แต่ช่อง Select Shipment ว่าง",
    steps: [
      "สาเหตุที่เจอบ่อย: ยังไม่ได้ทำ breakdown — ช่อง Select Shipment แสดงเฉพาะ shipment ที่ breakdown แล้ว",
      "เช็ก: 'ค้น AWB ขาเข้า' → ไม่มีแถว breakdown และสถานะ booking ยังเป็น FFM (ใบที่ทำ D/O ได้จะเป็น RCF)",
      "แก้: ทำ breakdown ให้ (SOP 'ทำ breakdown ให้หน้างาน') แล้วแจ้งหน้างาน refresh หน้า D/O จะมี shipment ให้เลือก",
      "ถ้าทำ breakdown แล้วช่อง Select Shipment ยังว่าง → ขอภาพหน้าจอจากหน้างาน แล้วเช็กสถานะ booking / routing ว่าเป็น RCF แล้วหรือยัง",
    ],
  },
  {
    key: "breakdown", title: "🛠 ทำ breakdown ให้หน้างาน",
    when: "ทำพร้อมกับการเพิ่ม AWB ทุกครั้ง / AWB ที่มีอยู่แล้วแต่ยังไม่มี breakdown (หน้างานกดรับ D/O ไม่ได้)",
    steps: [
      "ใช้ข้อมูลจาก shipment ของ AWB นั้น (ชิ้น / กก. / ลบ.ม.) — ไม่ใช่การนับของจริง ให้หน้างานแจ้งถ้าของจริงไม่ตรง",
      "เวลา RCF: ใช้เวลาเดียวกับ breakdown ของ AWB อื่นในเที่ยวบินเดียวกัน (มาเที่ยวเดียวกัน) — เวลานี้มีผลกับค่าเก็บรักษา",
      "location ใช้ค่าเดียวกับ AWB อื่นในเที่ยว (ปกติ 1)",
      "สร้างแถว breakdown + เปลี่ยนสถานะ booking และ routing จาก FFM เป็น RCF ในคำสั่งเดียว — ส่งเคสให้ admin/dev รัน",
      "ค้นซ้ำ: ต้องเห็นแถว breakdown และสถานะ RCF → แจ้งหน้างาน refresh หน้า D/O แล้วกดรับ D/O / ออกบิลต่อ",
    ],
  },
  {
    key: "cancel", title: "❌ ยกเลิก (cancel) AWB ขาเข้า — back up แล้วลบ",
    when: "หน้างานขอ cancel AWB / AWB ลงผิดใบ",
    steps: [
      "SQL template 'Back up ก่อนลบ AWB ขาเข้า' → คัดลอก → รันใน Dataflare",
      "กดปุ่มดาวน์โหลดมุมขวาล่าง → เลือก JSON → Export → ตั้งชื่อ backup_cancel_AWB_<เลข>_<วันที่>.json (หน้าต่าง Save อาจเด้งไปอีกจอ)",
      "เปิดไฟล์เช็กว่ามีครบทุกแถว (booking, routing, booking_flight, shipment, breakdown, D/O ฯลฯ)",
      "ติ๊ก 'ฉัน back up แล้ว' → คัดลอก 'ลบ AWB ขาเข้า' → รัน — ลบทั้งหมดในคำสั่งเดียว ถ้ามีตารางลูกอื่นค้างจะ error และไม่ลบอะไรเลย",
      "หัว D/O จะถูกลบเฉพาะเมื่อไม่มี AWB อื่นอยู่ใน D/O เดียวกัน",
      "ค้นซ้ำว่าไม่เหลือ — ไม่ต้องแตะ message FFM / manifest ของเที่ยวบิน เพราะ AWB อื่นยังใช้อยู่",
      "ย้ายไฟล์ back up ไปเก็บที่ปลอดภัย (โฟลเดอร์ back up / OneDrive) อย่าทิ้งไว้ใน Downloads",
    ],
  },
  {
    key: "ts", title: "🔀 ทำ T/S (Transhipment / ต่อเครื่อง) ไม่ได้",
    when: "หน้างานแจ้งว่าทำ T/S ของ AWB ขาเข้าไม่ได้",
    steps: [
      "SQL template 'ค้น AWB ขาเข้า' → ดูแถว customer (ข้อมูลจาก kn_cargo_in_booking_customers)",
      "AWB ต้องมี customer ครบ 3 แถว: 1 Consignee · 2 Agent · 3 Shipper (ช่อง pcs_wt ของแถว customer จะแสดง type ในวงเล็บ เช่น [Consignee])",
      "เช็กการสะกด type ด้วย — ในระบบมีแถวที่สะกดผิด/มีช่องว่างท้าย เช่น [Consigee], [Agents], [Agent ] และแถวที่ไม่มี type เลย ถือว่าไม่ครบ ต้องแก้ให้เป็น Consignee / Agent / Shipper ตรงตัว",
      "ขาดแถวไหน หรือมีไม่ครบ 3 = ต้นเหตุที่ทำ T/S ไม่ได้ → ส่งเคสให้ admin/dev เพิ่มแถวที่ขาด (ดูรูปแบบจาก AWB อื่นที่ทำ T/S ผ่าน)",
      "เพิ่มครบแล้ว → ค้นซ้ำให้เห็นครบ 3 แถว → ให้หน้างานลองทำ T/S อีกครั้ง",
    ],
  },
  {
    key: "awb-no", title: "🔢 แก้เลข AWB (Amendment MAWB No.)",
    when: "หน้างานขอเปลี่ยนเลข AWB จากเลขเดิมเป็นเลขใหม่",
    steps: [
      "เช็กเลขใหม่ในแท็บ 'ตรวจ FFM' หรือคำนวณเอง: 7 หลักแรก หาร 7 เศษต้องเท่ากับหลักสุดท้าย — เลขเดิมที่ผิดมักไม่ผ่าน check digit",
      "SQL template 'ค้น AWB ขาเข้า/ขาออก' ด้วยเลขใหม่ → ต้องไม่เจอ (ถ้าเจอ = มีใบนี้อยู่แล้ว ห้ามเปลี่ยนทับ ต้องคุยก่อน)",
      "เลข AWB เก็บอยู่ที่ booking (kn_cargo_in_bookings / kn_cargo_bookings) ที่เดียว — routing, shipment, breakdown, D/O ผูกด้วย booking_id แก้ booking แล้วเปลี่ยนตามเอง",
      "ที่อื่นที่มีเลข AWB: imp_messages (FFM ดิบ) และ message_centers (ประวัติ FSU ที่ระบบสร้าง) — ปกติไม่แก้ เก็บเป็นประวัติ",
      "Back up แถว booking (+ message_centers ถ้ามี) เป็นไฟล์ก่อน",
      "แก้ awb ใน booking แถวเดียว ใส่เงื่อนไขเลขเดิมใน WHERE และกันเลขใหม่ซ้ำ (NOT EXISTS) — ส่งเคสให้ admin/dev รัน",
      "ค้นซ้ำด้วยเลขใหม่: ต้องเห็น booking, routing, shipment, breakdown, D/O ครบ และค้นเลขเดิมใน booking ต้องไม่เจอ",
      "ถ้าระบบส่ง FSU เลขเดิมไปสายการบินแล้ว → แจ้งหน้างาน/สายการบินเอง แก้ในฐานข้อมูลเราไม่ได้",
    ],
  },
  {
    key: "partial", title: "✂️ Partial Shipment — ย้าย AWB ไปเที่ยวบินอื่น",
    when: "เคส Partial Shipment / ของมาไม่ครบหรือต้องย้ายไปลงอีกเที่ยวบิน",
    steps: [
      "SQL template 'หาเที่ยวบิน' → ใส่เลขเที่ยวบินปลายทางที่ต้องการย้ายไป + วันที่ → จด flight id ของเที่ยวนั้น",
      "SQL template 'ค้น AWB ขาเข้า' (หรือขาออก) → ดูแถว routing ว่าตอนนี้ผูกกับ flight ไหนอยู่",
      "วิธีแก้: นำ flight_id ของเที่ยวที่ต้องการย้ายไป มาเปลี่ยนที่ routing ของ AWB นั้น",
      "ค้นซ้ำให้ routing ชี้ไปเที่ยวบินใหม่แล้ว → ให้หน้างานเปิดหน้าจอเช็ก",
      "ที่มา: บทความ 'WMS Partial Shipment' ใน Knowledge Hub (Sayan, 13/9/2569)",
    ],
  },
  {
    key: "restore", title: "♻️ Back up / คืนข้อมูลที่ลบไป",
    when: "ลบไปแล้วมีปัญหา ต้องเอาข้อมูลกลับ",
    steps: [
      "ไฟล์ back up เก็บทุกคอลัมน์ รวม id เดิม — ใส่คืนด้วย id เดิมได้ ไม่ชนกับข้อมูลใหม่ (เลข id รันไปข้างหน้าเสมอ)",
      "คืนทีละแถว: INSERT INTO aotga.<ชื่อตาราง> SELECT * FROM jsonb_populate_record(NULL::aotga.<ชื่อตาราง>, '<row_json จากไฟล์>'::jsonb);",
      "ต้องคืนตามลำดับ แม่ก่อนลูก: booking → routing / booking_flight / shipment → breakdown → หัว D/O → awb_do → notification",
      "คืนได้เฉพาะสิ่งที่อยู่ในไฟล์ — งานที่หน้างานทำต่อหลังลบ (เช่น บิลใหม่) จะไม่ย้อนตาม",
    ],
  },
];

// ───────────────────────── SQL templates ─────────────────────────

const S = "aotga.";

function sqlTemplates(prefix, awb) {
  const A = `'${awb}'`, P = `'${prefix}'`;
  const inBk = `SELECT id FROM ${S}kn_cargo_in_bookings WHERE prefix = ${P} AND awb = ${A}`;
  const exBk = `SELECT id FROM ${S}kn_cargo_bookings WHERE prefix = ${P} AND awb = ${A}`;
  const inShip = `SELECT id FROM ${S}kn_cargo_in_shipments WHERE booking_id IN (${inBk})`;
  const inDo = `SELECT delivery_order_id FROM ${S}kn_cargo_in_awb_delivery_orders WHERE booking_id IN (${inBk})`;
  // หัว D/O ที่มีเฉพาะ AWB นี้
  const inDoOnly = `SELECT d.delivery_order_id FROM ${S}kn_cargo_in_awb_delivery_orders d WHERE d.booking_id IN (${inBk})
    AND NOT EXISTS (SELECT 1 FROM ${S}kn_cargo_in_awb_delivery_orders o WHERE o.delivery_order_id = d.delivery_order_id AND o.booking_id NOT IN (${inBk}))`;

  return [
    {
      key: "find-in", title: "ค้น AWB ขาเข้า (ทุกตารางที่เกี่ยว)", kind: "read",
      sql: `SELECT 'booking' AS t, b.id, b.piece || ' / ' || b.weight || ' / ' || coalesce(b.volume::text,'') AS pcs_wt_vol,
  b.origin || '-' || b.destination || ' ' || coalesce(b.nature_of_goods,'') || ' ' || coalesce(b.mvt_status,'') AS info
FROM ${S}kn_cargo_in_bookings b WHERE b.prefix = ${P} AND b.awb = ${A}
UNION ALL SELECT 'routing', r.id, '', 'flight=' || r.flight_id || ' ' || coalesce(r.mvt_status,'') FROM ${S}kn_cargo_in_booking_routings r WHERE r.booking_id IN (${inBk})
UNION ALL SELECT 'bflight', f.id, '', f.flight_no || ' ' || f.origin || '-' || f.destination || ' ' || coalesce(f.flight_date::text,'') FROM ${S}kn_cargo_in_booking_flights f WHERE f.booking_id IN (${inBk})
UNION ALL SELECT 'shipment', s.id, s.piece || ' / ' || s.weight || ' / ' || coalesce(s.volume::text,''), 'manifest=' || s.manifest_id || ' ' || s.shipment_type FROM ${S}kn_cargo_in_shipments s WHERE s.booking_id IN (${inBk})
UNION ALL SELECT 'breakdown', d.id, d.piece || ' / ' || d.weight, 'shipment=' || d.shipment_id || coalesce(' deleted=' || d.deleted_at::text,'') FROM ${S}kn_cargo_in_breakdowns d WHERE d.shipment_id IN (${inShip})
UNION ALL SELECT 'awb_do', o.id, o.piece || ' / ' || o.weight, 'do=' || o.delivery_order_id || coalesce(' deleted=' || o.deleted_at::text,'') FROM ${S}kn_cargo_in_awb_delivery_orders o WHERE o.booking_id IN (${inBk})
UNION ALL SELECT 'customer', cu.id, '[' || coalesce(cu.type,'ไม่มี type') || ']', 'customer_id=' || coalesce(cu.customer_id::text,'-') || ' address_id=' || coalesce(cu.address_id::text,'-') FROM ${S}kn_cargo_in_booking_customers cu WHERE cu.booking_id IN (${inBk})
ORDER BY 1, 2;`,
    },
    {
      key: "find-ex", title: "ค้น AWB ขาออก (ทุกตารางที่เกี่ยว)", kind: "read",
      sql: `SELECT 'booking' AS t, b.id, b.piece || ' / ' || b.weight AS pcs_wt, b.origin || '-' || b.destination || ' ' || coalesce(b.nature_of_goods,'') AS info
FROM ${S}kn_cargo_bookings b WHERE b.prefix = ${P} AND b.awb = ${A}
UNION ALL SELECT 'warehouse', w.id, w.piece || ' / ' || w.weight, 'created=' || w.created_at::text FROM ${S}kn_cargo_booking_warehouses w WHERE w.booking_id IN (${exBk})
UNION ALL SELECT 'shipment', s.id, s.piece || ' / ' || s.weight, 'manifest=' || s.manifest_id || ' vol=' || coalesce(s.volume::text,'') FROM ${S}kn_cargo_shipments s WHERE s.booking_id IN (${exBk})
UNION ALL SELECT 'rating', h.id, h.info_piece || ' / ' || h.info_weight, coalesce(h.invoice_no,'') || coalesce(' deleted=' || h.deleted_at::text,'') FROM ${S}kn_cargo_handling_ratings h WHERE h.awb = ${A}
ORDER BY 1, 2;`,
    },
    {
      key: "flight", title: "หาเที่ยวบิน (flight_id) + message FFM ของเที่ยวบิน", kind: "read", needsFlight: true,
      sql: (fl) => `SELECT 'flight' AS t, f.id, f.airline_prefix || ' ' || f.flight_no || ' ' || f.depart_airport || '-' || f.arrival_airport AS info, f.std::text AS std, f.airline_version_id::text AS airline_version
FROM ${S}kn_cargo_flights f WHERE f.airline_prefix = ${P} AND f.flight_no = '${fl.no}' AND f.std >= '${fl.date}'::date - 1 AND f.std < '${fl.date}'::date + 2
UNION ALL SELECT 'message', m.id, 'flight=' || m.flight_id, m.created_at::text, (m.message LIKE '%${prefix}-${awb}%')::text
FROM ${S}kn_cargo_imp_messages m WHERE m.flight_id IN (SELECT id FROM ${S}kn_cargo_flights WHERE airline_prefix = ${P} AND flight_no = '${fl.no}' AND std >= '${fl.date}'::date - 1 AND std < '${fl.date}'::date + 2)
UNION ALL SELECT 'manifest', mf.id, 'msg=' || mf.imp_msg_id, coalesce(mf.uld_serial,'') || ' bulk=' || mf.is_bulk, ''
FROM ${S}kn_cargo_in_manifests mf WHERE mf.imp_msg_id IN (SELECT m2.id FROM ${S}kn_cargo_imp_messages m2 WHERE m2.flight_id IN (SELECT id FROM ${S}kn_cargo_flights WHERE airline_prefix = ${P} AND flight_no = '${fl.no}' AND std >= '${fl.date}'::date - 1 AND std < '${fl.date}'::date + 2))
ORDER BY 1, 2;`,
    },
    {
      key: "backup-in", title: "Back up ก่อนลบ AWB ขาเข้า (แล้ว Export เป็น JSON)", kind: "read",
      sql: `SELECT 'kn_cargo_in_bookings' AS tbl, id, to_jsonb(x)::text AS row_json FROM ${S}kn_cargo_in_bookings x WHERE prefix = ${P} AND awb = ${A}
UNION ALL SELECT 'kn_cargo_in_booking_routings', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_booking_routings x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_booking_flights', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_booking_flights x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_shipments', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_shipments x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_breakdowns', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_breakdowns x WHERE shipment_id IN (${inShip})
UNION ALL SELECT 'kn_cargo_in_awb_delivery_orders', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_awb_delivery_orders x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_delivery_orders', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_delivery_orders x WHERE id IN (${inDo})
UNION ALL SELECT 'kn_cargo_notifications', id, to_jsonb(x)::text FROM ${S}kn_cargo_notifications x WHERE delivery_id IN (${inDo})
UNION ALL SELECT 'kn_cargo_in_booking_customers', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_booking_customers x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_booking_dimensions', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_booking_dimensions x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_booking_hawbs', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_booking_hawbs x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_other_charges', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_other_charges x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_rate_details', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_rate_details x WHERE booking_id IN (${inBk})
UNION ALL SELECT 'kn_cargo_in_accountings', id, to_jsonb(x)::text FROM ${S}kn_cargo_in_accountings x WHERE booking_id IN (${inBk});`,
    },
    {
      key: "delete-in", title: "ลบ AWB ขาเข้า (ต้อง back up ก่อน!)", kind: "danger",
      sql: `-- ลบทั้งหมดในคำสั่งเดียว ถ้ามีตารางลูกอื่นค้างอยู่ (เช่น hawbs, rate_details) จะ error และไม่ลบอะไรเลย → ตรวจ back up ก่อน
WITH d_notif AS (
  DELETE FROM ${S}kn_cargo_notifications WHERE delivery_id IN (${inDoOnly}) RETURNING id
), d_awbdo AS (
  DELETE FROM ${S}kn_cargo_in_awb_delivery_orders WHERE booking_id IN (${inBk}) RETURNING id
), d_do AS (
  DELETE FROM ${S}kn_cargo_in_delivery_orders WHERE id IN (${inDoOnly}) RETURNING id
), d_bd AS (
  DELETE FROM ${S}kn_cargo_in_breakdowns WHERE shipment_id IN (${inShip}) RETURNING id
), d_ship AS (
  DELETE FROM ${S}kn_cargo_in_shipments WHERE booking_id IN (${inBk}) RETURNING id
), d_bf AS (
  DELETE FROM ${S}kn_cargo_in_booking_flights WHERE booking_id IN (${inBk}) RETURNING id
), d_rt AS (
  DELETE FROM ${S}kn_cargo_in_booking_routings WHERE booking_id IN (${inBk}) RETURNING id
), d_bk AS (
  DELETE FROM ${S}kn_cargo_in_bookings WHERE prefix = ${P} AND awb = ${A} RETURNING id
)
SELECT (SELECT count(*) FROM d_notif) AS notifications, (SELECT count(*) FROM d_awbdo) AS awb_do, (SELECT count(*) FROM d_do) AS do_header,
  (SELECT count(*) FROM d_bd) AS breakdowns, (SELECT count(*) FROM d_ship) AS shipments, (SELECT count(*) FROM d_bf) AS bflights,
  (SELECT count(*) FROM d_rt) AS routings, (SELECT count(*) FROM d_bk) AS bookings;`,
    },
  ];
}

// ───────────────────────── UI ─────────────────────────

function useCopy() {
  const [copied, setCopied] = useState("");
  async function copy(key, text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? "" : k)), 1500);
  }
  return [copied, copy];
}

function FfmChecker({ c }) {
  const [text, setText] = useState("");
  const r = useMemo(() => parseFFM(text), [text]);
  const bad = r.awbs.filter((a) => a.issues.some((x) => !x.startsWith("ไม่มีบรรทัด SHC")));
  const card = { background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 };
  const th = { textAlign: "left", padding: "6px 8px", fontSize: 11.5, color: c.text400, fontWeight: 700, borderBottom: `1px solid ${c.border}`, whiteSpace: "nowrap" };
  const td = { padding: "7px 8px", fontSize: 12.5, color: c.text900, borderBottom: `1px solid ${c.borderSoft}`, verticalAlign: "top" };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false}
        placeholder={"วาง FFM ที่หน้างานส่งมา เช่น\nFFM/8\n1/TG221/27OCT/BKK/HSTEN\nHKT\n217-75613171BKKHKT/T16K115MC0.02/FRESH ATEMIA\n/PER\nLAST"}
        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 12px", fontSize: 13,
          fontFamily: "ui-monospace,Consolas,monospace", outline: "none", background: c.card, color: c.text900, resize: "vertical", lineHeight: 1.5 }} />

      {text.trim() && (
        <>
          <div style={{ ...card, borderColor: bad.length || r.problems.length ? c.danger : c.ok }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: bad.length ? c.danger : r.problems.length ? c.warn : c.ok }}>
              {bad.length ? `❌ มี AWB ผิด ${bad.length} ใบ — ส่งกลับหน้างานแก้ก่อน อย่าเพิ่งยิง Postman`
                : r.problems.length ? "⚠️ อ่านได้ แต่มีจุดที่ควรเช็ก" : "✅ รูปแบบถูกต้อง ยิง Postman ต่อได้"}
            </div>
            {r.header && (
              <div style={{ fontSize: 12.5, color: c.text500, marginTop: 6, lineHeight: 1.7 }}>
                เที่ยวบิน <b style={{ color: c.text900 }}>{r.header.flight}</b> · วันที่ {r.header.date} · ออกจาก {r.header.origin}
                {r.header.reg && <> · ทะเบียน {r.header.reg}</>}
                {r.unloading.length > 0 && <> · ลงที่ {r.unloading.join(", ")}</>}
                {" · "}{r.ulds.length ? `ULD ${r.ulds.length} ตู้` : "BULK (ไม่มี ULD)"} · {r.awbs.length} AWB
              </div>
            )}
            {r.problems.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: c.warn, lineHeight: 1.7 }}>
                {r.problems.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
          </div>

          {r.awbs.length > 0 && (
            <div style={{ ...card, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr>
                  <th style={th}>AWB</th><th style={th}>เส้นทาง</th><th style={th}>T/P</th><th style={th}>ชิ้น</th><th style={th}>กก.</th>
                  <th style={th}>ลบ.ม.</th><th style={th}>สินค้า</th><th style={th}>SHC</th><th style={th}>ULD</th><th style={th}>ตรวจ</th>
                </tr></thead>
                <tbody>
                  {r.awbs.map((a) => (
                    <tr key={a.line}>
                      <td style={{ ...td, fontFamily: "ui-monospace,Consolas,monospace", whiteSpace: "nowrap" }}>{a.prefix}-{a.awb}</td>
                      <td style={td}>{a.orig}-{a.dest}</td>
                      <td style={td}>{a.code}{a.code === "P" ? " (บางส่วน)" : ""}</td>
                      <td style={td}>{a.pcs}</td><td style={td}>{a.wt}</td><td style={td}>{a.vol ?? "-"}</td>
                      <td style={td}>{a.nature}</td><td style={td}>{a.shc.join(", ") || "-"}</td><td style={td}>{a.uld}</td>
                      <td style={{ ...td, minWidth: 200 }}>
                        {a.issues.length === 0 ? <span style={{ color: c.ok, fontWeight: 700 }}>✓ ผ่าน</span> : (
                          <div style={{ color: c.danger, lineHeight: 1.6 }}>
                            {a.issues.map((x, i) => <div key={i}>• {x}</div>)}
                            {a.cands.length > 0 && <div style={{ color: c.warn }}>เลขที่ผ่าน check digit: {a.cands.map((x) => `${a.prefix}-${x}`).join(", ")} (ต้องให้หน้างานยืนยัน)</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SopList({ c }) {
  const [open, setOpen] = useState("rules");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, color: c.text400, margin: "0 2px" }}>เลือกหัวข้อที่ตรงกับเคส · อัปเดตล่าสุด {SOP_UPDATED}</div>
      {SOPS.map((s) => {
        const on = open === s.key;
        return (
          <div key={s.key} style={{ background: c.card, border: `1px solid ${on ? c.text400 : c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div onClick={() => setOpen(on ? "" : s.key)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: c.text900 }}>{s.title}</div>
                {s.when && <div style={{ fontSize: 12, color: c.text500, marginTop: 2 }}>ใช้เมื่อ: {s.when}</div>}
              </div>
              <span style={{ fontSize: 11.5, color: c.text400 }}>{s.steps.length} ขั้นตอน</span>
              <span style={{ color: c.text400, fontSize: 12 }}>{on ? "▴" : "▾"}</span>
            </div>
            {on && (
              <ol style={{ margin: 0, padding: "4px 16px 14px", listStyle: "none", display: "grid", gap: 8, borderTop: `1px solid ${c.borderSoft}` }}>
                {s.steps.map((st, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: c.borderSoft, color: c.text900, fontSize: 12, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: c.text900, lineHeight: 1.65, wordBreak: "break-word" }}>{st}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SqlTemplates({ c }) {
  const [awbText, setAwbText] = useState("");
  const [flNo, setFlNo] = useState("");
  const [flDate, setFlDate] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [copied, copy] = useCopy();

  const m = awbText.replace(/\s/g, "").match(/^(\d{3})-?(\d{8})$/);
  const prefix = m?.[1], awb = m?.[2];
  const flight = /^\d{1,4}[A-Z]?$/.test(flNo.trim().toUpperCase()) && /^\d{4}-\d{2}-\d{2}$/.test(flDate) ? { no: flNo.trim().toUpperCase(), date: flDate } : null;
  const tpls = m ? sqlTemplates(prefix, awb) : [];

  const IS = { border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontFamily: "inherit", outline: "none",
    background: c.card, color: c.text900, boxSizing: "border-box" };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <input value={awbText} onChange={(e) => setAwbText(e.target.value)} placeholder="เลข AWB เช่น 217-75613171"
          style={{ ...IS, width: "100%", fontFamily: "ui-monospace,Consolas,monospace" }} />
        {awbText.trim() && !m && <div style={{ fontSize: 12, color: c.danger }}>รูปแบบต้องเป็น prefix 3 หลัก - เลข AWB 8 หลัก</div>}
        {m && !awbCheckOk(awb) && <div style={{ fontSize: 12, color: c.warn }}>⚠️ เลข {awb} ไม่ผ่าน check digit — ตรวจเลขอีกครั้ง</div>}
      </div>

      {!m ? (
        <div style={{ textAlign: "center", color: c.text400, padding: "30px 10px", fontSize: 13 }}>ใส่เลข AWB ก่อน แล้วจะได้ query พร้อมคัดลอกไปรันใน Dataflare</div>
      ) : tpls.map((t) => {
        if (t.kind === "danger" && !backedUp) {
          return (
            <div key={t.key} style={{ background: c.card, border: `1px dashed ${c.danger}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: c.danger }}>🔒 {t.title}</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 13, color: c.text900, cursor: "pointer" }}>
                <input type="checkbox" checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} />
                ฉัน back up และเปิดไฟล์เช็กแล้วว่าครบทุกแถว
              </label>
            </div>
          );
        }
        const sql = typeof t.sql === "function" ? (flight ? t.sql(flight) : "") : t.sql;
        return (
          <div key={t.key} style={{ background: c.card, border: `1px solid ${t.kind === "danger" ? c.danger : c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${c.borderSoft}` }}>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: t.kind === "danger" ? c.danger : c.text900 }}>
                {t.kind === "danger" ? "⚠️ " : "🔎 "}{t.title}
              </div>
              {sql && (
                <button onClick={() => copy(t.key, sql)} style={{ background: t.kind === "danger" ? c.danger : c.ink, border: "none", color: "#fff", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {copied === t.key ? "✓ คัดลอกแล้ว" : "คัดลอก"}
                </button>
              )}
            </div>
            {t.needsFlight && (
              <div style={{ display: "flex", gap: 8, padding: "10px 12px 0", flexWrap: "wrap" }}>
                <input value={flNo} onChange={(e) => setFlNo(e.target.value)} placeholder="เลขเที่ยวบิน เช่น 221" style={{ ...IS, width: 170 }} />
                <input type="date" value={flDate} onChange={(e) => setFlDate(e.target.value)} style={{ ...IS, width: 170 }} />
                <span style={{ fontSize: 12, color: c.text400, alignSelf: "center" }}>prefix สายการบินใช้ {prefix} จากเลข AWB</span>
              </div>
            )}
            {sql ? (
              <pre style={{ margin: 0, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.55, color: c.text900, background: c.bg, overflowX: "auto",
                fontFamily: "ui-monospace,Consolas,monospace", maxHeight: 260 }}>{sql}</pre>
            ) : (
              <div style={{ padding: "10px 12px 12px", fontSize: 12.5, color: c.text400 }}>ใส่เลขเที่ยวบินและวันที่ก่อน</div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ───────────────────────── ตัวช่วยแก้น้ำหนัก ─────────────────────────
// สร้าง SQL แก้ชิ้น / น้ำหนัก (/ ลบ.ม.) ทุกตารางที่เกี่ยวในคำสั่งเดียว
// กันพลาด: แก้เฉพาะเมื่อ AWB มี booking 1 ใบ และ shipment 1 แถว (ถ้ามีหลาย shipment = เคส partial ต้องแก้มือ)

function amendSql(dir, prefix, awb, pcs, wt, vol, uid) {
  const P = `'${prefix}'`, A = `'${awb}'`;
  const V = vol === "" ? null : vol;
  if (dir === "in") {
    const bk = `SELECT id FROM ${S}kn_cargo_in_bookings WHERE prefix = ${P} AND awb = ${A}`;
    const guard = `(SELECT count(*) FROM ${S}kn_cargo_in_bookings WHERE prefix = ${P} AND awb = ${A}) = 1
    AND (SELECT count(*) FROM ${S}kn_cargo_in_shipments WHERE booking_id IN (${bk})) = 1`;
    const setV = V === null ? "" : `, volume = ${V}`;
    return `-- แก้ AWB ขาเข้า ${prefix}-${awb} เป็น ${pcs} ชิ้น / ${wt} กก.${V === null ? "" : ` / ${V} ลบ.ม.`}
-- ถ้าผลออกมา 0 ทุกช่อง = ไม่ได้แก้อะไร (ไม่พบ AWB / มีหลาย booking / หลาย shipment)
WITH u_bk AS (
  UPDATE ${S}kn_cargo_in_bookings SET piece = ${pcs}, weight = ${wt}${setV}, updated_at = now(), updated_by = ${uid}
  WHERE prefix = ${P} AND awb = ${A} AND ${guard}
  RETURNING id
), u_ship AS (
  UPDATE ${S}kn_cargo_in_shipments SET piece = ${pcs}, weight = ${wt}${setV}, updated_at = now(), updated_by = ${uid}
  WHERE booking_id IN (${bk}) AND ${guard}
  RETURNING id
), u_bd AS (
  UPDATE ${S}kn_cargo_in_breakdowns SET piece = ${pcs}, weight = ${wt}${setV}, updated_at = now(), updated_by = ${uid}
  WHERE deleted_at IS NULL AND shipment_id IN (SELECT id FROM ${S}kn_cargo_in_shipments WHERE booking_id IN (${bk})) AND ${guard}
  RETURNING id
), u_do AS (
  UPDATE ${S}kn_cargo_in_awb_delivery_orders SET piece = ${pcs}, weight = ${wt}${setV}
  WHERE deleted_at IS NULL AND booking_id IN (${bk}) AND ${guard}
  RETURNING id
)
SELECT (SELECT count(*) FROM u_bk) AS booking, (SELECT count(*) FROM u_ship) AS shipment,
  (SELECT count(*) FROM u_bd) AS breakdown, (SELECT count(*) FROM u_do) AS awb_do;`;
  }
  const bk = `SELECT id FROM ${S}kn_cargo_bookings WHERE prefix = ${P} AND awb = ${A}`;
  const guard = `(SELECT count(*) FROM ${S}kn_cargo_bookings WHERE prefix = ${P} AND awb = ${A}) = 1
    AND (SELECT count(*) FROM ${S}kn_cargo_shipments WHERE booking_id IN (${bk})) <= 1`;
  return `-- แก้ AWB ขาออก ${prefix}-${awb} เป็น ${pcs} ชิ้น / ${wt} กก.${V === null ? "" : ` / ${V} ลบ.ม.`}
-- ไม่แก้ตารางรับเข้าคลัง (booking_warehouses) — ถ้ามีแถวซ้ำ ต้องลบแถวซ้ำแยก (ดูขั้นที่ 1)
WITH u_bk AS (
  UPDATE ${S}kn_cargo_bookings SET piece = ${pcs}, weight = ${wt}, updated_at = now()
  WHERE prefix = ${P} AND awb = ${A} AND ${guard}
  RETURNING id
), u_ship AS (
  UPDATE ${S}kn_cargo_shipments SET piece = ${pcs}, weight = ${wt}${V === null ? "" : `, volume = ${V}`}, updated_at = now(), updated_by = ${uid}
  WHERE booking_id IN (${bk}) AND ${guard}
  RETURNING id
), u_rt AS (
  UPDATE ${S}kn_cargo_handling_ratings SET info_piece = ${pcs}, info_weight = ${wt}
  WHERE awb = ${A} AND ${guard}
  RETURNING id
)
SELECT (SELECT count(*) FROM u_bk) AS booking, (SELECT count(*) FROM u_ship) AS shipment, (SELECT count(*) FROM u_rt) AS rating;`;
}

function warehouseCheckSql(prefix, awb) {
  return `-- นับแถวรับเข้าคลัง: ถ้ามี 2 แถวค่าเท่ากัน สร้างห่างกันไม่กี่วินาที = กดรับเข้าคลังซ้ำ (ลบแถวซ้ำ ต้อง back up ก่อน)
SELECT w.id, w.piece || ' / ' || w.weight AS pcs_wt, w.created_at::text AS created, w.updated_at::text AS updated
FROM ${S}kn_cargo_booking_warehouses w
WHERE w.booking_id IN (SELECT id FROM ${S}kn_cargo_bookings WHERE prefix = '${prefix}' AND awb = '${awb}')
ORDER BY w.id;`;
}

function AmendHelper({ c }) {
  const [dir, setDir] = useState("in");
  const [awbText, setAwbText] = useState("");
  const [pcs, setPcs] = useState("");
  const [wt, setWt] = useState("");
  const [vol, setVol] = useState("");
  const [uid, setUid] = useState("129");
  const [copied, copy] = useCopy();

  const m = awbText.replace(/\s/g, "").match(/^(\d{3})-?(\d{8})$/);
  const prefix = m?.[1], awb = m?.[2];
  const num = (x) => /^\d+(\.\d+)?$/.test(String(x).trim());
  const ok = m && /^\d+$/.test(pcs.trim()) && num(wt) && (vol.trim() === "" || num(vol)) && /^\d+$/.test(uid.trim());

  const IS = { border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontFamily: "inherit", outline: "none",
    background: c.card, color: c.text900, boxSizing: "border-box", width: "100%" };
  const LB = { fontSize: 12, color: c.text500, fontWeight: 700, marginBottom: 4, display: "block" };
  const chip = (on) => ({ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${on ? c.ink : c.border}`, background: on ? c.ink : c.card, color: on ? c.onInk : c.text500 });

  const steps = [];
  if (ok) {
    const t = sqlTemplates(prefix, awb);
    const find = t.find((x) => x.key === (dir === "in" ? "find-in" : "find-ex")).sql;
    steps.push({ key: "s1", title: "ขั้นที่ 1 — ค้นดูค่าปัจจุบัน", note: "รันแล้วดูคอลัมน์ pcs_wt ว่าแถวไหนผิด" + (dir === "in" ? "" : " และดูว่ามีแถว warehouse เกิน 1 แถวไหม"), sql: find, kind: "read" });
    if (dir === "ex") steps.push({ key: "s1b", title: "ขั้นที่ 1.1 — เช็กแถวรับเข้าคลังซ้ำ", note: "ถ้ามีมากกว่า 1 แถว ให้ส่งเคสให้ admin/dev ลบแถวซ้ำ (back up ก่อน) — แก้ตัวเลขอย่างเดียวไม่หาย", sql: warehouseCheckSql(prefix, awb), kind: "read" });
    steps.push({ key: "s2", title: "ขั้นที่ 2 — แก้ทุกตารางในคำสั่งเดียว", note: "ผลจะบอกจำนวนแถวที่แก้ในแต่ละตาราง ถ้าได้ 0 ทั้งหมด = ไม่ได้แก้ (AWB ไม่พบ / มีหลาย shipment ต้องแก้มือ)", sql: amendSql(dir, prefix, awb, pcs.trim(), wt.trim(), vol.trim(), uid.trim()), kind: "danger" });
    steps.push({ key: "s3", title: "ขั้นที่ 3 — ค้นซ้ำให้ทุกแถวถูก", note: "pcs_wt ทุกแถวต้องเป็น " + `${pcs} / ${wt}` + " แล้วบอกหน้างานปิดหน้าจอเปิดใหม่เช็ก", sql: find, kind: "read" });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setDir("in")} style={chip(dir === "in")}>ขาเข้า (Import)</button>
          <button onClick={() => setDir("ex")} style={chip(dir === "ex")}>ขาออก (Export)</button>
        </div>
        <div>
          <label style={LB}>เลข AWB</label>
          <input value={awbText} onChange={(e) => setAwbText(e.target.value)} placeholder="เช่น 829-05306136" style={{ ...IS, fontFamily: "ui-monospace,Consolas,monospace" }} />
          {awbText.trim() && !m && <div style={{ fontSize: 12, color: c.danger, marginTop: 4 }}>รูปแบบต้องเป็น prefix 3 หลัก - เลข AWB 8 หลัก</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
          <div><label style={LB}>ชิ้นที่ถูก</label><input value={pcs} onChange={(e) => setPcs(e.target.value)} inputMode="numeric" placeholder="1" style={IS} /></div>
          <div><label style={LB}>น้ำหนักที่ถูก (กก.)</label><input value={wt} onChange={(e) => setWt(e.target.value)} inputMode="decimal" placeholder="8" style={IS} /></div>
          <div><label style={LB}>ลบ.ม. (ไม่บังคับ)</label><input value={vol} onChange={(e) => setVol(e.target.value)} inputMode="decimal" placeholder="เว้นว่าง = ไม่แก้" style={IS} /></div>
          <div><label style={LB}>user id ผู้แก้</label><input value={uid} onChange={(e) => setUid(e.target.value)} inputMode="numeric" style={IS} /></div>
        </div>
        <div style={{ fontSize: 12, color: c.text400, lineHeight: 1.6 }}>
          {dir === "in" ? "จะแก้: booking · shipment · breakdown · AWB D/O (ถ้ามี)" : "จะแก้: booking · shipment · handling rating (หน้า Document Details) — ไม่แตะตารางรับเข้าคลัง"}
        </div>
      </div>

      {!ok ? (
        <div style={{ textAlign: "center", color: c.text400, padding: "26px 10px", fontSize: 13 }}>ใส่เลข AWB + ชิ้น + น้ำหนักที่ถูก แล้วจะได้ SQL ทีละขั้น</div>
      ) : steps.map((st) => (
        <div key={st.key} style={{ background: c.card, border: `1px solid ${st.kind === "danger" ? c.danger : c.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${c.borderSoft}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: st.kind === "danger" ? c.danger : c.text900 }}>{st.title}</div>
              <div style={{ fontSize: 12, color: c.text500, marginTop: 2, lineHeight: 1.5 }}>{st.note}</div>
            </div>
            <button onClick={() => copy(st.key, st.sql)} style={{ background: st.kind === "danger" ? c.danger : c.ink, border: "none", color: "#fff", borderRadius: 8,
              padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {copied === st.key ? "✓ คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
          <pre style={{ margin: 0, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.55, color: c.text900, background: c.bg, overflowX: "auto",
            fontFamily: "ui-monospace,Consolas,monospace", maxHeight: 220 }}>{st.sql}</pre>
        </div>
      ))}
      <div style={{ fontSize: 12, color: c.text400, lineHeight: 1.6 }}>วิธีรัน: กดคัดลอก → Dataflare หน้า SQL Query → Ctrl+A แล้ว Ctrl+V → Ctrl+Enter</div>
    </div>
  );
}

export default function WmsToolkit() {
  const { c } = useTheme();
  const [tab, setTab] = useState("ffm");
  const tabs = [["ffm", "ตรวจ FFM"], ["amend", "⚖️ แก้น้ำหนัก"], ["sop", "SOP"], ["sql", "SQL template"]];
  const chip = (on) => ({ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    whiteSpace: "nowrap", border: `1px solid ${on ? c.ink : c.border}`, background: on ? c.ink : c.card, color: on ? c.onInk : c.text500 });
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: c.text400, background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, lineHeight: 1.6 }}>
        ⚠️ query ในหน้านี้แก้ข้อมูลจริงของ WMS — ค้นดูก่อนทุกครั้ง และ back up ก่อนลบ
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={chip(tab === k)}>{l}</button>)}
      </div>
      {tab === "ffm" && <FfmChecker c={c} />}
      {tab === "sop" && <SopList c={c} />}
      {tab === "amend" && <AmendHelper c={c} />}
      {tab === "sql" && <SqlTemplates c={c} />}
    </div>
  );
}
