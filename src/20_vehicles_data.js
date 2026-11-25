/* ============================================================================
   20 · VEHICLE DATA — catalogue + procedural low-poly models (merged geometry).
   Local convention: +X is forward, +Y up, +Z right.  rotation.y = -angle.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const V = (LL.Vehicles = LL.Vehicles || {});
  const PI = Math.PI;

  /* ---------------------------------------------------------------- catalogue */
  // powers in m/s^2, maxSpeed in m/s, tank in litres
  V.CATALOG = {
    sedan: {
      name: 'Vice Sedan', cat: 'sedan', seats: 4, mass: 1380, power: 8.4, maxSpeed: 43, brake: 22, grip: 8.2,
      tank: 55, burn: 0.55, price: 24000, value: 9000, len: 4.6, wid: 1.92, wheelR: 0.36, audio: 'car',
      colors: ['#c8ccd2', '#1d2733', '#7c1f2a', '#2b4a63', '#e3e1d8', '#3e4a3f', '#6b6f76'],
      desc: 'Confortável, discreto, quatro portas e um porta-malas honesto.',
    },
    compact: {
      name: 'Little Havana', cat: 'compact', seats: 4, mass: 1080, power: 7.4, maxSpeed: 37, brake: 20, grip: 9.0,
      tank: 42, burn: 0.42, price: 14500, value: 6200, len: 3.95, wid: 1.78, wheelR: 0.32, audio: 'car',
      colors: ['#e2b23c', '#2f7f6b', '#c25a3d', '#d8d3c4', '#39424d'],
      desc: 'Pequeno, econômico e fácil de estacionar em qualquer beco.',
    },
    sports: {
      name: 'Neon GT', cat: 'sports', seats: 2, mass: 1240, power: 13.2, maxSpeed: 62, brake: 26, grip: 10.4,
      tank: 60, burn: 0.85, price: 68000, value: 31000, len: 4.4, wid: 1.98, wheelR: 0.35, audio: 'sports',
      colors: ['#e0304d', '#f2c02c', '#101319', '#1e7fd4', '#e8e8ea', '#7a2ec4'],
      desc: 'Tração traseira, som grave e traseira que sai de lado.',
    },
    super: {
      name: 'Coral 800', cat: 'super', seats: 2, mass: 1150, power: 17.5, maxSpeed: 78, brake: 30, grip: 11.6,
      tank: 68, burn: 1.25, price: 210000, value: 96000, len: 4.55, wid: 2.06, wheelR: 0.34, audio: 'sports',
      colors: ['#ffcf5c', '#e02a3a', '#141821', '#f2f2f4', '#2fd0b4'],
      desc: 'O carro do cartaz. Todo mundo olha, inclusive a polícia.',
    },
    suv: {
      name: 'Glades SUV', cat: 'suv', seats: 5, mass: 2100, power: 8.6, maxSpeed: 40, brake: 21, grip: 7.4,
      tank: 78, burn: 0.95, price: 52000, value: 24000, len: 4.9, wid: 2.02, wheelR: 0.44, audio: 'car',
      colors: ['#2c3238', '#5d6b55', '#9a8b7a', '#1b3a52', '#cfcfc9'],
      desc: 'Alto, pesado, aguenta calçada e estrada de terra.',
    },
    pickup: {
      name: 'Everglades 4x4', cat: 'pickup', seats: 2, mass: 1980, power: 8.0, maxSpeed: 41, brake: 20, grip: 7.0,
      tank: 80, burn: 1.0, price: 46000, value: 21000, len: 5.2, wid: 2.0, wheelR: 0.46, audio: 'car',
      colors: ['#7a3b2c', '#35474f', '#b9b3a2', '#2b2f33'],
      desc: 'Caçamba aberta: leva carga e leva problema.',
    },
    van: {
      name: 'Cargo Van', cat: 'van', seats: 2, mass: 2300, power: 6.6, maxSpeed: 34, brake: 18, grip: 6.4,
      tank: 90, burn: 1.05, price: 38000, value: 17000, len: 5.4, wid: 2.05, wheelR: 0.4, audio: 'car',
      colors: ['#e4e2da', '#8b8f93', '#2f4a6b', '#6a6f4a'],
      desc: 'Espaço de sobra. Ótima para entregas e para esconder coisas.',
    },
    police: {
      name: 'LPD Interceptor', cat: 'police', seats: 4, mass: 1620, power: 12.0, maxSpeed: 60, brake: 28, grip: 10.0,
      tank: 70, burn: 0.9, price: 0, value: 0, len: 4.7, wid: 1.98, wheelR: 0.37, audio: 'sports',
      colors: ['#101419'], police: true,
      desc: 'Viatura do Departamento de Leonida. Não se compra.',
    },
    taxi: {
      name: 'Sunset Cab', cat: 'taxi', seats: 4, mass: 1400, power: 8.2, maxSpeed: 42, brake: 22, grip: 8.0,
      tank: 55, burn: 0.55, price: 18000, value: 7000, len: 4.6, wid: 1.92, wheelR: 0.36, audio: 'car',
      colors: ['#f2c02c', '#e8b42a'],
      desc: 'Amarelo clássico. Sempre tem um no ponto errado.',
    },
    scooter: {
      name: 'Volt Scooter', cat: 'scooter', seats: 1, mass: 120, power: 4.2, maxSpeed: 19, brake: 14, grip: 11,
      tank: 0, burn: 0, price: 3200, value: 1200, len: 1.7, wid: 0.62, wheelR: 0.26, audio: 'scooter', twoWheels: true,
      colors: ['#2fd0b4', '#ff5d8f', '#e8e8ea', '#1b1f24'],
      desc: 'Patinete elétrico. Silencioso, ágil, e o capacete é opcional.',
    },
    boat: {
      name: 'Bay Runner', cat: 'boat', seats: 4, mass: 900, power: 6.2, maxSpeed: 26, brake: 9, grip: 3.4,
      tank: 90, burn: 1.1, price: 34000, value: 15000, len: 5.4, wid: 2.0, wheelR: 0, audio: 'boat', water: true,
      colors: ['#e6e9ec', '#1f3f5c', '#c33b3b', '#2f6b52'],
      desc: 'Lancha de passeio. Só anda na água, obviamente.',
    },
    speedboat: {
      name: 'Marlin 42', cat: 'boat', seats: 4, mass: 1100, power: 10.5, maxSpeed: 40, brake: 12, grip: 4.0,
      tank: 140, burn: 1.9, price: 96000, value: 44000, len: 6.6, wid: 2.2, wheelR: 0, audio: 'boat', water: true,
      colors: ['#f4f6f8', '#12161c', '#d8b93a', '#1f7f96'],
      desc: 'Lancha rápida com dois motores. A baía inteira é sua.',
    },
  };
  V.ORDER = ['sedan', 'compact', 'sports', 'super', 'suv', 'pickup', 'van', 'taxi', 'police', 'scooter', 'boat', 'speedboat'];
  V.SPAWNABLE = ['sedan', 'compact', 'sports', 'suv', 'pickup', 'van', 'taxi', 'police', 'scooter'];
  V.randomCar = function () { return U.pick(V.SPAWNABLE); };

  /* --------------------------------------------------------------- geometry */
  const _euler = new THREE.Euler(), _mat = new THREE.Matrix4(), _col = new THREE.Color();
  function bucket() { return { p: [], n: [], c: [] }; }
  function addGeo(b, geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _euler.set(rx || 0, ry || 0, rz || 0);
    _mat.makeRotationFromEuler(_euler);
    if (sx !== undefined && sx !== 1) _mat.scale(new THREE.Vector3(sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    _mat.setPosition(x || 0, y || 0, z || 0);
    g.applyMatrix4(_mat);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    _col.set(color); const cr = _col.r, cg = _col.g, cb = _col.b;
    for (let i = 0; i < p.length; i += 3) {
      b.p.push(p[i], p[i + 1], p[i + 2]);
      b.n.push(n[i], n[i + 1], n[i + 2]);
      b.c.push(cr, cg, cb);
    }
    g.dispose();
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  function addBox(b, w, h, d, x, y, z, color, rx, ry, rz) {
    addGeo(b, BOX, color, x, y, z, rx || 0, ry || 0, rz || 0, w, h, d);
  }
  function toMesh(b, material, shadows) {
    if (!b.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadows !== false; m.receiveShadow = false;
    return m;
  }
  V.toMesh = toMesh;
  V.addBox = addBox;

  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x8fb6cc, transparent: true, opacity: 0.42, shininess: 120, specular: 0xaaddff, depthWrite: false, side: THREE.DoubleSide });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x121417 });
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xb9bec4 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x8a1418 });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2f6bff });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  V.mats = { bodyMat, glassMat, wheelMat, rimMat, lightMat, tailMat, brakeMat, blueMat, redMat };

  // wheels: geometry cached per radius
  const wheelGeoCache = {};
  function wheelGeo(r, w) {
    const k = r.toFixed(2) + '|' + w.toFixed(2);
    if (!wheelGeoCache[k]) {
      const g = new THREE.CylinderGeometry(r, r, w, 14, 1);
      g.rotateX(PI / 2);
      wheelGeoCache[k] = g;
    }
    return wheelGeoCache[k];
  }
  const rimGeoCache = {};
  function rimGeo(r) {
    const k = r.toFixed(2);
    if (!rimGeoCache[k]) {
      const g = new THREE.CylinderGeometry(r * 0.58, r * 0.58, 0.06, 10, 1);
      g.rotateX(PI / 2);
      rimGeoCache[k] = g;
    }
    return rimGeoCache[k];
  }
  V.wheelGeo = wheelGeo; V.rimGeo = rimGeo;

  /* ------------------------------------------------------- model definitions */
  // every builder receives (b, g, col, spec, accent) where b = opaque bucket,
  // g = glass bucket, col = paint, accent = secondary paint
  const BUILDERS = {
    sedan(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.52, W, 0, 0.62, 0, col);
      addBox(b, L * 0.98, 0.2, W * 0.94, 0, 0.9, 0, col);
      addBox(b, L * 0.34, 0.24, W * 0.9, L * 0.31, 0.98, 0, col);
      addBox(b, L * 0.44, 0.6, W * 0.86, -L * 0.06, 1.16, 0, col);
      addBox(b, L * 0.4, 0.1, W * 0.82, -L * 0.06, 1.47, 0, acc || col);
      // glass
      addBox(g, L * 0.36, 0.44, W * 0.84, -L * 0.06, 1.2, 0, 0xffffff);
      addBox(g, L * 0.02, 0.4, W * 0.8, L * 0.14, 1.18, 0, 0xffffff, 0, 0, -0.28);
      addBox(g, L * 0.02, 0.4, W * 0.8, -L * 0.26, 1.18, 0, 0xffffff, 0, 0, 0.3);
      addBox(g, L * 0.3, 0.34, W * 0.88, -L * 0.06, 1.2, 0, 0xffffff);
      // bumpers / trim
      addBox(b, 0.24, 0.34, W * 1.01, L * 0.49, 0.62, 0, '#23272c');
      addBox(b, 0.22, 0.34, W * 1.01, -L * 0.49, 0.62, 0, '#23272c');
      addBox(b, 0.5, 0.16, W * 0.98, L * 0.42, 0.42, 0, '#24282d');
      addBox(b, 0.5, 0.16, W * 0.98, -L * 0.42, 0.42, 0, '#24282d');
      // mirrors
      addBox(b, 0.2, 0.14, 0.3, L * 0.1, 1.14, W * 0.52, col);
      addBox(b, 0.2, 0.14, 0.3, L * 0.1, 1.14, -W * 0.52, col);
      // lights
      addBox(b, 0.1, 0.18, 0.42, L * 0.5, 0.78, W * 0.32, '#fff2c8');
      addBox(b, 0.1, 0.18, 0.42, L * 0.5, 0.78, -W * 0.32, '#fff2c8');
      addBox(b, 0.1, 0.16, 0.4, -L * 0.5, 0.8, W * 0.33, '#8a1418');
      addBox(b, 0.1, 0.16, 0.4, -L * 0.5, 0.8, -W * 0.33, '#8a1418');
      addBox(b, 0.12, 0.12, 0.3, -L * 0.5, 0.55, W * 0.42, '#d8d8d8');
      addBox(b, 0.1, 0.1, 0.16, -L * 0.5, 0.34, W * 0.42, '#2b2b2b');
    },
    compact(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.5, W, 0, 0.58, 0, col);
      addBox(b, L * 0.92, 0.5, W * 0.92, 0, 1.02, 0, col);
      addBox(b, L * 0.66, 0.3, W * 0.88, -L * 0.04, 1.34, 0, col);
      addBox(b, L * 0.62, 0.08, W * 0.84, -L * 0.04, 1.5, 0, acc || col);
      addBox(g, L * 0.24, 0.42, W * 0.86, L * 0.02, 1.18, 0, 0xffffff);
      addBox(g, L * 0.24, 0.42, W * 0.86, -L * 0.3, 1.18, 0, 0xffffff);
      addBox(b, 0.2, 0.3, W * 1.0, L * 0.49, 0.55, 0, '#23272c');
      addBox(b, 0.2, 0.3, W * 1.0, -L * 0.49, 0.55, 0, '#23272c');
      addBox(b, 0.18, 0.12, 0.26, L * 0.12, 1.2, W * 0.5, col);
      addBox(b, 0.18, 0.12, 0.26, L * 0.12, 1.2, -W * 0.5, col);
      addBox(b, 0.09, 0.16, 0.36, L * 0.5, 0.72, W * 0.3, '#fff2c8');
      addBox(b, 0.09, 0.16, 0.36, L * 0.5, 0.72, -W * 0.3, '#fff2c8');
      addBox(b, 0.09, 0.16, 0.32, -L * 0.5, 0.76, W * 0.32, '#8a1418');
      addBox(b, 0.09, 0.16, 0.32, -L * 0.5, 0.76, -W * 0.32, '#8a1418');
    },
    sports(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.34, W, 0, 0.48, 0, col);
      addBox(b, L * 0.92, 0.22, W * 0.96, 0, 0.72, 0, col);
      // wedge hood
      addBox(b, L * 0.4, 0.18, W * 0.9, L * 0.28, 0.8, 0, col, 0, 0, -0.07);
      // cabin
      addBox(b, L * 0.38, 0.46, W * 0.8, -L * 0.04, 1.02, 0, col);
      addBox(b, L * 0.34, 0.08, W * 0.72, -L * 0.06, 1.28, 0, acc || col);
      addBox(g, L * 0.3, 0.36, W * 0.78, -L * 0.04, 1.04, 0, 0xffffff);
      addBox(g, L * 0.02, 0.34, W * 0.72, L * 0.14, 1.0, 0, 0xffffff, 0, 0, -0.5);
      addBox(g, L * 0.02, 0.34, W * 0.7, -L * 0.22, 1.02, 0, 0xffffff, 0, 0, 0.45);
      // skirts + splitter
      addBox(b, L * 0.7, 0.14, W * 1.02, 0, 0.34, 0, '#15181c');
      addBox(b, 0.3, 0.1, W * 0.98, L * 0.48, 0.3, 0, '#15181c');
      addBox(b, 0.26, 0.18, W * 0.94, -L * 0.48, 0.42, 0, '#15181c');
      // spoiler
      addBox(b, 0.34, 0.06, W * 0.86, -L * 0.46, 0.94, 0, acc || '#15181c');
      addBox(b, 0.08, 0.26, 0.08, -L * 0.46, 0.82, W * 0.32, '#15181c');
      addBox(b, 0.08, 0.26, 0.08, -L * 0.46, 0.82, -W * 0.32, '#15181c');
      // mirrors + lights
      addBox(b, 0.16, 0.1, 0.24, L * 0.06, 1.0, W * 0.48, col);
      addBox(b, 0.16, 0.1, 0.24, L * 0.06, 1.0, -W * 0.48, col);
      addBox(b, 0.08, 0.12, 0.44, L * 0.5, 0.66, W * 0.28, '#fff2c8');
      addBox(b, 0.08, 0.12, 0.44, L * 0.5, 0.66, -W * 0.28, '#fff2c8');
      addBox(b, 0.08, 0.14, 0.44, -L * 0.5, 0.68, W * 0.3, '#8a1418');
      addBox(b, 0.08, 0.14, 0.44, -L * 0.5, 0.68, -W * 0.3, '#8a1418');
      // exhausts
      addBox(b, 0.16, 0.12, 0.14, -L * 0.5, 0.32, W * 0.3, '#9aa0a6');
      addBox(b, 0.16, 0.12, 0.14, -L * 0.5, 0.32, -W * 0.3, '#9aa0a6');
    },
    super(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.3, W, 0, 0.42, 0, col);
      addBox(b, L * 0.95, 0.16, W * 0.98, 0, 0.62, 0, col);
      addBox(b, L * 0.44, 0.14, W * 0.92, L * 0.26, 0.7, 0, col, 0, 0, -0.05);
      addBox(b, L * 0.36, 0.4, W * 0.76, -L * 0.04, 0.92, 0, col);
      addBox(b, L * 0.3, 0.06, W * 0.68, -L * 0.06, 1.14, 0, acc || '#101318');
      addBox(g, L * 0.3, 0.32, W * 0.74, -L * 0.04, 0.94, 0, 0xffffff);
      addBox(g, L * 0.02, 0.3, W * 0.68, L * 0.14, 0.9, 0, 0xffffff, 0, 0, -0.55);
      addBox(g, L * 0.02, 0.28, W * 0.7, -L * 0.2, 0.94, 0, 0xffffff, 0, 0, 0.5);
      addBox(b, L * 0.72, 0.12, W * 1.04, 0, 0.28, 0, '#101318');
      addBox(b, 0.34, 0.08, W * 1.0, L * 0.48, 0.25, 0, '#101318');
      addBox(b, 0.4, 0.18, W * 0.98, -L * 0.46, 0.5, 0, '#101318');
      // big rear wing
      addBox(b, 0.2, 0.06, W * 1.06, -L * 0.46, 1.04, 0, '#15181c');
      addBox(b, 0.07, 0.34, 0.07, -L * 0.46, 0.86, W * 0.4, '#15181c');
      addBox(b, 0.07, 0.34, 0.07, -L * 0.46, 0.86, -W * 0.4, '#15181c');
      // intakes
      addBox(b, 0.12, 0.14, 0.3, -L * 0.24, 0.74, W * 0.5, '#101318');
      addBox(b, 0.12, 0.14, 0.3, -L * 0.24, 0.74, -W * 0.5, '#101318');
      addBox(b, 0.16, 0.09, 0.22, L * 0.2, 0.94, W * 0.47, col);
      addBox(b, 0.16, 0.09, 0.22, L * 0.2, 0.94, -W * 0.47, col);
      addBox(b, 0.07, 0.1, 0.5, L * 0.49, 0.58, W * 0.26, '#fff2c8');
      addBox(b, 0.07, 0.1, 0.5, L * 0.49, 0.58, -W * 0.26, '#fff2c8');
      addBox(b, 0.07, 0.1, 0.44, -L * 0.5, 0.62, W * 0.28, '#8a1418');
      addBox(b, 0.07, 0.1, 0.44, -L * 0.5, 0.62, -W * 0.28, '#8a1418');
    },
    suv(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.62, W, 0, 0.86, 0, col);
      addBox(b, L * 0.96, 0.66, W * 0.98, 0, 1.5, 0, col);
      addBox(b, L * 0.9, 0.12, W * 0.94, 0, 1.86, 0, acc || col);
      addBox(g, L * 0.3, 0.5, W * 0.96, L * 0.2, 1.5, 0, 0xffffff);
      addBox(g, L * 0.26, 0.5, W * 0.96, -L * 0.22, 1.5, 0, 0xffffff);
      addBox(b, 0.26, 0.42, W * 1.02, L * 0.49, 0.78, 0, '#2a2e33');
      addBox(b, 0.24, 0.42, W * 1.02, -L * 0.49, 0.78, 0, '#2a2e33');
      addBox(b, L * 0.7, 0.16, W * 1.02, 0, 0.44, 0, '#2a2e33');
      // roof rack
      addBox(b, L * 0.66, 0.06, 0.08, -L * 0.04, 1.96, W * 0.32, '#31363b');
      addBox(b, L * 0.66, 0.06, 0.08, -L * 0.04, 1.96, -W * 0.32, '#31363b');
      addBox(b, 0.1, 0.06, W * 0.62, L * 0.3, 1.96, 0, '#31363b');
      addBox(b, 0.1, 0.06, W * 0.62, -L * 0.36, 1.96, 0, '#31363b');
      addBox(b, 0.2, 0.14, 0.28, L * 0.12, 1.5, W * 0.52, col);
      addBox(b, 0.2, 0.14, 0.28, L * 0.12, 1.5, -W * 0.52, col);
      addBox(b, 0.1, 0.22, 0.4, L * 0.5, 1.05, W * 0.3, '#fff2c8');
      addBox(b, 0.1, 0.22, 0.4, L * 0.5, 1.05, -W * 0.3, '#fff2c8');
      addBox(b, 0.1, 0.24, 0.34, -L * 0.5, 1.2, W * 0.32, '#8a1418');
      addBox(b, 0.1, 0.24, 0.34, -L * 0.5, 1.2, -W * 0.32, '#8a1418');
    },
    pickup(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.6, W, 0, 0.78, 0, col);
      addBox(b, L * 0.44, 0.7, W * 0.98, L * 0.06, 1.42, 0, col);
      addBox(b, L * 0.4, 0.1, W * 0.92, L * 0.06, 1.8, 0, acc || col);
      addBox(g, L * 0.26, 0.5, W * 0.96, L * 0.11, 1.44, 0, 0xffffff);
      addBox(g, L * 0.2, 0.5, W * 0.96, -L * 0.12, 1.44, 0, 0xffffff);
      // bed walls
      addBox(b, L * 0.44, 0.42, 0.12, -L * 0.26, 1.28, W * 0.48, col);
      addBox(b, L * 0.44, 0.42, 0.12, -L * 0.26, 1.28, -W * 0.48, col);
      addBox(b, 0.12, 0.42, W * 0.96, -L * 0.47, 1.28, 0, col);
      addBox(b, L * 0.44, 0.08, W * 0.86, -L * 0.26, 1.1, 0, '#2c3035');
      // bumpers, step
      addBox(b, 0.28, 0.34, W * 1.04, L * 0.5, 0.66, 0, '#33383d');
      addBox(b, 0.24, 0.3, W * 1.04, -L * 0.5, 0.7, 0, '#33383d');
      addBox(b, L * 0.7, 0.14, W * 1.03, 0, 0.42, 0, '#2c3035');
      addBox(b, 0.22, 0.12, 0.3, L * 0.12, 1.42, W * 0.55, col);
      addBox(b, 0.22, 0.12, 0.3, L * 0.12, 1.42, -W * 0.55, col);
      addBox(b, 0.1, 0.2, 0.4, L * 0.5, 0.95, W * 0.3, '#fff2c8');
      addBox(b, 0.1, 0.2, 0.4, L * 0.5, 0.95, -W * 0.3, '#fff2c8');
      addBox(b, 0.1, 0.22, 0.3, -L * 0.5, 1.0, W * 0.4, '#8a1418');
      addBox(b, 0.1, 0.22, 0.3, -L * 0.5, 1.0, -W * 0.4, '#8a1418');
    },
    van(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L, 0.7, W, 0, 0.86, 0, col);
      addBox(b, L * 0.98, 1.18, W * 0.98, -L * 0.01, 1.78, 0, col);
      addBox(b, L * 0.9, 0.1, W * 0.94, -L * 0.02, 2.4, 0, acc || col);
      addBox(g, L * 0.1, 0.56, W * 0.94, L * 0.42, 1.86, 0, 0xffffff, 0, 0, 0.18);
      addBox(g, L * 0.3, 0.5, W * 0.96, L * 0.16, 1.86, 0, 0xffffff);
      addBox(g, L * 0.16, 0.46, W * 0.96, -L * 0.26, 1.86, 0, 0xffffff);
      addBox(b, 0.28, 0.48, W * 1.02, L * 0.49, 0.78, 0, '#2c3035');
      addBox(b, 0.26, 0.48, W * 1.02, -L * 0.49, 0.82, 0, '#2c3035');
      addBox(b, L * 0.72, 0.16, W * 1.02, 0, 0.42, 0, '#2c3035');
      // rear door seam
      addBox(b, 0.04, 1.05, 0.04, -L * 0.49, 1.78, 0, '#1b1f23');
      addBox(b, 0.2, 0.14, 0.3, L * 0.42, 1.8, W * 0.53, col);
      addBox(b, 0.2, 0.14, 0.3, L * 0.42, 1.8, -W * 0.53, col);
      addBox(b, 0.1, 0.2, 0.4, L * 0.5, 1.1, W * 0.32, '#fff2c8');
      addBox(b, 0.1, 0.2, 0.4, L * 0.5, 1.1, -W * 0.32, '#fff2c8');
      addBox(b, 0.1, 0.3, 0.24, -L * 0.5, 1.4, W * 0.38, '#8a1418');
      addBox(b, 0.1, 0.3, 0.24, -L * 0.5, 1.4, -W * 0.38, '#8a1418');
    },
    taxi(b, g, col, spec) { BUILDERS.sedan(b, g, col, spec, '#15181c'); addBox(b, 0.5, 0.22, 0.66, -0.2, 1.62, 0, '#15181c'); addBox(b, 0.34, 0.06, 0.5, -0.2, 1.76, 0, '#fff6c8'); },
    police(b, g, col, spec) {
      BUILDERS.sedan(b, g, '#e9edf2', spec, '#0c1016');
      const L = spec.len, W = spec.wid;
      // black-white livery panels
      addBox(b, L * 0.5, 0.3, W * 1.005, -L * 0.12, 0.66, 0, '#0c1016');
      addBox(b, L * 0.16, 0.3, W * 1.005, L * 0.3, 0.66, 0, '#0c1016');
      // light bar (blue/red halves driven by siren toggle)
      addBox(b, 0.26, 0.1, W * 0.62, -L * 0.02, 1.56, 0, '#171b20');
      // push bar
      addBox(b, 0.12, 0.5, W * 0.7, L * 0.52, 0.72, 0, '#22262b');
      addBox(b, 0.2, 0.1, W * 0.74, L * 0.5, 0.5, 0, '#22262b');
      // antenna
      addBox(b, 0.04, 0.5, 0.04, -L * 0.3, 1.76, 0, '#14181c');
    },
    scooter(b, g, col, spec) {
      const L = spec.len, W = spec.wid;
      addBox(b, L * 0.5, 0.12, W * 0.6, -L * 0.02, 0.34, 0, '#23272c');
      addBox(b, L * 0.34, 0.2, W * 0.62, -L * 0.12, 0.52, 0, col);
      addBox(b, 0.1, 0.9, 0.1, L * 0.34, 0.86, 0, '#3a4046', 0, 0, -0.24);
      addBox(b, 0.09, 0.09, W * 0.82, L * 0.42, 1.28, 0, '#23272c');
      addBox(b, 0.22, 0.1, 0.32, -L * 0.06, 0.62, 0, '#15181c');
      addBox(b, 0.14, 0.26, 0.12, -L * 0.34, 0.5, 0, col);
      addBox(b, 0.08, 0.12, 0.16, L * 0.46, 1.12, 0, '#fff2c8');
      addBox(b, 0.06, 0.1, 0.1, -L * 0.3, 0.44, 0, '#ff3030');
    },
    boat(b, g, col, spec, acc) {
      const L = spec.len, W = spec.wid;
      addBox(b, L * 0.86, 0.6, W, 0, 0.5, 0, col);
      addBox(b, L * 0.5, 0.5, W * 0.92, L * 0.2, 0.94, 0, col);
      addBox(b, L * 0.5, 0.08, W * 0.86, L * 0.2, 1.22, 0, '#e8e4d4');
      addBox(b, L * 0.16, 0.34, W * 0.94, L * 0.41, 0.98, 0, col, 0, PI / 4, 0);
      addBox(b, L * 0.1, 0.42, W * 0.96, -L * 0.45, 0.86, 0, '#1b1f23');
      // windshield
      addBox(g, 0.06, 0.42, W * 0.74, L * 0.36, 1.4, 0, 0xffffff, 0, 0, -0.32);
      // seats
      addBox(b, 0.5, 0.26, W * 0.34, -L * 0.06, 1.2, 0, '#d8d2c0');
      addBox(b, 0.16, 0.4, W * 0.34, -L * 0.24, 1.3, 0, '#d8d2c0');
      addBox(b, 0.5, 0.24, 0.4, L * 0.1, 1.18, W * 0.34, '#d8d2c0');
      addBox(b, 0.5, 0.24, 0.4, L * 0.1, 1.18, -W * 0.34, '#d8d2c0');
      // rub rail
      addBox(b, L * 0.9, 0.1, W * 1.02, 0, 0.72, 0, acc || '#15181c');
      // engine
      addBox(b, 0.4, 0.34, 0.5, -L * 0.5, 0.8, 0, '#2d3237');
      addBox(b, 0.16, 0.1, 0.24, -L * 0.5, 0.5, 0, '#8d939a');
      addBox(b, 0.12, 0.14, 0.2, L * 0.52, 1.06, 0, '#fff2c8');
    },
  };
  // speedboat: longer, sleeker
  BUILDERS.speedboat = function (b, g, col, spec, acc) {
    const L = spec.len, W = spec.wid;
    addBox(b, L * 0.8, 0.5, W, 0, 0.42, 0, col);
    addBox(b, L * 0.62, 0.42, W * 0.9, L * 0.1, 0.78, 0, col);
    addBox(b, L * 0.3, 0.08, W * 0.82, L * 0.3, 1.0, 0, '#f2f4f6');
    addBox(b, L * 0.22, 0.3, W * 0.94, L * 0.38, 0.74, 0, col, 0, PI / 4, 0);
    addBox(g, 0.06, 0.36, W * 0.7, L * 0.3, 1.16, 0, 0xffffff, 0, 0, -0.42);
    addBox(b, 0.4, 0.36, 0.32, -L * 0.04, 1.06, W * 0.28, '#1e2227');
    addBox(b, 0.4, 0.36, 0.32, -L * 0.04, 1.06, -W * 0.28, '#1e2227');
    addBox(b, L * 0.86, 0.08, W * 1.02, 0, 0.62, 0, acc || '#12161c');
    for (let i = -1; i <= 1; i++) addBox(b, 0.5, 0.36, 0.36, -L * 0.52, 0.8 + (i === 0 ? 0.1 : 0), i * W * 0.26, '#2b3036');
    addBox(b, 0.1, 0.1, W * 0.9, -L * 0.54, 1.02, 0, '#8d939a');
    addBox(b, 0.1, 0.1, 0.24, L * 0.5, 0.9, 0, '#fff2c8');
    addBox(b, 0.1, 0.12, 0.2, -L * 0.53, 1.12, 0, '#ff3030');
  };

  V.buildModel = function (type, color, accent) {
    const spec = V.CATALOG[type] || V.CATALOG.sedan;
    const b = bucket(), g = bucket();
    const build = BUILDERS[type] || BUILDERS.sedan;
    try { build(b, g, color || spec.colors[0], spec, accent); }
    catch (e) { LL.reportError(e, 'vehmodel:' + type); build(b, g, '#cccccc', spec, null); }
    const group = new THREE.Group();
    const body = toMesh(b, bodyMat);
    if (body) group.add(body);
    const glass = toMesh(g, glassMat, false);
    if (glass) { glass.renderOrder = 3; group.add(glass); }
    return { group, body, glass, spec };
  };

  console.log('[vehicles] data pronta —', V.ORDER.length, 'modelos');
})();
