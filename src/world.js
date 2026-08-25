import * as THREE from "three";
import { mat } from "./characters.js";

// Gecachte GPU-Ressourcen. Arenen werden pro Etage neu gebaut; ohne Cache
// landete pro Arena ein frischer Satz CanvasTexturen auf der GPU, der nie
// wieder freigegeben wurde.
const shared = new Set();
const texCache = new Map();
const matCache = new Map();

function noiseTex(w, colors, rx = 1, ry = 1) {
  const key = `${w}|${colors.join(",")}|${rx}x${ry}`;
  const cached = texCache.get(key);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = c.height = w;
  const ctx = c.getContext("2d");
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < w * 12; i++) {
    ctx.fillStyle = colors[1 + (i % (colors.length - 1))];
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    ctx.fillRect(Math.random() * w, Math.random() * w, 2 + Math.random() * 5, 2 + Math.random() * 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(rx, ry);
  texCache.set(key, tex);
  shared.add(tex);
  return tex;
}

function sharedMat(key, make) {
  const cached = matCache.get(key);
  if (cached) return cached;
  const m = make();
  matCache.set(key, m);
  shared.add(m);
  return m;
}

function grassMat() {
  return sharedMat("grass", () =>
    new THREE.MeshLambertMaterial({
      map: noiseTex(256, ["#3d9440", "#5aaa3a", "#2f7a32", "#6bbb44", "#4e9a34"], 10, 10),
      color: "#c8f0a8",
    })
  );
}

function stoneMat(hex = "#8a846c") {
  return sharedMat(`stone:${hex}`, () =>
    new THREE.MeshLambertMaterial({
      map: noiseTex(128, ["#6a6358", "#8a846c", "#5a5348", "#9a9480"], 2, 2),
      color: hex,
    })
  );
}

function groundMatFor(themeId, t) {
  if (themeId === "meadow") return grassMat();
  return sharedMat(`ground:${themeId}`, () =>
    new THREE.MeshLambertMaterial({
      map: noiseTex(256, [t.ground, t.rim, t.accent, t.wall]),
      color: t.ground,
    })
  );
}

// Gibt alles frei, was diese Szene exklusiv besitzt. Gecachte Ressourcen
// bleiben bestehen - sie werden von der naechsten Arena wiederverwendet.
export function disposeScene(scene) {
  if (!scene) return;
  scene.traverse((o) => {
    if (o.isLight) o.shadow?.dispose?.();
    if (o.geometry) o.geometry.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (shared.has(m)) continue;
      for (const key of ["map", "gradientMap", "alphaMap", "emissiveMap"]) {
        const tex = m[key];
        if (tex && !shared.has(tex)) tex.dispose?.();
      }
      m.dispose?.();
    }
  });
  scene.clear?.();
}

function mesh(geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, typeof color === "string" ? mat(color) : color);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createLights(scene, warm = true) {
  const hemi = new THREE.HemisphereLight(warm ? 0xffe2b0 : 0xb0d4ff, warm ? 0x4a6a32 : 0x2a3040, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  return sun;
}

export function createHubWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#7ec8ff");
  scene.fog = new THREE.Fog("#9ad4ff", 28, 90);
  createLights(scene, true);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), grassMat());
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const hill = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), mat("#4e9a34"));
  hill.position.set(-16, -12, -18);
  hill.scale.set(1.6, 0.45, 1.4);
  hill.receiveShadow = true;
  scene.add(hill);

  for (let i = 0; i < 18; i++) {
    const house = makeHouse();
    const a = (i / 18) * Math.PI * 1.4 + 0.4;
    const r = 10 + (i % 5) * 2.2;
    house.position.set(Math.cos(a) * r - 2, 0, Math.sin(a) * r - 6);
    house.rotation.y = -a + Math.PI;
    scene.add(house);
  }

  const tower = makeTower();
  tower.position.set(6, 0, -16);
  scene.add(tower);

  for (let i = 0; i < 28; i++) {
    const t = makeTree();
    t.position.set((Math.random() - 0.4) * 50, 0, -20 - Math.random() * 30);
    scene.add(t);
  }

  const camp = makeCampfire();
  camp.position.set(-1.5, 0, 2.5);
  scene.add(camp);

  return scene;
}

function makeHouse() {
  const g = new THREE.Group();
  const c = ["#c45a3a", "#d48a3a", "#e8dcc8", "#6b8cae"][Math.floor(Math.random() * 4)];
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.7, 2.4), c, 0, 0.85, 0));
  g.add(mesh(new THREE.ConeGeometry(1.9, 1.45, 4), "#8a3a28", 0, 2.2, 0, 0, Math.PI / 4));
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.78, 0.12), "#5a3a18", 0, 0.5, 1.22));
  g.add(mesh(new THREE.BoxGeometry(0.38, 0.38, 0.08), "#ffe98a", 0.55, 1.15, 1.22));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), "#6b3d18", 0.85, 2.55, 0.2));
  return g;
}

function makeTree() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), "#6b3d18", 0, 0.6, 0));
  g.add(mesh(new THREE.ConeGeometry(1.1, 1.8, 7), "#2f7a32", 0, 1.9, 0));
  g.add(mesh(new THREE.ConeGeometry(0.85, 1.4, 7), "#3d9440", 0, 2.6, 0));
  return g;
}

function makeTower() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(4.2, 5.4, 6, 10), "#5a5348", 0, 3, 0));
  g.add(mesh(new THREE.CylinderGeometry(3.4, 4.0, 8, 10), "#6a6358", 0, 10, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.4, 3.2, 10, 10), "#4a453c", 0, 18.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.3, 2.2, 12, 8), "#3a352e", 0, 29, 0));
  g.add(mesh(new THREE.ConeGeometry(2.0, 4.2, 8), "#2a1810", 0, 37, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(new THREE.BoxGeometry(1.1, 1.4, 0.7), "#6a6358", Math.cos(a) * 4.6, 6.6, Math.sin(a) * 4.6));
  }
  const glow = new THREE.PointLight(0xffaa44, 2.4, 40);
  glow.position.set(0, 34, 0);
  g.add(glow);
  return g;
}

function makeCampfire() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.22, 10), "#5a3a18", 0, 0.1, 0));
  g.add(mesh(new THREE.ConeGeometry(0.28, 0.7, 6), "#ff7a1a", 0, 0.5, 0));
  g.add(mesh(new THREE.ConeGeometry(0.16, 0.5, 5), "#ffe98a", 0.05, 0.55, 0.05));
  const light = new THREE.PointLight(0xff8120, 1.6, 10);
  light.position.y = 0.8;
  g.add(light);
  return g;
}

const THEMES = {
  meadow: { ground: "#5aaa3a", rim: "#6b5344", wall: "#8a6a4a", sky: "#7ec8ff", fog: "#9ad4ff", accent: "#3d9440" },
  dungeon: { ground: "#4a453c", rim: "#2a2620", wall: "#5a5348", sky: "#1a2230", fog: "#243044", accent: "#8a6a3a" },
  ruins: { ground: "#6a7a58", rim: "#4a5340", wall: "#8a846c", sky: "#c8b48a", fog: "#d8c8a0", accent: "#5a4a32" },
  magma: { ground: "#3a2218", rim: "#1a0c08", wall: "#5a2a18", sky: "#4a1820", fog: "#5a2030", accent: "#e25b12" },
  frost: { ground: "#d8e8f4", rim: "#8ab0c8", wall: "#e8f4ff", sky: "#b8d8ff", fog: "#d0e8ff", accent: "#7ec8e8" },
  night: { ground: "#2a3a28", rim: "#1a2218", wall: "#3a4a38", sky: "#0c1424", fog: "#182438", accent: "#f0b429" },
};

export function themeFor(index, type) {
  if (type === "boss") return "night";
  if (type === "elite") return "ruins";
  const keys = ["meadow", "dungeon", "ruins", "magma", "frost", "night"];
  return keys[index % keys.length];
}

export function createArena(themeId) {
  const t = THEMES[themeId] || THEMES.meadow;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(t.sky);
  scene.fog = new THREE.Fog(t.fog, 22, 48);
  createLights(scene, themeId !== "night" && themeId !== "dungeon" && themeId !== "magma");

  const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 48), groundMatFor(themeId, t));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(new THREE.RingGeometry(15.2, 16.4, 48), stoneMat(t.rim));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.receiveShadow = true;
  scene.add(ring);

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const wall = mesh(new THREE.BoxGeometry(5.2, 2.6, 1.2), stoneMat(t.wall), Math.cos(a) * 16.2, 1.3, Math.sin(a) * 16.2, 0, -a);
    scene.add(wall);
    if (i % 2 === 0) {
      const batt = mesh(new THREE.BoxGeometry(1.5, 0.9, 1.3), stoneMat(t.wall), Math.cos(a) * 16.2, 3.0, Math.sin(a) * 16.2);
      scene.add(batt);
    }
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const r = 11 + (i % 2) * 1.4;
    if (themeId === "meadow" || themeId === "ruins") {
      const tr = makeTree();
      tr.scale.setScalar(0.7);
      tr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      scene.add(tr);
    } else if (themeId === "dungeon" || themeId === "night") {
      const col = mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.6, 8), t.accent, Math.cos(a) * r, 1.3, Math.sin(a) * r);
      scene.add(col);
    } else if (themeId === "magma") {
      const rock = mesh(new THREE.IcosahedronGeometry(0.7, 0), t.accent, Math.cos(a) * r, 0.4, Math.sin(a) * r);
      scene.add(rock);
    } else {
      const ice = mesh(new THREE.ConeGeometry(0.5, 1.6, 5), t.accent, Math.cos(a) * r, 0.8, Math.sin(a) * r);
      scene.add(ice);
    }
  }

  for (let i = 0; i < 6; i++) {
    const crate = mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), "#8a5a28", (Math.random() - 0.5) * 8, 0.35, (Math.random() - 0.5) * 8);
    crate.rotation.y = Math.random() * 2;
    scene.add(crate);
  }

  return { scene, radius: 14.2, theme: t };
}

export function makeTelegraph(radius) {
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.05;
  return g;
}

export function makeBurst(color = 0xffe98a) {
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  return g;
}
