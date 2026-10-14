import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import type { Rarity } from "@/lib/hunt";

/** The mark's box inside favicon.svg (the same crop as components/game/I8Mark.tsx). */
const BOX = { x: 320, y: 120, w: 732, h: 1130 };

export const RARITY_HEX: Record<Rarity, number> = { common: 0x12bfea, rare: 0x20c9bc, legendary: 0xd6b56d };

export type Emblem = {
  root: THREE.Group;
  /** Pixel squares, each with the spot it assembles into. */
  pixels: { mesh: THREE.Mesh; home: THREE.Vector3; from: THREE.Vector3; delay: number }[];
  /** Body and ribbon, which grow in after the pixels start flying. */
  solid: THREE.Group;
  setRarity: (r: Rarity) => void;
  dispose: () => void;
};

/**
 * The INNEV8 mark as a solid 3D object: the "8" body and blue ribbon extruded from the logo's
 * own SVG paths, plus its pixel squares as small glowing blocks. `height` is in scene units;
 * the result is centred on the origin with the mark standing along +y.
 */
export async function buildEmblem(height: number): Promise<Emblem> {
  const svg = await fetch("/assets/img/favicon.svg").then((r) => r.text());
  const data = new SVGLoader().parse(svg);

  const root = new THREE.Group();
  root.scale.setScalar(height / BOX.h);
  const cx = BOX.x + BOX.w / 2;
  const cy = BOX.y + BOX.h / 2;
  const flip = new THREE.Group(); // SVG y points down
  flip.scale.y = -1;
  flip.position.set(-cx, cy, 0);
  root.add(flip);
  // Pivot on the mark's centre so the body can grow in place; its meshes sit back in SVG units.
  const solid = new THREE.Group();
  solid.position.set(cx, cy, 0);
  flip.add(solid);
  const solidInner = new THREE.Group();
  solidInner.position.set(-cx, -cy, 0);
  solid.add(solidInner);

  const body = new THREE.MeshPhysicalMaterial({
    color: 0xf2fbff,
    metalness: 0.15,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: RARITY_HEX.common,
    emissiveIntensity: 0.1,
  });
  const ribbon = new THREE.MeshPhysicalMaterial({
    color: 0x168cf2,
    metalness: 0.35,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    emissive: 0x0a4fd0,
    emissiveIntensity: 0.35,
  });
  const pixelMats = new Map<string, THREE.MeshStandardMaterial>();
  const geometries: THREE.BufferGeometry[] = [];
  const pixels: Emblem["pixels"] = [];

  for (const path of data.paths) {
    const fill = String((path.userData?.style as { fill?: string } | undefined)?.fill ?? "");
    if (fill.includes("#a")) continue; // the app icon's background square
    const shapes = path.toShapes();
    if (fill.includes("#b") || fill.includes("#c")) {
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: 70,
        bevelEnabled: true,
        bevelThickness: 22,
        bevelSize: 12,
        bevelSegments: 5,
        curveSegments: 28,
      });
      geo.translate(0, 0, -35);
      geometries.push(geo);
      solidInner.add(new THREE.Mesh(geo, fill.includes("#b") ? body : ribbon));
      continue;
    }
    let mat = pixelMats.get(fill);
    if (!mat) {
      const color = new THREE.Color(fill);
      mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.35 });
      pixelMats.set(fill, mat);
    }
    for (const shape of shapes) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 44, bevelEnabled: false });
      geo.computeBoundingBox();
      const home = geo.boundingBox!.getCenter(new THREE.Vector3());
      geo.translate(-home.x, -home.y, -22);
      home.z = 0;
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(home);
      flip.add(mesh);
      // Fly in from around the mark, nearest pixels first (like the splash emblem).
      const from = home
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 1100, (Math.random() - 0.5) * 900, 200 + Math.random() * 500));
      pixels.push({ mesh, home, from, delay: 0 });
    }
  }
  pixels
    .sort((a, b) => a.home.y - b.home.y)
    .forEach((p, i) => {
      p.delay = i * 0.035;
    });

  const setRarity = (r: Rarity) => {
    const glow = new THREE.Color(RARITY_HEX[r]);
    if (r === "legendary") {
      body.color.set(0xf3d995);
      body.metalness = 0.85;
      body.roughness = 0.22;
    } else {
      body.color.set(0xf2fbff);
      body.metalness = 0.15;
      body.roughness = 0.16;
    }
    body.emissive.copy(glow);
    body.emissiveIntensity = r === "legendary" ? 0.18 : 0.1;
    ribbon.color.set(r === "rare" ? 0x16b8a8 : 0x168cf2);
    ribbon.emissive.set(r === "rare" ? 0x0a7d72 : 0x0a4fd0);
  };

  return {
    root,
    pixels,
    solid,
    setRarity,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      body.dispose();
      ribbon.dispose();
      pixelMats.forEach((m) => m.dispose());
    },
  };
}
