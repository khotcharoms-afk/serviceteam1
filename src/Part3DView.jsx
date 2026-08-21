import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const STATUS_COLOR = {
  ok: "#16a34a",
  warning: "#d97706",
  critical: "#dc2626",
};
const IDLE_COLOR = "#cbd5e1";

function colorFor(status) {
  return STATUS_COLOR[status] || IDLE_COLOR;
}

const LEGEND_FIELDS = [
  { key: "diameter", label: "วงแหวนนอก · เส้นผ่านศูนย์กลาง" },
  { key: "thickness", label: "วงแหวนใน · ความหนา" },
  { key: "gainX", label: "แท่ง X · Gain X" },
  { key: "gainY", label: "แท่ง Z · Gain Y" },
];

export default function Part3DView({ results = {}, overallStatus }) {
  const mountRef = useRef(null);
  const matsRef = useRef(null);

  // Init scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 300;
    const height = mount.clientHeight || 260;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(3.4, 2.6, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 8;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    const group = new THREE.Group();
    scene.add(group);

    // Main body — color = overall status
    const bodyGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.55, 48);
    const bodyMat = new THREE.MeshStandardMaterial({ color: IDLE_COLOR, roughness: 0.45, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Outer ring — diameter status
    const outerRingGeo = new THREE.TorusGeometry(1.4, 0.07, 16, 60);
    const outerRingMat = new THREE.MeshStandardMaterial({ color: IDLE_COLOR, roughness: 0.4 });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    group.add(outerRing);

    // Inner rim — thickness status
    const rimGeo = new THREE.TorusGeometry(0.95, 0.06, 16, 60);
    const rimMat = new THREE.MeshStandardMaterial({ color: IDLE_COLOR, roughness: 0.4 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.29;
    group.add(rim);

    // gainX indicator bar
    const gxGeo = new THREE.BoxGeometry(0.55, 0.16, 0.16);
    const gxMat = new THREE.MeshStandardMaterial({ color: IDLE_COLOR, roughness: 0.4 });
    const gx = new THREE.Mesh(gxGeo, gxMat);
    gx.position.set(1.0, 0.35, 0);
    group.add(gx);

    // gainY indicator bar
    const gyGeo = new THREE.BoxGeometry(0.16, 0.16, 0.55);
    const gyMat = new THREE.MeshStandardMaterial({ color: IDLE_COLOR, roughness: 0.4 });
    const gy = new THREE.Mesh(gyGeo, gyMat);
    gy.position.set(0, 0.35, 1.0);
    group.add(gy);

    matsRef.current = { bodyMat, outerRingMat, rimMat, gxMat, gyMat };

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      group.rotation.y += 0.0025;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      [bodyGeo, outerRingGeo, rimGeo, gxGeo, gyGeo].forEach(g => g.dispose());
      [bodyMat, outerRingMat, rimMat, gxMat, gyMat].forEach(m => m.dispose());
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      matsRef.current = null;
    };
  }, []);

  // Update colors live as results/overallStatus change (no re-mount)
  useEffect(() => {
    const mats = matsRef.current;
    if (!mats) return;
    mats.bodyMat.color.set(overallStatus ? colorFor(overallStatus) : IDLE_COLOR);
    mats.outerRingMat.color.set(colorFor(results.diameter?.status));
    mats.rimMat.color.set(colorFor(results.thickness?.status));
    mats.gxMat.color.set(colorFor(results.gainX?.status));
    mats.gyMat.color.set(colorFor(results.gainY?.status));
  }, [results, overallStatus]);

  return (
    <div>
      <div ref={mountRef} style={{
        width: "100%", height: 260, borderRadius: 12,
        background: "linear-gradient(180deg,#f8fafc,#f1f5f9)",
        border: "1px solid #e2e8f0", overflow: "hidden", cursor: "grab", touchAction: "none",
      }} />
      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", margin: "6px 0 10px" }}>
        ลาก/หมุนดูโมเดลได้ · สีเปลี่ยนตามค่าที่วัด
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 10 }}>
        {LEGEND_FIELDS.map(f => {
          const r = results[f.key];
          const color = r?.status ? colorFor(r.status) : IDLE_COLOR;
          return (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
              <span>{f.label}{r?.diff != null ? ` (${r.diff.toFixed(1)}%)` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
