import { createContext, useContext } from 'react';

export const THEMES = {
  // โทน shadcn/ui: เทากลาง (zinc) ทั้งแอป + สีเน้นเดียว (blue = accent) ใช้เฉพาะสิ่งสำคัญที่สุดบนจอ
  // ink = ปุ่มหลัก/ตัวที่เลือกอยู่ (เกือบดำในโหมดสว่าง เกือบขาวในโหมดมืด) ตัวอักษรบนปุ่มใช้ onInk
  light: {
    bg: '#fafafa', card: '#ffffff', border: '#e4e4e7', borderSoft: '#f4f4f5',
    text900: '#09090b', text500: '#52525b', text400: '#a1a1aa',
    blue: '#2563eb', purple: '#7c3aed', orange: '#ea580c',
    green: '#16a34a', amber: '#d97706', red: '#dc2626', teal: '#0f766e',
    ink: '#18181b', onInk: '#fafafa', accent: '#2563eb', onAccent: '#ffffff',
    warn: '#b45309', danger: '#dc2626', ok: '#15803d',
  },
  dark: {
    bg: '#09090b', card: '#111113', border: '#27272a', borderSoft: '#1c1c1f',
    text900: '#fafafa', text500: '#a1a1aa', text400: '#71717a',
    blue: '#60a5fa', purple: '#a78bfa', orange: '#fb923c',
    green: '#4ade80', amber: '#fbbf24', red: '#f87171', teal: '#2dd4bf',
    ink: '#fafafa', onInk: '#18181b', accent: '#3b82f6', onAccent: '#ffffff',
    warn: '#fbbf24', danger: '#f87171', ok: '#4ade80',
  },
};

export const ThemeContext = createContext({ dark: false, c: THEMES.light });
export function useTheme() { return useContext(ThemeContext); }

// ระบบขนาด (ใช้ค่าในชุดนี้เท่านั้น)
export const SPACE = { 1:4, 2:8, 3:12, 4:16, 6:24, 8:32, 12:48, 16:64 };
export const RADIUS = { sm:6, md:8, lg:12 };
