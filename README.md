# ServiceLog

ระบบบันทึกงานบริการ (Field Service Management PWA) ของทีม Service **บริษัท เมทเธียร์ จำกัด** พัฒนาและดูแลโดยทีมเอง

ใช้งานจริงที่ [serviceteam1.vercel.app](https://serviceteam1.vercel.app)

---

## ภาพรวม

ใช้บันทึกเคสงานบริการ ติดตามสถานะ ส่งต่องานระหว่างช่าง และรวมข้อมูลที่ทีมต้องใช้ทุกวันไว้ที่เดียว ได้แก่ ข้อมูลอุปกรณ์หน้างาน ใบเบิกของ สถิติหุ่นยนต์ทำความสะอาด และรายงานสถานะ Smart Pole / EV Car

ติดตั้งเป็นแอปบนมือถือได้ (PWA) มี Push Notification ผู้ใช้หลักคือทีมช่างภาคสนามประมาณ 7–20 คน

## Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 18 + Vite |
| ฐานข้อมูล | Firebase Firestore |
| ยืนยันตัวตน | Firebase Auth (อีเมล/รหัสผ่าน) |
| Hosting + Serverless | Vercel (`api/*.js`) |
| ผู้ช่วย AI | Google Gemini API (รุ่น Flash มีตัวสำรองอัตโนมัติ) |
| Push Notification | Web Push (VAPID) |
| ไฟล์เอกสาร | `xlsx`, `jszip`, `html2canvas` + `jspdf` |

> Firebase ใช้แพ็กเกจ Spark (ฟรี) จึงต้องระวังจำนวน read ต่อวัน หน้าที่ไม่ต้องอัปเดตสดใช้ `getDocs` แทน `onSnapshot` และหน้าที่เปิดเป็นครั้งคราวโหลดแบบ lazy

---

## โมดูล

**งานบริการ**

- **ภาพรวมเคส**: สร้าง แก้ไข อัปเดตความคืบหน้า ส่งต่องาน Checklist ก่อนออกหน้างาน แจ้งเตือนประกัน / สัญญาเช่า / เช่าซื้อใกล้หมด (30 และ 90 วัน)
- **Dashboard**: KPI สถิติรายโครงการ ประวัติการลบเคส สรุปเคสเป็น PDF
- **บันทึกการรับเคส**: เคสที่แก้ทางไกล เช่น ผ่าน LINE OA แยกจากเคสหลัก
- **ใบงาน (Work Order)**: เปิดใบงาน A4 สำหรับพิมพ์ / Export PDF
- **อุปกรณ์/รีโมท**: IP, AnyDesk, RustDesk, รุ่น, S/N ของทุกไซต์ นำเข้า/ส่งออก Excel รหัสผ่านซ่อนไว้จนกว่าจะกดดู
- **ใบเบิกของ**: กรอกในเว็บ ออกเป็น Excel ตามแบบฟอร์มบริษัท และ PDF (ฟอนต์ Angsana New พร้อมโลโก้)
- **Knowledge Hub**: คลังความรู้ของทีม มีแท็บเครื่องมือ WMS (ตรวจ FFM, SOP, SQL template)
- **ผู้ช่วย AI**: ถามเป็นภาษาไทยเรื่องเคส งานค้าง ประกันใกล้หมด อุปกรณ์ คำถามที่พบบ่อยตอบเองโดยไม่เรียก AI

**หุ่นยนต์ / Smart Pole**

- **รายงานสถานะอุปกรณ์**: รวม Smart Pole → EV Car → หุ่นยนต์ เป็นข้อความเดียว แยกกะเช้า/บ่าย คัดลอกส่ง LINE ได้ทันที ระบบจำสถานะและหมายเหตุของแต่ละไซต์ไว้ใช้วันถัดไป
- **สถิติหุ่นยนต์**: พื้นที่ทำความสะอาดรายวันจาก VIGGO ดูย้อนหลังได้ ดึงข้อมูลย้อนหลังของคันที่เป็น 0 (กรณีหน้างานเน็ตหลุด) ส่งยอดเข้า Google Sheet "Weekly สรุป" พร้อมทำตัวแดงช่องที่ต่ำกว่า Target และสร้างสไลด์สรุปรายสัปดาห์ (ตาราง + กราฟ) เป็น PNG สำหรับใส่ Canva
- **แจ้งเหตุ/แจ้งซ่อม**: เคสหุ่นยนต์ที่ลูกค้าแจ้งผ่าน LINE bot
- **Smart Pole**: จำนวนใบหน้า / VIP / Blacklist รายวันของทุกไซต์จาก Grafana

**เวลาทำงาน** (มีในระบบ ใช้ตามความจำเป็น)

- Onsite, บันทึก OT (หน้าปก OT และใบ OR), ใบลา, ตารางกะ, บอร์ดงาน

---

## โครงสร้างโปรเจกต์

```
├── api/                    Vercel Serverless Functions
│   ├── assistant.js        ผู้ช่วย AI (Gemini) — ต้องล็อกอิน
│   ├── smartpole.js        ดึงตัวเลข Smart Pole จาก Grafana — ต้องล็อกอิน
│   ├── imou.js             สถานะกล้องรถ EV จาก Imou — ต้องล็อกอิน
│   ├── robot-stats.js      สถิติหุ่นยนต์จาก VIGGO
│   ├── sheet-sync.js       ส่งยอด/อ่านตารางรายสัปดาห์จาก Google Sheet
│   ├── robot-issues-proxy.js  เคสแจ้งซ่อมจาก LINE bot
│   ├── generate-ot.js, generate-or.js  เอกสาร OT / OR
│   ├── send-notification.js   Push Notification
│   └── _*.js               ไลบรารีที่ฟังก์ชันอื่นใช้ร่วม (ไม่ใช่ endpoint)
├── public/                 ไฟล์สาธารณะ, sw.js, templates/ (แม่แบบใบเบิก + โลโก้)
├── src/                    ซอร์สโค้ดหน้าเว็บ
│   ├── Root.jsx            ตรวจ auth + สิทธิ์ ก่อนเข้าแอป
│   ├── App.jsx             หน้าหลัก + สลับหน้า
│   ├── *Page.jsx           หน้าต่าง ๆ
│   ├── statusReport.js     รูปแบบรายงานสถานะอุปกรณ์
│   ├── robotReport.js      รายงานหุ่นยนต์ประจำวัน
│   ├── weeklySlides.js     สไลด์รายสัปดาห์ + target ตั้งต้น
│   ├── theme.js            ชุดสี light/dark + ThemeContext
│   ├── components/         โมดอลและคอมโพเนนต์ร่วม
│   └── hooks/              useFirestore
├── firestore.rules         Security Rules (ต้องกด Publish ใน Firebase Console เอง)
└── vercel.json             ตั้งเวลาสูงสุดของ function ที่ใช้นาน
```

---

## สิทธิ์ผู้ใช้งาน

| Role | สิทธิ์ |
|---|---|
| `dev` | ทุกอย่าง รวมถึงจัดการสิทธิ์ระดับ dev |
| `admin` | จัดการผู้ใช้ อนุมัติ Onsite/ใบลา ดู Dashboard จัดการข้อมูลอุปกรณ์ แตะบัญชี dev ไม่ได้ |
| `user` | สร้าง/แก้เคส ส่งต่องาน ดูข้อมูลอุปกรณ์ สร้างใบเบิก บันทึก OT ยื่นใบลา |
| `pending` | สมัครแล้วรอ admin อนุมัติ ยังเข้าใช้งานไม่ได้ |
| `disabled` | ถูกระงับ เข้าระบบไม่ได้ แต่ข้อมูลยังอยู่ครบ |

สิทธิ์ถูกตรวจที่ฝั่งเซิร์ฟเวอร์ด้วย Firestore Security Rules (`firestore.rules`) และ API ที่เข้าถึงระบบภายนอก (AI, Grafana, Imou) ตรวจ Firebase ID token ทุกครั้ง

> การเอาผู้ใช้ออกจากระบบใช้วิธี "ระงับ" (`role: disabled`) ไม่ใช่ลบถาวร เพราะการลบ document ใน Firestore ไม่ได้ลบบัญชีใน Firebase Authentication อีเมลนั้นจะยังถูกจอง ถ้าต้องการปล่อยอีเมลจริง ๆ ต้องลบใน Firebase Console → Authentication

**ข้อมูลที่ผู้ช่วย AI ได้รับ:** ข้อมูลเคสและอุปกรณ์ที่เกี่ยวกับคำถาม แต่ไม่ได้รับรหัสผ่านอุปกรณ์ (ส่งแค่ว่ามีรหัสหรือไม่) ควรใช้ Gemini API แบบผูก Billing เพื่อให้ Google ไม่นำข้อมูลไปใช้พัฒนาโมเดล

---

## Firestore Collections

`users` `presence` `cases` `caseLogs` `deletedCases` `projects` `tasks`
`onsiteRecords` `otRecords` `otProfiles` `leaves`
`shifts` `shiftTypes` `userSchedules` `shiftMembers`
`partStandards` `partInspections` `devices` `requisitions` `settings`
`knowledge` `notifications` `fcmTokens`

แก้ Security Rules ที่ `firestore.rules` ใน repo แล้วคัดลอกไป Publish ที่ Firebase Console → Firestore Database → Rules

---

## Environment Variables (ตั้งใน Vercel)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin: ตรวจ token ผู้ใช้ใน API และส่งแจ้งเตือน |
| `ROBOT_API_TOKEN` | API ระบบหุ่นยนต์ VIGGO |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` (หรือ `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`) | อ่าน/เขียน Google Sheet |
| `GEMINI_API_KEY` | ผู้ช่วย AI |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | (ไม่บังคับ) เปลี่ยนรุ่นโมเดลหลัก/สำรอง |
| `GRAFANA_USER` / `GRAFANA_PASSWORD` / `GRAFANA_URL` | ดึงตัวเลข Smart Pole (`GRAFANA_URL` ไม่บังคับ) |
| `IMOU_APP_ID` / `IMOU_APP_SECRET` / `IMOU_BASE` | สถานะกล้องรถ EV (`IMOU_BASE` ไม่บังคับ) |
| `ROBOT_BOT_SERVICE_ACCOUNT_KEY_BASE64` / `LINE_CHANNEL_ACCESS_TOKEN` | อ่านเคสแจ้งซ่อมจากโปรเจกต์ LINE bot |

รหัสทั้งหมดเก็บใน Vercel เท่านั้น ไม่อยู่ในโค้ดและไม่ส่งลงเครื่องผู้ใช้ (Firebase web config ใน `src/firebase.js` เปิดเผยได้ตามการออกแบบของ Firebase และถูกคุมด้วย Security Rules)

---

## การพัฒนาและ Deploy

1. แก้โค้ดในสาขาใหม่ (branch) แล้วเปิด Pull Request เข้า `main` หรือแก้ผ่าน GitHub Web UI โดยตรง
2. merge เข้า `main` แล้ว Vercel build และ deploy อัตโนมัติ (ประมาณ 1 นาที)
3. ตรวจสถานะที่ Vercel → Deployments หรือสถานะ commit บน GitHub

**ข้อควรระวัง**

- ถ้าโค้ดผิดจน build พัง เว็บจะค้างอยู่ที่เวอร์ชันเดิม ควรเช็กสถานะ build ทุกครั้ง
- ไฟล์ใน `api/` ที่ขึ้นต้นด้วย `_` เป็นไลบรารี ไม่นับเป็น function ของ Vercel
- หลัง deploy ผู้ที่เปิดเว็บค้างไว้อาจเจอ "Failed to fetch dynamically imported module" ระบบรีโหลดหน้าให้เองอัตโนมัติ (`src/staleChunk.js`)
- แก้ `firestore.rules` แล้วต้องไป Publish ใน Firebase Console เอง ไม่ deploy อัตโนมัติ

---

## ธีมและสี

ชุดสีอยู่ที่ `src/theme.js` (`THEMES.light` / `THEMES.dark`) แจกผ่าน `ThemeContext`

```jsx
import { useTheme } from "./theme.js";

function MyPage() {
  const { c } = useTheme();
  return <button style={{ background: c.ink, color: c.onInk }}>บันทึก</button>;
}
```

- คีย์หลักที่ควรใช้: `bg` `card` `border` `borderSoft` `text900` `text500` `text400` และชุดสีกลาง `ink` (สีหลัก/ปุ่มหลัก) `onInk` (ตัวอักษรบนปุ่ม) `warn` `danger` `ok`
- คีย์สีเดิม `blue` `purple` `orange` `green` `amber` `red` `teal` ยังมีอยู่ ใช้กับกราฟหรือจุดที่ต้องการสีเฉพาะ
- ห้าม hardcode สีเข้มเป็นสีตัวอักษร เช่น `#1e293b` เพราะในโหมดมืดตรงกับสีพื้นการ์ด ตัวอักษรจะหายไป
- ใบงาน รายงาน ใบเบิก และสไลด์ที่ส่งออกเป็นพื้นขาวเสมอ ไม่ว่าจะอยู่โหมดไหน

---

## ผู้ดูแล

สายัญห์ คชรมย์ — khotcharoms@gmail.com
