/* ============================================================================
   05 · AUDIO — 100% procedural WebAudio. No external assets, spatial, pooled.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U;
  const A = (LL.Audio = {
    ctx: null, ready: false, suspended: false,
    master: null, comp: null, sfxBus: null, musicBus: null, ambBus: null,
    noiseBuf: null, brownBuf: null,
    voices: 0, maxVoices: 28, _cool: Object.create(null),
    engine: null, screech: null, siren: null, chopper: null,
    rain: null, wave: null, city: null, wind: null,
    musicOn: false, musicStep: 0, musicNext: 0, musicDuck: 1,
    _lastHorn: 0, _lastBird: 0, _ready: false,
    settings: null,
    init() {
      if (this.ready) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        const ctx = (this.ctx = new AC());
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14; this.comp.knee.value = 22; this.comp.ratio.value = 5;
        this.comp.attack.value = 0.004; this.comp.release.value = 0.22;
        this.master = ctx.createGain(); this.master.gain.value = 0.75;
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9;
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.3;
        this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.7;
        this.sfxBus.connect(this.master); this.musicBus.connect(this.master); this.ambBus.connect(this.master);
        this.master.connect(this.comp); this.comp.connect(ctx.destination);
        this.noiseBuf = this._makeNoise(2.2, false);
        this.brownBuf = this._makeNoise(3.0, true);
        this.ready = true;
        this.applySettings();
        this._buildAmbience();
        this.musicOn = true;
        this.musicNext = ctx.currentTime + 0.2;
        this._ready = true;
        LL.emit('audio:ready');
        return true;
      } catch (e) { LL.reportError(e, 'audio'); return false; }
    },
    _makeNoise(seconds, brown) {
      const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        else d[i] = w;
      }
      return buf;
    },
    resume() {
      if (!this.ready) { this.init(); }
      if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume().catch(() => { }); }
      this.suspended = false;
    },
    suspend() { if (this.ctx && this.ctx.state === 'running') { this.ctx.suspend().catch(() => { }); this.suspended = true; } },
    applySettings() {
      const S = LL.Settings;
      if (!this.ready) return;
      try {
        this.master.gain.setTargetAtTime(S.master, this.ctx.currentTime, 0.05);
        this.musicBus.gain.setTargetAtTime(S.music * 0.9, this.ctx.currentTime, 0.08);
        this.sfxBus.gain.setTargetAtTime(S.sfx, this.ctx.currentTime, 0.05);
        this.ambBus.gain.setTargetAtTime(S.sfx * 0.75, this.ctx.currentTime, 0.1);
      } catch (e) { }
    },
    _bus(dest) {
      return dest === 'music' ? this.musicBus : dest === 'amb' ? this.ambBus : this.sfxBus;
    },
    _now() { return this.ctx ? this.ctx.currentTime : 0; },
    _gate(name, ms) {
      const n = performance.now(), last = this._cool[name] || 0;
      if (n - last < ms) return false;
      this._cool[name] = n; return true;
    },
    _spatial(x, y) {
      if (!isFinite(x) || !isFinite(y)) return { gain: 1, pan: 0, dist: 0, behind: 0 };
      const g = LL.game;
      if (!g || !g.camera) return { gain: 1, pan: 0, dist: 0, behind: 0 };
      const p = g.player ? g.player.pos : { x: 0, y: 0 };
      const dist = Math.hypot(x - p.x, y - p.y);
      const cam = g.camera;
      let pan = 0, behind = 0;
      try {
        if (!A._v1) { A._v1 = new THREE.Vector3(); A._v2 = new THREE.Vector3(); A._v3 = new THREE.Vector3(); A._v4 = new THREE.Vector3(); }
        A._v1.set(x, 1.2, y).sub(cam.position);
        cam.getWorldDirection(A._v2); A._v2.y = 0;
        if (A._v2.lengthSq() < 1e-4) A._v2.set(0, 0, -1);
        A._v2.normalize();
        A._v3.crossVectors(A._v2, new THREE.Vector3(0, 1, 0)).normalize();
        const horiz = Math.hypot(A._v1.x, A._v1.z) || 1;
        pan = U.clamp((A._v1.x * A._v3.x + A._v1.z * A._v3.z) / horiz, -1, 1) * 0.85;
        behind = A._v1.x * A._v2.x + A._v1.z * A._v2.z < 0 ? 1 : 0;
      } catch (e) { }
      const gain = 1 / (1 + dist / 26) * (behind ? 0.82 : 1);
      return { gain: U.clamp(gain, 0, 1), pan, dist, behind };
    },
    _voice(seconds) {
      if (!this.ready) return false;
      if (this.voices >= this.maxVoices) return false;
      this.voices++;
      setTimeout(() => { this.voices = Math.max(0, this.voices - 1); }, Math.max(80, seconds * 1000));
      return true;
    },
    _panner(pan) {
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner(); p.pan.value = U.clamp(pan || 0, -1, 1); return p;
      }
      return this.ctx.createGain();
    },
    tone(opt) {
      if (!this.ready || !this._voice(opt.dur || 0.2)) return;
      const ctx = this.ctx, t = ctx.currentTime + (opt.delay || 0);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = opt.type || 'sine';
      o.frequency.setValueAtTime(opt.freq || 440, t);
      if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + (opt.dur || 0.2));
      let dest = g;
      if (opt.filter) {
        const f = ctx.createBiquadFilter(); f.type = opt.filter; f.frequency.value = opt.filterFreq || 900; f.Q.value = opt.q || 1;
        o.connect(f); f.connect(g);
      } else o.connect(g);
      const pan = this._panner(opt.pan || 0);
      g.connect(pan); pan.connect(this._bus(opt.bus));
      const vol = Math.max(0.0001, (opt.gain ?? 0.2));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, (opt.dur || 0.2) * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));
      o.start(t); o.stop(t + (opt.dur || 0.2) + 0.03);
    },
    noise(opt) {
      if (!this.ready || !this._voice(opt.dur || 0.2)) return;
      const ctx = this.ctx, t = ctx.currentTime + (opt.delay || 0);
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
      s.loop = true; s.playbackRate.value = opt.rate || 1;
      const f = ctx.createBiquadFilter(); f.type = opt.filter || 'lowpass';
      f.frequency.setValueAtTime(opt.freq || 1200, t);
      if (opt.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.to), t + (opt.dur || 0.2));
      f.Q.value = opt.q || 0.8;
      const g = ctx.createGain();
      const pan = this._panner(opt.pan || 0);
      s.connect(f); f.connect(g); g.connect(pan); pan.connect(this._bus(opt.bus));
      const vol = Math.max(0.0001, opt.gain ?? 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));
      s.start(t, Math.random() * 1.2); s.stop(t + (opt.dur || 0.2) + 0.05);
    },

    /* ------------------------------------------------------------- one-shots */
    ui(kind) {
      if (!this.ready) return;
      const now = this._now();
      switch (kind) {
        case 'hover': this.tone({ freq: 720, to: 820, dur: 0.03, gain: 0.025, type: 'sine' }); break;
        case 'click': this.tone({ freq: 420, to: 620, dur: 0.06, gain: 0.07, type: 'triangle' }); break;
        case 'back': this.tone({ freq: 380, to: 240, dur: 0.08, gain: 0.06, type: 'triangle' }); break;
        case 'error': this.tone({ freq: 150, to: 110, dur: 0.18, gain: 0.09, type: 'square', filter: 'lowpass', filterFreq: 600 }); break;
        case 'confirm': this.tone({ freq: 520, dur: 0.08, gain: 0.07, type: 'triangle' }); this.tone({ freq: 780, dur: 0.12, gain: 0.07, type: 'triangle', delay: 0.07 }); break;
        case 'cash': [880, 1170, 1560].forEach((f, i) => this.tone({ freq: f, dur: 0.12, gain: 0.055, type: 'sine', delay: i * 0.055 })); break;
        case 'pickup': [520, 660, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.14, gain: 0.06, type: 'triangle', delay: i * 0.06 })); break;
        case 'star': this.tone({ freq: 180, to: 320, dur: 0.4, gain: 0.09, type: 'sawtooth', filter: 'lowpass', filterFreq: 900 }); break;
        case 'mission': [392, 523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.35, gain: 0.08, type: 'triangle', delay: i * 0.11 })); break;
        case 'fail': [330, 262, 196].forEach((f, i) => this.tone({ freq: f, dur: 0.4, gain: 0.08, type: 'sawtooth', filter: 'lowpass', filterFreq: 700, delay: i * 0.16 })); break;
        case 'reload': this.noise({ dur: 0.05, gain: 0.12, filter: 'highpass', freq: 1800 }); this.noise({ dur: 0.05, gain: 0.1, filter: 'highpass', freq: 1200, delay: 0.16 }); break;
        case 'empty': this.tone({ freq: 900, dur: 0.03, gain: 0.05, type: 'square' }); break;
      }
    },
    shot(kind, x, y) {
      if (!this.ready || !this._gate('shot' + kind, 18)) return;
      const sp = (x !== undefined) ? this._spatial(x, y) : { gain: 0.85, pan: 0 };
      if (sp.dist > 220) return;
      const g = sp.gain * (kind === 'shotgun' ? 1.1 : 0.8);
      if (kind === 'shotgun') {
        this.noise({ dur: 0.28, gain: 0.36 * g, filter: 'lowpass', freq: 2600, to: 180, pan: sp.pan });
        this.tone({ freq: 120, to: 48, dur: 0.24, gain: 0.22 * g, type: 'sine', pan: sp.pan });
      } else if (kind === 'rifle') {
        this.noise({ dur: 0.16, gain: 0.3 * g, filter: 'bandpass', freq: 1900, q: 0.7, pan: sp.pan });
        this.tone({ freq: 180, to: 60, dur: 0.13, gain: 0.18 * g, type: 'square', filter: 'lowpass', filterFreq: 700, pan: sp.pan });
      } else if (kind === 'revolver') {
        this.noise({ dur: 0.22, gain: 0.32 * g, filter: 'lowpass', freq: 1500, pan: sp.pan });
        this.tone({ freq: 140, to: 50, dur: 0.2, gain: 0.18 * g, type: 'sawtooth', filter: 'lowpass', filterFreq: 500, pan: sp.pan });
      } else if (kind === 'smg') {
        this.noise({ dur: 0.09, gain: 0.19 * g, filter: 'bandpass', freq: 2400, q: 0.5, pan: sp.pan });
        this.tone({ freq: 200, to: 80, dur: 0.07, gain: 0.12 * g, type: 'square', pan: sp.pan });
      } else {
        this.noise({ dur: 0.1, gain: 0.22 * g, filter: 'bandpass', freq: 2200, q: 0.6, pan: sp.pan });
        this.tone({ freq: 220, to: 70, dur: 0.09, gain: 0.13 * g, type: 'triangle', pan: sp.pan });
      }
      // distant echo in the city
      if (sp.dist > 20) this.noise({ dur: 0.32, gain: 0.05 * g, filter: 'lowpass', freq: 500, delay: 0.08, pan: sp.pan });
    },
    impact(x, y, strength) {
      if (!this.ready || !this._gate('impact', 45)) return;
      const sp = x !== undefined ? this._spatial(x, y) : { gain: 0.9, pan: 0 };
      if (sp.dist > 180) return;
      const s = U.clamp(strength || 1, 0.15, 2.5);
      this.noise({ dur: 0.16 * s, gain: 0.12 * s * sp.gain, filter: 'lowpass', freq: 900, to: 180, pan: sp.pan });
      this.tone({ freq: 90, to: 40, dur: 0.14 * s, gain: 0.12 * s * sp.gain, type: 'sine', pan: sp.pan });
      if (s > 0.9) this.noise({ dur: 0.3, gain: 0.06 * s * sp.gain, filter: 'highpass', freq: 2400, delay: 0.03, pan: sp.pan });
    },
    crash(x, y, speed) {
      if (!this.ready || !this._gate('crash', 120)) return;
      const sp = x !== undefined ? this._spatial(x, y) : { gain: 0.9, pan: 0 };
      if (sp.dist > 200) return;
      this.noise({ dur: 0.42, gain: 0.2 * sp.gain, filter: 'lowpass', freq: 1600, to: 120, pan: sp.pan });
      this.tone({ freq: 120, to: 35, dur: 0.35, gain: 0.16 * sp.gain, type: 'sine', pan: sp.pan });
      if (speed > 12) this.noise({ dur: 0.5, gain: 0.1 * sp.gain, filter: 'highpass', freq: 2800, delay: 0.04, pan: sp.pan });
    },
    footstep(surface) {
      if (!this.ready || !this._gate('step', 90)) return;
      const f = surface === 'sand' ? 700 : surface === 'grass' ? 500 : 1400;
      this.noise({ dur: 0.045, gain: 0.045, filter: 'bandpass', freq: f, q: 1.2 });
    },
    splash(x, y) {
      if (!this.ready) return;
      const sp = x !== undefined ? this._spatial(x, y) : { gain: 0.9, pan: 0 };
      this.noise({ dur: 0.35, gain: 0.08 * sp.gain, filter: 'bandpass', freq: 700, q: 0.7, pan: sp.pan });
    },
    hitmarker(kind) {
      if (!this.ready || !this._gate('hitmarker', 18)) return;
      if (kind === 'head') this.tone({ freq: 900, to: 1300, dur: 0.05, gain: 0.04, type: 'sine' });
      else this.tone({ freq: 600, dur: 0.03, gain: 0.025, type: 'sine' });
    },
    hurt() {
      if (!this.ready || !this._gate('hurt', 200)) return;
      this.noise({ dur: 0.16, gain: 0.09, filter: 'lowpass', freq: 500 });
      this.tone({ freq: 110, to: 70, dur: 0.18, gain: 0.08, type: 'sawtooth', filter: 'lowpass', filterFreq: 400 });
    },
    horn(x, y) {
      if (!this.ready || !this._gate('horn', 800)) return;
      const sp = this._spatial(x, y); if (sp.dist > 200) return;
      this.tone({ freq: 310, dur: 0.24, gain: 0.05 * sp.gain, type: 'square', filter: 'lowpass', filterFreq: 900, pan: sp.pan });
      this.tone({ freq: 392, dur: 0.24, gain: 0.045 * sp.gain, type: 'square', filter: 'lowpass', filterFreq: 900, pan: sp.pan });
    },
    sirenBlip(x, y) {
      if (!this.ready) return;
      const sp = this._spatial(x, y); if (sp.dist > 260) return;
      this.tone({ freq: 900, to: 1300, dur: 0.32, gain: 0.05 * sp.gain, type: 'square', filter: 'lowpass', filterFreq: 1800, pan: sp.pan });
    },
    thunder() {
      if (!this.ready) return;
      this.noise({ dur: 2.2, gain: 0.16, filter: 'lowpass', freq: 300, to: 80, attack: 0.05 });
      this.tone({ freq: 55, to: 30, dur: 1.4, gain: 0.1, type: 'sine' });
    },
    alarm(x, y) {
      if (!this.ready || !this._gate('alarm', 1100)) return;
      const sp = this._spatial(x, y); if (sp.dist > 160) return;
      for (let i = 0; i < 3; i++) {
        this.tone({ freq: 760, to: 1020, dur: 0.18, gain: 0.045 * sp.gain, type: 'square', delay: i * 0.24, pan: sp.pan });
        this.tone({ freq: 1020, to: 760, dur: 0.18, gain: 0.045 * sp.gain, type: 'square', delay: i * 0.24 + 0.12, pan: sp.pan });
      }
    },

    /* --------------------------------------------------------------- loops */
    _loopNoise(buf, filterType, freq, q) {
      const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1; g.gain.value = 0;
      s.connect(f); f.connect(g); s.start();
      return { s, f, g };
    },
    _buildAmbience() {
      const ctx = this.ctx;
      try {
        const city = this._loopNoise(this.brownBuf, 'lowpass', 380, 0.6); city.g.gain.value = 0.05; city.g.connect(this.ambBus); this.city = city;
        const wind = this._loopNoise(this.noiseBuf, 'bandpass', 500, 0.4); wind.g.gain.value = 0.0; wind.g.connect(this.ambBus); this.wind = wind;
        const wave = this._loopNoise(this.noiseBuf, 'bandpass', 700, 0.5); wave.g.gain.value = 0.0; wave.g.connect(this.ambBus); this.wave = wave;
        const rain = this._loopNoise(this.noiseBuf, 'highpass', 1200, 0.3); rain.g.gain.value = 0.0; rain.g.connect(this.ambBus); this.rain = rain;
        // rain LFO movement
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.13; lg.gain.value = 0.01; lfo.connect(lg); lg.connect(rain.g.gain); lfo.start();
        // wave swell
        const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
        lfo2.frequency.value = 0.09; lg2.gain.value = 0.025; lfo2.connect(lg2); lg2.connect(wave.g.gain); lfo2.start();
      } catch (e) { LL.reportError(e, 'ambience'); }
    },
    startEngine(kind) {
      if (!this.ready) return;
      this.stopEngine();
      const ctx = this.ctx;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pan = this._panner(0);
      o1.type = kind === 'boat' ? 'sawtooth' : 'square'; o2.type = 'sawtooth';
      o1.frequency.value = 55; o2.frequency.value = 82;
      f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 2.5;
      g.gain.value = 0.0001;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(pan); pan.connect(this.sfxBus);
      o1.start(); o2.start();
      this.engine = { o1, o2, f, g, pan, kind };
    },
    updateEngine(ratio, throttle, speedKmh) {
      const e = this.engine; if (!e || !this.ready) return;
      try {
        const t = this.ctx.currentTime;
        const base = e.kind === 'boat' ? 38 : 42;
        const f = base + ratio * (e.kind === 'boat' ? 90 : 155);
        e.o1.frequency.setTargetAtTime(f, t, 0.08);
        e.o2.frequency.setTargetAtTime(f * 1.51, t, 0.08);
        e.f.frequency.setTargetAtTime(300 + ratio * 1400 + throttle * 500, t, 0.09);
        e.g.gain.setTargetAtTime(0.02 + ratio * 0.055 + throttle * 0.025, t, 0.1);
        e.pan.pan.setTargetAtTime(0, t, 0.2);
      } catch (err) { }
    },
    stopEngine() {
      if (!this.engine) return;
      const e = this.engine; this.engine = null;
      try {
        const t = this.ctx.currentTime;
        e.g.gain.setTargetAtTime(0.0001, t, 0.08);
        setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (err) { } }, 300);
      } catch (err) { }
    },
    setScreech(amount) {
      if (!this.ready) return;
      if (!this.screech) {
        try {
          const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(), p = this._panner(0);
          s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 2.2; g.gain.value = 0;
          s.connect(f); f.connect(g); g.connect(p); p.connect(this.sfxBus); s.start();
          this.screech = { s, f, g, p };
        } catch (e) { return; }
      }
      try { this.screech.g.gain.setTargetAtTime(U.clamp(amount, 0, 1) * 0.07, this.ctx.currentTime, 0.08); } catch (e) { }
    },
    setSiren(amount, pan) {
      if (!this.ready) return;
      if (!this.siren) {
        try {
          const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = this._panner(0);
          o.type = 'square'; o.frequency.value = 720; f.type = 'lowpass'; f.frequency.value = 1700; g.gain.value = 0;
          const lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = 0.62; lg.gain.value = 280; lfo.connect(lg); lg.connect(o.frequency); lfo.start();
          o.connect(f); f.connect(g); g.connect(p); p.connect(this.sfxBus); o.start();
          this.siren = { o, g, p };
        } catch (e) { return; }
      }
      try {
        this.siren.g.gain.setTargetAtTime(U.clamp(amount, 0, 1) * 0.055, this.ctx.currentTime, 0.15);
        this.siren.p.pan.setTargetAtTime(U.clamp(pan || 0, -1, 1), this.ctx.currentTime, 0.15);
      } catch (e) { }
    },
    setChopper(amount) {
      if (!this.ready) return;
      if (!this.chopper) {
        try {
          const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = this._panner(0);
          s.buffer = this.brownBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0;
          const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start();
          s.connect(f); f.connect(g); g.connect(p); p.connect(this.sfxBus); s.start();
          this.chopper = { s, g, p };
        } catch (e) { return; }
      }
      try { this.chopper.g.gain.setTargetAtTime(U.clamp(amount, 0, 1) * 0.12, this.ctx.currentTime, 0.2); } catch (e) { }
    },

    /* ---------------------------------------------------------------- music */
    musicTick() {
      if (!this.ready || !this.musicOn || LL.Settings.music <= 0.001) return;
      const ctx = this.ctx;
      const stepDur = 60 / 92 / 4; // 16th at 92 bpm
      if (this.musicNext < ctx.currentTime) this.musicNext = ctx.currentTime + 0.05;
      if (this.musicNext > ctx.currentTime + 0.6) return;
      const chords = [
        [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 55, 59],
      ];
      const bar = (this.musicStep / 16) | 0, chord = chords[bar % chords.length];
      const st = this.musicStep % 16;
      const at = this.musicNext - ctx.currentTime;
      const duck = this.musicDuck;
      const playNote = (midi, dur, gain, type) => {
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        this.tone({ freq, dur, gain: gain * duck, type: type || 'triangle', bus: 'music', delay: at, filter: 'lowpass', filterFreq: 2400 });
      };
      if (st % 4 === 0) playNote(chord[0] - 24, stepDur * 2.5, 0.16, 'sawtooth');
      if (st % 2 === 1) playNote(chord[0] - 12, stepDur * 0.9, 0.05, 'triangle');
      if (st % 4 === 2) playNote(chord[2] - 12, stepDur * 1.6, 0.045, 'sine');
      if (st % 2 === 0) {
        const idx = (st / 2) % 3;
        playNote(chord[idx], stepDur * 1.7, 0.035, 'triangle');
      }
      if (st === 0) { playNote(chord[0], stepDur * 15, 0.028, 'sawtooth'); playNote(chord[1], stepDur * 15, 0.02, 'sine'); }
      if (st === 8 && bar % 4 === 3) this.noise({ dur: 0.3, gain: 0.035, filter: 'highpass', freq: 5000, delay: at, bus: 'music' });
      this.musicStep++; this.musicNext += stepDur;
      if (this.musicStep > 16 * 32) this.musicStep = 0;
    },

    /* --------------------------------------------------------------- update */
    update(dt, env) {
      if (!this.ready) return;
      this.musicDuck = U.damp(this.musicDuck, env && env.duckMusic ? 0.35 : 1, 2, dt);
      this.musicTick();
      const t = this.ctx.currentTime;
      try {
        if (this.city) {
          const urban = env && env.urban !== undefined ? env.urban : 0.5;
          this.city.g.gain.setTargetAtTime(0.035 + urban * 0.045, t, 0.5);
        }
        if (this.wind) {
          const w = env && env.wind !== undefined ? env.wind : 0.2;
          this.wind.g.gain.setTargetAtTime(w * 0.045, t, 0.8);
        }
        if (this.wave) {
          const w = env && env.water !== undefined ? env.water : 0;
          this.wave.g.gain.setTargetAtTime(w * 0.09, t, 0.6);
        }
        if (this.rain) {
          const r = env && env.rain !== undefined ? env.rain : 0;
          this.rain.g.gain.setTargetAtTime(r * 0.1, t, 0.7);
        }
      } catch (e) { }
      if (env) {
        if (env.siren) this.setSiren(env.siren, env.sirenPan || 0);
        else if (this.siren) { try { this.siren.g.gain.setTargetAtTime(0, t, 0.3); } catch (e) { } }
        if (env.screech !== undefined) this.setScreech(env.screech);
        if (env.chopper) this.setChopper(env.chopper); else if (this.chopper) { try { this.chopper.g.gain.setTargetAtTime(0, t, 0.3); } catch (e) { } }
        if (env.engine) this.updateEngine(env.engine.ratio, env.engine.throttle, env.engine.kmh);
      }
      // ambience one-shots
      const now = performance.now();
      if (now - this._lastHorn > 9000 + Math.random() * 12000) {
        this._lastHorn = now;
        if (Math.random() < 0.55) {
          const p = LL.game && LL.game.player ? LL.game.player.pos : { x: 0, y: 0 };
          const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 100;
          this.horn(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
      }
      if (now - this._lastBird > 14000 + Math.random() * 16000) {
        this._lastBird = now;
        if (Math.random() < 0.4) this.tone({ freq: 1800 + Math.random() * 900, to: 2400, dur: 0.08, gain: 0.012, type: 'sine', delay: 0.1 });
      }
    },
    play(name, x, y, extra) {
      if (!this.ready) return;
      switch (name) {
        case 'shot': this.shot(extra || 'pistol', x, y); break;
        case 'impact': this.impact(x, y, extra || 1); break;
        case 'crash': this.crash(x, y, extra || 10); break;
        case 'footstep': this.footstep(extra); break;
        case 'splash': this.splash(x, y); break;
        case 'alarm': this.alarm(x, y); break;
        case 'horn': this.horn(x, y); break;
        case 'siren': this.sirenBlip(x, y); break;
        case 'ui': this.ui(extra); break;
      }
    },
  });

  LL.on('first:gesture', () => { A.init(); A.resume(); });
  LL.on('settings:changed', () => A.applySettings());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) A.suspend(); else if (A.ready) A.resume();
  });
})();
