/* ============================================================================
   10 · WORLD DATA — constants, districts, mesh builder, procedural facades.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const PI = Math.PI;
  const W = (LL.World = {});

  const CELL = 420, GRID = 12, WORLD = CELL * GRID, ROAD = 96, PLOT = CELL - ROAD, INNER = PLOT - 32, WATER_END = WORLD + 1450;
  Object.assign(W, { CELL, GRID, WORLD, ROAD, PLOT, INNER, WATER_END, WATER_Y: WORLD / 2, scene: null, colliders: [], pois: [], blocks: [], landmarks: [], parkingSpots: [], collectibleSpots: [], lamps: [], signals: [], districts: [] });

  const ROWS = [
    'r r r s s h h m m m b b',
    'r r s s h h c m m b b b',
    'r s s h h c c m b b b b',
    'i s h h c c c e e b b b',
    'i h h c d d d e e b b b',
    'i h h c d d d c e b b b',
    'i i h c d d d c e p b b',
    'i i o c c g c c p p p b',
    'r i o o g g c p p p p b',
    'r r o o g h h c p p p b',
    'r r o o h h c c p p b b',
    'r r r o o h h c p p b b',
  ].map((r) => r.split(' '));
  W.ROWS = ROWS;

  const ZONE = { r: 'rural', s: 'suburb', h: 'residential', m: 'mansion', c: 'commercial', d: 'downtown', i: 'industrial', p: 'port', b: 'beach', e: 'entertainment', g: 'park', o: 'outskirts' };
  const ZONE_NAME = {
    rural: 'EVERGLADES', suburb: 'PALM GROVE', residential: 'LITTLE HAVANA', mansion: 'STAR ISLAND',
    commercial: 'OCEAN DRIVE', downtown: 'DOWNTOWN LEONIDA', industrial: 'ZONA INDUSTRIAL',
    port: 'PORTO LEONIDA', beach: 'VICE BEACH', entertainment: 'NEON STRIP', park: 'GRAND PARK', outskirts: 'AREA PERIFÉRICA',
  };
  W.ZONE = ZONE; W.ZONE_NAME = ZONE_NAME;

  /* special blocks: services + landmarks. Every one is actually constructed. */
  const SPECIALS = {
    '2,3': { kind: 'safehouse', name: 'Casa de Jason', service: 'safehouse', icon: '⌂', color: '#33e19a', style: 'mansion', sign: 'CASA DE JASON', desc: 'Refúgio de Jason em Little Havana. Salva, dorme e troca de roupa.' },
    '6,9': { kind: 'safehouse', name: 'Casa de Lucia', service: 'safehouse', icon: '⌂', color: '#33e19a', style: 'mansion', sign: 'CASA DE LUCIA', desc: 'Apartamento seguro de Lucia. Salva e recupera energia.' },
    '3,3': { kind: 'garage', name: 'Oficina de Leonida', service: 'garage', icon: 'G', color: '#ffcf5c', style: 'industrial', sign: 'OFICINA LEONIDA', desc: 'Pintura, reparos, blindagem e garagem.' },
    '5,5': { kind: 'dealer', name: 'Auto Leonida', service: 'dealer', icon: 'A', color: '#22d3ee', style: 'glass', sign: 'AUTO LEONIDA', desc: 'Concessionária. Compre e registre veículos.' },
    '4,4': { kind: 'shop', name: 'Casa Vice', service: 'clothes', icon: 'C', color: '#ff7ac6', style: 'stucco', sign: 'CASA VICE', desc: 'Roupas e disfarces. A polícia memoriza seu visual.' },
    '3,4': { kind: 'shop', name: 'Ammu-Leonida', service: 'gunshop', icon: 'G', color: '#ff3d6e', style: 'industrial', sign: 'AMMU-LEONIDA', desc: 'Armas, munição e coletes.' },
    '1,7': { kind: 'fence', name: 'Ferro-Velho', service: 'fence', icon: 'R', color: '#b07a3a', style: 'industrial', sign: 'RECEPTADOR', desc: 'Compra veículos e espólios sem perguntas.' },
    '4,6': { kind: 'hospital', name: 'Hospital Leonida', service: 'hospital', icon: '+', color: '#ff5c5c', style: 'modern', sign: 'HOSPITAL', desc: 'Atendimento médico. Cura ferimentos por um preço.' },
    '5,3': { kind: 'police', name: '9º Distrito', service: 'police', icon: 'P', color: '#5c8dff', style: 'modern', sign: 'POLÍCIA', desc: 'Delegacia central. Cuidado com os olhos.' },
    '7,4': { kind: 'club', name: 'Club Neon', service: 'club', icon: 'N', color: '#c04dff', style: 'modern', sign: 'NEON', desc: 'Casa noturna. Bebida, música e negócios.' },
    '8,5': { kind: 'casino', name: 'Hotel Coral', service: 'casino', icon: '$', color: '#ffcf5c', style: 'glass', sign: 'CORAL', desc: 'Hotel e cassino à beira da Strip.' },
    '11,3': { kind: 'beachbar', name: 'Bar do Sol', service: 'bar', icon: 'B', color: '#ffb35c', style: 'wood', sign: 'BAR DO SOL', desc: 'Drinks na areia. Recupera energia.' },
    '10,8': { kind: 'port', name: 'Cais 7', service: 'port', icon: '⚓', color: '#22d3ee', style: 'industrial', sign: 'CAIS 7', desc: 'Cais de carga. Mercadorias e missões.' },
    '2,2': { kind: 'gas', name: 'Posto Palm', service: 'gas', icon: '⛽', color: '#33e19a', style: 'gas', sign: 'POSTO', desc: 'Combustível e conveniência.' },
    '6,6': { kind: 'gas', name: 'Posto Coral', service: 'gas', icon: '⛽', color: '#33e19a', style: 'gas', sign: 'POSTO', desc: 'Combustível e conveniência.' },
    '9,10': { kind: 'gas', name: 'Posto Sul', service: 'gas', icon: '⛽', color: '#33e19a', style: 'gas', sign: 'POSTO', desc: 'Combustível e conveniência.' },
    '11,5': { kind: 'beachshop', name: 'Ocean Drive', service: 'bar', icon: 'B', color: '#ffb35c', style: 'wood', sign: 'OCEAN DRIVE', desc: 'Quiosque da orla.' },
  };
  W.SPECIALS = SPECIALS;

  W.districts = [
    { name: 'DOWNTOWN LEONIDA', x: 6 * CELL, y: 4.6 * CELL }, { name: 'VICE BEACH', x: 10.9 * CELL, y: 4.4 * CELL },
    { name: 'NEON STRIP', x: 7.7 * CELL, y: 4.6 * CELL }, { name: 'LITTLE HAVANA', x: 2.4 * CELL, y: 4.6 * CELL },
    { name: 'OCEAN DRIVE', x: 5.2 * CELL, y: 2.8 * CELL }, { name: 'PALM GROVE', x: 3.2 * CELL, y: 1.6 * CELL },
    { name: 'STAR ISLAND', x: 8.5 * CELL, y: 1.4 * CELL }, { name: 'ZONA INDUSTRIAL', x: 1.6 * CELL, y: 7.3 * CELL },
    { name: 'PORTO LEONIDA', x: 10.1 * CELL, y: 8.1 * CELL }, { name: 'GRAND PARK', x: 5.2 * CELL, y: 7.8 * CELL },
    { name: 'EVERGLADES', x: 1.4 * CELL, y: 10.1 * CELL }, { name: 'AREA PERIFÉRICA', x: 3.7 * CELL, y: 9.4 * CELL },
  ];

  /* --------------------------------------------------------------- geometry */
  const tmpColor = new THREE.Color();
  class MB {
    constructor(material, textured) {
      this.mat = material; this.textured = !!textured;
      this.p = []; this.n = []; this.uv = []; this.c = [];
    }
    _v(x, y, z, nx, ny, nz, u, v, col) {
      this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v);
      this.c.push(col[0], col[1], col[2]);
    }
    quad(a, b, c, d, normal, uv, color) {
      const [nx, ny, nz] = normal;
      const u = uv || [0, 0, 1, 0, 1, 1, 0, 1];
      const cl = color || [1, 1, 1];
      this._v(a[0], a[1], a[2], nx, ny, nz, u[0], u[1], cl);
      this._v(b[0], b[1], b[2], nx, ny, nz, u[2], u[3], cl);
      this._v(c[0], c[1], c[2], nx, ny, nz, u[4], u[5], cl);
      this._v(d[0], d[1], d[2], nx, ny, nz, u[6], u[7], cl);
      // second triangle
      this._v(a[0], a[1], a[2], nx, ny, nz, u[0], u[1], cl);
      this._v(c[0], c[1], c[2], nx, ny, nz, u[4], u[5], cl);
      this._v(d[0], d[1], d[2], nx, ny, nz, u[6], u[7], cl);
    }
    tri(a, b, c, normal, color) {
      const [nx, ny, nz] = normal, cl = color || [1, 1, 1];
      this._v(a[0], a[1], a[2], nx, ny, nz, 0, 0, cl);
      this._v(b[0], b[1], b[2], nx, ny, nz, 1, 0, cl);
      this._v(c[0], c[1], c[2], nx, ny, nz, 0.5, 1, cl);
    }
    box(cx, y0, cz, w, h, d, color, uvTile) {
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
      const c = color || [0.75, 0.75, 0.75];
      const uS = uvTile || 1;
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, 0, d / uS, 0, d / uS, h / uS, 0, h / uS], c);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, 0, d / uS, 0, d / uS, h / uS, 0, h / uS], c);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, 0, w / uS, 0, w / uS, h / uS, 0, h / uS], c);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, 0, w / uS, 0, w / uS, h / uS, 0, h / uS], c);
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], c);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0, 1, 0, 1, 1, 0, 1], c);
    }
    // four walls only, UVs repeated by building size; the tile is 12m x 12m
    facade(cx, y0, cz, w, h, d, tint) {
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
      const c = tint || [1, 1, 1], ts = 12;
      const uW = w / ts, uD = d / ts, vH = h / ts;
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, 0, uD, 0, uD, vH, 0, vH], c);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, 0, uD, 0, uD, vH, 0, vH], c);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, 0, uW, 0, uW, vH, 0, vH], c);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, 0, uW, 0, uW, vH, 0, vH], c);
    }
    build(mat) {
      if (!this.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      const m = new THREE.Mesh(g, mat || this.mat);
      m.castShadow = true; m.receiveShadow = true;
      return m;
    }
  }
  W.MB = MB;

  /* -------------------------------------------------------- facade textures */
  const FSTYLES = {
    glass: { wall: '#3d4b63', trim: '#6d7d93', win: '#172a3d', lit: '#f6d9a0', tile: 13, floors: 4, bays: 4, ledges: true },
    modern: { wall: '#4c5058', trim: '#30343a', win: '#121b26', lit: '#ffd89a', tile: 12, floors: 4, bays: 4, ledges: true },
    brick: { wall: '#7c4b3d', trim: '#5b352a', win: '#17232c', lit: '#ffcf8a', tile: 12, floors: 4, bays: 3 },
    stucco: { wall: '#c7b394', trim: '#9a8569', win: '#20303b', lit: '#ffe0a4', tile: 12, floors: 4, bays: 3 },
    mansion: { wall: '#dfd0b2', trim: '#b6a284', win: '#22323c', lit: '#ffe3b0', tile: 12, floors: 3, bays: 3 },
    industrial: { wall: '#6a6c69', trim: '#4c4e4b', win: '#1b242a', lit: '#e9d09d', tile: 14, floors: 3, bays: 5 },
    wood: { wall: '#79563a', trim: '#5c3e28', win: '#1c262a', lit: '#ffd29a', tile: 10, floors: 3, bays: 3 },
    shop: { wall: '#b9555b', trim: '#8a343a', win: '#17252e', lit: '#ffe1a6', tile: 11, floors: 3, bays: 3 },
  };
  W.FSTYLES = FSTYLES;
  const facadeMats = {};

  function facadeTexture(style, variant) {
    const C = 512, S = FSTYLES[style] || FSTYLES.modern;
    const rnd = U.seed(1337 + style.length * 977 + variant * 311);
    const wall = document.createElement('canvas'); wall.width = wall.height = C;
    const em = document.createElement('canvas'); em.width = em.height = C;
    const a = wall.getContext('2d'), e = em.getContext('2d');
    a.fillStyle = S.wall; a.fillRect(0, 0, C, C);
    // subtle vertical / horizontal material texture
    const wallCol = new THREE.Color(S.wall).offsetHSL(0, 0, variant ? 0.035 : -0.02);
    a.fillStyle = '#' + wallCol.getHexString(); a.fillRect(0, 0, C, C);
    if (style === 'brick' || style === 'stucco' || style === 'wood') {
      a.globalAlpha = 0.12; a.strokeStyle = '#000'; a.lineWidth = 1;
      const step = style === 'wood' ? 18 : 10;
      for (let y = 0; y < C; y += step) { a.beginPath(); a.moveTo(0, y); a.lineTo(C, y); a.stroke(); }
      if (style === 'brick') {
        for (let y = 0; y < C; y += 10) for (let x = (y / 10) % 2 ? 0 : 14; x < C; x += 28) { a.beginPath(); a.moveTo(x, y); a.lineTo(x, y + 10); a.stroke(); }
      }
      a.globalAlpha = 1;
    }
    if (style === 'industrial') {
      a.globalAlpha = 0.18; a.strokeStyle = '#d7d7d7'; a.lineWidth = 2;
      for (let x = 0; x < C; x += 18) { a.beginPath(); a.moveTo(x, 0); a.lineTo(x, C); a.stroke(); }
      a.globalAlpha = 1;
    }
    if (style === 'glass' || style === 'modern') {
      a.globalAlpha = 0.16; a.strokeStyle = '#fff'; a.lineWidth = 1;
      for (let x = 0; x < C; x += 64) { a.beginPath(); a.moveTo(x, 0); a.lineTo(x, C); a.stroke(); }
      a.globalAlpha = 1;
    }
    // floors and bays
    const floors = S.floors, bays = S.bays, fh = C / floors, bw = C / bays;
    e.fillStyle = '#000'; e.fillRect(0, 0, C, C);
    for (let f = 0; f < floors; f++) {
      // floor band
      a.fillStyle = S.trim; a.globalAlpha = 0.5; a.fillRect(0, f * fh, C, 4); a.globalAlpha = 1;
      for (let b = 0; b < bays; b++) {
        const wm = style === 'glass' ? 5 : 18, hm = 12;
        const x = b * bw + wm, y = f * fh + hm, w = bw - wm * 2, h = fh - hm * 2 + 2;
        const g = a.createLinearGradient(x, y, x + w, y + h);
        const lit = rnd() < (style === 'glass' ? 0.44 : 0.3);
        if (lit) {
          g.addColorStop(0, S.lit); g.addColorStop(1, '#c99d5c');
          e.fillStyle = variant ? 'rgba(255,214,150,.95)' : 'rgba(255,196,120,.9)';
          e.fillRect(x + 2, y + 2, w - 4, h - 4);
          e.globalAlpha = 0.22; e.fillStyle = '#fff'; e.fillRect(x + 2, y + 2, w - 4, 6); e.globalAlpha = 1;
        } else {
          g.addColorStop(0, S.win); g.addColorStop(0.55, '#0d151d'); g.addColorStop(1, '#1d2a35');
        }
        a.fillStyle = g; a.fillRect(x, y, w, h);
        a.strokeStyle = S.trim; a.lineWidth = style === 'glass' ? 2 : 3; a.strokeRect(x, y, w, h);
        // mullion
        a.strokeStyle = 'rgba(0,0,0,.35)'; a.lineWidth = 1;
        if (w > 30) { a.beginPath(); a.moveTo(x + w / 2, y); a.lineTo(x + w / 2, y + h); a.stroke(); }
        if (style === 'glass' || style === 'modern') {
          a.globalAlpha = 0.16; a.fillStyle = '#caeeff'; a.beginPath();
          a.moveTo(x, y + h); a.lineTo(x + w * 0.55, y); a.lineTo(x + w, y); a.lineTo(x, y + h * 0.92); a.fill(); a.globalAlpha = 1;
        }
      }
    }
    // bottom plinth
    a.fillStyle = S.trim; a.fillRect(0, C - 20, C, 20);
    a.globalAlpha = 0.25; a.fillStyle = '#000'; a.fillRect(0, C - 26, C, 6); a.globalAlpha = 1;
    const t = new THREE.CanvasTexture(wall); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    const et = new THREE.CanvasTexture(em); et.wrapS = et.wrapT = THREE.RepeatWrapping; et.anisotropy = 4;
    return { map: t, emissiveMap: et };
  }

  W.facadeMaterial = function (style, variant) {
    const key = style + variant;
    if (facadeMats[key]) return facadeMats[key];
    const tex = facadeTexture(style, variant || 0);
    const mat = new THREE.MeshLambertMaterial({ map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissiveMap, emissiveIntensity: 0, vertexColors: true });
    mat.userData = { style, variant: variant || 0 };
    facadeMats[key] = mat;
    return mat;
  };
  W.facadeMats = facadeMats;
  W.setNight = function (n) {
    for (const k in facadeMats) { try { facadeMats[k].emissiveIntensity = n * 1.35; } catch (e) { } }
  };

  /* ------------------------------------------------------------------ signs */
  const signCache = new Map();
  W.signMaterial = function (text, bg, fg, glow) {
    const key = text + '|' + bg + '|' + fg + '|' + (glow ? 1 : 0);
    if (signCache.has(key)) return signCache.get(key);
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const q = c.getContext('2d');
    q.fillStyle = bg || '#101319'; q.fillRect(0, 0, 512, 128);
    q.strokeStyle = 'rgba(255,255,255,.25)'; q.lineWidth = 4; q.strokeRect(6, 6, 500, 116);
    q.font = '900 58px Arial, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.fillStyle = fg || '#ffffff';
    if (glow) { q.shadowColor = fg || '#fff'; q.shadowBlur = 24; }
    q.fillText(text, 256, 68);
    q.shadowBlur = 0;
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, toneMapped: false });
    signCache.set(key, m);
    return m;
  };
  W.addSign = function (text, x, y, z, w, h, facing, bg, fg, glow) {
    if (!W.scene) return null;
    const m = W.signMaterial(text, bg, fg, glow);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z);
    if (facing === 'n') mesh.rotation.y = PI;
    else if (facing === 'e') mesh.rotation.y = -PI / 2;
    else if (facing === 'w') mesh.rotation.y = PI / 2;
    mesh.renderOrder = 2;
    W.scene.add(mesh);
    return mesh;
  };

  /* ------------------------------------------------------------ shared utils */
  W.tint = function (r, h) {
    const c = new THREE.Color().setHSL(h ?? U.rand(1), 0.12, U.rand(0.98, 0.82));
    return [c.r, c.g, c.b];
  };
  W.col = function (hex) {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  W.zoneAt = function (i, j) {
    if (i < 0 || j < 0 || i >= GRID || j >= GRID) return 'outskirts';
    return ZONE[ROWS[j][i]] || 'residential';
  };
  W.codeAt = (i, j) => (i >= 0 && j >= 0 && i < GRID && j < GRID ? ROWS[j][i] : 'o');
  W.blockCenter = (i, j) => ({ x: i * CELL + CELL / 2, y: j * CELL + CELL / 2 });
  W.innerRect = function (i, j) {
    const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
    return { x0: cx - INNER / 2, y0: cy - INNER / 2, x1: cx + INNER / 2, y1: cy + INNER / 2, cx, cy };
  };
  W.districtAt = function (x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    let z = W.zoneAt(i, j);
    if (x > WORLD + 40) return 'BAÍA DE LEONIDA';
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return 'LEONIDA';
    // flavor overrides
    if (z === 'residential') return (x < WORLD * 0.45 ? 'LITTLE HAVANA' : 'SUNSET ISLES');
    if (z === 'commercial') return (y < WORLD * 0.45 ? 'OCEAN DRIVE' : 'MIDTOWN');
    if (z === 'rural') return 'EVERGLADES';
    return ZONE_NAME[z] || 'LEONIDA';
  };

  console.log('[world] data pronto —', GRID + 'x' + GRID, 'quarteirões,', Object.keys(SPECIALS).length, 'pontos especiais');
})();
