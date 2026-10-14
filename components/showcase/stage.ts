import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { STATIONS, type Station } from "@/lib/hunt";
import { buildQr3d, RARITY_HEX, type Qr3d } from "./qr3d";

export type CamState = "starting" | "on" | "denied" | "unavailable" | "insecure";
export type Phase = "intro" | "searching" | "found" | "ready" | "collecting" | "collected" | "done";

/** Where the hidden codes are, relative to where the phone points. */
export type Guide = {
  /** Horizontal angle to each code still hidden, in radians: 0 straight ahead, positive to the right. */
  blips: number[];
  /** Which way to move toward the closest one; null when it's in view. */
  turn: "left" | "right" | "up" | "down" | null;
  /** True when the phone's motion sensors steer the view; false means drag to look. */
  sensors: boolean;
};

export type StageEvents = {
  onPhase: (phase: Phase, station: Station | null, found: number, total: number) => void;
  onCamera: (state: CamState | null) => void;
  onGuide: (guide: Guide | null) => void;
};

export type Stage = {
  /** Call from a tap: asks for motion and camera access, then starts the hunt. */
  start: () => void;
  /** Hide a fresh set of codes around you. */
  scatter: () => void;
  /** After a collect: back to searching (or "done" when none are left). */
  next: () => void;
  dispose: () => void;
};

const COUNT = 3; // codes hidden per round
const DIST = 3.2; // how far away they sit
const AIM_S = 0.45; // hold a code in the frame this long to reveal it
const REVEAL_S = 1.6;
const COLLECT_S = 1.25;
const FLOOR_Y = -1.5;
const BURST = 120;
const PALETTE = [0x5fd8f5, 0x12bfea, 0xc9f4ff, 0x8fe9ff, 0xffffff];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);
const deg = THREE.MathUtils.degToRad;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Hidden = { station: Station; qr: Qr3d; spot: THREE.Group; sway: THREE.Group; shimmer: THREE.Points; got: boolean };

/**
 * AR test for the hunt's virtual QR codes. A few 3D QR codes are hidden at fixed directions around
 * the player; with motion sensors they stay put in the room as the phone turns (like Pokémon GO's AR),
 * otherwise drag to look. Each is invisible until the camera is held on its spot, then it assembles,
 * and a tap collects it. Over the camera feed when there is one, in a virtual room when there isn't.
 */
export async function createStage(host: HTMLElement, video: HTMLVideoElement, ev: StageEvents): Promise<Stage> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "show__canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  const pmrem = track(new THREE.PMREMGenerator(renderer));
  const room = new RoomEnvironment();
  scene.environment = track(pmrem.fromScene(room, 0.04).texture);
  room.dispose();
  scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x061033, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(2, 5, 3);
  scene.add(sun);

  const cam = new THREE.PerspectiveCamera(62, 1, 0.05, 80);
  cam.rotation.order = "YXZ";

  // ---- Virtual room, shown when there's no camera feed
  const virtual = new THREE.Group();
  scene.add(virtual);
  const gridTex = track(
    canvasTexture(1024, 1024, (g) => {
      g.fillStyle = "#061030";
      g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i <= 1024; i += 32) {
        g.fillStyle = i % 128 === 0 ? "rgba(18,191,234,0.2)" : "rgba(18,191,234,0.07)";
        g.fillRect(i, 0, 2, 1024);
        g.fillRect(0, i, 1024, 2);
      }
      const v = g.createRadialGradient(512, 512, 100, 512, 512, 540);
      v.addColorStop(0, "rgba(3,8,23,0)");
      v.addColorStop(1, "rgba(3,8,23,0.95)");
      g.fillStyle = v;
      g.fillRect(0, 0, 1024, 1024);
    }),
  );
  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(16, 16)),
    track(new THREE.MeshBasicMaterial({ map: gridTex })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  virtual.add(floor);
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 7;
    dustPos.set([Math.cos(a) * r, FLOOR_Y + Math.random() * 4.5, Math.sin(a) * r], i * 3);
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    track(
      new THREE.PointsMaterial({
        color: 0x12bfea,
        size: 0.03,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    ),
  );
  virtual.add(dust);
  const showVirtual = (on: boolean) => {
    virtual.visible = on;
    scene.background = on ? new THREE.Color(0x030817) : null;
    scene.fog = on ? new THREE.Fog(0x030817, 6, 15) : null;
  };
  showVirtual(true);

  // ---- Effects around the code being revealed: halo, pulse rings, collect burst
  const fx = new THREE.Group();
  scene.add(fx);
  const glowTex = track(
    canvasTexture(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, "rgba(255,255,255,1)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }),
  );
  const haloMat = track(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  const halo = new THREE.Sprite(haloMat);
  halo.position.z = -0.15;
  fx.add(halo);
  const ringGeo = track(new THREE.RingGeometry(0.9, 0.94, 4, 1, Math.PI / 4)); // a square ring, like the code
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(
      ringGeo,
      track(
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
    m.position.z = -0.05;
    fx.add(m);
    return m;
  });
  const glow = new THREE.PointLight(0x12bfea, 0, 5);
  glow.position.set(0, 0, 1);
  fx.add(glow);
  const burstGeo = track(new THREE.BufferGeometry());
  const burstPos = new Float32Array(BURST * 3);
  const burstCol = new Float32Array(BURST * 3);
  const burstVel = new Float32Array(BURST * 3);
  for (let i = 0; i < BURST; i++) new THREE.Color(PALETTE[i % PALETTE.length]).toArray(burstCol, i * 3);
  burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute("color", new THREE.BufferAttribute(burstCol, 3));
  const burstMat = track(
    new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  fx.add(new THREE.Points(burstGeo, burstMat));
  let burstAt = -1;

  const shimmerGeo = track(new THREE.BufferGeometry());
  const shimmerPos = new Float32Array(14 * 3);
  for (let i = 0; i < 14; i++) shimmerPos.set([(Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, 0], i * 3);
  shimmerGeo.setAttribute("position", new THREE.BufferAttribute(shimmerPos, 3));
  const shimmerMat = track(
    new THREE.PointsMaterial({
      color: 0xc9f4ff,
      size: 0.05,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );

  // ---- The hidden codes
  let codes: Hidden[] = [];
  let active: Hidden | null = null;
  let phase: Phase = "intro";
  let t0 = 0;
  let now = 0;
  const foundCount = () => codes.filter((c) => c.got).length;
  const go = (p: Phase) => {
    phase = p;
    t0 = now;
    ev.onPhase(p, active?.station ?? null, foundCount(), codes.length);
  };

  const heading = () => {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    return Math.atan2(-f.x, -f.z);
  };

  const scatter = () => {
    for (const c of codes) {
      c.spot.removeFromParent();
      c.qr.dispose();
    }
    const picks = [...STATIONS].sort(() => Math.random() - 0.5).slice(0, COUNT);
    // Spread them round the room, the nearest at least ~45° from where the phone points now.
    const base = heading() + deg(45 + Math.random() * 30) * (Math.random() < 0.5 ? 1 : -1);
    codes = picks.map((station, i) => {
      const yaw = base + (i * Math.PI * 2) / COUNT + deg((Math.random() - 0.5) * 40);
      const pitch = deg(-14 + Math.random() * 22);
      const spot = new THREE.Group();
      spot.position.set(
        -Math.sin(yaw) * Math.cos(pitch) * DIST,
        Math.sin(pitch) * DIST,
        -Math.cos(yaw) * Math.cos(pitch) * DIST,
      );
      spot.lookAt(0, spot.position.y * 0.6, 0); // face the player, standing roughly upright
      const sway = new THREE.Group();
      sway.scale.setScalar(0.72);
      spot.add(sway);
      const qr = buildQr3d(station);
      qr.root.visible = false;
      sway.add(qr.root);
      const shimmer = new THREE.Points(shimmerGeo, shimmerMat);
      spot.add(shimmer);
      scene.add(spot);
      return { station, qr, spot, sway, shimmer, got: false };
    });
    active = null;
    aimFor = 0;
    if (phase !== "intro") go("searching");
  };

  // ---- Looking around: motion sensors, or drag
  let sensors = false;
  const sensorQ = new THREE.Quaternion();
  const zee = new THREE.Vector3(0, 0, 1);
  const qBack = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2); // the camera looks out the back of the phone
  const qScreen = new THREE.Quaternion();
  const oe = new THREE.Euler();
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    oe.set(deg(e.beta), deg(e.alpha), -deg(e.gamma), "YXZ");
    sensorQ.setFromEuler(oe).multiply(qBack).multiply(qScreen.setFromAxisAngle(zee, -deg(screen.orientation?.angle ?? 0)));
    if (!sensors) {
      sensors = true;
      cam.quaternion.copy(sensorQ);
      if (foundCount() === 0 && !active) scatter(); // re-place around the real heading
    }
  };
  let listening = false;
  const listenSensors = () => {
    if (listening) return;
    listening = true;
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DOE?.requestPermission) {
      DOE.requestPermission()
        .then((r) => r === "granted" && addEventListener("deviceorientation", onOrient))
        .catch(() => {});
    } else addEventListener("deviceorientation", onOrient);
  };
  const look = { yaw: 0, pitch: -0.08 };

  // ---- Camera feed
  let stream: MediaStream | undefined;
  let camOn = false;
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
      stream = s;
      video.srcObject = s;
      await video.play().catch(() => {});
      camOn = true;
      showVirtual(false);
      ev.onCamera("on");
    } catch (e) {
      ev.onCamera(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  // ---- Sizing
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ---- Pointer: drag to look (without sensors), tap to collect
  const ray = new THREE.Raycaster();
  let down: { x: number; y: number; t: number; lx: number; ly: number } | null = null;
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    if (!down || sensors) return;
    look.yaw += (e.clientX - down.lx) * 0.005;
    look.pitch = THREE.MathUtils.clamp(look.pitch + (e.clientY - down.ly) * 0.005, -1.2, 1.2);
    down.lx = e.clientX;
    down.ly = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    if (!d || phase !== "ready" || !active) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 600) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
      cam,
    );
    if (ray.intersectObject(active.qr.hit).length) {
      navigator.vibrate?.([20, 40, 80]);
      go("collecting");
    }
  };
  const el = renderer.domElement;
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);

  // ---- Frame loop
  let aimFor = 0;
  let guideAt = -1;
  let lastTurn: Guide["turn"] | undefined;
  const v = new THREE.Vector3();
  let lastTime = -1;

  const guide = () => {
    const blips: number[] = [];
    let best: { a: number; ndc: THREE.Vector3; ahead: boolean } | null = null;
    for (const c of codes) {
      if (c.got) continue;
      v.copy(c.spot.position).applyMatrix4(cam.matrixWorldInverse);
      const a = Math.atan2(v.x, -v.z);
      blips.push(a);
      if (!best || Math.abs(a) < Math.abs(best.a)) {
        best = { a, ndc: c.spot.position.clone().project(cam), ahead: v.z < 0 };
      }
    }
    let turn: Guide["turn"] = null;
    if (best) {
      if (!best.ahead || Math.abs(best.a) > deg(22)) turn = best.a > 0 ? "right" : "left";
      else if (best.ndc.y < -0.45) turn = "down";
      else if (best.ndc.y > 0.45) turn = "up";
    }
    if (turn !== lastTurn || now - guideAt > 0.1) {
      guideAt = now;
      lastTurn = turn;
      ev.onGuide({ blips, turn, sensors });
    }
  };

  const tick = (time: number) => {
    const dt = lastTime < 0 ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    now += dt;

    // Point the virtual camera the way the phone points
    if (sensors) cam.quaternion.slerp(sensorQ, 1 - Math.pow(1e-5, dt));
    else cam.quaternion.setFromEuler(oe.set(look.pitch, look.yaw, 0, "YXZ"));
    if (camOn && video.videoWidth) {
      // Match the phone camera's field of view (~65–70° across the long side) so codes stay put on screen.
      const W = host.clientWidth;
      const H = host.clientHeight;
      const cover = Math.max(W / video.videoWidth, H / video.videoHeight);
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(H / 2 / (0.76 * Math.max(video.videoWidth, video.videoHeight) * cover)));
      if (Math.abs(cam.fov - fov) > 0.05) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
    cam.updateMatrixWorld();

    const pe = now - t0;
    if (phase === "searching") {
      guide();
      // Is a hidden code held inside the scan frame?
      let aimed: Hidden | null = null;
      for (const c of codes) {
        if (c.got) continue;
        v.copy(c.spot.position).applyMatrix4(cam.matrixWorldInverse);
        const ndc = c.spot.position.clone().project(cam);
        const inView = v.z < 0 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1;
        // A faint shimmer gives it away once it's on screen
        c.shimmer.visible = inView;
        if (v.z < 0 && Math.abs(ndc.x) < 0.3 && Math.abs(ndc.y) < 0.22) aimed = c;
      }
      shimmerMat.opacity = 0.25 + 0.25 * Math.sin(now * 9);
      aimFor = aimed ? aimFor + dt : 0;
      if (aimed && aimFor > AIM_S) {
        active = aimed;
        aimFor = 0;
        for (const c of codes) c.shimmer.visible = false;
        active.qr.root.visible = true;
        active.spot.add(fx);
        const tint = RARITY_HEX[active.station.rarity];
        haloMat.color.set(tint);
        glow.color.set(tint);
        rings.forEach((r) => (r.material as THREE.MeshBasicMaterial).color.set(tint));
        ev.onGuide(null);
        lastTurn = undefined;
        go("found");
      }
    }

    if (active) {
      const { qr, sway } = active;
      if (phase === "found") {
        qr.update(clamp01(pe / REVEAL_S), now, 0);
        haloMat.opacity = 0.7 * easeOut(pe / 0.5) * (1 - 0.4 * easeOut((pe - 0.6) / 0.8));
        halo.scale.setScalar(1.6 + 1.4 * easeOut(pe / 0.6));
        glow.intensity = 6 * easeOut(pe / 0.6);
        sway.rotation.y = -1.4 * (1 - easeOut(pe / REVEAL_S));
        if (pe > REVEAL_S) go("ready");
      } else if (phase === "ready") {
        qr.update(1, now, 0);
        sway.rotation.y = Math.sin(now * 0.9) * 0.45;
        sway.position.y = Math.sin(now * 1.8) * 0.05;
        haloMat.opacity = 0.42 + 0.08 * Math.sin(now * 3);
      } else if (phase === "collecting") {
        qr.update(1, now, clamp01(pe / 0.9));
        sway.rotation.y += dt * (2 + 14 * easeIn(pe / 0.8));
        if (pe > 0.85 && burstAt < 0) {
          burstAt = now;
          for (let i = 0; i < BURST; i++) {
            burstPos.set([0, 0, 0.3], i * 3);
            const b = new THREE.Vector3().randomDirection().multiplyScalar(0.9 + Math.random() * 1.8);
            burstVel.set([b.x, b.y, b.z], i * 3);
          }
          halo.scale.setScalar(4.2);
          haloMat.opacity = 1;
        }
        if (pe > COLLECT_S) {
          active.got = true;
          qr.root.visible = false;
          go("collected");
        }
      }
      const live = phase === "found" || phase === "ready";
      rings.forEach((r, i) => {
        const k = (now * 0.6 + i * 0.5) % 1;
        r.scale.setScalar(1 + 0.9 * k);
        (r.material as THREE.MeshBasicMaterial).opacity = live ? 0.5 * (1 - k) : 0;
      });
    }
    if (burstAt >= 0) {
      const be = now - burstAt;
      burstMat.opacity = Math.max(0, 1 - be / 1.1);
      for (let i = 0; i < BURST * 3; i++) {
        burstPos[i] += burstVel[i] * dt;
        burstVel[i] *= 0.95;
      }
      burstGeo.attributes.position.needsUpdate = true;
      haloMat.opacity = Math.max(0, haloMat.opacity - dt * 1.8);
      glow.intensity = Math.max(0, glow.intensity - dt * 10);
      if (be > 1.2) burstAt = -1;
    }

    dust.rotation.y += dt * 0.015;
    renderer.render(scene, cam);
  };
  renderer.setAnimationLoop(tick);

  scatter();

  return {
    start: () => {
      if (phase !== "intro") return;
      listenSensors(); // first, while still inside the tap (iPhone asks for permission here)
      void startCamera();
      go("searching");
    },
    scatter,
    next: () => {
      if (phase !== "collected") return;
      active?.spot.remove(fx);
      active = null;
      go(codes.every((c) => c.got) ? "done" : "searching");
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      removeEventListener("deviceorientation", onOrient);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      for (const c of codes) c.qr.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
