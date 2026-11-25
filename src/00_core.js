/* ============================================================================
   LEONIDA ULTIMATE OVERHAUL — 00 · CORE / UTIL / INPUT / SETTINGS / SAVE
   Single-file game architecture. Everything hangs off window.LL.
   ========================================================================== */
(function () {
  'use strict';
  const LL = (window.LL = window.LL || {});
  LL.VERSION = '2.0.0';
  LL.BUILD = 'leonida-ultimate';

  /* ---------------------------------------------------------------- utils */
  const PI = Math.PI, TAU = PI * 2;
  const U = (LL.U = {
    PI, TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    inv: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    smooth: (t) => t * t * (3 - 2 * t),
    damp: (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt)),
    dampAngle: (a, b, lambda, dt) => a + U.shortAngle(b - a) * (1 - Math.exp(-lambda * dt)),
    shortAngle(a) { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; },
    angleTo: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    dist2sq: (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
    rand: (a = 1, b = 0) => b + Math.random() * (a - b),
    rint: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    moveTo: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
    fmtMoney: (n) => '$' + Math.round(n).toLocaleString('pt-BR'),
    fmtNum: (n) => Math.round(n).toLocaleString('pt-BR'),
    fmtKm: (m) => (m / 1000).toFixed(1).replace('.', ',') + ' km',
    pad2: (n) => (n < 10 ? '0' : '') + n,
    clock(h) { const hh = ((h % 24) + 24) % 24; return U.pad2(Math.floor(hh)) + ':' + U.pad2(Math.floor((hh % 1) * 60)); },
    duration(s) {
      s = Math.max(0, Math.floor(s || 0));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h > 0 ? h + ' h ' + U.pad2(m) + ' min' : m + ' min ' + U.pad2(s % 60) + ' s';
    },
    seed(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash2(x, y) {
      let h = x * 374761393 + y * 668265263;
      h = (h ^ (h >> 13)) * 1274126177;
      return ((h ^ (h >> 16)) >>> 0) / 4294967296;
    },
    // scan a circle against a list of segments; returns nearest hit param 0..1
    raySeg(px, py, dx, dy, ax, ay, bx, by) {
      const ex = bx - ax, ey = by - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-8) return 1;
      const t = ((ax - px) * ey - (ay - py) * ex) / den;
      const s = ((ax - px) * dy - (ay - py) * dx) / den;
      return t >= 0 && s >= 0 && s <= 1 ? t : 1;
    },
    // shortest distance from point to segment
    segDist(px, py, ax, ay, bx, by) {
      const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
      const c1 = vx * wx + vy * wy;
      if (c1 <= 0) return Math.hypot(px - ax, py - ay);
      const c2 = vx * vx + vy * vy;
      if (c2 <= c1) return Math.hypot(px - bx, py - by);
      const t = c1 / c2;
      return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    },
    easeOut(t) { return 1 - Math.pow(1 - t, 3); },
    weightedPick(items, weightFn) {
      let total = 0;
      for (const it of items) total += weightFn(it);
      let r = Math.random() * total;
      for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
      return items[items.length - 1];
    },
  });

  /* ------------------------------------------------------------------ bus */
  class Bus {
    constructor() { this.map = new Map(); }
    on(ev, fn) { (this.map.get(ev) || this.map.set(ev, []).get(ev)).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this.map.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, ...args) {
      const a = this.map.get(ev); if (!a) return;
      for (let i = a.length - 1; i >= 0; i--) {
        try { a[i](...args); } catch (e) { console.error('[bus:' + ev + ']', e); }
      }
    }
    once(ev, fn) { const off = this.on(ev, (...a) => { off(); fn(...a); }); return off; }
  }
  LL.Bus = new Bus();
  LL.on = LL.Bus.on.bind(LL.Bus);
  LL.emit = LL.Bus.emit.bind(LL.Bus);

  /* --------------------------------------------------------------- errors */
  LL.errors = [];
  LL.reportError = function (err, where) {
    const msg = (err && err.stack) || String(err);
    LL.errors.push({ where: where || '', msg, t: Date.now() });
    console.error('[' + (where || 'leonida') + ']', err);
    if (LL.errors.length <= 12) {
      try { if (LL.notify) LL.notify('Erro em ' + (where || 'sistema') + ' — o jogo continuou.', 'red', 'DIAGNÓSTICO'); } catch (e) { }
    }
  };
  LL.guard = function (fn, where) {
    return function (...args) {
      try { return fn.apply(this, args); } catch (e) { LL.reportError(e, where); }
    };
  };

  /* -------------------------------------------------------------- settings */
  const DEFAULT_SETTINGS = {
    quality: 'high', shadows: true, drawDistance: 720, fov: 66,
    sensitivity: 1, invertY: false, cameraShake: true,
    master: 0.75, music: 0.32, sfx: 0.85, ui: 0.6,
    showFps: false, subtitles: true, minimap: true, unitsMetric: true,
    autosave: true, voiceChatter: true,
  };
  const SETTINGS_KEY = 'gta7_leonida_settings_v2';
  LL.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  LL.Settings = Object.assign({}, DEFAULT_SETTINGS);
  LL.Settings.load = function () {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          for (const k in DEFAULT_SETTINGS) if (k in d && typeof d[k] === typeof DEFAULT_SETTINGS[k]) LL.Settings[k] = d[k];
        }
      }
    } catch (e) { console.warn('settings: usando padrões', e); }
    return LL.Settings;
  };
  LL.Settings.save = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(LL.Settings)); return true; }
    catch (e) { console.warn('settings save failed', e); return false; }
  };
  LL.Settings.applyQuality = function (q) {
    const S = LL.Settings;
    S.quality = q;
    if (q === 'low') { S.shadows = false; S.drawDistance = 480; }
    else if (q === 'medium') { S.shadows = true; S.drawDistance = 620; }
    else if (q === 'high') { S.shadows = true; S.drawDistance = 760; }
    else if (q === 'ultra') { S.shadows = true; S.drawDistance = 980; }
    LL.emit('settings:changed', S);
    LL.Settings.save();
  };
  LL.Settings.set = function (key, val) {
    if (!(key in LL.Settings)) return;
    LL.Settings[key] = val; LL.Settings.save(); LL.emit('settings:changed', LL.Settings);
  };
  LL.Settings.load();

  /* ------------------------------------------------------------------ save */
  const SAVE_KEY = 'gta7_leonida_ultimate_save_v2';
  const SAVE_BACKUP = 'gta7_leonida_ultimate_save_backup_v2';
  const SAVE_CORRUPT = 'gta7_leonida_ultimate_corrupt_v2';
  LL.Save = {
    key: SAVE_KEY, backupKey: SAVE_BACKUP, version: 2,
    _collect: null, _restore: null, lastWrite: 0, lastError: '',
    register(collectFn, restoreFn) { this._collect = collectFn; this._restore = restoreFn; },
    _storage() {
      try { const t = '__lltest__'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; }
      catch (e) { return null; }
    },
    readRaw() {
      const s = this._storage(); if (!s) return null;
      try { return s.getItem(SAVE_KEY) || null; } catch (e) { return null; }
    },
    readParsed() {
      const raw = this.readRaw(); if (!raw) return null;
      try {
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object' || d.version !== this.version || !d.data) return null;
        return d;
      } catch (e) { return null; }
    },
    exists() { return !!this.readParsed(); },
    meta() {
      const d = this.readParsed(); if (!d) return null;
      return {
        savedAt: d.savedAt || 0, playtime: d.meta?.playtime || 0, money: d.meta?.money ?? 0,
        character: d.meta?.character || 'Jason', missions: d.meta?.missions || 0,
        percent: d.meta?.percent || 0, level: d.meta?.level || 1,
      };
    },
    write(reason) {
      if (!this._collect) return false;
      try {
        const data = this._collect();
        if (!data) return false;
        const payload = {
          version: this.version, savedAt: Date.now(), reason: reason || 'auto', meta: {
            playtime: data.playtime || 0, money: data.player?.money || 0,
            character: data.player?.character === 1 ? 'Lucia' : 'Jason',
            missions: (data.missions?.completed || []).length,
            percent: data.progress || 0, level: data.player?.level || 1,
          }, data,
        };
        const s = this._storage(); if (!s) { this.lastError = 'localStorage indisponível'; return false; }
        const old = s.getItem(SAVE_KEY);
        if (old) { try { s.setItem(SAVE_BACKUP, old); } catch (e) { } }
        s.setItem(SAVE_KEY, JSON.stringify(payload));
        this.lastWrite = Date.now(); this.lastError = '';
        LL.emit('save:written', payload);
        return true;
      } catch (e) {
        this.lastError = e.message || String(e);
        LL.reportError(e, 'save');
        return false;
      }
    },
    load() {
      const parsed = this.readParsed();
      if (!parsed) {
        // try backup before giving up
        const s = this._storage();
        if (s) {
          try {
            const b = s.getItem(SAVE_BACKUP);
            if (b) {
              const bd = JSON.parse(b);
              if (bd && bd.version === this.version && bd.data) {
                LL.notify && LL.notify('Save principal corrompido — backup restaurado.', 'gold', 'SALVAMENTO');
                s.setItem(SAVE_KEY, b);
                return this._restore ? this._restore(bd.data) : false;
              }
            }
          } catch (e) { }
        }
        return false;
      }
      try {
        if (!this._restore) return false;
        const ok = this._restore(parsed.data);
        return !!ok;
      } catch (e) {
        this.lastError = e.message || String(e);
        LL.reportError(e, 'load');
        return false;
      }
    },
    clear() {
      const s = this._storage(); if (!s) return;
      try {
        const raw = s.getItem(SAVE_KEY);
        if (raw) s.setItem(SAVE_CORRUPT, raw);
        s.removeItem(SAVE_KEY); s.removeItem(SAVE_BACKUP);
      } catch (e) { }
    },
  };

  /* ---------------------------------------------------------------- notify */
  LL.Notifications = [];
  LL.notify = function (text, kind, label) {
    const n = { text, kind: kind || 'info', label: label || '', t: performance.now(), id: ++LL._notifyId || (LL._notifyId = 1) };
    LL.Notifications.push(n);
    if (LL.Notifications.length > 5) LL.Notifications.shift();
    if (LL.UI && LL.UI.pushToast) LL.UI.pushToast(n); else console.log('[notify]', label || '', text);
  };

  /* ----------------------------------------------------------------- input */
  const Input = (LL.Input = {
    keys: Object.create(null), pressed: Object.create(null), released: Object.create(null),
    mouse: { x: innerWidth / 2, y: innerHeight / 2, dx: 0, dy: 0, down: false, justDown: false, justUp: false, right: false, wheel: 0, moved: false },
    locked: false, enabled: true, onKey: [], _clearedOnBlur: false,
    init(canvas) {
      this.canvas = canvas;
      addEventListener('keydown', (e) => {
        if (e.code === 'Tab' || e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
        if (!this.keys[e.code]) this.pressed[e.code] = true;
        this.keys[e.code] = true;
        for (const fn of this.onKey) { try { fn(e.code, e, 'down'); } catch (err) { LL.reportError(err, 'key'); } }
      }, { passive: false });
      addEventListener('keyup', (e) => {
        this.keys[e.code] = false; this.released[e.code] = true;
        for (const fn of this.onKey) { try { fn(e.code, e, 'up'); } catch (err) { LL.reportError(err, 'key'); } }
      });
      addEventListener('blur', () => this.clear());
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
      canvas.addEventListener('mousedown', (e) => {
        this.mouse.justDown = true; this.mouse.down = e.button === 0; this.mouse.right = e.button === 2;
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      });
      addEventListener('mouseup', (e) => {
        if (e.button === 0) { this.mouse.down = false; this.mouse.justUp = true; }
        if (e.button === 2) this.mouse.right = false;
      });
      addEventListener('mousemove', (e) => {
        this.mouse.moved = true;
        if (this.locked) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; }
        else { this.mouse.x = e.clientX; this.mouse.y = e.clientY; }
      });
      canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === canvas;
        if (LL.emit) LL.emit('pointerlock', this.locked);
      });
      document.addEventListener('pointerlockerror', () => { this.locked = false; });
      addEventListener('mousedown', () => { if (!this._audioReady) { this._audioReady = true; LL.emit('first:gesture'); } });
    },
    clear() {
      for (const k in this.keys) this.keys[k] = false;
      this.mouse.down = false; this.mouse.right = false;
      this.mouse.dx = 0; this.mouse.dy = 0;
      this._clearedOnBlur = true;
    },
    down(code) { return !!this.keys[code]; },
    anyDown() { return !!(this.keys.KeyW || this.keys.KeyA || this.keys.KeyS || this.keys.KeyD); },
    justPressed(code) { return !!this.pressed[code]; },
    consume(code) { const v = !!this.pressed[code]; this.pressed[code] = false; return v; },
    lock() {
      if (!this.canvas || this.locked) return;
      try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
    },
    unlock() { if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { } } },
    endFrame() {
      for (const k in this.pressed) this.pressed[k] = false;
      for (const k in this.released) this.released[k] = false;
      this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.justDown = false; this.mouse.justUp = false; this.mouse.wheel = 0; this.mouse.moved = false;
    },
  });

  /* ------------------------------------------------------------ dom helpers */
  LL.$ = (s, root) => (root || document).querySelector(s);
  LL.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  LL.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  LL.svg = function (d, vb) {
    return '<svg viewBox="' + (vb || '0 0 100 60') + '" xmlns="http://www.w3.org/2000/svg"><path d="' + d + '"/></svg>';
  };

  /* --------------------------------------------------------------- shortcuts */
  LL.rng = U.seed((Date.now() ^ 0x9e3779b9) >>> 0);
  LL.now = () => performance.now() / 1000;
  LL.online = () => navigator.onLine;
  LL.DOM = {}; // filled by UI/main

  console.log('%cLEONIDA ULTIMATE %c' + LL.VERSION + ' — core carregado', 'color:#ff3d6e;font-weight:bold', 'color:#22d3ee');
})();
