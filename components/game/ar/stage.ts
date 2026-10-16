import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Station } from "@/lib/hunt";
import { createZoomTracker } from "./flow";
import { buildQr3d, RARITY_HEX, type Qr3d } from "./qr3d";

export type CamState = "starting" | "on" | "denied" | "unavailable" | "insecure";
export type ArPhase = "searching" | "found" | "ready" | "collecting" | "done";

/** Where the hidden codes are, relative to where the phone points. */
export type Guide = {
  /**
   * Each code still hidden: horizontal angle in radians (0 straight ahead, positive to the right),
   * and whether it's the one the player chose to look for.
   */
  blips: { angle: number; target: boolean }[];
  /** Which way to move toward the chosen code (or the closest one); null when it's in view. */
  turn: "left" | "right" | "up" | "down" | null;
  /** True when the phone's motion sensors steer the view; false means drag to look. */
  sensors: boolean;
};

export type ArEvents = {
  onPhase: (phase: ArPhase, station: Station | null) => void;
  onCamera: (state: CamState) => void;
  onGuide: (guide: Guide | null) => void;
  /** Fired once the collect animation has played. */
  onCollect: (station: Station) => void;
  /** Full movement tracking (WebXR) is running, or is available but needs a tap to start. */
  onXr: (state: "on" | "offer" | null) => void;
  /** The phone ended the AR session itself (e.g. the back button). */
  onEnd: () => void;
  /** While searching: a hidden code is (or is no longer) on screen. */
  onNear?: (near: boolean) => void;
};

export type ArStage = {
  /** Start full movement tracking; call from a tap. */
  startXr: () => void;
  /**
   * The code the player wants to find (or none). If it isn't hidden around them yet, it's hidden now
   * (the codes are placed again, while still searching). The guide points to it.
   */
  setTarget: (station: Station | undefined) => void;
  dispose: () => void;
};

const DIST = 3.2; // how far away the codes sit
const SIZE = 1.05; // code scale: about 1.3 units across, most of a phone screen's width
// With WebXR the units are real metres and the phone's movement is tracked: each code is a ~60 cm
// panel 2 m away, so it grows as you walk up to it and shrinks as you back away.
const XR_DIST = 2;
const XR_SIZE = 0.5;
// Without WebXR, walking is read from the camera feed (./flow) and moves the virtual camera.
const NEAR = 0.9; // the closest you can get to a code
const ROAM = 10; // how far you can wander from where the scanner opened
const STEP_MAX = 0.35; // the most the camera moves in one frame
const AIM_S = 0.45; // hold a code in the frame this long to reveal it
// The reveal zone, in screen units (-1…1 across): about the inside of the scan frame. The arrows use
// the same edges, so "hold still" always means the code is in the zone.
const AIM_X = 0.5;
const AIM_Y = 0.24;
const NEAR_OUT = 1.3; // "near" starts when a hidden code is on screen and ends once it's this far out
const REVEAL_S = 1.6;
const COLLECT_S = 1.25;
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
 * The scanner's AR layer. On phones with WebXR AR (Android Chrome with ARCore) the phone's movement is
 * tracked, so the hidden codes are fixed in the room: walk away and they shrink, walk up and they grow.
 * Elsewhere they sit at fixed directions around the player; motion sensors keep them put as the phone
 * turns (like Pokémon GO's AR), otherwise drag to look. Walking is read from the camera picture: as
 * it zooms out (backing away) the codes shrink with the room, as it zooms in they grow.
 * Each is invisible until the camera is held on its spot, then it assembles into a 3D QR code, and a
 * tap collects it. Drawn over the camera feed, or on a plain dark background when there's no camera.
 * There's no set order: whichever code is revealed and tapped first is the one collected. `target` is
 * the code the player chose to look for, if any; the guide points to it, but it's hidden like the rest.
 */
export async function createArStage(
  host: HTMLElement,
  video: HTMLVideoElement,
  /** The scanner's root element: stays on screen over the AR view (WebXR DOM overlay). */
  overlay: HTMLElement,
  hide: Station[],
  target: Station | undefined,
  ev: ArEvents,
): Promise<ArStage> {
  let hidden = hide;
  let wanted = target;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "scan__canvas";
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

  // ---- Virtual room, shown when there's no camera feed: plain dark space with faint drifting specks
  // (no floor), so turning still shows movement
  const virtual = new THREE.Group();
  scene.add(virtual);
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 7;
    dustPos.set([Math.cos(a) * r, -1.5 + Math.random() * 4.5, Math.sin(a) * r], i * 3);
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
          side: THREE.DoubleSide,
          fog: false,
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
  let phase: ArPhase = "searching";
  let t0 = 0;
  let now = 0;
  let aimFor = 0;
  const go = (p: ArPhase) => {
    phase = p;
    t0 = now;
    if (p !== "searching") setNear(false);
    ev.onPhase(p, active?.station ?? null);
  };
  let near = false;
  const setNear = (next: boolean) => {
    if (next === near) return;
    near = next;
    ev.onNear?.(near);
  };

  const heading = () => {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    return Math.atan2(-f.x, -f.z);
  };

  let xr = false; // WebXR session running: real movement tracking, real distances
  const place = () => {
    for (const c of codes) {
      c.spot.removeFromParent();
      c.qr.dispose();
    }
    const n = hidden.length;
    const dist = xr ? XR_DIST : DIST;
    const size = xr ? XR_SIZE : SIZE;
    fx.scale.setScalar(size / 0.72); // the halo, rings and burst were sized for a 0.72-scale code
    const c0 = cam.position;
    // Spread round the room in a random order, the nearest at least ~45° from where the phone points.
    const base = heading() + deg(45 + Math.random() * 30) * (Math.random() < 0.5 ? 1 : -1);
    const slots = hidden.map((_, i) => i).sort(() => Math.random() - 0.5);
    codes = hidden.map((station, i) => {
      const yaw = base + (slots[i] * Math.PI * 2) / n + deg((Math.random() - 0.5) * 40);
      const pitch = deg(-14 + Math.random() * 22);
      const spot = new THREE.Group();
      spot.position.set(
        c0.x - Math.sin(yaw) * Math.cos(pitch) * dist,
        c0.y + Math.sin(pitch) * dist,
        c0.z - Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      spot.lookAt(c0.x, c0.y + (spot.position.y - c0.y) * 0.6, c0.z); // face the player, roughly upright
      const sway = new THREE.Group();
      sway.scale.setScalar(size);
      spot.add(sway);
      const qr = buildQr3d(station);
      qr.root.visible = false;
      sway.add(qr.root);
      const shimmer = new THREE.Points(shimmerGeo, shimmerMat);
      spot.add(shimmer);
      scene.add(spot);
      return { station, qr, spot, sway, shimmer, got: false };
    });
    aimFor = 0;
  };

  // ---- Looking around: motion sensors (permission is asked by the Scan tap), or drag
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
      if (!active) place(); // re-place around the phone's real heading
    }
  };
  addEventListener("deviceorientation", onOrient);
  const look = { yaw: 0, pitch: -0.08 };

  // ---- Camera feed
  let stream: MediaStream | undefined;
  let camOn = false;
  const zoom = createZoomTracker(renderer, video);
  let disposed = false;
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
      if (disposed) return s.getTracks().forEach((t) => t.stop());
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

  const stopCamera = () => {
    camOn = false;
    zoom.reset();
    stream?.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
    stream = undefined;
  };

  // ---- Sizing
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h || renderer.xr.isPresenting) return;
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
    if (ray.intersectObject(active.qr.hit).length) collect();
  };
  const collect = () => {
    navigator.vibrate?.([20, 40, 80]);
    go("collecting");
  };
  // In WebXR a screen tap arrives as a "select" along a ray from the phone
  const tapRay = renderer.xr.getController(0);
  scene.add(tapRay);
  const rot = new THREE.Matrix4();
  tapRay.addEventListener("select", () => {
    if (!xr || phase !== "ready" || !active) return;
    rot.identity().extractRotation(tapRay.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(tapRay.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(rot);
    if (ray.intersectObject(active.qr.hit).length) collect();
  });
  // Taps on the scanner's own buttons shouldn't also count as AR taps
  const noXrSelect = (e: Event) => {
    if ((e.target as Element | null)?.closest?.("button, a")) e.preventDefault();
  };
  overlay.addEventListener("beforexrselect", noXrSelect);
  const el = renderer.domElement;
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);

  // ---- Frame loop
  let guideAt = -1;
  let lastTurn: Guide["turn"] | undefined;
  const v = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  let lastTime = -1;

  const guide = () => {
    const blips: Guide["blips"] = [];
    let best: { a: number; x: number; y: number; ahead: boolean; target: boolean } | null = null;
    for (const c of codes) {
      if (c.got) continue;
      v.copy(c.spot.position).applyMatrix4(cam.matrixWorldInverse);
      const a = Math.atan2(v.x, -v.z);
      const isTarget = c.station === wanted;
      blips.push({ angle: a, target: isTarget });
      // Point to the chosen code; without one, to whichever is closest.
      if (!best || (isTarget && !best.target) || (isTarget === best.target && Math.abs(a) < Math.abs(best.a))) {
        ndc.copy(c.spot.position).project(cam);
        best = { a, x: ndc.x, y: ndc.y, ahead: v.z < 0, target: isTarget };
      }
    }
    let turn: Guide["turn"] = null;
    if (best) {
      if (!best.ahead || Math.abs(best.x) >= AIM_X) turn = best.a > 0 ? "right" : "left";
      else if (best.y <= -AIM_Y) turn = "down";
      else if (best.y >= AIM_Y) turn = "up";
    }
    if (turn !== lastTurn || now - guideAt > 0.1) {
      guideAt = now;
      lastTurn = turn;
      ev.onGuide({ blips, turn, sensors: sensors || xr });
    }
  };

  // Walking without WebXR: the picture zoomed by `s`, so move toward (or away from) what the phone
  // points at by as much as that takes. Its distance is the code nearest the middle of the screen,
  // or the usual one, so whatever's on screen shrinks and grows with the room behind it.
  const ahead = new THREE.Vector3();
  const walk = (s: number) => {
    ahead.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0);
    if (ahead.lengthSq() < 0.09) return; // pointing at the floor or the ceiling: no way to tell
    ahead.normalize();
    let depth = DIST;
    let best = Infinity;
    for (const c of codes) {
      if (c.got) continue;
      v.copy(c.spot.position).applyMatrix4(cam.matrixWorldInverse);
      ndc.copy(c.spot.position).project(cam);
      const off = Math.hypot(ndc.x, ndc.y);
      if (v.z < 0 && off < 1 && off < best) {
        best = off;
        depth = -v.z;
      }
    }
    const d = Math.min(THREE.MathUtils.clamp(depth * (1 - 1 / s), -STEP_MAX, STEP_MAX), depth - NEAR);
    cam.position.addScaledVector(ahead, d).clampLength(0, ROAM);
  };

  const tick = (time: number) => {
    const dt = lastTime < 0 ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    now += dt;

    // Point the virtual camera the way the phone points (and, with WebXR, put it where the phone is)
    if (xr) {
      renderer.xr.updateCamera(cam);
      if (needPlace) {
        needPlace = false;
        place(); // around where the phone is when tracking starts
      }
    } else if (sensors) cam.quaternion.slerp(sensorQ, 1 - Math.pow(1e-5, dt));
    else cam.quaternion.setFromEuler(oe.set(look.pitch, look.yaw, 0, "YXZ"));
    if (!xr && camOn && video.videoWidth) {
      // Match the phone camera's field of view (~65–70° across the long side) so codes stay put on screen.
      const W = host.clientWidth;
      const H = host.clientHeight;
      const cover = Math.max(W / video.videoWidth, H / video.videoHeight);
      const f = 0.76 * Math.max(video.videoWidth, video.videoHeight) * cover;
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(H / 2 / f));
      if (Math.abs(cam.fov - fov) > 0.05) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
    if (!xr) {
      // Big, but never wider than ~70% of the screen, whatever the camera's field of view
      const hfov = 2 * Math.atan(Math.tan(deg(cam.fov) / 2) * cam.aspect);
      const fit = Math.min(1, (2 * DIST * Math.tan(0.36 * hfov)) / (1.22 * SIZE));
      for (const c of codes) c.spot.scale.setScalar(fit);
    }
    cam.updateMatrixWorld();
    if (!xr && camOn) {
      const s = zoom.take();
      if (s !== 1) {
        walk(s);
        cam.updateMatrixWorld();
      }
    }

    if (phase === "searching") {
      guide();
      // Is a hidden code held inside the scan frame? Or at least on screen (near)?
      let aimed: Hidden | null = null;
      let close = false;
      const reach = near ? NEAR_OUT : 1;
      for (const c of codes) {
        if (c.got) continue;
        v.copy(c.spot.position).applyMatrix4(cam.matrixWorldInverse);
        ndc.copy(c.spot.position).project(cam);
        // A faint shimmer gives it away once it's on screen
        c.shimmer.visible = v.z < 0 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1;
        if (v.z < 0 && Math.abs(ndc.x) < AIM_X && Math.abs(ndc.y) < AIM_Y) aimed = c;
        if (v.z < 0 && Math.abs(ndc.x) < reach && Math.abs(ndc.y) < reach) close = true;
      }
      setNear(close);
      shimmerMat.opacity = 0.25 + 0.25 * Math.sin(now * 9);
      aimFor = aimed ? aimFor + dt : 0;
      if (aimed && aimFor > AIM_S) {
        active = aimed;
        for (const c of codes) c.shimmer.visible = false;
        active.qr.root.visible = true;
        active.spot.add(fx);
        const tint = RARITY_HEX[active.station.rarity];
        haloMat.color.set(tint);
        glow.color.set(tint);
        rings.forEach((r) => (r.material as THREE.MeshBasicMaterial).color.set(tint));
        ev.onGuide(null);
        go("found");
      }
    }

    if (active) {
      const { qr, sway } = active;
      const pe = now - t0; // time in this phase, read after the search above may have just started one
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
        if (pe > COLLECT_S && !active.got) {
          active.got = true;
          qr.root.visible = false;
          ev.onCollect(active.station);
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
    }

    dust.rotation.y += dt * 0.015;
    renderer.render(scene, cam);
  };

  // ---- WebXR: full movement tracking where the phone supports it
  let session: XRSession | null = null;
  let needPlace = false;
  let tried = false;
  const startXr = async () => {
    if (session || disposed || !navigator.xr) return;
    const first = !tried;
    tried = true;
    let s: XRSession;
    try {
      s = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlay },
      });
    } catch {
      // The first try runs right after the Scan tap and can miss the browser's "user tapped" window;
      // offer a button. If the player then declines, stay in the standard view.
      ev.onXr(first ? "offer" : null);
      return;
    }
    if (disposed) return void s.end().catch(() => {});
    session = s;
    stopCamera(); // the AR session drives the camera itself
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(s);
    xr = true;
    showVirtual(false);
    s.addEventListener("end", () => {
      session = null;
      xr = false;
      if (!disposed) ev.onEnd();
    });
    // Hide the codes again around where the phone is now, at real distances
    active?.spot.remove(fx);
    active = null;
    aimFor = 0;
    needPlace = true;
    ev.onXr("on");
    go(hidden.length ? "searching" : "done");
  };

  place();
  renderer.setAnimationLoop(tick);
  go(hidden.length ? "searching" : "done");
  const xrOk = navigator.xr ? await navigator.xr.isSessionSupported("immersive-ar").catch(() => false) : false;
  if (xrOk) {
    void startXr().then(() => {
      if (!xr && !disposed) void startCamera(); // standard view while the "Start AR" button waits
    });
  } else void startCamera();

  return {
    setTarget: (station) => {
      wanted = station;
      if (!station || hidden.includes(station)) return;
      hidden = [station, ...hidden];
      if (phase === "searching" && !active) place();
    },
    startXr: () => {
      if (xr) return;
      stopCamera();
      void startXr().then(() => {
        if (!xr && !disposed) void startCamera();
      });
    },
    dispose: () => {
      disposed = true;
      void session?.end().catch(() => {});
      overlay.removeEventListener("beforexrselect", noXrSelect);
      renderer.setAnimationLoop(null);
      ro.disconnect();
      removeEventListener("deviceorientation", onOrient);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      zoom.dispose();
      stream?.getTracks().forEach((t) => t.stop());
      if (stream && video.srcObject === stream) video.srcObject = null; // (not another scanner's feed)
      for (const c of codes) c.qr.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      el.remove();
    },
  };
}
