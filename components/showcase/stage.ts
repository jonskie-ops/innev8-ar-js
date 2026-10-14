import jsQR from "jsqr";
import QRCode from "qrcode";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { pad2 } from "@/lib/dom";
import { RARITY_LABEL, stationFromPayload, type Station } from "@/lib/hunt";
import { buildEmblem, RARITY_HEX } from "./emblem";
import { qrPose, type Pt } from "./pose";

export type Mode = "demo" | "camera";
export type Phase = "loading" | "scanning" | "found" | "rising" | "ready" | "collecting" | "collected";
export type CamState = "starting" | "on" | "denied" | "unavailable" | "insecure";

export type StageEvents = {
  onPhase: (phase: Phase, station: Station) => void;
  onCamera: (state: CamState | null) => void;
  onToast: (msg: string) => void;
  onLost: (lost: boolean) => void;
};

export type Stage = {
  setMode: (mode: Mode) => void;
  /** Demo mode: show this code on the card and play the sequence again. */
  setStation: (station: Station) => void;
  replay: () => void;
  dispose: () => void;
};

const EMBLEM_H = 1.5; // emblem height, in QR code side lengths
const HOVER = 0.95; // emblem centre above the code once risen
const DUR = { scan: 1.8, found: 0.75, rise: 2.1, collect: 1.25 };
const TARGET_Y = 0.8; // demo camera looks at the emblem's middle
const ELEVATION = 0.6; // demo camera's starting angle above the table (radians)
const SAMPLE_W = 480; // camera frames are downscaled to this width before decoding
const SCAN_MS = 90;
const SPARKS = 70;
const BURST = 110;
const PALETTE = [0x5fd8f5, 0x12bfea, 0xc9f4ff, 0x8fe9ff, 0xffffff];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);
const easeBack = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft round glow, for the halo and the card's shadow. */
const radial = (inner: string) =>
  canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, inner);
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });

/** The printed card players find: brand, a real scannable QR code, and its number. */
async function drawCard(g: CanvasRenderingContext2D, st: Station) {
  await document.fonts.load("800 40px Montserrat").catch(() => {});
  g.clearRect(0, 0, 680, 930);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(0, 0, 680, 930, 34);
  g.fill();
  g.textAlign = "center";
  g.fillStyle = "#030817";
  g.font = "800 34px Montserrat, sans-serif";
  g.fillText("INNEV8 QR CODE HUNT", 340, 112);
  g.fillStyle = `#${RARITY_HEX[st.rarity].toString(16).padStart(6, "0")}`;
  g.fillRect(250, 140, 180, 7);
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, `${location.origin}/?s=${st.code}`, {
    margin: 1,
    width: 500,
    errorCorrectionLevel: "M",
    color: { dark: "#030817", light: "#ffffff" },
  });
  g.drawImage(qr, 90, 190, 500, 500);
  g.fillStyle = "#030817";
  g.font = "800 38px Montserrat, sans-serif";
  g.fillText(`#${pad2(st.num)} ${st.name.toUpperCase()}`, 340, 778);
  g.fillStyle = "#4a5878";
  g.font = "500 27px ui-monospace, Menlo, Consolas, monospace";
  g.fillText(`${st.code} · ${RARITY_LABEL[st.rarity]}`, 340, 836);
}

/**
 * The 3D showcase. Demo mode: a virtual phone camera looks at a printed INNEV8 QR card on a table;
 * drag to look around. Camera mode: the real rear camera; the scanner finds the code's four corners,
 * works out its position and tilt (pose.ts) and anchors the same 3D scene onto the real card.
 * Either way: scan → lock on → the INNEV8 emblem rises out of the code → tap it to collect.
 */
export async function createStage(host: HTMLElement, video: HTMLVideoElement, ev: StageEvents): Promise<Stage> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "show__canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = env;
  const disposables: { dispose: () => void }[] = [pmrem, env];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x061033, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 5, 3);
  scene.add(sun);

  // ---- Demo world: a holographic table with the printed card on it
  const demoCam = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  const arCam = new THREE.PerspectiveCamera(60, 1, 0.01, 60);
  const demo = new THREE.Group();
  scene.add(demo);

  const tableTex = track(
    canvasTexture(1024, 1024, (g) => {
      g.fillStyle = "#061030";
      g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i <= 1024; i += 32) {
        g.fillStyle = i % 128 === 0 ? "rgba(18,191,234,0.16)" : "rgba(18,191,234,0.06)";
        g.fillRect(i, 0, 2, 1024);
        g.fillRect(0, i, 1024, 2);
      }
      const v = g.createRadialGradient(512, 512, 120, 512, 512, 560);
      v.addColorStop(0, "rgba(3,8,23,0)");
      v.addColorStop(1, "rgba(3,8,23,0.95)");
      g.fillStyle = v;
      g.fillRect(0, 0, 1024, 1024);
    }),
  );
  const table = new THREE.Mesh(
    track(new THREE.PlaneGeometry(12, 12)),
    track(new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.9, metalness: 0, envMapIntensity: 0.12 })),
  );
  table.rotation.x = -Math.PI / 2;
  demo.add(table);

  const yaw = new THREE.Group();
  yaw.rotation.y = 0.18;
  demo.add(yaw);
  const demoAnchor = new THREE.Group(); // the code's frame: x right, y to its top, z out of the card
  demoAnchor.rotation.x = -Math.PI / 2;
  demoAnchor.position.y = 0.004;
  yaw.add(demoAnchor);

  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = 680;
  cardCanvas.height = 930;
  const cardTex = track(new THREE.CanvasTexture(cardCanvas));
  cardTex.colorSpace = THREE.SRGBColorSpace;
  cardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const card = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.36, 1.86)),
    track(new THREE.MeshStandardMaterial({ map: cardTex, transparent: true, roughness: 0.7 })),
  );
  card.position.y = -0.05; // puts the QR square's centre on the anchor
  demoAnchor.add(card);
  const shadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.4, 2.9)),
    track(
      new THREE.MeshBasicMaterial({ map: track(radial("rgba(0,0,0,0.85)")), transparent: true, depthWrite: false }),
    ),
  );
  shadow.position.set(0.04, -0.1, -0.002);
  demoAnchor.add(shadow);

  // Drifting specks for some depth in the room
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    dustPos.set([(Math.random() - 0.5) * 10, Math.random() * 4, (Math.random() - 0.5) * 10], i * 3);
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    track(
      new THREE.PointsMaterial({
        color: 0x12bfea,
        size: 0.025,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  demo.add(dust);

  const controls = new OrbitControls(demoCam, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.3;
  controls.minAzimuthAngle = -1.2;
  controls.maxAzimuthAngle = 1.2;
  controls.target.set(0, TARGET_Y, 0);
  disposables.push(controls);

  // ---- Camera world: an anchor whose matrix follows the real code
  const arAnchor = new THREE.Group();
  arAnchor.matrixAutoUpdate = false;
  scene.add(arAnchor);

  // ---- The effect, attached to whichever anchor is live
  const fx = new THREE.Group();
  const glowMat = (opacity = 0) =>
    track(
      new THREE.MeshBasicMaterial({
        color: RARITY_HEX.common,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );

  const bracketMat = glowMat();
  const brackets = new THREE.Group();
  const barH = track(new THREE.PlaneGeometry(0.2, 0.03));
  const barV = track(new THREE.PlaneGeometry(0.03, 0.2));
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const h = new THREE.Mesh(barH, bracketMat);
    h.position.set(sx * 0.47, sy * 0.565, 0.004);
    const v = new THREE.Mesh(barV, bracketMat);
    v.position.set(sx * 0.565, sy * 0.47, 0.004);
    brackets.add(h, v);
  }
  fx.add(brackets);

  const ringGeo = track(new THREE.RingGeometry(0.6, 0.64, 72));
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(ringGeo, glowMat());
    m.position.z = 0.003;
    fx.add(m);
    return m;
  });

  const up = new THREE.Group(); // y: the emblem's "up"
  fx.add(up);

  const gradTex = track(
    canvasTexture(4, 256, (g) => {
      const l = g.createLinearGradient(0, 0, 0, 256);
      l.addColorStop(0, "#000");
      l.addColorStop(0.55, "#333");
      l.addColorStop(1, "#fff");
      g.fillStyle = l;
      g.fillRect(0, 0, 4, 256);
    }),
  );
  const columnGeo = track(new THREE.CylinderGeometry(0.44, 0.56, 2.6, 56, 1, true));
  columnGeo.translate(0, 1.3, 0);
  const columnMat = glowMat();
  columnMat.alphaMap = gradTex;
  const column = new THREE.Mesh(columnGeo, columnMat);
  up.add(column);

  const halo = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: track(radial("rgba(255,255,255,1)")),
        color: RARITY_HEX.common,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  halo.position.y = HOVER;
  halo.scale.setScalar(2.4);
  up.add(halo);

  const holder = new THREE.Group();
  holder.position.y = HOVER;
  up.add(holder);
  const emblem = await buildEmblem(EMBLEM_H);
  disposables.push(emblem);
  holder.add(emblem.root);

  const glow = new THREE.PointLight(RARITY_HEX.common, 0, 6);
  glow.position.set(0, HOVER, 0.9);
  up.add(glow);

  const hit = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.9, 16, 12)),
    track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
  );
  hit.position.y = HOVER;
  up.add(hit);

  // Pixel sparks rising through the beam, and a burst of pixels when it's collected
  const sparkGeo = track(new THREE.BufferGeometry());
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  const sparkSpeed = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.42;
    sparkPos.set([Math.cos(a) * r, Math.random() * 2.4, Math.sin(a) * r], i * 3);
    new THREE.Color(PALETTE[i % PALETTE.length]).toArray(sparkCol, i * 3);
    sparkSpeed[i] = 0.25 + Math.random() * 0.6;
  }
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const pointsMat = () =>
    track(
      new THREE.PointsMaterial({
        size: 0.045,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
  const sparks = new THREE.Points(sparkGeo, pointsMat());
  up.add(sparks);

  const burstGeo = track(new THREE.BufferGeometry());
  const burstPos = new Float32Array(BURST * 3);
  const burstCol = new Float32Array(BURST * 3);
  const burstVel = new Float32Array(BURST * 3);
  for (let i = 0; i < BURST; i++) new THREE.Color(PALETTE[i % PALETTE.length]).toArray(burstCol, i * 3);
  burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute("color", new THREE.BufferAttribute(burstCol, 3));
  const burstMat = pointsMat();
  burstMat.size = 0.06;
  const burst = new THREE.Points(burstGeo, burstMat);
  up.add(burst);
  let burstAt = -1;

  // ---- State
  let mode: Mode = "demo";
  let station: Station | null = null;
  let phase: Phase = "loading";
  let t0 = 0;
  let now = 0;
  const go = (p: Phase) => {
    phase = p;
    t0 = now;
    if (station) ev.onPhase(p, station);
  };

  const applyRarity = () => {
    if (!station) return;
    const c = RARITY_HEX[station.rarity];
    emblem.setRarity(station.rarity);
    for (const m of [bracketMat, columnMat, ...rings.map((r) => r.material as THREE.MeshBasicMaterial)]) m.color.set(c);
    (halo.material as THREE.SpriteMaterial).color.set(c);
    glow.color.set(c);
  };

  /** Back to "scanning": everything hidden, the emblem broken up into its scattered pixels. */
  const reset = () => {
    bracketMat.opacity = 0;
    brackets.scale.setScalar(1.6);
    columnMat.opacity = 0;
    column.scale.y = 0.001;
    rings.forEach((r) => ((r.material as THREE.MeshBasicMaterial).opacity = 0));
    (halo.material as THREE.SpriteMaterial).opacity = 0;
    halo.scale.setScalar(2.4);
    glow.intensity = 0;
    holder.rotation.set(0, 0, 0);
    holder.position.y = HOVER;
    holder.scale.setScalar(1);
    emblem.solid.visible = false;
    for (const p of emblem.pixels) p.mesh.visible = false;
    (sparks.material as THREE.PointsMaterial).opacity = 0;
    burstMat.opacity = 0;
    burstAt = -1;
    go("scanning");
  };

  /** Table: the emblem rises out of the code. Wall: it floats upright in front of the code. */
  const setLayout = (onTable: boolean) => {
    if (onTable) {
      up.rotation.set(Math.PI / 2, 0, 0);
      up.position.set(0, 0, 0);
      up.scale.setScalar(1);
    } else {
      up.rotation.set(0, 0, 0);
      up.scale.setScalar(0.75);
      up.position.set(0, -HOVER * 0.75, 0.3);
    }
    column.visible = onTable;
  };

  // ---- Sizing
  let fitDist = 4;
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    for (const cam of [demoCam, arCam]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    // Keep about 2.9 units in view across the screen's width: the card plus room around the emblem.
    demoCam.fov = w < h ? 56 : 42;
    demoCam.updateProjectionMatrix();
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(demoCam.fov / 2)) * demoCam.aspect);
    const d = Math.max(3.4, 1.45 / Math.tan(half));
    controls.minDistance = d * 0.55;
    controls.maxDistance = d * 1.35;
    const dir = demoCam.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, Math.sin(ELEVATION), Math.cos(ELEVATION));
    demoCam.position.copy(controls.target).add(dir.setLength(dir.length() * (d / fitDist) || d));
    fitDist = d;
  };
  demoCam.position.set(0, TARGET_Y + Math.sin(ELEVATION) * 4, Math.cos(ELEVATION) * 4);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ---- Camera mode
  let stream: MediaStream | undefined;
  let camOn = false;
  let lastScan = 0;
  let lastSeen = -10;
  let lost = false;
  let hasPose = false;
  const target = new THREE.Matrix4();
  const tp = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  const ts = new THREE.Vector3();
  const cp = new THREE.Vector3();
  const cq = new THREE.Quaternion();
  const sampler = document.createElement("canvas");
  const sctx = sampler.getContext("2d", { willReadFrequently: true })!;
  const toasted = new Map<string, number>();
  const toastOnce = (key: string, msg: string) => {
    if (now - (toasted.get(key) ?? -99) < 3) return;
    toasted.set(key, now);
    ev.onToast(msg);
  };

  const startCamera = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      ev.onCamera(window.isSecureContext ? "unavailable" : "insecure");
      return;
    }
    ev.onCamera("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (mode !== "camera") return s.getTracks().forEach((t) => t.stop());
      stream = s;
      video.srcObject = s;
      await video.play().catch(() => {});
      camOn = true;
      ev.onCamera("on");
    } catch (e) {
      ev.onCamera(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };
  const stopCamera = () => {
    camOn = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
    video.srcObject = null;
  };

  const scanFrame = () => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || video.readyState < 2) return;
    const k = Math.min(1, SAMPLE_W / vw);
    const w = Math.round(vw * k);
    const h = Math.round(vh * k);
    if (sampler.width !== w || sampler.height !== h) {
      sampler.width = w;
      sampler.height = h;
    }
    sctx.drawImage(video, 0, 0, w, h);
    const qr = jsQR(sctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
    if (!qr) return;
    const found = stationFromPayload(qr.data);
    if (!found) return toastOnce("?", "That's not an INNEV8 QR code.");

    // Sampled frame → video pixels → screen pixels (the video covers the screen, object-fit: cover).
    const W = host.clientWidth;
    const H = host.clientHeight;
    const cover = Math.max(W / vw, H / vh);
    const ox = (W - vw * cover) / 2;
    const oy = (H - vh * cover) / 2;
    const map = (p: Pt): Pt => ({ x: (p.x / k) * cover + ox, y: (p.y / k) * cover + oy });
    const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = qr.location;
    // Phone rear cameras see roughly 65–70° across their long side.
    const f = 0.76 * Math.max(vw, vh) * cover;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(H / 2 / f));
    if (Math.abs(arCam.fov - fov) > 0.01) {
      arCam.fov = fov;
      arCam.updateProjectionMatrix();
    }
    const m = qrPose([a, b, c, d].map(map), f, W / 2, H / 2);
    if (!m) return;
    target.fromArray(m);
    lastSeen = now;

    if (phase === "scanning") {
      station = found;
      applyRarity();
      // The code's outward normal pointing up the screen means it's lying flat (on a table or floor).
      setLayout(m[9] > 0.5);
      arAnchor.matrix.copy(target);
      arAnchor.matrixWorldNeedsUpdate = true;
      hasPose = true;
      go("found");
    }
  };

  // ---- Tap to collect
  const ray = new THREE.Raycaster();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e: PointerEvent) => {
    if (!down || phase !== "ready") return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 10 || performance.now() - down.t > 600) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
      mode === "demo" ? demoCam : arCam,
    );
    if (ray.intersectObject(hit).length) {
      navigator.vibrate?.([20, 40, 80]);
      go("collecting");
    }
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  // ---- Frame loop
  let lastTime = -1;
  const tick = (time: number) => {
    const dt = lastTime < 0 ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    now += dt;
    const e = now - t0;

    if (mode === "camera" && camOn && now - lastScan > SCAN_MS / 1000) {
      lastScan = now;
      scanFrame();
    }
    if (mode === "camera" && hasPose) {
      // Ease toward the latest detection: the scanner reports ~10×/s, the screen draws ~60×/s.
      target.decompose(tp, tq, ts);
      arAnchor.matrix.decompose(cp, cq, ts);
      const a = 1 - Math.pow(0.0005, dt);
      cp.lerp(tp, a);
      cq.slerp(tq, a);
      arAnchor.matrix.compose(cp, cq, ts.set(1, 1, 1));
      arAnchor.matrixWorldNeedsUpdate = true;
      const isLost = now - lastSeen > 0.7 && (phase === "found" || phase === "rising" || phase === "ready");
      if (isLost !== lost) ev.onLost((lost = isLost));
    }

    switch (phase) {
      case "scanning":
        if (mode === "demo" && e > DUR.scan) go("found");
        break;
      case "found":
        if (e > DUR.found) go("rising");
        break;
      case "rising":
        if (e > DUR.rise) go("ready");
        break;
      case "collecting":
        if (e > DUR.collect + 0.45) go("collected");
        break;
    }
    const pe = now - t0;

    // Lock-on brackets snap in on "found" and stay
    if (phase !== "scanning" && phase !== "loading") {
      const k = phase === "found" ? easeOut(pe / 0.45) : 1;
      brackets.scale.setScalar(1.6 - 0.6 * k);
      bracketMat.opacity = phase === "collected" ? Math.max(0, bracketMat.opacity - dt) : 0.95 * k;
    }

    const live = phase === "rising" || phase === "ready" || phase === "collecting";
    if (phase === "rising") {
      columnMat.opacity = 0.42 * easeOut(pe / 0.5);
      column.scale.y = Math.max(0.001, easeOut(pe / 0.8));
      (halo.material as THREE.SpriteMaterial).opacity = 0.5 * easeOut((pe - 0.4) / 0.7);
      glow.intensity = 9 * easeOut((pe - 0.3) / 0.8);
      for (const p of emblem.pixels) {
        const k = easeOut((pe - 0.2 - p.delay) / 0.8);
        p.mesh.visible = k > 0;
        p.mesh.position.lerpVectors(p.from, p.home, k);
        p.mesh.scale.setScalar(0.3 + 0.7 * k);
      }
      const s = easeBack((pe - 0.7) / 0.9);
      emblem.solid.visible = s > 0.001;
      emblem.solid.scale.setScalar(Math.max(0.001, s));
      holder.rotation.y = -1.6 * (1 - easeOut(pe / DUR.rise));
    }
    if (phase === "ready") {
      holder.rotation.y += dt * 0.9;
      holder.position.y = HOVER + Math.sin(now * 2.1) * 0.045;
    }
    if (phase === "collecting") {
      holder.rotation.y += dt * (0.9 + 16 * easeIn(pe / 0.85));
      holder.position.y = HOVER + 0.9 * easeIn(pe / 1.05);
      holder.scale.setScalar(Math.max(0.001, 1 - easeIn((pe - 0.55) / 0.5)));
      columnMat.opacity = 0.42 * (1 - easeOut(pe / 0.9));
      if (pe > 0.95 && burstAt < 0) {
        burstAt = now;
        for (let i = 0; i < BURST; i++) {
          burstPos.set([0, holder.position.y, 0], i * 3);
          const v = new THREE.Vector3().randomDirection().multiplyScalar(0.8 + Math.random() * 1.6);
          burstVel.set([v.x, v.y, v.z], i * 3);
        }
        burstGeo.attributes.position.needsUpdate = true;
        halo.scale.setScalar(4.5);
        (halo.material as THREE.SpriteMaterial).opacity = 1;
      }
    }
    if (burstAt >= 0) {
      const be = now - burstAt;
      burstMat.opacity = Math.max(0, 1 - be / 1.1);
      for (let i = 0; i < BURST * 3; i++) {
        burstPos[i] += burstVel[i] * dt;
        burstVel[i] *= 0.95;
      }
      burstGeo.attributes.position.needsUpdate = true;
      const hm = halo.material as THREE.SpriteMaterial;
      hm.opacity = Math.max(0, hm.opacity - dt * 1.8);
      glow.intensity = Math.max(0, glow.intensity - dt * 14);
    }

    // Rings pulse out from the code while the emblem is up
    rings.forEach((r, i) => {
      const k = (now * 0.55 + i * 0.5) % 1;
      r.scale.setScalar(1 + 1.3 * k);
      (r.material as THREE.MeshBasicMaterial).opacity = live && phase !== "collecting" ? 0.55 * (1 - k) : 0;
    });
    const sm = sparks.material as THREE.PointsMaterial;
    sm.opacity = live ? Math.min(0.9, sm.opacity + dt * 1.5) : Math.max(0, sm.opacity - dt * 2);
    if (sm.opacity > 0) {
      for (let i = 0; i < SPARKS; i++) {
        const y = sparkPos[i * 3 + 1] + sparkSpeed[i] * dt;
        sparkPos[i * 3 + 1] = y > 2.4 ? 0 : y;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    if (mode === "demo") {
      dust.rotation.y += dt * 0.02;
      controls.update();
      renderer.render(scene, demoCam);
    } else {
      renderer.render(scene, arCam);
    }
  };
  renderer.setAnimationLoop(tick);

  // ---- Modes
  const setStation = async (st: Station) => {
    station = st;
    applyRarity();
    await drawCard(cardCanvas.getContext("2d")!, st);
    cardTex.needsUpdate = true;
    if (mode === "demo") reset();
  };

  const enterDemo = () => {
    stopCamera();
    ev.onCamera(null);
    demo.visible = true;
    arAnchor.visible = false;
    controls.enabled = true;
    demoAnchor.add(fx);
    setLayout(true);
    scene.background = new THREE.Color(0x030817);
    scene.fog = new THREE.Fog(0x030817, 5, 12);
    if (station) {
      void drawCard(cardCanvas.getContext("2d")!, station).then(() => (cardTex.needsUpdate = true));
      applyRarity();
    }
    reset();
  };
  const enterCamera = () => {
    demo.visible = false;
    arAnchor.visible = true;
    controls.enabled = false;
    arAnchor.add(fx);
    scene.background = null;
    scene.fog = null;
    hasPose = false;
    lastSeen = -10;
    reset();
    void startCamera();
  };
  const setMode = (m: Mode) => {
    if (m === mode) return;
    mode = m;
    if (m === "demo") enterDemo();
    else enterCamera();
  };
  enterDemo();

  return {
    setMode,
    setStation: (st) => void setStation(st),
    replay: () => {
      if (mode === "camera") hasPose = false;
      reset();
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      stopCamera();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
