import * as THREE from "three";

let toonMap;

function toonTex() {
  if (toonMap) return toonMap;
  const data = new Uint8Array([90, 80, 70, 255, 150, 140, 130, 255, 210, 200, 190, 255, 255, 255, 255, 255]);
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

function outline(mesh) {
  const ol = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: 0x1a0c08, side: THREE.BackSide })
  );
  ol.scale.setScalar(1.12);
  ol.castShadow = false;
  mesh.add(ol);
}

export function createCharacter(def, isEnemy = false) {
  const g = new THREE.Group();
  g.userData.parts = {};
  const skin = mat(def.skin || "#e8b898");
  const cloth = mat(def.color);
  const dark = mat(def.accent || "#3a2810");
  const hair = mat(def.hair || "#3a2810");

  const body = new THREE.Group();
  body.position.y = 0.62;
  g.add(body);
  g.userData.parts.body = body;

  const torso = add(body, new THREE.SphereGeometry(0.48, 16, 12), cloth, 0, 0.28, 0, 0, 0, 0, 1, 1.15, 0.85);
  outline(torso);
  add(body, new THREE.SphereGeometry(0.36, 12, 10), dark, 0, -0.08, 0, 0, 0, 0, 1.05, 0.7, 0.9);

  const head = add(body, new THREE.SphereGeometry(0.5, 18, 14), skin, 0, 1.08, 0.04);
  outline(head);
  g.userData.parts.head = head;
  face(head);

  const lArm = new THREE.Group();
  lArm.position.set(-0.52, 0.42, 0.04);
  body.add(lArm);
  const lUpper = add(lArm, new THREE.CapsuleGeometry(0.13, 0.42, 5, 8), skin, 0, -0.28, 0);
  outline(lUpper);
  g.userData.parts.lArm = lArm;

  const rArm = new THREE.Group();
  rArm.position.set(0.52, 0.42, 0.04);
  body.add(rArm);
  const rUpper = add(rArm, new THREE.CapsuleGeometry(0.13, 0.42, 5, 8), skin, 0, -0.28, 0);
  outline(rUpper);
  g.userData.parts.rArm = rArm;

  const lLeg = add(body, new THREE.CapsuleGeometry(0.14, 0.38, 4, 8), dark, -0.18, -0.38, 0);
  const rLeg = add(body, new THREE.CapsuleGeometry(0.14, 0.38, 4, 8), dark, 0.18, -0.38, 0);
  add(body, new THREE.SphereGeometry(0.16, 8, 8), mat("#3a2410"), -0.18, -0.62, 0.06, 0.4);
  add(body, new THREE.SphereGeometry(0.16, 8, 8), mat("#3a2410"), 0.18, -0.62, 0.06, 0.4);
  g.userData.parts.lLeg = lLeg;
  g.userData.parts.rLeg = rLeg;

  dressHero(def, body, head, rArm, lArm, hair, cloth, dark, skin, isEnemy);

  g.userData.anim = { t: 0, attack: 0 };
  g.userData.def = def;
  const s = isEnemy ? Math.max(0.78, (def.radius || 0.55) * 1.25) : 1.08;
  g.scale.setScalar(s);
  return g;
}

function face(head) {
  const white = mat("#fff8f0");
  const pupil = mat("#1a120c");
  add(head, new THREE.SphereGeometry(0.11, 10, 8), white, 0.16, 0.08, 0.4, 0, 0, 0, 1, 1.15, 0.55);
  add(head, new THREE.SphereGeometry(0.11, 10, 8), white, -0.16, 0.08, 0.4, 0, 0, 0, 1, 1.15, 0.55);
  add(head, new THREE.SphereGeometry(0.055, 8, 8), pupil, 0.16, 0.07, 0.45);
  add(head, new THREE.SphereGeometry(0.055, 8, 8), pupil, -0.16, 0.07, 0.45);
  add(head, new THREE.BoxGeometry(0.12, 0.035, 0.04), mat("#3a2010"), 0.16, 0.2, 0.42, 0, 0, 0.15);
  add(head, new THREE.BoxGeometry(0.12, 0.035, 0.04), mat("#3a2010"), -0.16, 0.2, 0.42, 0, 0, -0.15);
  add(head, new THREE.SphereGeometry(0.07, 8, 6), mat("#c45a48"), 0, -0.12, 0.44, 0, 0, 0, 1.3, 0.55, 0.5);
}

function dressHero(def, body, head, rArm, lArm, hair, cloth, dark, skin, isEnemy) {
  const id = def.id || def.name;
  if (isEnemy) {
    add(head, new THREE.SphereGeometry(0.52, 12, 10), dark, 0, 0.12, -0.06, 0.5, 0, 0, 1, 0.55, 1);
    if (def.elite || def.boss) {
      add(body, new THREE.BoxGeometry(1.15, 0.4, 0.95), mat("#4a5a38"), 0, 0.15, 0);
      add(head, new THREE.ConeGeometry(0.24, 0.55, 6), mat("#c9a227"), 0, 0.62, 0);
      add(rArm, new THREE.BoxGeometry(0.22, 0.85, 0.22), mat("#6a6358"), 0.1, -0.7, 0.1, 0.4);
    } else if (def.ranged) {
      add(lArm, new THREE.BoxGeometry(0.08, 0.75, 0.08), mat("#5a3a18"), 0, -0.52, 0.12, 0.7);
    } else {
      add(rArm, new THREE.BoxGeometry(0.1, 0.55, 0.18), mat("#8a5a28"), 0.06, -0.55, 0.1, 0.35);
    }
    return;
  }

  if (id === "berserker") {
    add(head, new THREE.ConeGeometry(0.26, 0.55, 8), hair, 0, 0.48, -0.06);
    add(head, new THREE.BoxGeometry(0.2, 0.32, 0.14), hair, 0.32, 0.2, 0);
    add(head, new THREE.BoxGeometry(0.2, 0.32, 0.14), hair, -0.32, 0.2, 0);
    add(body, new THREE.BoxGeometry(0.95, 0.28, 0.6), mat("#6b2a10"), 0, 0.05, 0.08);
    const axe = new THREE.Group();
    axe.position.set(0.08, -0.7, 0.12);
    rArm.add(axe);
    add(axe, new THREE.CylinderGeometry(0.05, 0.06, 0.95, 6), mat("#8a5a28"));
    add(axe, new THREE.BoxGeometry(0.42, 0.22, 0.08), mat("#c0c4cc"), 0.12, 0.38, 0);
  } else if (id === "ranger") {
    add(head, new THREE.SphereGeometry(0.54, 14, 10), cloth, 0, 0.12, -0.04, 0.4, 0, 0, 1, 0.72, 1.08);
    add(head, new THREE.ConeGeometry(0.22, 0.48, 4), cloth, 0, 0.52, -0.2, 0.55);
    add(body, new THREE.BoxGeometry(0.2, 0.7, 0.45), mat("#3a6b2a"), 0, 0.1, -0.28);
    add(lArm, new THREE.TorusGeometry(0.32, 0.045, 6, 16, Math.PI), mat("#5a3a18"), 0.02, -0.42, 0.18, 0.2, 0, 1.15);
    add(rArm, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), mat("#d8c090"), 0, -0.5, 0.14, 0.5);
  } else if (id === "aegis") {
    add(head, new THREE.SphereGeometry(0.54, 14, 12), mat("#dfe7ee"), 0, 0.1, 0, 0, 0, 0, 1.08, 0.72, 1.08);
    add(head, new THREE.BoxGeometry(0.14, 0.48, 0.3), mat("#e8eef4"), 0.48, 0.26, 0, 0, 0, 0.45);
    add(head, new THREE.BoxGeometry(0.14, 0.48, 0.3), mat("#e8eef4"), -0.48, 0.26, 0, 0, 0, -0.45);
    add(body, new THREE.BoxGeometry(0.9, 0.35, 0.55), mat("#b8c4d0"), 0, 0.12, 0.08);
    add(rArm, new THREE.TorusGeometry(0.3, 0.07, 6, 18), mat("#c9d6de"), 0.06, -0.58, 0.08, 1.15);
    add(lArm, new THREE.TorusGeometry(0.3, 0.07, 6, 18), mat("#c9d6de"), -0.06, -0.58, 0.08, 1.15);
  } else if (id === "pyre") {
    add(head, new THREE.TorusGeometry(0.24, 0.07, 8, 14), mat("#2a2a32"), 0, 0.1, 0.32, 1.25);
    add(head, new THREE.SphereGeometry(0.13, 8, 8), mat("#88e0ff"), 0.18, 0.1, 0.42);
    add(head, new THREE.SphereGeometry(0.13, 8, 8), mat("#88e0ff"), -0.18, 0.1, 0.42);
    add(head, new THREE.ConeGeometry(0.2, 0.4, 6), hair, 0.26, 0.42, -0.04, 0, 0, -0.55);
    add(rArm, new THREE.CylinderGeometry(0.13, 0.18, 0.78, 8), mat("#4a4a55"), 0.06, -0.55, 0.14, 0.75);
    add(rArm, new THREE.ConeGeometry(0.14, 0.2, 8), mat("#ffd24a"), 0.06, -0.95, 0.22, 0.75);
  } else if (id === "blast") {
    add(head, new THREE.SphereGeometry(0.56, 14, 10), dark, 0, 0.1, -0.02, 0.25, 0, 0, 1, 0.78, 1);
    add(body, new THREE.BoxGeometry(0.85, 0.22, 0.5), mat("#c45a3a"), 0, 0.05, 0.06);
    add(rArm, new THREE.SphereGeometry(0.24, 12, 8), mat("#2a2a32"), 0.06, -0.6, 0.14);
    add(rArm, new THREE.CylinderGeometry(0.05, 0.05, 0.24, 6), mat("#c45a3a"), 0.06, -0.8, 0.14);
  } else if (id === "knave") {
    add(head, new THREE.SphereGeometry(0.18, 8, 8), hair, 0.26, 0.26, 0.12);
    add(head, new THREE.SphereGeometry(0.18, 8, 8), hair, -0.26, 0.26, 0.12);
    add(head, new THREE.SphereGeometry(0.12, 8, 8), hair, 0, 0.42, -0.04);
    add(rArm, new THREE.BoxGeometry(0.09, 0.48, 0.14), mat("#c0c4cc"), 0.05, -0.58, 0.16, 0.45);
    add(lArm, new THREE.BoxGeometry(0.09, 0.48, 0.14), mat("#c0c4cc"), -0.05, -0.58, 0.16, -0.45);
  }
}

export function animateCharacter(mesh, dt, moving, attacking) {
  const a = mesh.userData.anim;
  const p = mesh.userData.parts;
  a.t += dt * (moving ? 11 : 3.2);
  if (attacking) a.attack = 1;
  a.attack = Math.max(0, a.attack - dt * 4);
  const bob = Math.sin(a.t) * (moving ? 0.09 : 0.025);
  if (p.body) p.body.position.y = 0.62 + bob;
  if (p.rArm) p.rArm.rotation.x = moving ? Math.sin(a.t) * 0.75 : -a.attack * 1.55;
  if (p.lArm) p.lArm.rotation.x = moving ? Math.cos(a.t) * 0.75 : a.attack * 0.45;
  if (p.rLeg) p.rLeg.rotation.x = moving ? Math.cos(a.t) * 0.65 : 0;
  if (p.lLeg) p.lLeg.rotation.x = moving ? Math.sin(a.t) * 0.65 : 0;
}

export function createProjectile(kind, color) {
  const g = new THREE.Group();
  if (kind === "arrow") {
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.78, 6), mat("#8a5a28"), 0, 0, 0, Math.PI / 2);
    add(g, new THREE.ConeGeometry(0.09, 0.2, 6), mat("#c0c4cc"), 0, 0, 0.42, Math.PI / 2);
  } else if (kind === "rocket") {
    add(g, new THREE.CylinderGeometry(0.09, 0.12, 0.5, 8), mat(color || "#e84a2a"), 0, 0, 0, Math.PI / 2);
    add(g, new THREE.ConeGeometry(0.12, 0.2, 8), mat("#ffd24a"), 0, 0, 0.3, Math.PI / 2);
  } else if (kind === "bomb") {
    add(g, new THREE.SphereGeometry(0.24, 10, 8), mat("#2a2a32"));
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.18, 6), mat("#c45a3a"), 0, 0.24, 0);
  } else {
    add(g, new THREE.SphereGeometry(0.18, 8, 8), mat(color || "#ffe98a"));
  }
  return g;
}

export function hpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a0c04 }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.09), new THREE.MeshBasicMaterial({ color: 0xe23b3b }));
  fg.position.z = 0.01;
  g.add(bg);
  g.add(fg);
  g.userData.fg = fg;
  g.userData.base = 1.2;
  return g;
}
