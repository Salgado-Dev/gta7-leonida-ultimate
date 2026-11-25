/* ============================================================================
   13 · WORLD PROPS — lamps, traffic signals, street furniture, piers, billboards.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, CELL = W.CELL, GRID = W.GRID, WORLD = W.WORLD, SPECIALS = W.SPECIALS;
  const PI = Math.PI;

  W.overrides = W.overrides || [];
  W.boatSpots = [];
  W.overrides.push ? null : null;
  W.addWalkOverride = function (o) {
    o.h = o.h || 0.35; o.surface = o.surface || 'wood';
    W.overrides.push(o);
    return o;
  };

  /* ------------------------------------------------------------------ lamps */
  function buildLamps() {
    const headGeo = new THREE.BoxGeometry(1.5, 0.35, 0.7);
    const poolGeo = new THREE.PlaneGeometry(30, 30);
    const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 128;
    const pg = poolCanvas.getContext('2d');
    const grad = pg.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,220,150,.9)'); grad.addColorStop(0.35, 'rgba(255,190,110,.36)'); grad.addColorStop(1, 'rgba(255,170,80,0)');
    pg.fillStyle = grad; pg.fillRect(0, 0, 128, 128);
    const ptex = new THREE.CanvasTexture(poolCanvas);
    const headMat = new THREE.MeshBasicMaterial({ color: 0x9a9486 });
    const poolMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    W.lampHeadMat = headMat; W.lampPoolMat = poolMat;
    const list = [];
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
      const spots = (i + j) % 2 ? [[cx - 148, cy - 148], [cx + 148, cy + 148]] : [[cx + 148, cy - 148], [cx - 148, cy + 148]];
      for (const [x, y] of spots) {
        if (W.onRoad(x, y)) continue;
        list.push({ x, y });
      }
    }
    // island, bridge and pier lamps added later by env; keep array
    W.lampSpots = list;
    const heads = new THREE.InstancedMesh(headGeo, headMat, list.length);
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, list.length);
    const dummy = new THREE.Object3D();
    const db = new THREE.Object3D();
    for (let k = 0; k < list.length; k++) {
      const { x, y } = list[k];
      const b = W.getDB(x, y);
      b.box(x, 0, y, 0.34, 8.2, 0.34, W.col('#3b4045'));
      b.box(x, 7.95, y + 1.15, 0.24, 0.24, 2.4, W.col('#3b4045'));
      b.box(x, 0.1, y, 1.4, 0.3, 1.4, W.col('#5b5f61'));
      dummy.position.set(x, 8.05, y + 2.15); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      heads.setMatrixAt(k, dummy.matrix);
      dummy.position.set(x, 0.22, y + 2.15); dummy.rotation.set(-PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      pools.setMatrixAt(k, dummy.matrix);
    }
    heads.instanceMatrix.needsUpdate = true; pools.instanceMatrix.needsUpdate = true;
    heads.castShadow = true; pools.frustumCulled = false;
    W.scene.add(heads, pools);
    W.lampHeads = heads; W.lampPools = pools;
    // a few lamps on the pier deck and island are added by env
  }

  /* --------------------------------------------------------- traffic signals */
  const SIGNAL_CYCLE = 26;
  W.signalState = function (i, j, axis, t) {
    const off = ((i * 3 + j * 5) % 16) * 0.7;
    const p = ((t + off) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    if (axis === 0) {
      if (p < 11) return 'green'; if (p < 13) return 'yellow'; return 'red';
    }
    if (p < 13) return 'red'; if (p < 24) return 'green'; return 'yellow';
  };
  function buildSignals() {
    const heads = [];
    const lensGeo = new THREE.SphereGeometry(0.32, 6, 5);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headGeo = new THREE.BoxGeometry(1.1, 3.3, 0.8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x1e2328 });
    const lensData = [];
    for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) {
      const x = i * CELL, y = j * CELL;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      corners.forEach(([sx, sz], idx) => {
        const px = x + sx * 56, py = y + sz * 56;
        const db = W.getDB(px, py);
        db.box(px, 0, py, 0.34, 6.4, 0.34, W.col('#363c41'));
        // arm toward the intersection
        const ax = -sx * 26, ay = -sz * 26;
        db.box(px + ax / 2, 6.25, py + ay / 2, Math.abs(ax) + 1.1, 0.24, Math.abs(ay) + 1.1, W.col('#363c41'));
        const hx = px + ax, hy = py + ay;
        db.box(hx, 4.9, hy, 0.9, 3.1, 0.9, W.col('#1e2328'));
        const axis = (idx === 0 || idx === 3) ? 0 : 1;
        const base = lensData.length;
        for (let l = 0; l < 3; l++) {
          lensData.push({ x: hx, y: 7.05 - l * 1.02, z: hy, axis, i, j });
        }
        heads.push({ i, j, axis, base, x: hx, y: hy });
      });
    }
    const lenses = new THREE.InstancedMesh(lensGeo, lensMat, lensData.length);
    const dummy = new THREE.Object3D();
    lensData.forEach((l, k) => {
      dummy.position.set(l.x, l.y, l.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      lenses.setMatrixAt(k, dummy.matrix);
      lenses.setColorAt(k, new THREE.Color('#2a2e30'));
    });
    lenses.instanceMatrix.needsUpdate = true; if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
    W.scene.add(lenses);
    W.signalLenses = lenses; W.signalLensData = lensData; W.signalHeads = heads;
    W._lastSignalTick = -1;
  }
  W.updateSignals = function (t) {
    if (!W.signalLenses) return;
    const tick = Math.floor(t * 2);
    if (tick === W._lastSignalTick) return;
    W._lastSignalTick = tick;
    const off = { red: new THREE.Color('#451518'), yellow: new THREE.Color('#4a3d12'), green: new THREE.Color('#123f2c') };
    const on = { red: new THREE.Color('#ff3333'), yellow: new THREE.Color('#ffcf5c'), green: new THREE.Color('#32ff8a') };
    const data = W.signalLensData;
    for (let k = 0; k < data.length; k++) {
      const l = data[k], state = W.signalState(l.i, l.j, l.axis, t);
      const isOn = (l.y > 6.5 && state === 'red') || (l.y > 5.5 && l.y <= 6.5 && state === 'yellow') || (l.y <= 5.5 && state === 'green');
      W.signalLenses.setColorAt(k, isOn ? on[state] : off[state]);
    }
    if (W.signalLenses.instanceColor) W.signalLenses.instanceColor.needsUpdate = true;
  };

  /* ------------------------------------------------------------ street bits */
  function buildStreetFurniture() {
    const dbCount = W.blocks.length;
    for (let b = 0; b < dbCount; b++) {
      const block = W.blocks[b], cx = block.center.x, cy = block.center.y, rnd = U.seed(block.i * 37 + block.j * 91 + 5);
      // bins & hydrants along the south sidewalk
      for (let k = 0; k < 2; k++) {
        const x = cx - 120 + rnd() * 240, y = cy + 150 + (rnd() - 0.5) * 4;
        if (W.onRoad(x, y)) continue;
        if (rnd() < 0.5) {
          W.getDB(x, y).box(x, 0, y, 1.1, 1.5, 1.1, W.col('#2b4c44'));
          W.getDB(x, y).box(x, 1.5, y, 1.2, 0.15, 1.2, W.col('#1d342f'));
        } else {
          W.getDB(x, y).box(x, 0, y, 0.5, 0.9, 0.5, W.col('#c73e35'));
          W.getDB(x, y).box(x, 0.9, y, 1, 0.25, 0.4, W.col('#c73e35'));
        }
      }
      // bus stop on some blocks
      if (rnd() < 0.2) {
        const x = cx + 100, y = cy + 152;
        W.getDB(x, y).box(x, 2.6, y, 7, 0.25, 2.6, W.col('#26333b'));
        W.getDB(x, y).box(x - 3.2, 0, y, 0.2, 2.6, 0.2, W.col('#49535a'));
        W.getDB(x, y).box(x + 3.2, 0, y, 0.2, 2.6, 0.2, W.col('#49535a'));
        W.getDB(x, y).box(x, 0.8, y - 0.8, 5.2, 0.16, 0.8, W.col('#5b4430'));
      }
      // newspaper boxes / mailbox
      if (rnd() < 0.25) {
        const x = cx - 130, y = cy + 152;
        W.getDB(x, y).box(x, 0, y, 1.4, 1.3, 1.1, W.col('#2d4f74'));
        W.getDB(x, y).box(x, 1.3, y, 1.5, 0.2, 1.2, W.col('#1e344d'));
      }
      // benches in parks and beach
      if (block.zone === 'park' || block.zone === 'beach') {
        // already park benches; add beach ones
        if (block.zone === 'beach') {
          for (let k = 0; k < 3; k++) W.benchProp(cx - 90 + k * 50, cy + 125, 0);
        }
      }
    }
    // billboards above some commercial corners
    const boards = [
      { i: 4, j: 2, text: 'LEONIDA', bg: '#1b1326', fg: '#ff6fce' },
      { i: 6, j: 5, text: 'VICE', bg: '#0c2230', fg: '#7fe8ff' },
      { i: 3, j: 8, text: 'CAIS 7', bg: '#102a24', fg: '#8fffd3' },
      { i: 9, j: 4, text: 'NEON', bg: '#2a0a23', fg: '#ff8bdc' },
      { i: 1, j: 6, text: 'SUNSET', bg: '#2c1a0c', fg: '#ffcf8a' },
    ];
    for (const b of boards) {
      const cx = b.i * CELL + CELL / 2, cy = b.j * CELL + CELL / 2;
      const x = cx + 110, y = cy - 110;
      W.getDB(x, y).box(x - 5, 0, y, 0.4, 18, 0.4, W.col('#4b4f52'));
      W.getDB(x, y).box(x + 5, 0, y, 0.4, 18, 0.4, W.col('#4b4f52'));
      W.getDB(x, y).box(x, 18, y, 22, 0.7, 0.5, W.col('#2b2e30'));
      W.addSign(b.text, x, 20, y, 24, 8, 's', b.bg, b.fg, true);
    }
  }

  /* ------------------------------------------------------------ piers & docks */
  function buildPiers() {
    const rows = [7, 8, 9];
    for (const j of rows) {
      const i = 11, cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
      const x0 = WORLD - 60, x1 = WORLD + 118, y0 = cy - 11, y1 = cy + 11;
      const db = W.getDB(x0, cy);
      // deck planks
      for (let x = x0; x < x1; x += 9) db.box(x + 4.5, 0.05, cy, 8.6, 0.3, 22, W.col(U.chance(0.5) ? '#8b6a44' : '#7c5d3b'));
      // piles
      for (let x = x0 + 8; x < x1; x += 24) {
        db.box(x, -2.4, y0 + 1, 0.7, 5, 0.7, W.col('#4a3524'));
        db.box(x, -2.4, y1 - 1, 0.7, 5, 0.7, W.col('#4a3524'));
      }
      // bollards
      for (let x = x0 + 12; x < x1; x += 26) {
        db.box(x, 0.3, y0 + 1.2, 0.6, 1.2, 0.6, W.col('#2d3134'));
        db.box(x, 0.3, y1 - 1.2, 0.6, 1.2, 0.6, W.col('#2d3134'));
      }
      W.addWalkOverride({ x0, y0, x1, y1, h: 0.35, surface: 'wood', kind: 'pier' });
      // lamp
      W.getDB(x0, cy).box(x1 - 12, 0.3, cy - 9, 0.3, 6, 0.3, W.col('#3b4045'));
      // moored boats are spawned by the vehicle system via spots
      W.boatSpots.push({ x: WORLD + 142, y: cy, a: PI, kind: 'dock' });
    }
    // a small dock at the island will be added by env
    W.boatSpots.push({ x: WORLD + 235, y: W.WATER_Y + 80, a: -PI / 2, kind: 'bay' });
    W.boatSpots.push({ x: WORLD + 300, y: W.WATER_Y - 90, a: PI, kind: 'bay' });
  }

  W.buildProps = async function () {
    buildLamps();
    buildSignals();
    buildStreetFurniture();
    buildPiers();
    W.updateSignals(0);
  };

  console.log('[world] props ready');
})();
