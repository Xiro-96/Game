export class AudioBus {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  resume() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  tone(freq, dur = 0.12, type = "square", gain = 0.2, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur = 0.08, gain = 0.12) {
    if (this.muted || !this.ctx) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  ui() {
    this.tone(520, 0.08, "triangle", 0.12);
    this.tone(780, 0.1, "triangle", 0.08);
  }

  hit() {
    this.noise(0.05, 0.1);
    this.tone(180, 0.07, "square", 0.12, -80);
  }

  heavy() {
    this.noise(0.12, 0.16);
    this.tone(90, 0.18, "sawtooth", 0.18, -40);
  }

  perfect() {
    this.tone(660, 0.12, "triangle", 0.14);
    this.tone(990, 0.16, "triangle", 0.1);
  }

  skill() {
    this.tone(240, 0.2, "sawtooth", 0.14, 180);
    this.noise(0.1, 0.1);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.18, "triangle", 0.14), i * 90);
    });
  }

  lose() {
    this.tone(220, 0.3, "sawtooth", 0.12, -120);
  }
}
