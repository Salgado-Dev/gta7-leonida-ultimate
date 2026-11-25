/* ============================================================================
   11 · WORLD BLOCKS — buildings, special services, yards, colliders.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, CELL = W.CELL, GRID = W.GRID, WORLD = W.WORLD, ROAD = W.ROAD, INNER = W.INNER, SPECIALS = W.SPECIALS;
  const PI = Math.PI, addSign = W.addSign;

  /* ------------------------------------------------------------- colliders */
  W.addCollider = function (cx, cy, w, d, h, type) {
    W.colliders.push({ x0: cx - w / 2, y0: cy - d / 2, x1: cx + w / 2, y1: cy + d / 2, h: h || 10, type: type || 'building' });
  };
  W.addColliderRect = function (x0, y0, x1, y1, h, type) {
    W.colliders.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), h: h || 10, type: type || 'building' });
  };

  /* -------------------------------------------------------------- builders */
  const builders = new Map();
  const detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const detailMats = { detail: detailMat };
  function sectorOf(x, z) { return (x > WORLD / 2 ? 1 : 0) + (z > WORLD / 2 ? 2 : 0); }
  function getFB(style, variant, x, z) {
    const key = 'f|' + style + '|' + (variant || 0) + '|' + sectorOf(x, z);
    if (!builders.has(key)) builders.set(key, new W.MB(W.facadeMaterial(style, variant || 0), true));
    return builders.get(key);
  }
  function getDB(x, z) {
    const key = 'd|' + sectorOf(x, z);
    if (!builders.has(key)) builders.set(key, new W.MB(detailMat));
    return builders.get(key);
  }
  W.detailMat = detailMat;

  const ROOFS = ['#3a3d40', '#4a453d', '#2f3438', '#55483a', '#3e4145'];
  const SHOP_NAMES = [
    ['LEONIDA MART', '#173a2a', '#b8ffd9'], ['SUNSET LIQUOR', '#3a1620', '#ffc0cf'], ['CASA VICE', '#3a2140', '#ffb7f3'],
    ['PRAIA CAFÉ', '#3c2a12', '#ffe0a8'], ['NEON TATTOO', '#24113a', '#d0a6ff'], ['PAWN & GOLD', '#2c2a10', '#ffe66e'],
    ['MARINA BOUTIQUE', '#0f2c3a', '#a9e8ff'], ['FLAMINGO CLUB', '#3a102a', '#ff9ec8'], ['CAIS 7', '#0e2e33', '#9ff5e7'],
    ['VICE AUTO PARTS', '#2b2b2b', '#d7d7d7'], ['BANCO CORAL', '#14303a', '#9ee6ff'], ['HOTEL LUNA', '#2a1840', '#d7b8ff'],
    ['TACOS EL REY', '#3a2010', '#ffce8a'], ['SURF SHACK', '#0f3340', '#a2f0ff'], ['LUCKY CIGARS', '#2c1b12', '#f0c99a'],
    ['LEONIDA REALTY', '#0f2c22', '#9dffd0'], ['MOONLIGHT DINER', '#2e1530', '#ffb8e6'], ['BODEGA 24H', '#22300e', '#d9ff9e'],
  ];
  const SHOP_SIGNS = [];

  function addBuilding(cx, cy, w, d, h, style, opts) {
    opts = opts || {};
    const variant = opts.variant || 0;
    const b = getFB(style, variant, cx, cy);
    const tint = opts.tint || W.tint(0, 0.09);
    b.facade(cx, 0.14, cy, w, h, d, tint);
    const db = getDB(cx, cy);
    const roof = opts.roof || U.pick(ROOFS);
    db.box(cx, h + 0.14, cy, w + 0.7, 0.45, d + 0.7, W.col(roof));
    // parapet
    if (!opts.pitched && h < 60) {
      const pc = W.col(roof).map((v) => v * 0.85);
      db.box(cx, h + 0.55, cy + d / 2 + 0.2, w + 0.8, 0.7, 0.5, pc);
      db.box(cx, h + 0.55, cy - d / 2 - 0.2, w + 0.8, 0.7, 0.5, pc);
      db.box(cx + w / 2 + 0.2, h + 0.55, cy, 0.5, 0.7, d + 0.8, pc);
      db.box(cx - w / 2 - 0.2, h + 0.55, cy, 0.5, 0.7, d + 0.8, pc);
    }
    if (opts.pitched) addGable(cx, cy, w, d, h, roof, opts.gableH || 3.2);
    // rooftop clutter
    if (opts.rooftop !== false && h > 6) {
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const ox = U.rand(w * 0.3, -w * 0.3), oz = U.rand(d * 0.3, -d * 0.3);
        db.box(cx + ox, h + 0.7, cy + oz, U.rand(4, 2), U.rand(2.6, 1.1), U.rand(4, 2), W.col('#676b6f'));
      }
      if (h > 25 && Math.random() < 0.65) {
        const ax = cx + U.rand(w * 0.25, -w * 0.25), az = cy + U.rand(d * 0.25, -d * 0.25);
        db.box(ax, h + 0.7, az, 0.35, U.rand(18, 7), 0.35, W.col('#8d939a'));
        db.box(ax, h + 0.7 + 7, az, 0.6, 0.6, 0.6, W.col('#ff3b3b'));
      }
    }
    // ground floor shopfront
    if (opts.storefront) {
      const zf = cy + d / 2 + 0.22;
      const aw = w * 0.84;
      const awn = opts.awn || U.pick(['#b83a4b', '#265c63', '#b58b2a', '#46356e', '#2d6b44']);
      db.box(cx, 2.75, zf + 1.2, aw, 0.3, 2.4, W.col(awn));
      db.box(cx, 0.4, zf + 0.1, aw * 0.92, 0.28, 0.28, W.col('#22272d'));
      db.box(cx, 0.15, zf + 0.25, aw * 0.92, 2.4, 0.12, W.col('#0e1a22'));
      // warm shop window light strip
      db.box(cx, 0.35, zf + 0.16, aw * 0.86, 1.35, 0.06, W.col('#e7c47a'));
      if (opts.sign) {
        SHOP_SIGNS.push({ text: opts.sign, x: cx, y: 4.8, z: zf + 0.45, w: Math.min(w * 0.8, 34), h: 4.4, bg: opts.signBg || '#14181f', fg: opts.signFg || '#fff', glow: opts.neon });
      }
    }
    if (opts.door !== false) db.box(cx + (opts.doorX || 0), 0.15, cy + d / 2 + 0.18, 3.4, 4.2, 0.25, W.col('#171a1f'));
    if (opts.setback && h > 34) {
      const h2 = Math.round(h * U.rand(0.45, 0.22));
      const w2 = w * U.rand(0.72, 0.55), d2 = d * U.rand(0.72, 0.55);
      b.facade(cx, h + 0.6, cy, w2, h2, d2, tint);
      db.box(cx, h + h2 + 0.6, cy, w2 + 0.6, 0.45, d2 + 0.6, W.col(roof));
      if (Math.random() < 0.6) {
        db.box(cx + w2 / 2 + 0.2, h + h2 + 1, cy, 0.5, 0.8, d2 + 0.6, W.col('#2a2d31'));
      }
    }
    if (!opts.noCollide) W.addCollider(cx, cy, w, d, opts.collideH || h + (opts.pitched ? 3 : 0), 'building');
    return { cx, cy, w, d, h, style };
  }

  function addGable(cx, cy, w, d, h, color, rh) {
    const db = getDB(cx, cy), c = W.col(color), e = 1.1;
    const x0 = cx - w / 2 - e, x1 = cx + w / 2 + e, z0 = cy - d / 2 - e, z1 = cy + d / 2 + e, y0 = h + 0.4, yr = h + rh;
    // two slopes (ridge along x)
    db.quad([x0, y0, z1], [x1, y0, z1], [x1, yr, cy], [x0, yr, cy], [0, 0.8, 0.6], [0, 0, 1, 0, 1, 1, 0, 1], c);
    db.quad([x1, y0, z0], [x0, y0, z0], [x0, yr, cy], [x1, yr, cy], [0, 0.8, -0.6], [0, 0, 1, 0, 1, 1, 0, 1], c);
    // ends
    db.tri([x0, y0, z0], [x0, y0, z1], [x0, yr, cy], [-1, 0, 0], c);
    db.tri([x1, y0, z1], [x1, y0, z0], [x1, yr, cy], [1, 0, 0], c);
  }
  W.addGable = addGable;

  function addFence(x0, y0, x1, y1, h, color, collide) {
    const db = getDB(x0, y0), len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const c = W.col(color || '#7f735f');
    for (let s = 0; s < len; s += 3.6) {
      const t = s / len;
      db.box(x0 + (x1 - x0) * t, 0.15, y0 + (y1 - y0) * t, 0.22, h, 0.22, c);
    }
    // rails
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    db.box(mx, h * 0.5, my, len, 0.16, 0.1, c, 1);
    if (Math.abs(x1 - x0) > Math.abs(y1 - y0)) db.box(mx, h * 0.5, my, len, 0.16, 0.1, c, 1);
    else db.box(mx, h * 0.5, my, 0.1, 0.16, len, c, 1);
    if (collide !== false) W.addColliderRect(x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3, h, 'fence');
  }
  W.addFence = addFence;

  function addContainer(x, y, color, rot, stack) {
    const c = W.col(color || U.pick(['#8d3f35', '#2f5a72', '#6d6a34', '#7a6037', '#3f6b4c']));
    const w = 6.2, d = 2.6;
    for (let s = 0; s < (stack || 1); s++) {
      getDB(x, y).box(x, 0.3 + s * 2.7, y, w, 2.55, d, c);
    }
    W.addCollider(x, y, w, d, 2.5 + (stack || 1) * 2.7, 'container');
  }
  W.addContainer = addContainer;

  function addParking(x, y, a, tag) {
    if (W.parkingSpots.length > 260) return;
    W.parkingSpots.push({ x, y, a: a || 0, tag: tag || '' });
  }

  function addPOI(def, x, y, extra) {
    const poi = Object.assign({ id: def.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: def.name, service: def.service, icon: def.icon || '●', color: def.color || '#ffcf5c', desc: def.desc || '', x, y, radius: def.radius || 5 }, extra || {});
    W.pois.push(poi);
    // glowing entrance ring
    try {
      const g = new THREE.RingGeometry(2.4, 3.1, 28);
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(poi.color), transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(g, m); ring.rotation.x = -PI / 2; ring.position.set(x, 0.2, y);
      W.scene.add(ring); (W.poiRings || (W.poiRings = [])).push({ ring, phase: Math.random() * 6 });
    } catch (e) { }
    return poi;
  }
  W.addPOI = addPOI;

  function addTrees(list, count, type, x0, y0, x1, y1) {
    for (let n = 0; n < count; n++) {
      for (let k = 0; k < 14; k++) {
        const x = U.rand(x1, x0), y = U.rand(y1, y0);
        if (W.freeSpot && !W.freeSpot(x, y, type === 'palm' ? 2.2 : 1.7)) continue;
        if (W.pois.some((p) => Math.hypot(p.x - x, p.y - y) < 10)) continue;
        (W.treeSpots || (W.treeSpots = { oak: [], pine: [], palm: [], bush: [] }))[type].push({ x, y, s: U.rand(1.3, 0.72), r: Math.random() * 6.28 });
        break;
      }
    }
  }
  W.addTrees = addTrees;

  /* ----------------------------------------------------------- generic block */
  function shopFor(i, j) {
    const r = U.seed(i * 311 + j * 977 + 4);
    const s = SHOP_NAMES[(r() * SHOP_NAMES.length) | 0];
    return { text: s[0], bg: s[1], fg: s[2] };
  }

  function buildDowntown(i, j, r, cx, cy, inner) {
    const tall = U.rand(120, 42);
    const s = U.chance(0.6) ? 'glass' : 'modern';
    addBuilding(cx - 48, cy - 20, U.rand(185, 145), U.rand(185, 140), tall, s, { variant: Math.random() < 0.5 ? 1 : 0, setback: true, storefront: true, sign: U.chance(0.5) ? shopFor(i, j).text : null, signBg: '#10182a', signFg: '#bfe6ff', neon: Math.random() < 0.35 });
    if (U.chance(0.7)) addBuilding(cx + 82, cy + 62, U.rand(104, 80), U.rand(115, 78), U.rand(36, 15), 'modern', { variant: 1, storefront: true, sign: shopFor(i, j).text, signBg: '#141418', signFg: '#ffd277' });
    addTrees([], 2, 'oak', inner.x0 + 8, inner.y0 + 8, inner.x1 - 8, inner.y1 - 8);
    if (U.chance(0.4)) addParking(cx + 60, cy + 120, PI / 2, 'downtown');
  }

  function buildCommercial(i, j, r, cx, cy, inner) {
    const offs = [[-74, -76], [76, -76], [-74, 78], [78, 78]];
    let n = 0;
    for (const [ox, oy] of offs) {
      if (n >= 3 || (n === 2 && Math.random() < 0.35)) break;
      const w = U.rand(128, 98), d = U.rand(116, 90), h = U.rand(32, 8);
      const shop = shopFor(i, j);
      addBuilding(cx + ox, cy + oy, w, d, h, U.pick(['stucco', 'shop', 'modern', 'brick']), {
        storefront: true, sign: shop.text, signBg: shop.bg, signFg: shop.fg, neon: Math.random() < 0.18,
        pitched: h < 9 && Math.random() < 0.35, variant: Math.random() < 0.4 ? 1 : 0,
      });
      n++;
    }
    addParking(cx - 70, cy + 128, PI / 2, 'shop');
    addParking(cx + 20, cy + 128, PI / 2, 'shop');
    addParking(cx + 70, cy + 128, PI / 2, 'shop');
    addTrees([], 2, 'oak', inner.x0, inner.y0, inner.x1, inner.y1);
  }

  function buildResidential(i, j, r, cx, cy, inner, dense) {
    const offs = dense ? [[-92, -92], [0, -92], [92, -92], [-92, 0], [92, 0], [-92, 92], [0, 92], [92, 92]] : [[-88, -80], [88, -80], [-88, 80], [88, 80]];
    const count = dense ? 6 : 4;
    let built = 0;
    for (const [ox, oy] of offs) {
      if (built >= count) break;
      if (Math.random() < 0.16) continue;
      const w = U.rand(76, 58), d = U.rand(70, 52), h = U.rand(7.2, 4.6);
      const style = U.pick(['brick', 'stucco', 'wood', 'mansion']);
      addBuilding(cx + ox, cy + oy, w, d, h, style, {
        pitched: true, gableH: U.rand(3.2, 2.2), rooftop: false, variant: Math.random() < 0.4 ? 1 : 0,
        tint: W.tint(0, 0.12),
      });
      built++;
      // yard fence fragment
      if (Math.random() < 0.28) {
        addFence(cx + ox - w / 2 - 4, cy + oy + d / 2 + 8, cx + ox + w / 2 + 4, cy + oy + d / 2 + 8, 0.9, '#9a8b73', false);
      }
    }
    addTrees([], dense ? 5 : 3, 'oak', inner.x0 + 4, inner.y0 + 4, inner.x1 - 4, inner.y1 - 4);
    addTrees([], 2, 'bush', inner.x0 + 4, inner.y0 + 4, inner.x1 - 4, inner.y1 - 4);
  }

  function buildMansion(i, j, r, cx, cy, inner) {
    addBuilding(cx - 24, cy - 52, U.rand(178, 145), U.rand(130, 105), U.rand(13, 8), 'mansion', {
      pitched: U.chance(0.25), gableH: 2.6, variant: 1, rooftop: false, tint: W.tint(0, 0.08),
    });
    // pool
    const px = cx + 66, py = cy + 56;
    getDB(cx, cy).box(px, 0.08, py, 62, 0.3, 34, W.col('#d8d4c8'));
    addPool(px, py, 56, 28);
    // walls
    addFence(inner.x0 - 12, inner.y0 - 12, inner.x1 + 12, inner.y0 - 12, 1.5, '#b7aa91', true);
    addFence(inner.x0 - 12, inner.y1 + 12, inner.x1 + 12, inner.y1 + 12, 1.5, '#b7aa91', true);
    addFence(inner.x0 - 12, inner.y0 - 12, inner.x0 - 12, inner.y1 + 12, 1.5, '#b7aa91', true);
    addFence(inner.x1 + 12, inner.y0 - 12, inner.x1 + 12, inner.y1 + 12, 1.5, '#b7aa91', true);
    addTrees([], 5, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
    addTrees([], 2, 'bush', inner.x0, inner.y0, inner.x1, inner.y1);
    addParking(cx - 92, cy + 122, PI / 2, 'mansion');
  }

  function addPool(x, y, w, d) {
    try {
      const g = new THREE.PlaneGeometry(w, d);
      const m = new THREE.MeshPhongMaterial({ color: 0x2a91b4, shininess: 120, specular: 0x9fe9ff, transparent: true, opacity: 0.88 });
      const p = new THREE.Mesh(g, m); p.rotation.x = -PI / 2; p.position.set(x, 0.25, y); p.receiveShadow = true;
      W.scene.add(p); (W.pools || (W.pools = [])).push({ mesh: p, base: 0.88 });
    } catch (e) { }
  }

  function buildIndustrial(i, j, r, cx, cy, inner) {
    const w = U.rand(205, 150), d = U.rand(150, 105), h = U.rand(16, 8);
    addBuilding(cx - 18, cy - 50, w, d, h, 'industrial', { storefront: false, style: 'industrial' });
    getDB(cx, cy).box(cx - 18 + w / 2 + 4, 1.2, cy - 50, 8, 4, 30, W.col('#2b2e30'));
    // loading bays
    for (let k = -1; k <= 1; k++) getDB(cx, cy).box(cx - 18 + k * 32, 0.2, cy + 34, 18, 0.6, 10, W.col('#595c5e'));
    for (let k = 0; k < 4; k++) addContainer(cx + U.rand(120, 58), cy + U.rand(126, 62), null, 0, U.chance(0.3) ? 2 : 1);
    addFence(inner.x0, inner.y1 + 10, inner.x1, inner.y1 + 10, 1.1, '#7b7d78', true);
    addTrees([], 2, 'pine', inner.x0, inner.y0, inner.x1, inner.y1);
    addParking(cx + 110, cy + 104, PI / 2, 'industrial');
  }

  function buildPort(i, j, r, cx, cy, inner) {
    addBuilding(cx - 45, cy - 58, U.rand(170, 140), U.rand(112, 90), U.rand(14, 8), 'industrial', { storefront: false });
    // container yard
    for (let k = 0; k < 6; k++) addContainer(cx + U.rand(120, 20), cy + U.rand(120, 45), null, 0, U.chance(0.35) ? 2 : 1);
    addCrane(cx + 100, cy + 40);
    addFence(inner.x0, inner.y0 - 10, inner.x1, inner.y0 - 10, 1.4, '#8b8d86', true);
    addTrees([], 1, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
    addParking(cx - 100, cy + 120, PI / 2, 'port');
  }

  function addCrane(x, y) {
    const db = getDB(x, y), c = W.col('#c7a33a'), c2 = W.col('#4d5155');
    db.box(x - 7, 0, y - 7, 1.1, 32, 1.1, c2); db.box(x + 7, 0, y - 7, 1.1, 32, 1.1, c2);
    db.box(x + 7, 0, y + 7, 1.1, 32, 1.1, c2); db.box(x - 7, 0, y + 7, 1.1, 32, 1.1, c2);
    db.box(x, 30, y, 16, 1.4, 16, c); db.box(x, 32, y, 60, 1.1, 2, c);
    db.box(x + 28, 25, y, 0.5, 16, 0.5, c2);
    W.addCollider(x, y, 16, 16, 32, 'crane');
  }

  function buildEntertainment(i, j, r, cx, cy, inner) {
    const h = U.rand(44, 18);
    addBuilding(cx - 46, cy - 40, U.rand(145, 115), U.rand(130, 100), h, U.pick(['modern', 'glass']), {
      storefront: true, sign: U.pick(SHOP_NAMES)[0], signBg: '#2a0b26', signFg: '#ff8bdc', neon: true, variant: 1, setback: h > 30,
    });
    if (U.chance(0.65)) addBuilding(cx + 78, cy + 58, U.rand(96, 70), U.rand(90, 70), U.rand(18, 7), 'shop', {
      storefront: true, sign: U.pick(SHOP_NAMES)[0], signBg: '#161028', signFg: '#7ff5ff', neon: true,
    });
    // neon strips
    const db = getDB(cx, cy), col = W.col(U.pick(['#ff3d9a', '#22d3ee', '#ffcf5c', '#b55cff']));
    for (let k = 0; k < 3; k++) db.box(cx - 46 + k * 14, 6 + k * 5, cy - 40 + U.rand(60, -60), 0.4, 2.5, 0.4, col);
    addTrees([], 2, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
  }

  function buildPark(i, j, r, cx, cy, inner) {
    const db = getDB(cx, cy);
    // fountain
    db.box(cx, 0.2, cy, 24, 0.8, 24, W.col('#a6a293'));
    db.box(cx, 0.2, cy, 18, 0.55, 18, W.col('#2f7f95'));
    db.box(cx, 0.9, cy, 4, 2.2, 4, W.col('#8e8a80'));
    addPool(cx, cy, 17, 17);
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2 + PI / 4;
      db.box(cx + Math.cos(a) * 20, 0.4, cy + Math.sin(a) * 20, 4, 0.7, 1.2, W.col('#7d633e'));
    }
    // benches + bins
    for (let k = 0; k < 7; k++) {
      const a = U.rand(6.28), rad = U.rand(97, 30);
      benchProp(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, U.rand(6.28));
    }
    addTrees([], 13, 'oak', inner.x0 + 6, inner.y0 + 6, inner.x1 - 6, inner.y1 - 6);
    addTrees([], 8, 'bush', inner.x0 + 6, inner.y0 + 6, inner.x1 - 6, inner.y1 - 6);
  }

  function benchProp(x, y, a) {
    const db = getDB(x, y), c = W.col('#6b4d2c'), c2 = W.col('#35393b');
    db.box(x, 0.4, y, 3.2, 0.3, 1.0, c2);
    db.box(x, 0.7, y - 0.6, 3.2, 0.6, 0.16, c);
    db.box(x - 1.3, 0, y, 0.2, 0.7, 0.9, c2); db.box(x + 1.3, 0, y, 0.2, 0.7, 0.9, c2);
  }
  W.benchProp = benchProp;

  function buildBeach(i, j, r, cx, cy, inner) {
    const db = getDB(cx, cy);
    // boardwalk strip at the west side of the beach blocks
    for (let k = 0; k < 6; k++) {
      const y = cy - 120 + k * 48;
      db.box(cx - 126, 0.12, y, 16, 0.35, 44, W.col('#8a6a43'));
    }
    // lifeguard towers
    for (let k = 0; k < 2; k++) {
      const lx = cx + U.rand(80, -10), ly = cy + U.rand(105, 20);
      db.box(lx - 5, 0, ly - 5, 0.5, 6, 0.5, W.col('#d8d8d0')); db.box(lx + 5, 0, ly - 5, 0.5, 6, 0.5, W.col('#d8d8d0'));
      db.box(lx - 5, 0, ly + 5, 0.5, 6, 0.5, W.col('#d8d8d0')); db.box(lx + 5, 0, ly + 5, 0.5, 6, 0.5, W.col('#d8d8d0'));
      db.box(lx, 4.5, ly, 11, 2.6, 11, W.col('#e8e4d8'));
      db.box(lx, 7.5, ly, 12, 0.4, 12, W.col('#c9563d'));
    }
    // umbrellas & towels
    for (let k = 0; k < 9; k++) {
      const x = cx + U.rand(135, -30), y = cy + U.rand(135, -130);
      if (!W.freeSpot || !W.freeSpot(x, y, 2)) continue;
      const c = U.pick(['#e0495f', '#2d8fb3', '#f2c84b', '#d96bb0']);
      db.box(x, 0, y, 0.16, 3.2, 0.16, W.col('#d8d4c8'));
      db.box(x, 3.1, y, 6.5, 0.25, 6.5, W.col(c));
      db.box(x + 3, 0.18, y + 1, 3, 0.1, 2, W.col(U.pick(['#e5d7b8', '#d3a6b8', '#8fc7d8'])));
    }
    addTrees([], 8, 'palm', inner.x0 - 30, inner.y0, inner.x1, inner.y1);
    addTrees([], 3, 'bush', inner.x0 - 30, inner.y0, inner.x1, inner.y1);
  }

  function buildRural(i, j, r, cx, cy, inner) {
    addBuilding(cx - 55, cy - 40, U.rand(95, 70), U.rand(125, 85), U.rand(10, 6), 'wood', { pitched: true, gableH: 4, rooftop: false, variant: 1 });
    addBuilding(cx + 70, cy + 45, U.rand(55, 42), U.rand(48, 38), U.rand(6, 4), 'wood', { pitched: true, gableH: 2.4, rooftop: false });
    // silo
    const sx = cx + 80, sy = cy - 70;
    getDB(cx, cy).box(sx, 0.2, sy, 10, 20, 10, W.col('#b9b3a5'));
    getDB(cx, cy).box(sx, 20, sy, 11, 2, 11, W.col('#8e8779'));
    W.addCollider(sx, sy, 10, 10, 22, 'silo');
    addFence(inner.x0 - 10, inner.y0 - 10, inner.x1 + 10, inner.y0 - 10, 1.2, '#7d6b4f', true);
    addFence(inner.x0 - 10, inner.y1 + 10, inner.x1 + 10, inner.y1 + 10, 1.2, '#7d6b4f', true);
    addTrees([], 7, 'pine', inner.x0, inner.y0, inner.x1, inner.y1);
    addTrees([], 3, 'oak', inner.x0, inner.y0, inner.x1, inner.y1);
  }

  function buildOutskirts(i, j, r, cx, cy, inner) {
    addBuilding(cx - 30, cy - 50, U.rand(120, 85), U.rand(80, 55), U.rand(9, 5), U.pick(['wood', 'industrial']), { pitched: U.chance(0.5), rooftop: false });
    for (let k = 0; k < 3; k++) addContainer(cx + U.rand(110, 40), cy + U.rand(100, 30), null, 0, 1);
    addTrees([], 4, 'pine', inner.x0, inner.y0, inner.x1, inner.y1);
    addParking(cx + 80, cy + 120, PI / 2, 'outskirts');
  }

  /* --------------------------------------------------------------- specials */
  function buildSpecial(i, j, def, cx, cy, inner) {
    const r = U.seed(i * 5003 + j * 7919 + 11);
    const kind = def.kind;
    if (kind === 'safehouse') {
      addBuilding(cx - 12, cy - 58, 128, 92, 8.5, 'mansion', { pitched: true, gableH: 3.4, rooftop: false, doorX: 0, tint: W.tint(0, 0.06) });
      addBuilding(cx + 86, cy - 6, 48, 42, 4.2, 'stucco', { rooftop: false, door: false, variant: 1 });
      getDB(cx, cy).box(cx + 86, 0.15, cy - 26, 44, 3.8, 0.3, W.col('#2b2e31'));
      addParking(cx + 86, cy + 28, PI / 2, 'safehouse');
      addTrees([], 3, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
      addFence(inner.x0, inner.y1 + 10, inner.x1, inner.y1 + 10, 1.1, '#b5a68d', false);
      addPOI(def, cx, cy - 2);
    } else if (kind === 'garage') {
      addBuilding(cx - 22, cy - 46, 166, 96, 8, 'industrial', { storefront: false, sign: null });
      getDB(cx, cy).box(cx - 22, 0.2, cy + 2, 48, 5.4, 0.4, W.col('#1b1e21'));
      getDB(cx, cy).box(cx - 22, 0.2, cy + 2.2, 44, 4.5, 0.1, W.col('#30363b'));
      W.addSign('GARAGEM', cx - 22, 6.4, cy + 2.8, 22, 4.4, 's', '#181b20', '#ffcf5c', true);
      for (let k = 0; k < 4; k++) addParking(cx - 90 + k * 45, cy + 110, 0, 'garage');
      addPOI(def, cx - 22, cy + 16);
    } else if (kind === 'dealer') {
      addBuilding(cx, cy - 68, 190, 86, 11, 'glass', { storefront: true, sign: 'AUTO LEONIDA', signBg: '#0b1b26', signFg: '#8fe8ff', neon: true, variant: 1, rooftop: false });
      for (let k = 0; k < 6; k++) addParking(cx - 112 + k * 45, cy + 50, PI / 2, 'dealer');
      for (let k = 0; k < 4; k++) addParking(cx - 100 + k * 50, cy + 112, PI / 2, 'dealer');
      addTrees([], 3, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
      addPOI(def, cx, cy + 8, { lot: { x: cx, y: cy + 60 } });
    } else if (kind === 'shop' || kind === 'hospital' || kind === 'police') {
      const h = kind === 'hospital' ? 34 : kind === 'police' ? 17 : 8;
      const w = kind === 'hospital' ? 188 : kind === 'police' ? 160 : 124;
      const d = kind === 'hospital' ? 122 : kind === 'police' ? 100 : 88;
      addBuilding(cx, cy - 58, w, d, h, kind === 'hospital' ? 'modern' : kind === 'police' ? 'modern' : 'stucco', {
        storefront: kind === 'shop', sign: def.sign, signBg: kind === 'hospital' ? '#3b1113' : kind === 'police' ? '#10203f' : '#24152d',
        signFg: kind === 'hospital' ? '#ff9b9b' : kind === 'police' ? '#a9c8ff' : '#ffc6ef', neon: kind === 'shop', variant: 1,
      });
      if (kind === 'hospital') {
        addSign('+', cx, 23, cy - 58 + 62, 10, 10, 's', '#7a1218', '#ffb2b2', true);
        addParking(cx - 70, cy + 104, PI / 2, 'hospital'); addParking(cx - 20, cy + 104, PI / 2, 'hospital');
      } else if (kind === 'police') {
        addParking(cx + 55, cy + 92, PI / 2, 'police'); addParking(cx + 105, cy + 92, PI / 2, 'police');
      }
      addPOI(def, cx, cy + 2);
    } else if (kind === 'fence') {
      addBuilding(cx - 30, cy - 55, 140, 92, 7, 'industrial', { storefront: false, sign: def.sign, signBg: '#2a1c0e', signFg: '#ffca73' });
      for (let k = 0; k < 5; k++) addContainer(cx + U.rand(115, 20), cy + U.rand(120, 35), null, 0, 1);
      addFence(inner.x0, inner.y1 + 8, inner.x1, inner.y1 + 8, 1.8, '#6b6d66', true);
      addPOI(def, cx - 30, cy + 12);
    } else if (kind === 'club') {
      addBuilding(cx, cy - 54, 150, 112, 22, 'modern', { storefront: true, sign: def.sign, signBg: '#240a33', signFg: '#ff8bdc', neon: true, variant: 1 });
      addSign('CLUB NEON', cx, 13.5, cy + 2.5, 30, 5, 's', '#16051f', '#ff6fce', true);
      for (let k = 0; k < 3; k++) getDB(cx, cy).box(cx - 58 + k * 6, 3.4, cy + 2.8, 0.35, 9, 0.35, W.col('#b45cff'));
      addTrees([], 2, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
      addPOI(def, cx, cy + 8);
    } else if (kind === 'casino') {
      addBuilding(cx - 20, cy - 66, 190, 112, 11, 'glass', { storefront: false, sign: 'CORAL', signBg: '#2a1708', signFg: '#ffcf5c', neon: true });
      addBuilding(cx - 20, cy - 68, 120, 100, 58, 'glass', { variant: 1, setback: true, rooftop: true });
      addSign('CORAL', cx - 20, 68, cy - 18, 34, 6, 's', '#1b0e05', '#ffd36b', true);
      addPOI(def, cx, cy + 4);
    } else if (kind === 'beachbar' || kind === 'beachshop') {
      addBuilding(cx - 70, cy + 8, 70, 52, 4.6, 'wood', { pitched: true, gableH: 2.2, rooftop: false, door: false, variant: 1 });
      getDB(cx, cy).box(cx - 70, 3.2, cy + 30, 34, 0.4, 4, W.col('#5f4326'));
      getDB(cx, cy).box(cx - 70, 0.9, cy + 30, 34, 0.2, 1, W.col('#d8c8a8'));
      addSign(def.sign, cx - 70, 5.6, cy + 34, 22, 4.2, 's', '#301c0d', '#ffd08a', true);
      for (let k = 0; k < 5; k++) {
        const x = cx - 10 + k * 22, y = cy + 64 + (k % 2) * 26;
        getDB(cx, cy).box(x, 0, y, 0.15, 3, 0.15, W.col('#e4ddc9'));
        getDB(cx, cy).box(x, 3, y, 6, 0.2, 6, W.col('#e0495f'));
      }
      addTrees([], 4, 'palm', inner.x0, inner.y0, inner.x1, inner.y1);
      addPOI(def, cx - 70, cy + 38);
    } else if (kind === 'port') {
      addBuilding(cx - 50, cy - 50, 180, 110, 13, 'industrial', { storefront: false, sign: def.sign, signBg: '#081c22', signFg: '#9ef4ff' });
      for (let k = 0; k < 8; k++) addContainer(cx + U.rand(120, 10), cy + U.rand(125, 30), null, 0, U.chance(0.35) ? 2 : 1);
      addCrane(cx + 105, cy + 72);
      addPOI(def, cx - 50, cy + 10, { port: true });
    } else if (kind === 'gas') {
      buildGasStation(i, j, def, cx, cy, inner);
    }
  }

  function buildGasStation(i, j, def, cx, cy, inner) {
    const db = getDB(cx, cy);
    // canopy
    db.box(cx, 6.2, cy, 104, 0.8, 62, W.col('#d8d4c4'));
    db.box(cx, 5.9, cy, 100, 0.3, 58, W.col('#b94a4a'));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      db.box(cx + sx * 46, 0, cy + sz * 26, 1.5, 6.2, 1.5, W.col('#c9c5b6'));
      W.addCollider(cx + sx * 46, cy + sz * 26, 1.5, 1.5, 6.2, 'pillar');
    }
    // pumps
    for (const sx of [-1, 1]) {
      const px = cx + sx * 18, py = cy;
      db.box(px, 0.2, py, 3.4, 1.2, 6.2, W.col('#8b8f93'));
      db.box(px, 1.4, py, 2.4, 2.6, 2.2, W.col('#d8d9d2'));
      db.box(px, 2.2, py, 2.2, 0.7, 0.3, W.col('#1e6f80'));
      W.addCollider(px, py, 3.4, 6.2, 3.2, 'pump');
    }
    // store
    addBuilding(cx - 88, cy - 10, 74, 52, 5.2, 'stucco', { storefront: true, sign: 'CONVENIÊNCIA', signBg: '#102e22', signFg: '#9dffd0', rooftop: false, doorX: -10 });
    // sign pole
    db.box(cx + 82, 0, cy + 40, 0.8, 13, 0.8, W.col('#7d8185'));
    addSign('POSTO', cx + 82, 14.4, cy + 40, 20, 5, 's', '#0d3b26', '#7dffb8', true);
    addParking(cx - 100, cy + 98, PI / 2, 'gas'); addParking(cx - 55, cy + 98, PI / 2, 'gas');
    addPOI(def, cx, cy + 36, { pumps: [{ x: cx, y: cy }] });
  }

  /* ------------------------------------------------------------ block driver */
  W.generateBlock = function (i, j) {
    const code = W.codeAt(i, j), zone = W.zoneAt(i, j), key = i + ',' + j;
    const special = SPECIALS[key];
    const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
    const inner = W.innerRect(i, j);
    const r = U.seed(i * 131 + j * 977 + 17);
    try {
      if (special) buildSpecial(i, j, special, cx, cy, inner);
      else if (zone === 'downtown') buildDowntown(i, j, r, cx, cy, inner);
      else if (zone === 'commercial') buildCommercial(i, j, r, cx, cy, inner);
      else if (zone === 'residential') buildResidential(i, j, r, cx, cy, inner, true);
      else if (zone === 'suburb') buildResidential(i, j, r, cx, cy, inner, false);
      else if (zone === 'mansion') buildMansion(i, j, r, cx, cy, inner);
      else if (zone === 'industrial') buildIndustrial(i, j, r, cx, cy, inner);
      else if (zone === 'port') buildPort(i, j, r, cx, cy, inner);
      else if (zone === 'entertainment') buildEntertainment(i, j, r, cx, cy, inner);
      else if (zone === 'park') buildPark(i, j, r, cx, cy, inner);
      else if (zone === 'beach') buildBeach(i, j, r, cx, cy, inner);
      else if (zone === 'rural') buildRural(i, j, r, cx, cy, inner);
      else buildOutskirts(i, j, r, cx, cy, inner);
    } catch (e) { LL.reportError(e, 'block ' + i + ',' + j); }

    // sidewalk loop for pedestrians
    const px = 162 - 9;
    W.blocks.push({
      i, j, zone, code, special,
      loop: [
        { x: cx - px, y: cy - px }, { x: cx + px, y: cy - px }, { x: cx + px, y: cy + px }, { x: cx - px, y: cy + px },
      ],
      center: { x: cx, y: cy },
    });
  };

  W.builders = builders;
  W.getDB = getDB;
  W.SHOP_SIGNS = SHOP_SIGNS;
  W.addBuilding = addBuilding;
  W.addParking = addParking;
  W.addTrees = addTrees;
})();
