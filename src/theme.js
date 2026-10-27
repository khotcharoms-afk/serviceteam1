import { createContext, useContext } from 'react';

export const THEMES = {
  light: {
    bg: '#f8fafc', card: '#fff', border: '#e2e8f0', borderSoft: '#f1f5f9',
    text900: '#0f172a', text500: '#64748b', text400: '#94a3b8',
    blue: '#2563eb', purple: '#6B21A8', orange: '#F97316',
    green: '#16a34a', amber: '#f59e0b', red: '#ef4444', teal: '#0f766e',
    // ชุดสีกลาง (โทนเรียบ): ปุ่มหลักใช้ ink พื้น/ตัวอักษรบนปุ่มใช้ onInk; สีเตือนใช้ warn/danger
    ink: '#0f172a', onInk: '#ffffff', warn: '#b45309', danger: '#b91c1c', ok: '#15803d',
  },
  dark: {
    bg: '#0f172a', card: '#1e293b', border: '#334155', borderSoft: '#293548',
    text900: '#f1f5f9', text500: '#cbd5e1', text400: '#94a3b8',
    blue: '#60a5fa', purple: '#c4b5fd', orange: '#fb923c',
    green: '#4ade80', amber: '#fbbf24', red: '#f87171', teal: '#2dd4bf',
    ink: '#f1f5f9', onInk: '#0f172a', warn: '#fbbf24', danger: '#f87171', ok: '#4ade80',
  },
};

export const ThemeContext = createContext({ dark: false, c: THEMES.light });
export function useTheme() { return useContext(ThemeContext); }
