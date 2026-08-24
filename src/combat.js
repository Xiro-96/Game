import * as THREE from "three";
import { HEROES, ENEMY_KINDS, PERKS, floorPlan } from "./data.js";
import { createCharacter, animateCharacter, createProjectile, hpBar } from "./characters.js";
import { createArena, themeFor, makeTelegraph, makeBurst } from "./world.js";

const ARENA = 14.2;

function clampArena(pos) {
  const l = Math.hypot(pos.x, pos.z);
  if (l > ARENA) {
    pos.x = (pos.x / l) * ARENA;
    pos.z = (pos.z / l) * ARENA;
  }
}

function nearest(from, list, max = 99) {
  let best = null;
  let bd = max;
  for (const o of list) {
    if (o.dead) continue;
    const d = from.pos.distanceTo(o.pos);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.fx = [];
    this.projectiles = [];
    this.floats = [];
    this.shake = 0;
    this.time = 0;
  }

  startRun(heroId, path) {
    this.path = path;
    this.floor = 0;
    this.kills = 0;
    this.gold = 0;
    this.elapsed = 0;
    this.paused = false;
    this.over = false;
    this.perksPicked = [];
    const heroDef = HEROES.find((h) => h.id === heroId);
    const others = HEROES.filter((h) => h.id !== heroId);
    const allies = [others[Math.floor(Math.random() * others.length)]];
    let second = others[Math.floor(Math.random() * others.length)];
    while (second.id === allies[0].id) second = others[Math.floor(Math.random() * others.length)];
    allies.push(second);
    this.squadDefs = [heroDef, ...allies];
    this.beginFloor();
  }

  beginFloor() {
    this.clearScene();
    this.floorType = floorPlan(this.path.id, this.floor, this.path.floors);
    this.theme = themeFor(this.floor, this.floorType);
    const arena = createArena(this.theme);
    this.scene = arena.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.enemies = [];
    this.projectiles = [];
    this.fx = [];
    this.wave = 0;
    this.wavesTotal = this.floorType === "combat" ? 3 : 1;
    this.surviving = this.floorType === "survival" ? 28 : 0;
    this.spawnTimer = 0;
    this.bannerAt = 0.1;
    this.cleared = false;
    this.heroes = this.squadDefs.map((def, i) => this.spawnHero(def, i === 0, i));
    this.player = this.heroes[0];
    this.spawnWave();
    this.game.showHud(this);
  }

  spawnHero(def, isPlayer, i) {
    const mesh = createCharacter(def, false);
    const bar = hpBar();
    bar.position.y = 2.35;
    mesh.add(bar);
    const ang = (i / 3) * Math.PI * 2;
    mesh.position.set(Math.cos(ang) * 1.6, 0, Math.sin(ang) * 1.6);
    this.group.add(mesh);
    const stats = {
      lightMul: 1,
      heavyMul: 1,
      skillCdMul: 1,
      speedMul: 1,
      vamp: 0,
      chargeGain: 0.22,
      crit: 0.08,
      armor: 1,
      aoe: false,
      homing: false,
      extraShots: 0,
      maxHp: def.hp,
      hp: def.hp,
    };
    for (const p of this.perksPicked) PERKS.find((x) => x.id === p)?.apply(stats);
    return {
      def,
      mesh,
      bar,
      isPlayer,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      facing: new THREE.Vector3(0, 0, 1),
      stats,
      lightCd: 0,
      skillCd: 0,
      heavyMeter: 0,
      charging: false,
      chargeT: 0,
      combo: 0,
      comboT: 0,
      atkT: 0,
      aiT: 0,
      dead: false,
      invuln: 0,
    };
  }

  spawnWave() {
    const diff = this.path.difficulty * (1 + this.floor * 0.12);
    if (this.floorType === "elite") {
      this.spawnEnemy("elite", 0, 8, diff * 1.1);
      this.spawnEnemy("grunt", -4, 7, diff);
      this.spawnEnemy("grunt", 4, 7, diff);
      this.spawnEnemy("archer", 0, 10, diff);
      return;
    }
    if (this.floorType === "boss") {
      this.spawnEnemy("boss", 0, 7, diff);
      this.spawnEnemy("knight", -5, 6, diff);
      this.spawnEnemy("archer", 5, 8, diff);
      return;
    }
    const n = this.floorType === "survival" ? 4 : 5 + this.wave * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const r = 8 + Math.random() * 4;
      const kinds = ["grunt", "grunt", "archer", "runner", "knight"];
      const kind = kinds[(i + this.wave + this.floor) % kinds.length];
      this.spawnEnemy(kind, Math.cos(a) * r, Math.sin(a) * r, diff);
    }
  }

  spawnEnemy(kind, x, z, diff) {
    const base = ENEMY_KINDS[kind];
    const def = { ...base, id: kind };
    const mesh = createCharacter(def, true);
    const bar = hpBar();
    bar.position.y = 1.8 + (def.radius || 0.5);
    mesh.add(bar);
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.enemies.push({
      def,
      mesh,
      bar,
      pos: mesh.position,
      facing: new THREE.Vector3(0, 0, -1),
      hp: base.hp * diff,
      maxHp: base.hp * diff,
      dmg: base.dmg * (0.85 + diff * 0.15),
      atkCd: 1 + Math.random(),
      telegraph: 0,
      dead: false,
      kind,
    });
  }

  update(dt, input) {
    if (this.paused || this.over) return;
    this.time += dt;
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 8);
    if (this.surviving > 0) {
      this.surviving -= dt;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.filter((e) => !e.dead).length < 10) {
        this.spawnTimer = 3.2;
        const a = Math.random() * Math.PI * 2;
        const kinds = ["grunt", "runner", "archer"];
        this.spawnEnemy(kinds[Math.floor(Math.random() * 3)], Math.cos(a) * 11, Math.sin(a) * 11, this.path.difficulty);
      }
    }

    this.updatePlayer(this.player, dt, input);
    for (const h of this.heroes) if (!h.isPlayer && !h.dead) this.updateAlly(h, dt);
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);

    const aliveEnemies = this.enemies.filter((e) => !e.dead).length;
    if (this.floorType === "survival") {
      if (this.surviving <= 0 && aliveEnemies === 0) this.onFloorClear();
    } else if (aliveEnemies === 0) {
      if (this.wave + 1 < this.wavesTotal) {
        this.wave++;
        this.spawnWave();
      } else this.onFloorClear();
    }

    if (this.player.dead) this.fail();
    this.game.syncHud(this);
  }

  updatePlayer(h, dt, input) {
    if (this.player.dead) return;
    const v = input.joy.vector();
    const cam = this.game.combatCam;
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    move.addScaledVector(right, v.x);
    move.addScaledVector(forward, -v.y);
    const moving = move.length() > 0.08;
    if (moving) {
      move.normalize();
      h.facing.copy(move);
      const spd = h.def.speed * h.stats.speedMul * (h.charging ? 0.55 : 1);
      h.pos.addScaledVector(move, spd * dt);
      clampArena(h.pos);
      h.mesh.rotation.y = Math.atan2(move.x, move.z);
    }
    h.lightCd = Math.max(0, h.lightCd - dt);
    h.skillCd = Math.max(0, h.skillCd - dt);
    h.comboT = Math.max(0, h.comboT - dt);
    h.atkT = Math.max(0, h.atkT - dt);
    h.invuln = Math.max(0, h.invuln - dt);
    input.act.tick(dt);

    if (input.act.consumeLight() && h.lightCd <= 0) this.doLight(h);
    if (input.act.heavyDown && !h.charging && h.heavyMeter >= 0.98) {
      h.charging = true;
      h.chargeT = 0;
    }
    if (h.charging) {
      h.chargeT += dt;
      if (!input.act.heavyDown) {
        this.doHeavy(h, h.chargeT);
        h.charging = false;
      }
    }
    if (input.act.consumeSkill() && h.skillCd <= 0) this.doSkill(h);
    animateCharacter(h.mesh, dt, moving, h.atkT > 0);
    this.syncBar(h);
  }

  updateAlly(h, dt) {
    const t = nearest(h, this.enemies, 40);
    let moving = false;
    if (t) {
      const d = h.pos.distanceTo(t.pos);
      const dir = t.pos.clone().sub(h.pos);
      dir.y = 0;
      if (dir.length() > 0.001) {
        dir.normalize();
        h.facing.copy(dir);
        h.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
      if (d > h.def.range * 0.85) {
        h.pos.addScaledVector(dir, h.def.speed * 0.85 * dt);
        clampArena(h.pos);
        moving = true;
      } else {
        h.lightCd -= dt;
        if (h.lightCd <= 0) this.doLight(h);
        h.skillCd -= dt;
        if (h.skillCd <= 0 && Math.random() < 0.01) this.doSkill(h);
      }
    }
    h.atkT = Math.max(0, h.atkT - dt);
    animateCharacter(h.mesh, dt, moving, h.atkT > 0);
    this.syncBar(h);
  }

  updateEnemy(e, dt) {
    const t = nearest(e, this.heroes, 40);
    if (!t) return;
    const dir = t.pos.clone().sub(e.pos);
    dir.y = 0;
    const d = dir.length();
    if (d > 0.001) {
      dir.normalize();
      e.facing.copy(dir);
      e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
    e.atkCd -= dt;
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) this.enemyStrike(e, t);
    } else if (d > e.def.range) {
      e.pos.addScaledVector(dir, e.def.speed * dt);
      clampArena(e.pos);
    } else if (e.atkCd <= 0) {
      if (e.def.elite && Math.random() < 0.35) {
        e.telegraph = 0.85;
        const tel = makeTelegraph(2.6);
        tel.position.set(t.pos.x, 0.05, t.pos.z);
        this.group.add(tel);
        this.fx.push({ mesh: tel, t: 0.85, max: 0.85, scale: 1 });
      } else {
        this.enemyStrike(e, t);
      }
    }
    animateCharacter(e.mesh, dt, d > e.def.range, e.atkCd > e.def.range ? false : e.atkCd > 0.6);
    this.syncBar(e, true);
  }

  enemyStrike(e, t) {
    e.atkCd = e.def.ranged ? 1.6 : 1.15;
    if (e.def.ranged) {
      this.shoot(e, t.pos.clone(), "bolt", e.def.color, e.dmg, false);
    } else if (e.pos.distanceTo(t.pos) <= e.def.range + 0.6) {
      this.hurt(t, e.dmg, e.pos);
    }
  }

  doLight(h) {
    h.lightCd = h.def.light.cd;
    h.combo = h.comboT > 0 ? (h.combo + 1) % h.def.light.combo : 1;
    h.comboT = 0.7;
    h.atkT = 0.22;
    h.heavyMeter = Math.min(1, h.heavyMeter + h.stats.chargeGain);
    const dmg = h.def.light.dmg * h.stats.lightMul * (1 + h.combo * 0.08);
    if (h.def.style === "ranged") {
      const tgt = nearest(h, this.enemies, h.def.range + 4);
      const aim = tgt ? tgt.pos.clone() : h.pos.clone().add(h.facing.clone().multiplyScalar(8));
      const kind = h.def.id === "pyre" ? "rocket" : h.def.id === "blast" ? "bomb" : "arrow";
      const shots = 1 + h.stats.extraShots;
      for (let i = 0; i < shots; i++) {
        const a = aim.clone();
        if (shots > 1) {
          a.x += (i - (shots - 1) / 2) * 1.2;
        }
        this.shoot(h, a, kind, h.def.color, dmg, true, h.stats.homing);
      }
    } else {
      this.melee(h, h.def.range, dmg, 2.2, h.stats.aoe ? 1.6 : 0.7);
    }
    this.game.audio.hit();
  }

  doHeavy(h, held) {
    if (h.heavyMeter < 0.98) return;
    h.heavyMeter = 0;
    h.atkT = 0.4;
    const need = h.def.heavy.charge;
    const perfect = held >= need * 0.72 && held <= need * 1.08;
    const charged = held >= need * 0.55;
    let dmg = h.def.heavy.dmg * h.stats.heavyMul;
    if (perfect) dmg *= 1.65;
    else if (charged) dmg *= 1.25;
    const knock = perfect ? 7 : charged ? 4.5 : 3;
    if (h.def.style === "ranged") {
      const tgt = nearest(h, this.enemies, 14);
      const aim = tgt ? tgt.pos.clone() : h.pos.clone().add(h.facing.clone().multiplyScalar(10));
      const kind = h.def.id === "blast" ? "bomb" : h.def.id === "pyre" ? "rocket" : "arrow";
      this.shoot(h, aim, kind, h.def.color, dmg, true, true, perfect ? 2.4 : 1.4);
      if (perfect && (h.def.id === "ranger" || h.def.id === "pyre")) {
        for (const extra of [-1.4, 1.4]) {
          const a = aim.clone();
          a.x += extra;
          this.shoot(h, a, kind, h.def.color, dmg * 0.6, true, true);
        }
      }
    } else {
      this.melee(h, h.def.range + 0.8, dmg, knock, perfect ? 2.8 : 1.6);
      if (perfect) this.burst(h.pos, h.def.color, 2.2);
    }
    this.shake = perfect ? 0.55 : 0.28;
    if (perfect) this.game.audio.perfect();
    else this.game.audio.heavy();
  }

  doSkill(h) {
    h.skillCd = h.def.skill.cd * h.stats.skillCdMul;
    h.atkT = 0.45;
    const dmg = h.def.skill.dmg * h.stats.lightMul;
    if (h.def.id === "berserker") {
      this.melee(h, 3.2, dmg, 6, 3.2);
      this.burst(h.pos, "#f0b429", 3);
      h.stats._haste = 1.5;
    } else if (h.def.id === "ranger") {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7 - 0.5) * 1.1;
        const dir = h.facing.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const aim = h.pos.clone().add(dir.multiplyScalar(12));
        this.shoot(h, aim, "arrow", h.def.color, dmg, true, true);
      }
    } else if (h.def.id === "aegis") {
      h.stats._spin = 0.7;
      this.melee(h, 3.4, dmg * 0.5, 3, 3.4);
    } else if (h.def.id === "pyre") {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (h.dead) return;
          const tgt = nearest(h, this.enemies, 16);
          const aim = tgt ? tgt.pos.clone() : h.pos.clone().add(h.facing.clone().multiplyScalar(8));
          this.shoot(h, aim, "rocket", h.def.color, dmg, true, true, 1.8);
        }, i * 120);
      }
    } else if (h.def.id === "blast") {
      for (let i = 0; i < 4; i++) {
        const dir = h.facing.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1.5) * 0.35);
        const aim = h.pos.clone().add(dir.multiplyScalar(6 + i));
        this.shoot(h, aim, "bomb", h.def.color, dmg, true, false, 2.2);
      }
    } else if (h.def.id === "knave") {
      const dir = h.facing.clone().setY(0).normalize();
      h.pos.addScaledVector(dir, 4.2);
      clampArena(h.pos);
      this.melee(h, 2.2, dmg, 4, 2.2);
      h.invuln = 0.35;
    }
    this.shake = 0.35;
    this.game.audio.skill();
  }

  melee(h, range, dmg, knock, radius) {
    const origin = h.pos.clone().add(h.facing.clone().multiplyScalar(0.8));
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dist = e.pos.distanceTo(origin);
      if (dist <= range + (e.def.radius || 0.5) && dist <= radius + range * 0.35) {
        const facing = e.pos.clone().sub(h.pos);
        if (facing.dot(h.facing) > -0.15 || dist < radius) this.hurt(e, dmg, h.pos, knock, h);
      }
    }
  }

  shoot(from, target, kind, color, dmg, friendly, homing = false, boom = 0) {
    const mesh = createProjectile(kind, color);
    mesh.position.copy(from.pos);
    mesh.position.y = 1.1;
    const dir = target.clone().sub(from.pos);
    dir.y = 0;
    if (dir.length() < 0.01) dir.copy(from.facing);
    dir.normalize();
    mesh.lookAt(mesh.position.clone().add(dir));
    this.group.add(mesh);
    this.projectiles.push({
      mesh,
      pos: mesh.position,
      dir,
      speed: kind === "bomb" ? 8 : kind === "rocket" ? 14 : 18,
      dmg,
      friendly,
      homing,
      boom,
      life: 1.6,
      owner: from,
      kind,
    });
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.homing) {
        const list = p.friendly ? this.enemies : this.heroes;
        const t = nearest({ pos: p.pos }, list, 8);
        if (t) {
          const want = t.pos.clone().sub(p.pos);
          want.y = 0;
          want.normalize();
          p.dir.lerp(want, 0.12).normalize();
        }
      }
      p.pos.addScaledVector(p.dir, p.speed * dt);
      p.pos.y = 1.1;
      p.mesh.lookAt(p.pos.clone().add(p.dir));
      const hits = p.friendly ? this.enemies : this.heroes;
      for (const h of hits) {
        if (h.dead) continue;
        if (p.pos.distanceTo(h.pos) < 0.85 + (h.def.radius || 0.5)) {
          this.hurt(h, p.dmg, p.pos, 2.2, p.friendly ? p.owner : null);
          if (p.boom) this.explode(p.pos, p.boom, p.dmg * 0.5, p.friendly, p.owner);
          p.dead = true;
          this.group.remove(p.mesh);
          break;
        }
      }
      if (!p.dead && (p.life <= 0 || Math.hypot(p.pos.x, p.pos.z) > ARENA + 1)) {
        if (p.kind === "bomb" || p.boom) this.explode(p.pos, p.boom || 1.6, p.dmg * 0.7, p.friendly, p.owner);
        p.dead = true;
        this.group.remove(p.mesh);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  explode(pos, r, dmg, friendly, owner) {
    this.burst(pos, "#ff9a4a", r);
    const list = friendly ? this.enemies : this.heroes;
    for (const h of list) {
      if (!h.dead && h.pos.distanceTo(pos) <= r + 0.5) this.hurt(h, dmg, pos, 3.5, owner);
    }
  }

  hpPool(target) {
    return target.stats || target;
  }

  hurt(target, dmg, from, knock = 1.8, source = null) {
    if (target.dead || target.invuln > 0) return;
    const crit = source && Math.random() < (source.stats?.crit || 0);
    let dealt = dmg * (crit ? 2 : 1);
    if (target.stats) dealt *= target.stats.armor;
    const pool = this.hpPool(target);
    pool.hp -= dealt;
    if (from) {
      const k = target.pos.clone().sub(from);
      k.y = 0;
      if (k.length() > 0.01) {
        k.normalize();
        target.pos.addScaledVector(k, knock * 0.12);
        clampArena(target.pos);
      }
    }
    if (source?.stats?.vamp) {
      source.stats.hp = Math.min(source.stats.maxHp, source.stats.hp + dealt * source.stats.vamp);
    }
    this.floatText(target.pos, Math.round(dealt), crit);
    this.flash(target.mesh);
    if (pool.hp <= 0) this.kill(target, source);
  }

  kill(target, source) {
    target.dead = true;
    this.hpPool(target).hp = 0;
    if (target.def && this.enemies.includes(target)) {
      this.kills++;
      this.gold += target.def.xp || 8;
      this.burst(target.pos, "#ffe98a", 1.1);
      this.group.remove(target.mesh);
    } else {
      target.mesh.visible = false;
    }
  }

  syncBar(u, enemy = false) {
    const hp = enemy ? u.hp : u.stats.hp;
    const max = enemy ? u.maxHp : u.stats.maxHp;
    const r = Math.max(0, hp / max);
    const fg = u.bar.userData.fg;
    fg.scale.x = Math.max(0.001, r);
    fg.position.x = -((1 - r) * u.bar.userData.base) / 2;
    fg.material.color.set(r > 0.45 ? 0x3ecf5a : r > 0.2 ? 0xf0b429 : 0xe23b3b);
    u.bar.lookAt(this.game.combatCam.position);
  }

  burst(pos, color, scale) {
    const m = makeBurst(new THREE.Color(color).getHex());
    m.position.copy(pos);
    m.position.y = 0.8;
    this.group.add(m);
    this.fx.push({ mesh: m, t: 0.28, max: 0.28, scale });
  }

  flash(mesh) {
    mesh.traverse((o) => {
      if (o.material && o.material.emissive) {
        o.material.emissive.setHex(0xffffff);
        setTimeout(() => o.material && o.material.emissive.setHex(0x000000), 60);
      }
    });
  }

  floatText(pos, n, crit) {
    const el = document.createElement("div");
    el.className = "dmg";
    el.textContent = n;
    el.style.cssText = `position:absolute;z-index:8;font-family:'Lilita One',cursive;font-size:${crit ? 28 : 18}px;color:${crit ? "#ffe98a" : "#fff"};text-shadow:0 2px 0 #3a1d0a;pointer-events:none;`;
    document.getElementById("app").appendChild(el);
    this.floats.push({ el, pos: pos.clone(), t: 0.7, y: 0 });
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.t -= dt;
      const k = 1 - f.t / f.max;
      f.mesh.scale.setScalar(f.scale * (0.4 + k * 1.4));
      if (f.mesh.material) f.mesh.material.opacity = Math.max(0, 0.7 * (1 - k));
      if (f.t <= 0) this.group.remove(f.mesh);
    }
    this.fx = this.fx.filter((f) => f.t > 0);
    for (const f of this.floats) {
      f.t -= dt;
      f.y += dt * 50;
      const p = f.pos.clone();
      p.y += 1.6;
      const v = p.project(this.game.combatCam);
      f.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      f.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight - f.y}px`;
      f.el.style.opacity = String(Math.max(0, f.t / 0.7));
      if (f.t <= 0) f.el.remove();
    }
    this.floats = this.floats.filter((f) => f.t > 0);
  }

  onFloorClear() {
    if (this.cleared) return;
    this.cleared = true;
    this.floor++;
    if (this.floor >= this.path.floors) {
      this.win();
      return;
    }
    this.game.openPerks(this);
  }

  continueAfterPerk() {
    this.beginFloor();
  }

  win() {
    this.over = true;
    this.game.endRun(true, this);
  }

  fail() {
    this.over = true;
    this.game.endRun(false, this);
  }

  clearScene() {
    for (const f of this.floats) f.el.remove();
    this.floats = [];
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
      });
    }
  }
}
