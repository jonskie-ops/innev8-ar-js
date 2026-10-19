import QRCode from "qrcode";
import * as THREE from "three";
import type { Rarity, Station } from "@/lib/hunt";
import { sponsorOf } from "@/lib/sponsors";

export const RARITY_HEX: Record<Rarity, number> = { common: 0x12bfea, rare: 0x20c9bc, legendary: 0xd6b56d };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);

/** Shared by every code: one unit cube, scaled per module. */
const CUBE = new THREE.BoxGeometry(1, 1, 1);

export type Qr3d = {
  /** Faces +z, about 1.2 units across. */
  root: THREE.Group;
  /** Invisible sphere used for taps. */
  hit: THREE.Mesh;
  /**
   * Pose every module. `assemble` 0→1 flies the scattered blocks into place, `t` drives the idle
   * ripple, `implode` 0→1 pulls everything into the centre for the collect.
   */
  update: (assemble: number, t: number, implode: number) => void;
  dispose: () => void;
};

/** Square ring (outer minus inner) as a flat shape, centred on the origin. */
function ring(outer: number, inner: number, r = 0) {
  const s = new THREE.Shape();
  const o = outer / 2;
  if (r > 0) {
    s.moveTo(-o + r, -o);
    s.lineTo(o - r, -o);
    s.quadraticCurveTo(o, -o, o, -o + r);
    s.lineTo(o, o - r);
    s.quadraticCurveTo(o, o, o - r, o);
    s.lineTo(-o + r, o);
    s.quadraticCurveTo(-o, o, -o, o - r);
    s.lineTo(-o, -o + r);
    s.quadraticCurveTo(-o, -o, -o + r, -o);
  } else {
    s.moveTo(-o, -o);
    s.lineTo(o, -o);
    s.lineTo(o, o);
    s.lineTo(-o, o);
  }
  if (inner > 0) {
    const i = inner / 2;
    const h = new THREE.Path();
    h.moveTo(-i, -i);
    h.lineTo(-i, i);
    h.lineTo(i, i);
    h.lineTo(i, -i);
    s.holes.push(h);
  }
  return s;
}

/**
 * A QR code built in 3D: each dark module is a glowing block standing on a glass plate, the three
 * corner "eyes" are solid rings in the code's rarity colour, and a bright frame runs round the edge.
 * The pattern is generated from the code's value, so every one of the 10 looks different. Its
 * sponsor's logo sits in a circle on the top-right corner.
 */
export function buildQr3d(station: Station): Qr3d {
  const tint = new THREE.Color(RARITY_HEX[station.rarity]);
  const qr = QRCode.create(`INNEV8 ${station.code}`, { errorCorrectionLevel: "L" });
  const n = qr.modules.size;
  const cell = 1 / n;
  const at = (i: number) => (i + 0.5) * cell - 0.5; // module index → position
  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  const root = new THREE.Group();
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x);

  // Glass plate and glowing frame
  const plate = new THREE.Mesh(
    own(new THREE.ExtrudeGeometry(ring(1.16, 0, 0.08), { depth: 0.03, bevelEnabled: false })),
    own(
      new THREE.MeshPhysicalMaterial({
        color: 0x0a1a4d,
        metalness: 0.4,
        roughness: 0.2,
        clearcoat: 1,
        transparent: true,
        opacity: 0.72,
        emissive: 0x061033,
      }),
    ),
  );
  plate.position.z = -0.03;
  root.add(plate);
  const frameMat = own(new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 1.4 }));
  const frame = new THREE.Mesh(
    own(new THREE.ExtrudeGeometry(ring(1.22, 1.14, 0.1), { depth: 0.05, bevelEnabled: false })),
    frameMat,
  );
  frame.position.z = -0.035;
  root.add(frame);

  // Corner eyes: a 7×7 ring and a 3×3 block, raised a little higher than the modules
  const eyeMat = own(
    new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.25 }),
  );
  const eyeRing = own(new THREE.ExtrudeGeometry(ring(7 * cell, 5 * cell), { depth: cell * 1.3, bevelEnabled: false }));
  const eyeDot = own(new THREE.BoxGeometry(3 * cell, 3 * cell, cell * 1.6));
  eyeDot.translate(0, 0, cell * 0.8);
  const eyes = new THREE.Group();
  for (const [r, c] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]) {
    const eye = new THREE.Group();
    eye.position.set(at(c + 3), -at(r + 3), 0);
    eye.add(new THREE.Mesh(eyeRing, eyeMat), new THREE.Mesh(eyeDot, eyeMat));
    eyes.add(eye);
  }
  root.add(eyes);

  // The sponsor's logo in a circle on the top-right corner, like a sticker, ringed in the rarity
  // colour. A plain white disc until the logo has loaded.
  const sponsor = sponsorOf(station.sponsor);
  let badge: THREE.Group | null = null;
  if (sponsor) {
    const R = 0.17;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(128, 128, 128, 0, Math.PI * 2);
    g.fill();
    const tex = own(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const logo = new Image();
    logo.onload = () => {
      g.drawImage(logo, 0, 0, 256, 256);
      tex.needsUpdate = true;
    };
    logo.src = sponsor.badge;
    badge = new THREE.Group();
    const face = new THREE.Mesh(own(new THREE.CircleGeometry(R, 48)), own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
    const rim = new THREE.Mesh(own(new THREE.RingGeometry(R * 0.98, R * 1.14, 48)), own(new THREE.MeshBasicMaterial({ color: tint, toneMapped: false })));
    rim.position.z = -0.002;
    badge.add(rim, face);
    badge.position.set(0.58, 0.58, 0.13);
    root.add(badge);
  }

  // Modules: one instanced mesh, each block with its own spot, scatter point and timing
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c) && !inEye(r, c)) cells.push([r, c]);
  const count = cells.length;
  const modMat = own(
    new THREE.MeshStandardMaterial({ color: 0xf2fbff, emissive: tint, emissiveIntensity: 0.32, metalness: 0.2, roughness: 0.3 }),
  );
  const modules = new THREE.InstancedMesh(CUBE, modMat, count);
  modules.frustumCulled = false;
  root.add(modules);
  const home = new Float32Array(count * 2);
  const from = new Float32Array(count * 3);
  const spin = new Float32Array(count * 2);
  const delay = new Float32Array(count);
  const wave = new Float32Array(count);
  cells.forEach(([r, c], i) => {
    const x = at(c);
    const y = -at(r);
    home.set([x, y], i * 2);
    const d = Math.hypot(x, y);
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 1.6);
    from.set([x + v.x, y + v.y, Math.abs(v.z) + 0.4], i * 3);
    spin.set([(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8], i * 2);
    delay[i] = d * 0.9 + Math.random() * 0.2; // centre first, out to the edges
    wave[i] = d * 9;
  });
  const dummy = new THREE.Object3D();
  const size = cell * 0.84;

  const update = (assemble: number, t: number, implode: number) => {
    for (let i = 0; i < count; i++) {
      const a = easeOut((assemble * 1.75 - delay[i]) / 0.7);
      const hx = home[i * 2];
      const hy = home[i * 2 + 1];
      const lift = a * (0.5 + 0.5 * Math.sin(t * 2.6 - wave[i])) * cell * 0.9; // ripple outward
      let x = from[i * 3] + (hx - from[i * 3]) * a;
      let y = from[i * 3 + 1] + (hy - from[i * 3 + 1]) * a;
      let z = from[i * 3 + 2] * (1 - a) + size / 2 + lift;
      let s = size * (0.25 + 0.75 * a);
      if (implode > 0) {
        const m = easeIn(implode * 1.3 - delay[i] * 0.3);
        x *= 1 - m;
        y *= 1 - m;
        z += m * 0.35;
        s *= 1 - m * 0.9;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(spin[i * 2] * (1 - a), spin[i * 2 + 1] * (1 - a), 0);
      dummy.scale.set(s, s, size + lift * 1.6);
      dummy.updateMatrix();
      modules.setMatrixAt(i, dummy.matrix);
    }
    modules.instanceMatrix.needsUpdate = true;

    const e = easeOut((assemble - 0.55) / 0.45) * (1 - easeIn(implode * 1.4));
    eyes.scale.setScalar(Math.max(0.001, e));
    const p = easeOut(assemble / 0.6) * (1 - easeIn(implode * 1.6));
    plate.scale.setScalar(Math.max(0.001, p));
    frame.scale.setScalar(Math.max(0.001, p));
    frameMat.emissiveIntensity = 1.4 + 0.6 * Math.sin(t * 3);
    badge?.scale.setScalar(Math.max(0.001, e)); // on with the eyes, once the code has built
  };

  const hit = new THREE.Mesh(
    own(new THREE.SphereGeometry(0.85, 16, 12)),
    own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
  );
  root.add(hit);

  update(0, 0, 0);
  return { root, hit, update, dispose: () => owned.forEach((o) => o.dispose()) };
}
