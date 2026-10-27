// ไอคอนเส้นเรียบ (แทนอีโมจิ) — สีตามตัวอักษร (currentColor)
const PATHS = {
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  board: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M9 12h6M9 16h4",
  bell: "M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Zm-8 4a2 2 0 0 0 4 0",
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  inbox: "M4 4h16v16H4zM4 14h4l2 3h4l2-3h4",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h10",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  box: "M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10",
  chat: "M4 5h16v11H9l-5 4V5Z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4m6-4v4",
  leave: "M9 4h6M8 4h8v16H8zM11 9h2M10 13h4",
};
export default function Icon({ name, size = 16, stroke = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
      <path d={PATHS[name]} />
    </svg>
  );
}
