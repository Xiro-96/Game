import * as THREE from "three";

let toonMap;

function toonTex() {
  if (toonMap) return toonMap;
  const data = new Uint8Array([70, 70, 70, 255, 130, 130, 130, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  toonMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  toonMap.minFilter = THREE.NearestFilter;
  toonMap.magFilter = THREE.NearestFilter;
  toonMap.needsUpdate = true;
  return toonMap;
}

export function mat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonTex(),
    ...opts,
  });
}

function add(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function createCharacter(def, isEnemy = false) {
  const g = new THREE.Group();
  g.userData.parts = {};
  const skin = mat(def.skin || "#e8b898");
  const cloth = mat(def.color);
  const dark = mat(def.accent || "#3a2810");
  const hair = mat(def.hair || "#3a2810");

  const body = new THREE.Group();
  body.position.y = 0.55;
  g.add(body);
  g.userData.parts.body = body;

  add(body, new THREE.CapsuleGeometry(0.38, 0.55, 6, 12), cloth, 0, 0.35, 0);
  const head = add(body, new THREE.SphereGeometry(0.42, 16, 12), skin, 0, 1.12, 0);
  g.userData.parts.head = head;
  add(head, new THREE.SphereGeometry(0.07, 8, 8), mat("#1a120c"), 0.14, 0.06, 0.34);
  add(head, new THREE.SphereGeometry(0.07, 8, 8), mat("#1a120c"), -0.14, 0.06, 0.34);
  add(head, new THREE.SphereGeometry(0.08, 8, 8), mat("#fff8f0"), 0.145, 0.08, 0.3, 0, 0, 0, 1.1, 0.7, 0.4);
  add(head, new THREE.SphereGeometry(0.08, 8, 8), mat("#fff8f0"), -0.145, 0.08, 0.3, 0, 0, 0, 1.1, 0.7, 0.4);

  const lArm = new THREE.Group();
  lArm.position.set(-0.48, 0.55, 0);
  body.add(lArm);
  add(lArm, new THREE.CapsuleGeometry(0.12, 0.38, 4, 8), skin, 0, -0.28, 0);
  g.userData.parts.lArm = lArm;

  const rArm = new THREE.Group();
  rArm.position.set(0.48, 0.55, 0);
  body.add(rArm);
  add(rArm, new THREE.CapsuleGeometry(0.12, 0.38, 4, 8), skin, 0, -0.28, 0);
  g.userData.parts.rArm = rArm;

  const lLeg = add(body, new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), dark, -0.16, -0.22, 0);
  const rLeg = add(body, new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), dark, 0.16, -0.22, 0);
  g.userData.parts.lLeg = lLeg;
  g.userData.parts.rLeg = rLeg;

  dressHero(def, body, head, rArm, lArm, hair, cloth, dark, skin, isEnemy);

  g.userData.anim = { t: 0, attack: 0 };
  g.userData.def = def;
  const s = isEnemy ? (def.radius ? def.radius * 1.15 : 0.85) : 1;
  g.scale.setScalar(isEnemy ? Math.max(0.72, s) : 1);
  return g;
}

function dressHero(def, body, head, rArm, lArm, hair, cloth, dark, skin, isEnemy) {
  const id = def.id || def.name;
  if (isEnemy) {
    add(head, new THREE.SphereGeometry(0.44, 12, 8), dark, 0, 0.08, -0.04, 0.4, 0, 0, 1, 0.55, 1);
    if (def.elite || def.boss) {
      add(body, new THREE.BoxGeometry(1.1, 0.35, 0.9), mat("#4a5a38"), 0, 0.2, 0);
      add(head, new THREE.ConeGeometry(0.22, 0.5, 6), mat("#c9a227"), 0, 0.55, 0);
    }
    if (def.ranged) {
      add(lArm, new THREE.BoxGeometry(0.08, 0.7, 0.08), mat("#5a3a18"), 0, -0.5, 0.1, 0.6);
    }
    return;
  }

  if (id === "berserker") {
    add(head, new THREE.ConeGeometry(0.22, 0.5, 7), hair, 0, 0.42, -0.04);
    add(head, new THREE.BoxGeometry(0.18, 0.28, 0.12), hair, 0.28, 0.18, 0);
    add(head, new THREE.BoxGeometry(0.18, 0.28, 0.12), hair, -0.28, 0.18, 0);
    add(rArm, new THREE.BoxGeometry(0.12, 0.7, 0.22), mat("#8a5a28"), 0.08, -0.62, 0.1, 0.3);
    add(rArm, new THREE.BoxGeometry(0.28, 0.18, 0.08), mat("#c0c4cc"), 0.08, -0.95, 0.18);
    add(lArm, new THREE.BoxGeometry(0.12, 0.7, 0.22), mat("#8a5a28"), -0.08, -0.62, 0.1, -0.3);
    add(body, new THREE.BoxGeometry(0.85, 0.22, 0.55), mat("#6b2a10"), 0, 0.15, 0.05);
  } else if (id === "ranger") {
    add(head, new THREE.SphereGeometry(0.46, 12, 10), cloth, 0, 0.1, -0.05, 0.35, 0, 0, 1, 0.7, 1.05);
    add(head, new THREE.ConeGeometry(0.2, 0.42, 4), cloth, 0, 0.48, -0.18, 0.5);
    add(lArm, new THREE.TorusGeometry(0.28, 0.04, 6, 14, Math.PI), mat("#5a3a18"), 0, -0.35, 0.15, 0, 0, 1.2);
    add(rArm, new THREE.BoxGeometry(0.06, 0.55, 0.06), mat("#d8c090"), 0, -0.45, 0.12);
  } else if (id === "aegis") {
    add(head, new THREE.SphereGeometry(0.46, 12, 10), mat("#dfe7ee"), 0, 0.08, 0, 0, 0, 0, 1.05, 0.7, 1.05);
    add(head, new THREE.BoxGeometry(0.12, 0.42, 0.28), mat("#e8eef4"), 0.42, 0.22, 0, 0, 0, 0.4);
    add(head, new THREE.BoxGeometry(0.12, 0.42, 0.28), mat("#e8eef4"), -0.42, 0.22, 0, 0, 0, -0.4);
    add(rArm, new THREE.TorusGeometry(0.28, 0.06, 6, 16), mat("#b8c4d0"), 0.05, -0.55, 0.05, 1.2);
    add(lArm, new THREE.TorusGeometry(0.28, 0.06, 6, 16), mat("#b8c4d0"), -0.05, -0.55, 0.05, 1.2);
  } else if (id === "pyre") {
    add(head, new THREE.TorusGeometry(0.22, 0.06, 6, 12), mat("#2a2a32"), 0, 0.08, 0.28, 1.2);
    add(head, new THREE.SphereGeometry(0.12, 8, 8), mat("#88e0ff"), 0.16, 0.08, 0.38);
    add(head, new THREE.SphereGeometry(0.12, 8, 8), mat("#88e0ff"), -0.16, 0.08, 0.38);
    add(rArm, new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), mat("#4a4a55"), 0.05, -0.5, 0.12, 0.7);
    add(head, new THREE.ConeGeometry(0.18, 0.35, 6), hair, 0.22, 0.38, -0.05, 0, 0, -0.5);
  } else if (id === "blast") {
    add(head, new THREE.SphereGeometry(0.48, 12, 10), dark, 0, 0.08, -0.02, 0.2, 0, 0, 1, 0.75, 1);
    add(rArm, new THREE.SphereGeometry(0.22, 10, 8), mat("#2a2a32"), 0.05, -0.55, 0.12);
    add(rArm, new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), mat("#c45a3a"), 0.05, -0.72, 0.12);
  } else if (id === "knave") {
    add(head, new THREE.SphereGeometry(0.16, 8, 8), hair, 0.22, 0.22, 0.1);
    add(head, new THREE.SphereGeometry(0.16, 8, 8), hair, -0.22, 0.22, 0.1);
    add(rArm, new THREE.BoxGeometry(0.08, 0.42, 0.12), mat("#c0c4cc"), 0.04, -0.55, 0.14, 0.4);
    add(lArm, new THREE.BoxGeometry(0.08, 0.42, 0.12), mat("#c0c4cc"), -0.04, -0.55, 0.14, -0.4);
  }
}

export function animateCharacter(mesh, dt, moving, attacking) {
  const a = mesh.userData.anim;
  const p = mesh.userData.parts;
  a.t += dt * (moving ? 10 : 3);
  if (attacking) a.attack = 1;
  a.attack = Math.max(0, a.attack - dt * 4);
  const bob = Math.sin(a.t) * (moving ? 0.08 : 0.02);
  if (p.body) p.body.position.y = 0.55 + bob;
  if (p.rArm) p.rArm.rotation.x = moving ? Math.sin(a.t) * 0.7 : -a.attack * 1.4;
  if (p.lArm) p.lArm.rotation.x = moving ? Math.cos(a.t) * 0.7 : a.attack * 0.4;
  if (p.rLeg) p.rLeg.rotation.x = moving ? Math.cos(a.t) * 0.6 : 0;
  if (p.lLeg) p.lLeg.rotation.x = moving ? Math.sin(a.t) * 0.6 : 0;
}

export function createProjectile(kind, color) {
  const g = new THREE.Group();
  if (kind === "arrow") {
    add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), mat("#8a5a28"), 0, 0, 0, Math.PI / 2);
    add(g, new THREE.ConeGeometry(0.08, 0.18, 6), mat("#c0c4cc"), 0, 0, 0.4, Math.PI / 2);
  } else if (kind === "rocket") {
    add(g, new THREE.CylinderGeometry(0.08, 0.1, 0.45, 8), mat(color || "#e84a2a"), 0, 0, 0, Math.PI / 2);
    add(g, new THREE.ConeGeometry(0.1, 0.18, 8), mat("#ffd24a"), 0, 0, 0.28, Math.PI / 2);
  } else if (kind === "bomb") {
    add(g, new THREE.SphereGeometry(0.22, 10, 8), mat("#2a2a32"));
    add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6), mat("#c45a3a"), 0, 0.22, 0);
  } else {
    add(g, new THREE.SphereGeometry(0.16, 8, 8), mat(color || "#ffe98a"));
  }
  return g;
}

export function hpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a0c04 }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xe23b3b }));
  fg.position.z = 0.01;
  g.add(bg);
  g.add(fg);
  g.userData.fg = fg;
  g.userData.base = 1.16;
  return g;
}
