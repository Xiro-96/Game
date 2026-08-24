export class Joystick {
  constructor(root, knob) {
    this.root = root;
    this.knob = knob;
    this.active = false;
    this.id = null;
    this.x = 0;
    this.y = 0;
    this.origin = { x: 0, y: 0 };
    this.keys = { w: false, a: false, s: false, d: false };
    this.enabled = false;

    const start = (e) => {
      if (!this.enabled) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (t.clientX > window.innerWidth * 0.46) return;
      this.active = true;
      this.id = t.identifier ?? "mouse";
      const r = this.root.getBoundingClientRect();
      this.origin.x = t.clientX;
      this.origin.y = t.clientY;
      this.root.style.left = `${t.clientX - r.width / 2}px`;
      this.root.style.bottom = `${window.innerHeight - t.clientY - r.height / 2}px`;
      this.move(t);
    };
    const move = (e) => {
      if (!this.active) return;
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      const t = list.find((p) => (p.identifier ?? "mouse") === this.id) || list[0];
      if (t) this.move(t);
    };
    const end = (e) => {
      if (!this.active) return;
      const list = e.changedTouches ? [...e.changedTouches] : [e];
      if (!list.some((p) => (p.identifier ?? "mouse") === this.id) && e.changedTouches) return;
      this.active = false;
      this.id = null;
      this.x = 0;
      this.y = 0;
      this.knob.style.transform = "translate(-50%, -50%)";
      this.root.style.left = "";
      this.root.style.bottom = "";
    };

    window.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k in this.keys) this.keys[k] = true;
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k in this.keys) this.keys[k] = false;
    });
  }

  move(t) {
    const r = this.root.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const max = r.width * 0.32;
    const len = Math.hypot(dx, dy) || 1;
    const s = Math.min(1, len / max);
    dx = (dx / len) * s;
    dy = (dy / len) * s;
    this.x = dx;
    this.y = dy;
    this.knob.style.transform = `translate(calc(-50% + ${dx * max}px), calc(-50% + ${dy * max}px))`;
  }

  vector() {
    let x = this.x;
    let y = this.y;
    if (this.keys.a) x -= 1;
    if (this.keys.d) x += 1;
    if (this.keys.w) y -= 1;
    if (this.keys.s) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }
}

export class ActionButtons {
  constructor() {
    this.light = false;
    this.heavyDown = false;
    this.heavyHeld = 0;
    this.skill = false;
    this._bind("btn-light", "light");
    this._bind("btn-skill", "skill");
    const heavy = document.getElementById("btn-heavy");
    const down = () => {
      this.heavyDown = true;
      this.heavyHeld = 0;
    };
    const up = () => {
      this.heavyDown = false;
    };
    heavy.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      down();
    });
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.key.toLowerCase() === "j") this.light = true;
      if (e.key.toLowerCase() === "k") down();
      if (e.key.toLowerCase() === "l") this.skill = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.key.toLowerCase() === "k") up();
    });
  }

  _bind(id, key) {
    const el = document.getElementById(id);
    const fire = (e) => {
      e.preventDefault();
      this[key] = true;
    };
    el.addEventListener("pointerdown", fire);
  }

  tick(dt) {
    if (this.heavyDown) this.heavyHeld += dt;
  }

  consumeLight() {
    const v = this.light;
    this.light = false;
    return v;
  }

  consumeSkill() {
    const v = this.skill;
    this.skill = false;
    return v;
  }
}
