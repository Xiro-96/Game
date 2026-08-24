import * as THREE from "three";
import { HEROES, PATHS, PERKS, objectiveText } from "./data.js";
import { AudioBus } from "./audio.js";
import { Joystick, ActionButtons } from "./input.js";
import { createHubWorld } from "./world.js";
import { Combat } from "./combat.js";
import { createCharacter } from "./characters.js";

const SAVE_KEY = "ascent-save-v1";

function loadSave() {
  try {
    return {
      gold: 0,
      elixir: 0,
      gems: 40,
      best: 0,
      unlocked: 1,
      ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"),
    };
  } catch {
    return { gold: 0, elixir: 0, gems: 40, best: 0, unlocked: 1 };
  }
}

export class Game {
  constructor() {
    this.save = loadSave();
    this.audio = new AudioBus();
    this.mode = "boot";
    this.heroId = "berserker";
    this.pathId = "brave";
    this.combat = new Combat(this);
    this.clock = new THREE.Clock();
    this.hubT = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById("scene"),
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.hubScene = createHubWorld();
    this.hubCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
    this.combatCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 80);

    this.heroPreview = createCharacter(HEROES[0]);
    this.heroPreview.position.set(-3.2, 0, 4.2);
    this.hubScene.add(this.heroPreview);

    this.input = {
      joy: new Joystick(document.getElementById("joystick"), document.getElementById("joy-knob")),
      act: new ActionButtons(),
    };

    this.bindUi();
    this.refreshTop();
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.loop();
    setTimeout(() => this.showTitle(), 1500);
  }

  persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h);
    this.hubCam.aspect = w / h;
    this.hubCam.updateProjectionMatrix();
    this.combatCam.aspect = w / h;
    this.combatCam.updateProjectionMatrix();
  }

  show(id) {
    for (const el of document.querySelectorAll(".screen")) el.classList.add("hidden");
    document.getElementById("hud").classList.add("hidden");
    if (id) document.getElementById(id).classList.remove("hidden");
  }

  showTitle() {
    this.mode = "title";
    this.show("title");
  }

  enterHub() {
    this.mode = "hub";
    this.show("hub");
    this.refreshTop();
    this.placePreview();
  }

  placePreview() {
    const def = HEROES.find((h) => h.id === this.heroId);
    this.hubScene.remove(this.heroPreview);
    this.heroPreview = createCharacter(def);
    this.heroPreview.position.set(-3.2, 0, 4.2);
    this.hubScene.add(this.heroPreview);
  }

  refreshTop() {
    document.getElementById("res-gold").textContent = Math.floor(this.save.gold);
    document.getElementById("res-elixir").textContent = Math.floor(this.save.elixir);
    document.getElementById("res-gems").textContent = Math.floor(this.save.gems);
    document.getElementById("best-floor").textContent = this.save.best;
  }

  bindUi() {
    const tap = (id, fn) =>
      document.getElementById(id).addEventListener("click", () => {
        this.audio.resume();
        this.audio.ui();
        fn();
      });

    tap("btn-play", () => this.enterHub());
    tap("btn-climb", () => this.openHeroes());
    tap("btn-heroes", () => this.openHeroes());
    tap("hero-back", () => this.enterHub());
    tap("hero-confirm", () => this.openPaths());
    tap("path-back", () => this.openHeroes());
    tap("path-confirm", () => this.startClimb());
    tap("btn-pause", () => this.pause(true));
    tap("btn-resume", () => this.pause(false));
    tap("btn-quit", () => {
      this.combat.fail();
    });
    tap("btn-home", () => this.enterHub());
    tap("btn-shop", () => this.toast("Shop kommt in der nächsten Saison."));
    tap("btn-squad", () => this.toast("Matchmaking: KI-Trupp ist bereit."));
    tap("btn-profile", () => this.toast(`Höchste Etage: ${this.save.best}`));

    document.getElementById("hero-grid").innerHTML = HEROES.map(
      (h) => `
      <button class="hero-card" data-id="${h.id}" type="button">
        <div class="swatch" style="background:linear-gradient(${h.color},${h.accent})"></div>
        <b>${h.title}</b>
        <small>${h.name}</small>
      </button>`
    ).join("");

    document.getElementById("hero-grid").addEventListener("click", (e) => {
      const card = e.target.closest(".hero-card");
      if (!card) return;
      this.audio.ui();
      this.heroId = card.dataset.id;
      this.renderHeroSelect();
    });

    document.getElementById("path-row").innerHTML = PATHS.map(
      (p) => `
      <button class="path-card" data-id="${p.id}" type="button">
        <div class="floors">${p.floors}</div>
        <h3 style="color:${p.color}">${p.name}</h3>
        <p>${p.mins}</p>
        <p>${p.blurb}</p>
      </button>`
    ).join("");

    document.getElementById("path-row").addEventListener("click", (e) => {
      const card = e.target.closest(".path-card");
      if (!card || card.classList.contains("locked")) return;
      this.audio.ui();
      this.pathId = card.dataset.id;
      this.renderPaths();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.mode === "combat") this.pause(!this.combat.paused);
    });
  }

  openHeroes() {
    this.mode = "hero";
    this.show("hero-select");
    this.renderHeroSelect();
  }

  renderHeroSelect() {
    const def = HEROES.find((h) => h.id === this.heroId);
    document.getElementById("hero-name").textContent = `${def.title} · ${def.name}`;
    document.getElementById("hero-role").textContent = def.role;
    document.getElementById("hero-blurb").textContent = def.blurb;
    document.getElementById("kit-light").textContent = def.kit.light;
    document.getElementById("kit-heavy").textContent = def.kit.heavy;
    document.getElementById("kit-skill").textContent = def.kit.skill;
    for (const c of document.querySelectorAll(".hero-card")) {
      c.classList.toggle("selected", c.dataset.id === this.heroId);
    }
    this.placePreview();
  }

  openPaths() {
    this.mode = "path";
    this.show("path-select");
    this.renderPaths();
  }

  renderPaths() {
    for (const c of document.querySelectorAll(".path-card")) {
      const p = PATHS.find((x) => x.id === c.dataset.id);
      const locked = this.save.unlocked < p.unlock + 1 && p.id !== "brave";
      c.classList.toggle("locked", locked);
      c.classList.toggle("selected", c.dataset.id === this.pathId && !locked);
      c.disabled = locked;
    }
  }

  startClimb() {
    const path = PATHS.find((p) => p.id === this.pathId);
    if (this.save.unlocked < path.unlock + 1 && path.id !== "brave") {
      this.toast("Pfad noch gesperrt.");
      return;
    }
    this.mode = "combat";
    this.show(null);
    this.input.joy.enabled = true;
    this.combat.startRun(this.heroId, path);
  }

  showHud(c) {
    document.getElementById("hud").classList.remove("hidden");
    document.getElementById("hud-path").textContent = c.path.name;
    document.getElementById("hud-floor").textContent = `ETAGE ${c.floor + 1}/${c.path.floors}`;
    document.getElementById("hud-obj").textContent = objectiveText(c.floorType);
    document.getElementById("skill-icon").textContent = c.player.def.icon;
    this.renderSquad(c);
    this.banner(`${objectiveText(c.floorType).toUpperCase()}`);
  }

  renderSquad(c) {
    document.getElementById("squad").innerHTML = c.heroes
      .map(
        (h) => `
      <div class="mate" data-id="${h.def.id}">
        <div class="ava" style="background:linear-gradient(${h.def.color},${h.def.accent})"></div>
        <div>
          <div class="nm">${h.isPlayer ? "DU · " : ""}${h.def.title}</div>
          <div class="hp"><i></i></div>
        </div>
      </div>`
      )
      .join("");
  }

  syncHud(c) {
    const meter = document.getElementById("heavy-meter");
    const circ = 264;
    meter.style.strokeDashoffset = String(circ * (1 - c.player.heavyMeter));
    const pr = document.getElementById("perfect-ring");
    if (c.player.charging) {
      const t = c.player.chargeT / c.player.def.heavy.charge;
      pr.style.opacity = t > 0.7 && t < 1.1 ? "1" : "0.35";
      pr.style.strokeDashoffset = String(circ * (1 - Math.min(1, t)));
    } else {
      pr.style.opacity = "0";
    }
    const cd = c.player.skillCd / (c.player.def.skill.cd * c.player.stats.skillCdMul);
    document.getElementById("skill-cd").style.setProperty("--p", `${Math.max(0, cd) * 100}%`);
    document.getElementById("hud-floor").textContent = `ETAGE ${c.floor + 1}/${c.path.floors}`;
    if (c.floorType === "survival") {
      document.getElementById("hud-obj").textContent = `Überleben ${Math.max(0, Math.ceil(c.surviving))}s`;
    }
    const mates = document.querySelectorAll(".mate");
    c.heroes.forEach((h, i) => {
      const bar = mates[i]?.querySelector("i");
      if (bar) bar.style.width = `${Math.max(0, (h.stats.hp / h.stats.maxHp) * 100)}%`;
    });
    this.drawMinimap(c);
    const fill = document.getElementById("wavebar");
    if (c.floorType === "combat") {
      fill.classList.remove("hidden");
      document.getElementById("wavefill").style.width = `${((c.wave + (c.enemies.every((e) => e.dead) ? 1 : 0)) / c.wavesTotal) * 100}%`;
    } else fill.classList.add("hidden");
  }

  drawMinimap(c) {
    const el = document.getElementById("minimap");
    const dots = [{ x: c.player.pos.x, z: c.player.pos.z, col: "#ffe98a", s: 7 }].concat(
      c.heroes.filter((h) => !h.isPlayer && !h.dead).map((h) => ({ x: h.pos.x, z: h.pos.z, col: "#3aa0ff", s: 5 })),
      c.enemies.filter((e) => !e.dead).map((e) => ({ x: e.pos.x, z: e.pos.z, col: e.def.elite ? "#ff6b6b" : "#c45a3a", s: e.def.elite ? 6 : 4 }))
    );
    el.innerHTML = dots
      .map((d) => {
        const x = 50 + (d.x / 16) * 42;
        const y = 50 + (d.z / 16) * 42;
        return `<i style="position:absolute;left:${x}%;top:${y}%;width:${d.s}px;height:${d.s}px;margin:${-d.s / 2}px;border-radius:50%;background:${d.col}"></i>`;
      })
      .join("");
  }

  banner(text) {
    const el = document.getElementById("banner");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(this._ban);
    this._ban = setTimeout(() => el.classList.add("hidden"), 1600);
  }

  openPerks(c) {
    c.paused = true;
    this.show("perk");
    document.getElementById("hud").classList.add("hidden");
    const pool = [...PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
    document.getElementById("perk-row").innerHTML = pool
      .map(
        (p) => `
      <button class="perk-card" data-id="${p.id}" type="button">
        <div style="font-size:28px">✦</div>
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
      </button>`
      )
      .join("");
    const row = document.getElementById("perk-row");
    row.onclick = (e) => {
      const card = e.target.closest(".perk-card");
      if (!card) return;
      this.audio.ui();
      c.perksPicked.push(card.dataset.id);
      this.show(null);
      document.getElementById("hud").classList.remove("hidden");
      c.continueAfterPerk();
    };
  }

  pause(on) {
    if (this.mode !== "combat") return;
    this.combat.paused = on;
    document.getElementById("pause").classList.toggle("hidden", !on);
  }

  endRun(win, c) {
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("pause").classList.add("hidden");
    this.input.joy.enabled = false;
    this.show("results");
    const stamp = document.getElementById("result-stamp");
    stamp.textContent = win ? "SIEG" : "NIEDERLAGE";
    stamp.classList.toggle("fail", !win);
    document.getElementById("result-title").textContent = win ? "Turm bezwungen" : `Gefallen auf Etage ${c.floor + 1}`;
    const bonus = Math.floor(c.gold * (win ? 1.4 : 0.6) + c.floor * 20);
    this.save.gold += bonus;
    this.save.elixir += Math.floor(bonus * 0.25);
    this.save.best = Math.max(this.save.best, win ? c.path.floors : c.floor);
    if (win) {
      if (c.path.id === "brave") this.save.unlocked = Math.max(this.save.unlocked, 2);
      if (c.path.id === "heroic") this.save.unlocked = Math.max(this.save.unlocked, 3);
      this.audio.win();
    } else this.audio.lose();
    this.persist();
    document.getElementById("result-stats").innerHTML = `
      <div><span>Etagen</span><b>${win ? c.path.floors : c.floor}/${c.path.floors}</b></div>
      <div><span>Besiegt</span><b>${c.kills}</b></div>
      <div><span>Gold</span><b>+${bonus}</b></div>
      <div><span>Zeit</span><b>${Math.floor(c.elapsed / 60)}:${String(Math.floor(c.elapsed % 60)).padStart(2, "0")}</b></div>`;
    this.mode = "results";
    this.refreshTop();
  }

  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.add("hidden"), 1800);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.033, this.clock.getDelta());
    if (this.mode === "combat" && this.combat.scene) {
      this.combat.update(dt, this.input);
      const p = this.combat.player.pos;
      const sh = this.combat.shake;
      const ox = (Math.random() - 0.5) * sh * 0.6;
      const oz = (Math.random() - 0.5) * sh * 0.6;
      this.combatCam.position.set(p.x + ox, 16.5, p.z + 13.5 + oz);
      this.combatCam.lookAt(p.x, 0.6, p.z);
      this.renderer.render(this.combat.scene, this.combatCam);
    } else {
      this.hubT += dt;
      this.hubCam.position.set(Math.sin(this.hubT * 0.12) * 4 - 2, 7.2, 14.5);
      this.hubCam.lookAt(-1, 3.5, -4);
      if (this.heroPreview) this.heroPreview.rotation.y = Math.sin(this.hubT * 0.8) * 0.25 + 0.4;
      this.renderer.render(this.hubScene, this.hubCam);
    }
  }
}
