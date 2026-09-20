# ServiceLog

ระบบบันทึกการเซอร์วิสโครงการ (Field Service Management PWA) สำหรับทีมเซอร์วิสของ **บริษัท เมทเธียร์ จำกัด**

ใช้งานจริงที่ → [serviceteam1.vercel.app](https://serviceteam1.vercel.app)

---

## ภาพรวม

ใช้บันทึกงานเซอร์วิส ติดตามสถานะ ส่งต่องานระหว่างช่าง และดูสรุปผลงาน รองรับการติดตั้งเป็นแอปบนมือถือ (PWA) พร้อม Push Notification

ผู้ใช้งานหลักคือทีมช่างภาคสนาม ~7–20 คน

## Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React + Vite |
| ฐานข้อมูล | Firebase Firestore |
| ยืนยันตัวตน | Firebase Auth (email/password) |
| Hosting + Serverless | Vercel |
| Push Notification | Web Push (VAPID) ผ่าน `web-push` |
| ไฟล์เอกสาร | `xlsx`, `docx`, `jszip` |

> Firebase ใช้แพ็กเกจ **Spark (ฟรี)** จึงต้องระวังจำนวน read ต่อวัน — โค้ดหลายจุดจงใจใช้ `getDocs` แทน `onSnapshot` เพื่อลด read

---

## โครงสร้างโปรเจกต์

```
├── api/                 Vercel Serverless Functions (proxy หุ่นยนต์, sheet sync)
├── public/              ไฟล์สาธารณะ + sw.js (service worker)
├── src/                 ซอร์สโค้ดหลัก
│   ├── Root.jsx         ตรวจ auth + สิทธิ์ ก่อนเข้าแอป
│   ├── App.jsx          หน้าหลัก + สลับหน้าภายใน
│   ├── Auth.jsx         เข้าสู่ระบบ / สมัครสมาชิก
│   ├── theme.js         ชุดสี light/dark + ThemeContext
│   ├── utils.js         ค่าคงที่และฟังก์ชันร่วม (รวม IS() สำหรับช่องกรอก)
│   ├── firebase.js      ตั้งค่า Firebase
│   ├── hooks/           useFirestore
│   └── components/      โมดอลต่าง ๆ
├── index.html
├── vite.config.js
└── package.json
```

## โมดูล

**ใช้งานประจำ**

- **บันทึกเคส** — สร้าง / แก้ไข / อัปเดตความคืบหน้า / ส่งต่องาน พร้อม Checklist ก่อนออกหน้างาน
- **Dashboard** — KPI, สถิติรายโครงการ, ประวัติการลบเคส, สรุปเคสเป็น PDF
- **สถิติหุ่นยนต์** — ดึงข้อมูลการทำงานของหุ่นยนต์ทำความสะอาด เทียบเป้าหมาย และเปิดเคสให้เครื่องที่ไม่ได้ทำงานได้จากหน้านี้
- **ใบงาน (Work Order)** — เปิดใบงาน A4 ในแท็บใหม่ สำหรับพิมพ์ / Export PDF
- **Knowledge Hub** — คลังความรู้ของทีม

**มีในระบบ แต่ยังไม่ได้ใช้เต็มที่**

- บันทึก Onsite (คำนวณค่าใช้จ่าย + ขออนุมัติ)
- บันทึก OT (Export Excel หน้าปก OT และใบ OR)
- ใบลา, ตารางกะ, บอร์ดงาน

---

## สิทธิ์ผู้ใช้งาน

| Role | สิทธิ์ |
|---|---|
| `dev` | ทุกอย่าง รวมถึงจัดการสิทธิ์ระดับ dev |
| `admin` | จัดการผู้ใช้ อนุมัติ Onsite/ใบลา ดู Dashboard — แตะบัญชี dev ไม่ได้ |
| `user` | สร้าง/แก้เคส ส่งต่องาน ลงตารางกะ บันทึก OT ยื่นใบลา |
| `pending` | สมัครแล้วรอ admin อนุมัติ ยังเข้าใช้งานไม่ได้ |
| `disabled` | ถูกระงับ เข้าระบบไม่ได้ แต่ข้อมูลยังอยู่ครบ |

> **การเอาผู้ใช้ออกจากระบบใช้วิธี "ระงับ" (`role: disabled`) ไม่ใช่ลบถาวร**
> เพราะการลบ document ใน Firestore ไม่ได้ลบบัญชีใน Firebase Authentication อีเมลนั้นจะยังถูกจองและนำกลับมาสมัครใหม่ไม่ได้ หากต้องการปล่อยอีเมลจริง ๆ ต้องลบใน Firebase Console → Authentication

---

## Firestore Collections

`users` `cases` `projects` `deletedCases` `notifications` `presence`
`onsiteRecords` `otRecords` `otProfiles` `leaves`
`shifts` `shiftTypes` `userSchedules` `shiftMembers`
`tasks` `knowledge` `fcmTokens`

Security Rules แก้ที่ Firebase Console → Firestore Database → Rules

---

## Environment Variables (ตั้งใน Vercel)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `ROBOT_API_TOKEN` | เรียก API ระบบจัดการหุ่นยนต์ |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | เขียนข้อมูลลง Google Sheet |

*(ชื่อตัวแปรอาจต่างจากนี้ — ตรวจกับค่าจริงที่ Vercel → Settings → Environment Variables)*

---

## การพัฒนาและ Deploy

โปรเจกต์นี้ **ไม่มี local dev environment** — แก้โค้ดผ่าน GitHub Web UI โดยตรง

1. เปิดไฟล์ที่ต้องการแก้ใน GitHub → กดไอคอนดินสอ
2. วางโค้ดใหม่ → Commit changes
3. Vercel build และ deploy อัตโนมัติ (~1 นาที)
4. ตรวจผลที่ Vercel → Deployments

**ข้อควรระวัง:** ไม่มีการตรวจ syntax ก่อน commit — ถ้าโค้ดผิด build จะพังและเว็บจะค้างอยู่ที่เวอร์ชันเดิม **ควรเช็คสถานะ build ทุกครั้งหลัง commit**

หน้าที่เปิดเป็นครั้งคราวถูกโหลดแบบ lazy (`React.lazy`) และไลบรารี `xlsx` โหลดตอนกด Export/Import เท่านั้น เพื่อให้ไฟล์ที่ต้องดาวน์โหลดตอนเข้าแอปครั้งแรกเล็กลง

---

## Dark Mode

ชุดสีอยู่ที่ `src/theme.js` (`THEMES.light` / `THEMES.dark`) แจกผ่าน `ThemeContext`

```jsx
import { useTheme } from "./theme.js";

function MyPage() {
  const { c } = useTheme();
  return <div style={{ background: c.bg, color: c.text900 }}>...</div>;
}
```

คีย์สีที่มี: `bg` `card` `border` `borderSoft` `text900` `text500` `text400` `blue` `purple` `orange` `green` `amber` `red`
สีพื้นอ่อนแบบ badge ใช้ hex-alpha ต่อท้าย เช่น `` `${c.green}22` ``

ข้อควรรู้:

- ช่อง `input` / `select` / `textarea` ที่ใช้ `IS()` จาก `utils.js` เปลี่ยนสีตามธีมให้เอง ไม่ต้องกำหนดสีซ้ำ
- **ห้าม hardcode สีเข้มเป็นสีตัวอักษร** เช่น `#1e293b` เพราะตรงกับสีพื้นหลังการ์ดในโหมดมืดพอดี ตัวอักษรจะหายไปทั้งหมด
- `App.jsx` ตั้ง CSS `color-scheme` ตามธีม เพื่อให้ป๊อปอัปของ `<select>` และปฏิทินของ `<input type="date">` เป็นโทนเดียวกับแอป
- ใบงานและรายงานที่พิมพ์ออกมาเป็นพื้นขาวเสมอ ไม่ว่าจะอยู่โหมดไหน
- หน้าที่ยังไม่ได้แปลง: OnsitePage, OTPage, ShiftCalendar, LeavePage, KnowledgeHub, AdminUsers, ProfilePage, TaskBoard

---

## เอกสาร

คู่มือการใช้งานสำหรับผู้ใช้ทั่วไป: `ServiceLog_คู่มือ_v2.6.docx`

---

## ผู้ดูแล

สายัญห์ คชรมย์ — khotcharoms@gmail.com
