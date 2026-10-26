// หลัง deploy เวอร์ชันใหม่ ไฟล์ย่อยของเวอร์ชันเก่า (ชื่อมี hash) ถูกลบจาก Vercel
// หน้าที่เปิดค้างไว้จะโหลดไฟล์ย่อยไม่ได้ ("Failed to fetch dynamically imported module")
// → รีเฟรชหน้า 1 ครั้งเพื่อโหลดเวอร์ชันใหม่ (URL #hash ยังอยู่ จึงกลับมาหน้าเดิม)
const KEY = "stale-chunk-reload-at";

export function isChunkError(e) {
  const m = String(e?.message || e || "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(m);
}

// คืนค่า true ถ้าสั่งรีเฟรชแล้ว (กันวนรีเฟรชซ้ำภายใน 30 วินาที)
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage ใช้ไม่ได้ก็รีเฟรชไปเลย */ }
  window.location.reload();
  return true;
}
