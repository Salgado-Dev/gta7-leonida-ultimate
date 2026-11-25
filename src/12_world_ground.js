/* ============================================================================
   12 · WORLD GROUND — procedural road map, city surface, trees, collisions.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, CELL = W.CELL, GRID = W.GRID, WORLD = W.WORLD, ROAD = W.ROAD, INNER = W.INNER, SPECIALS = W.SPECIALS;
  const PI = Math.PI;

  const GROUND = {
    residential: '#5c7444', suburb: '#647b4b', mansion: '#6a824f', park: '#4d7841', rural: '#53603a',
    beach: '#d3ba88', downtown: '#8b8f94', commercial: '#888c90', industrial: '#707476', port: '#686d70',
    entertainment: '#786e7b', outskirts: '#79705b',
  };

  /* ------------------------------------------------------------ free spots */
  W.onRoad = function (x, y) {
    const dx = Math.abs(x - Math.round(x / CELL) * CELL);
    const dy = Math.abs(y - Math.round(y / CELL) * CELL);
    return dx < ROAD / 2 + 2 || dy < ROAD / 2 + 2;
  };
  W.freeSpot = function (x, y, r) {
    r = r || 1.2;
    if (x < 10 || y < 10 || x > WORLD - 10 || y > WORLD - 10) return false;
    if (W.onRoad(x, y)) return false;
    for (let i = 0; i < W.colliders.length; i++) {
      const c = W.colliders[i];
      if (x + r > c.x0 && x - r < c.x1 && y + r > c.y0 && y - r < c.y1) return false;
    }
    for (let i = 0; i < W.pois.length; i++) {
      const p = W.pois[i];
      if (Math.abs(x - p.x) < 8 + r && Math.abs(y - p.y) < 8 + r) return false;
    }
    return true;
  };

  /* ---------------------------------------------------------------- ground */
  function paintGround() {
    const SIZE = 4096, scale = SIZE / WORLD;
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    const g = cv.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const rnd = U.seed(0x51ee7);
    // asphalt base
    g.fillStyle = '#22262c'; g.fillRect(0, 0, WORLD, WORLD);
    // asphalt grain
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.035)';
      g.fillRect(rnd() * WORLD, rnd() * WORLD, 1 + rnd() * 6, 1 + rnd() * 6);
    }
    // blocks
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2, zone = W.zoneAt(i, j);
      const code = W.codeAt(i, j);
      const special = SPECIALS[i + ',' + j];
      const px0 = cx - 162, py0 = cy - 162, pw = 324;
      // sidewalk bed
      g.fillStyle = '#9a9d9f'; g.fillRect(px0, py0, pw, pw);
      g.strokeStyle = 'rgba(40,44,48,.55)'; g.lineWidth = 2.4; g.strokeRect(px0, py0, pw, pw);
      // sidewalk seams
      g.strokeStyle = 'rgba(60,64,68,.18)'; g.lineWidth = 0.8;
      for (let s = 0; s <= pw; s += 27) {
        g.beginPath(); g.moveTo(px0 + s, py0); g.lineTo(px0 + s, py0 + pw); g.stroke();
        g.beginPath(); g.moveTo(px0, py0 + s); g.lineTo(px0 + pw, py0 + s); g.stroke();
      }
      // inner lot
      const ix = cx - INNER / 2, iy = cy - INNER / 2, is = INNER;
      let col = GROUND[zone] || '#6f7460';
      if (special) {
        if (special.kind === 'safehouse') col = GROUND.residential;
        else if (special.kind === 'beachbar' || special.kind === 'beachshop') col = GROUND.beach;
        else col = '#6f7375';
      }
      g.fillStyle = col; g.fillRect(ix, iy, is, is);
      // lot grain
      for (let k = 0; k < 110; k++) {
        g.globalAlpha = 0.05 + rnd() * 0.06;
        g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
        g.fillRect(ix + rnd() * is, iy + rnd() * is, 4 + rnd() * 18, 3 + rnd() * 12);
      }
      g.globalAlpha = 1;
      // zone specific surface
      if (zone === 'park' && !special) {
        g.fillStyle = '#3f7438'; g.fillRect(ix, iy, is, is);
        // paths
        g.fillStyle = '#b5ad97';
        g.fillRect(cx - 7, iy, 14, is);
        g.fillRect(ix, cy - 7, is, 14);
        g.beginPath(); g.arc(cx, cy, 46, 0, 7); g.strokeStyle = '#b5ad97'; g.lineWidth = 9; g.stroke();
        // pond
        g.fillStyle = '#2a6c7e'; g.beginPath(); g.ellipse(cx + 82, cy + 72, 46, 29, 0.3, 0, 7); g.fill();
        g.strokeStyle = '#d8c7a0'; g.lineWidth = 3; g.stroke();
        // flower beds
        for (let k = 0; k < 8; k++) {
          g.fillStyle = ['#c85f77', '#e0b24c', '#b96bc9'][k % 3];
          g.beginPath(); g.arc(ix + 24 + rnd() * (is - 48), iy + 22 + rnd() * (is - 44), 2 + rnd() * 3, 0, 7); g.fill();
        }
      } else if (zone === 'beach' && !special) {
        g.fillStyle = '#d8c08e'; g.fillRect(ix, iy, is, is);
        for (let k = 0; k < 260; k++) {
          g.fillStyle = 'rgba(120,96,58,.2)'; g.fillRect(ix + rnd() * is, iy + rnd() * is, 1.5, 1.5);
        }
        // boardwalk
        g.fillStyle = '#8a6a43'; g.fillRect(cx - 140, iy, 26, is);
        g.strokeStyle = 'rgba(50,34,18,.4)'; g.lineWidth = 1;
        for (let k = 0; k < is; k += 8) { g.beginPath(); g.moveTo(cx - 140, iy + k); g.lineTo(cx - 114, iy + k); g.stroke(); }
      } else if (zone === 'rural' && !special) {
        g.fillStyle = '#5b663d'; g.fillRect(ix, iy, is, is);
        // fields
        for (let k = 0; k < 4; k++) {
          const fy = iy + 20 + k * 66;
          g.fillStyle = k % 2 ? '#7a7a3e' : '#8c8446'; g.fillRect(ix + 16, fy, is - 32, 48);
          g.strokeStyle = 'rgba(40,45,18,.3)'; g.lineWidth = 1.4;
          for (let x = ix + 16; x < ix + is - 16; x += 9) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy + 48); g.stroke(); }
        }
        g.fillStyle = '#6d5a3d'; g.fillRect(ix + 10, iy + is - 40, is - 20, 22);
      } else if ((zone === 'industrial' || zone === 'port') && !special) {
        g.fillStyle = '#6e7173'; g.fillRect(ix, iy, is, is);
        for (let k = 0; k < 34; k++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(20,22,24,.18)' : 'rgba(255,255,255,.05)';
          g.fillRect(ix + rnd() * is, iy + rnd() * is, 8 + rnd() * 50, 4 + rnd() * 22);
        }
        // lot lines
        g.strokeStyle = 'rgba(230,220,180,.32)'; g.lineWidth = 1.1;
        for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(ix + k * is / 3, iy); g.lineTo(ix + k * is / 3, iy + is); g.stroke(); }
      } else if (zone === 'downtown' || zone === 'commercial' || zone === 'entertainment') {
        g.fillStyle = zone === 'entertainment' ? '#5f5568' : '#7b7f84'; g.fillRect(ix, iy, is, is);
        g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1.2;
        for (let k = 20; k < is; k += 46) {
          g.beginPath(); g.moveTo(ix + k, iy); g.lineTo(ix + k, iy + is); g.stroke();
          g.beginPath(); g.moveTo(ix, iy + k); g.lineTo(ix + is, iy + k); g.stroke();
        }
        if (zone === 'entertainment') {
          g.fillStyle = 'rgba(255,61,154,.1)'; g.fillRect(ix, iy + is - 30, is, 20);
        }
      } else if (zone === 'residential' || zone === 'suburb' || zone === 'mansion') {
        // lawns get mown stripes and driveways
        g.fillStyle = (zone === 'mansion' ? '#6c8551' : '#617c48'); g.fillRect(ix, iy, is, is);
        g.strokeStyle = 'rgba(30,48,24,.16)'; g.lineWidth = 3;
        for (let k = 0; k < is; k += 14) { g.beginPath(); g.moveTo(ix, iy + k); g.lineTo(ix + is, iy + k); g.stroke(); }
      }
      // special lot surfaces
      if (special) {
        if (special.kind === 'gas' || special.kind === 'dealer' || special.kind === 'police' || special.kind === 'hospital' || special.kind === 'garage' || special.kind === 'port' || special.kind === 'fence') {
          g.fillStyle = '#707376'; g.fillRect(ix, iy, is, is);
          for (let k = 0; k < 24; k++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(ix + rnd() * is, iy + rnd() * is, 10 + rnd() * 36, 5 + rnd() * 18); }
        }
      }
      // driveway to the south road for residential / special
      if ((zone === 'residential' || zone === 'suburb' || zone === 'mansion' || (special && special.kind === 'safehouse')) && !special) {
        g.fillStyle = '#83827b'; g.fillRect(cx - 13, cy + 50, 26, 112);
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
        g.strokeRect(cx - 13, cy + 50, 26, 112);
      }
      // curb
      g.strokeStyle = '#b0b2b0'; g.lineWidth = 3; g.strokeRect(px0 + 1.5, py0 + 1.5, pw - 3, pw - 3);
      // tree pits
      for (let k = 0; k < 3; k++) {
        const tx = px0 + 8 + rnd() * (pw - 16), ty = py0 + 8 + rnd() * 12;
        if (rnd() < 0.5) {
          g.fillStyle = '#4a3a25'; g.fillRect(tx - 4, ty - 4, 8, 8);
          g.strokeStyle = '#777'; g.strokeRect(tx - 4, ty - 4, 8, 8);
        }
      }
    }
    // lane markings between intersections
    g.lineCap = 'butt';
    for (let i = 0; i <= GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const x = i * CELL, y0 = j * CELL + 58, y1 = (j + 1) * CELL - 58;
        g.strokeStyle = '#c5a32c'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - 2.2, y0); g.lineTo(x - 2.2, y1); g.stroke();
        g.beginPath(); g.moveTo(x + 2.2, y0); g.lineTo(x + 2.2, y1); g.stroke();
        g.strokeStyle = 'rgba(235,235,225,.72)'; g.lineWidth = 1.1;
        for (let y = y0; y < y1; y += 14) {
          g.beginPath(); g.moveTo(x - 25, y); g.lineTo(x - 25, y + 7); g.stroke();
          g.beginPath(); g.moveTo(x + 25, y); g.lineTo(x + 25, y + 7); g.stroke();
        }
        g.strokeStyle = 'rgba(235,235,225,.4)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(x - 45, y0); g.lineTo(x - 45, y1); g.stroke();
        g.beginPath(); g.moveTo(x + 45, y0); g.lineTo(x + 45, y1); g.stroke();
      }
    }
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const y = j * CELL, x0 = i * CELL + 58, x1 = (i + 1) * CELL - 58;
        g.strokeStyle = '#c5a32c'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x0, y - 2.2); g.lineTo(x1, y - 2.2); g.stroke();
        g.beginPath(); g.moveTo(x0, y + 2.2); g.lineTo(x1, y + 2.2); g.stroke();
        g.strokeStyle = 'rgba(235,235,225,.72)'; g.lineWidth = 1.1;
        for (let x = x0; x < x1; x += 14) {
          g.beginPath(); g.moveTo(x, y - 25); g.lineTo(x + 7, y - 25); g.stroke();
          g.beginPath(); g.moveTo(x, y + 25); g.lineTo(x + 7, y + 25); g.stroke();
        }
        g.strokeStyle = 'rgba(235,235,225,.4)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(x0, y - 45); g.lineTo(x1, y - 45); g.stroke();
        g.beginPath(); g.moveTo(x0, y + 45); g.lineTo(x1, y + 45); g.stroke();
      }
    }
    // intersections, crosswalks and stop lines
    for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
      const x = i * CELL, y = j * CELL;
      g.fillStyle = '#20242a'; g.fillRect(x - 47, y - 47, 94, 94);
      // crosswalk bars on all four arms
      g.fillStyle = 'rgba(232,232,222,.78)';
      for (let k = 0; k < 7; k++) {
        const o = k * 9;
        // north / south arms (bars across the vertical road)
        g.fillRect(x - 40 + o * 0, y - 72 - o, 0, 0);
        g.fillRect(x - 38 + o * 10, y - 75, 6, 18);
        g.fillRect(x - 38 + o * 10, y + 57, 6, 18);
        // east / west arms
        g.fillRect(x - 75, y - 38 + o * 10, 18, 6);
        g.fillRect(x + 57, y - 38 + o * 10, 18, 6);
      }
      // stop lines
      g.fillStyle = 'rgba(232,232,222,.8)';
      g.fillRect(x - 47, y - 84, 42, 3);
      g.fillRect(x + 5, y + 81, 42, 3);
      g.fillRect(x + 81, y - 47, 3, 42);
      g.fillRect(x - 84, y + 5, 3, 42);
      // manhole
      if ((i + j) % 3 === 0) {
        g.fillStyle = '#33373b'; g.beginPath(); g.arc(x + 22, y - 16, 5, 0, 7); g.fill();
        g.strokeStyle = '#4c5054'; g.lineWidth = 1; g.stroke();
      }
    }
    // parking stalls
    for (const p of W.parkingSpots) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.a);
      g.strokeStyle = 'rgba(235,235,222,.65)'; g.lineWidth = 1.4;
      g.strokeRect(-5.5, -12, 11, 24);
      g.fillStyle = 'rgba(235,235,222,.35)'; g.font = 'bold 6px Arial'; g.textAlign = 'center'; g.fillText('P', 0, 2);
      g.restore();
    }
    // road wear
    for (let k = 0; k < 4200; k++) {
      const onV = rnd() < 0.5;
      const x = onV ? Math.round(rnd() * GRID) * CELL + (rnd() - 0.5) * 80 : rnd() * WORLD;
      const y = onV ? rnd() * WORLD : Math.round(rnd() * GRID) * CELL + (rnd() - 0.5) * 80;
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.03)';
      g.fillRect(x, y, 2 + rnd() * 22, 1 + rnd() * 4);
    }
    // beach wet edge + foam line
    g.fillStyle = 'rgba(84,152,170,.35)'; g.fillRect(WORLD - 6, 0, 6, WORLD);
    for (let y = 0; y < WORLD; y += 6) {
      g.strokeStyle = 'rgba(255,255,255,' + (0.08 + rnd() * 0.18) + ')'; g.lineWidth = 1.2 + rnd() * 2;
      g.beginPath(); g.moveTo(WORLD - 8 - rnd() * 8, y); g.lineTo(WORLD - 1, y + 3); g.stroke();
    }
    // curbs as thin geometry for real depth
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2, db = W.getDB(cx, cy), c = W.col('#b9bab6');
      const e = 162;
      db.box(cx, 0.02, cy - e, e * 2, 0.26, 3.4, c);
      db.box(cx, 0.02, cy + e, e * 2, 0.26, 3.4, c);
      db.box(cx - e, 0.02, cy, 3.4, 0.26, e * 2, c);
      db.box(cx + e, 0.02, cy, 3.4, 0.26, e * 2, c);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = Math.min(8, W.renderer ? W.renderer.capabilities.getMaxAnisotropy() : 8);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 8, specular: 0x141414 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), mat);
    mesh.rotation.x = -PI / 2; mesh.position.set(WORLD / 2, 0, WORLD / 2); mesh.receiveShadow = true;
    W.scene.add(mesh);
    W.groundMat = mat; W.groundTex = tex;
    return mesh;
  }
  W.paintGround = paintGround;

  /* ----------------------------------------------------------------- trees */
  function buildTrees() {
    const spots = W.treeSpots || { oak: [], pine: [], palm: [], bush: [] };
    const all = [];
    for (const type in spots) for (const s of spots[type]) all.push({ type, ...s });
    if (!all.length) return;
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.72, 1, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const canopyGeo = new THREE.SphereGeometry(1, 7, 5);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pineGeo = new THREE.ConeGeometry(1, 1, 7);
    const pineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const oaks = [], palms = [], pines = [], bushes = [];
    for (const t of all) {
      if (t.type === 'oak') oaks.push(t); else if (t.type === 'palm') palms.push(t); else if (t.type === 'pine') pines.push(t); else bushes.push(t);
    }
    const dummy = new THREE.Object3D();
    const canopyList = [];
    function addTrunk(list, h, rad) {
      const im = new THREE.InstancedMesh(trunkGeo, trunkMat.clone(), list.length);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      list.forEach((t, k) => {
        dummy.position.set(t.x, h * 0.5, t.y); dummy.rotation.set(0, t.r, 0); dummy.scale.set(rad * t.s, h * t.s, rad * t.s); dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
        im.setColorAt(k, new THREE.Color(t.type === 'palm' ? '#a78a5e' : '#6b4a2f').offsetHSL(0, 0, (U.hash2(t.x | 0, t.y | 0) - 0.5) * 0.12));
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = false; W.scene.add(im);
      return im;
    }
    // trunks
    addTrunk(oaks, 3.4, 0.55); addTrunk(palms, 7.5, 0.32); addTrunk(pines, 3.2, 0.45);
    // canopy entries
    for (const t of oaks) {
      canopyList.push({ x: t.x, y: t.y, h: 4.5 * t.s, s: U.rand(3.4, 2.5) * t.s, sy: U.rand(2.8, 2.1) * t.s, c: '#3d7d3a', type: 'oak' });
    }
    for (const t of palms) {
      const n = 3;
      for (let k = 0; k < n; k++) canopyList.push({ x: t.x + Math.cos(k * 2.1) * 1.4 * t.s, y: t.y + Math.sin(k * 2.1) * 1.4 * t.s, h: 8.1 * t.s, s: U.rand(3.1, 2.3) * t.s, sy: 0.9 * t.s, c: '#3c7f43', type: 'palm' });
    }
    for (const t of pines) {
      canopyList.push({ x: t.x, y: t.y, h: 5.4 * t.s, s: U.rand(2.2, 1.6) * t.s, sy: U.rand(3.4, 2.4) * t.s, c: '#2f5e39', type: 'pine' });
    }
    for (const t of bushes) {
      canopyList.push({ x: t.x, y: t.y, h: 0.8 * t.s, s: U.rand(1.3, 0.8) * t.s, sy: U.rand(1.1, 0.7) * t.s, c: '#44713a', type: 'bush' });
    }
    const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, canopyList.length);
    const pineList = canopyList.filter((c) => c.type === 'pine');
    const sphereList = canopyList.filter((c) => c.type !== 'pine');
    // sphere canopies
    const sph = new THREE.InstancedMesh(canopyGeo, canopyMat.clone(), sphereList.length);
    sphereList.forEach((t, k) => {
      dummy.position.set(t.x, t.h, t.y); dummy.rotation.set(0, t.x * 0.03, 0); dummy.scale.set(t.s, t.sy, t.s); dummy.updateMatrix();
      sph.setMatrixAt(k, dummy.matrix);
      const c = new THREE.Color(t.c).offsetHSL((U.hash2(k, 3) - 0.5) * 0.04, 0, (U.hash2(k, 7) - 0.5) * 0.1);
      sph.setColorAt(k, c);
    });
    sph.instanceMatrix.needsUpdate = true; if (sph.instanceColor) sph.instanceColor.needsUpdate = true;
    sph.castShadow = true; sph.receiveShadow = true; W.scene.add(sph);
    // pine canopies
    if (pineList.length) {
      const pim = new THREE.InstancedMesh(pineGeo, pineMat.clone(), pineList.length);
      pineList.forEach((t, k) => {
        dummy.position.set(t.x, t.h, t.y); dummy.rotation.set(0, t.r, 0); dummy.scale.set(t.s, t.sy, t.s); dummy.updateMatrix();
        pim.setMatrixAt(k, dummy.matrix);
        pim.setColorAt(k, new THREE.Color(t.c).offsetHSL(0, 0, (U.hash2(k, 5) - 0.5) * 0.08));
      });
      pim.instanceMatrix.needsUpdate = true; if (pim.instanceColor) pim.instanceColor.needsUpdate = true;
      pim.castShadow = true; W.scene.add(pim);
    }
    // bushes without trunks
    if (bushes.length) {
      const bim = new THREE.InstancedMesh(canopyGeo, canopyMat.clone(), bushes.length);
      bushes.forEach((t, k) => {
        dummy.position.set(t.x, 0.65 * t.s, t.y); dummy.rotation.set(0, t.r, 0); dummy.scale.set(t.s, t.s * 0.72, t.s); dummy.updateMatrix();
        bim.setMatrixAt(k, dummy.matrix); bim.setColorAt(k, new THREE.Color('#416b38').offsetHSL(0, 0, (U.hash2(k, 2) - 0.5) * 0.1));
      });
      bim.instanceMatrix.needsUpdate = true; if (bim.instanceColor) bim.instanceColor.needsUpdate = true;
      bim.castShadow = true; W.scene.add(bim);
    }
    W.treeMeshes = { sph, pim: null, trunks: true };
  }

  /* --------------------------------------------------------- collision hash */
  const CG = 84;
  function hashColliders() {
    const map = new Map();
    W.colliders.forEach((c, idx) => {
      const x0 = Math.floor(c.x0 / CG), x1 = Math.floor(c.x1 / CG), y0 = Math.floor(c.y0 / CG), y1 = Math.floor(c.y1 / CG);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = x + ',' + y;
        let arr = map.get(k); if (!arr) map.set(k, (arr = []));
        arr.push(idx);
      }
    });
    W.colliderGrid = map;
  }
  W.rehashColliders = hashColliders;

  function staticBlocked(x, y, r) {
    if (!W.colliderGrid) return false;
    const x0 = Math.floor((x - r) / CG), x1 = Math.floor((x + r) / CG);
    const y0 = Math.floor((y - r) / CG), y1 = Math.floor((y + r) / CG);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const arr = W.colliderGrid.get(gx + ',' + gy); if (!arr) continue;
      for (const idx of arr) {
        const c = W.colliders[idx];
        if (x + r > c.x0 && x - r < c.x1 && y + r > c.y0 && y - r < c.y1) return true;
      }
    }
    return false;
  }
  W.staticBlocked = staticBlocked;

  W.isWalkOverride = function (x, y) {
    if (!W.overrides) return false;
    for (const o of W.overrides) {
      if (o.circle) { if (Math.hypot(x - o.x, y - o.y) < o.r) return o; }
      else if (x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1) return o;
    }
    return null;
  };
  W.isWater = function (x, y) {
    if (y < 0 || y > WORLD || x > W.WATER_END) return false;
    if (x <= WORLD) return false;
    if (W.isWalkOverride(x, y)) return false;
    return true;
  };
  W.isBlocked = function (x, y, r) {
    r = r || 0;
    if (!isFinite(x) || !isFinite(y)) return true;
    if (x < 2 || y < 2 || x > W.WATER_END || y > WORLD - 2) {
      if (W.isWalkOverride(x, y)) return staticBlocked(x, y, r);
      return true;
    }
    if (x > WORLD || y > WORLD) {
      if (!W.isWalkOverride(x, y)) return true;
    } else if (W.isWater(x, y)) return true;
    return staticBlocked(x, y, r);
  };
  W.canDrive = function (x, y) {
    if (!isFinite(x) || !isFinite(y)) return false;
    if (x < 6 || y < 6 || y > WORLD - 6 || x > W.WATER_END) return false;
    if (x > WORLD && !W.isWalkOverride(x, y)) return false;
    if (W.isWater(x, y)) return false;
    return !staticBlocked(x, y, 0);
  };
  W.canBoat = function (x, y) {
    if (x < WORLD - 2 || x > W.WATER_END - 6 || y < 8 || y > WORLD - 8) return false;
    return !W.isWalkOverride(x, y);
  };
  W.heightAt = function (x, y) {
    const o = W.isWalkOverride(x, y);
    if (o) return o.h || 0;
    return 0;
  };
  W.surfaceAt = function (x, y) {
    if (W.isWater(x, y)) return 'water';
    const o = W.isWalkOverride(x, y);
    if (o) return o.surface || 'wood';
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return 'concrete';
    if (W.onRoad(x, y)) return 'road';
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL), zone = W.zoneAt(i, j);
    if (zone === 'beach') return 'sand';
    if (zone === 'park' || zone === 'rural' || zone === 'mansion' || zone === 'residential' || zone === 'suburb') return 'grass';
    return 'concrete';
  };
  W.segmentBlocked = function (ax, ay, bx, by, minH) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 3);
    const h = minH === undefined ? 1.2 : minH;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (!W.colliderGrid) continue;
      const gx = Math.floor(x / CG), gy = Math.floor(y / CG), arr = W.colliderGrid.get(gx + ',' + gy);
      if (!arr) continue;
      for (const idx of arr) {
        const c = W.colliders[idx];
        if (h < c.h && x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1) return true;
      }
    }
    return false;
  };

  /* ------------------------------------------------------------- map canvas */
  function buildMapCanvas() {
    const S = 1400, sc = S / WORLD;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const MAP_COL = {
      rural: '#36502e', suburb: '#3e5633', residential: '#445c36', mansion: '#4b6239', commercial: '#4d535b',
      downtown: '#4a5563', industrial: '#42474b', port: '#3e4a50', beach: '#c3a878', entertainment: '#564257',
      park: '#2f5c33', outskirts: '#4b4d3e',
    };
    g.fillStyle = '#0d1a24'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#08131c'; g.fillRect(WORLD * sc, 0, S - WORLD * sc, S);
    // water texture
    for (let i = 0; i < 300; i++) {
      g.strokeStyle = 'rgba(80,160,190,.08)'; g.lineWidth = 1;
      const y = Math.random() * S; g.beginPath(); g.moveTo(WORLD * sc, y); g.lineTo(S, y + Math.random() * 6); g.stroke();
    }
    // roads
    g.fillStyle = '#2b3138'; g.fillRect(0, 0, WORLD * sc, WORLD * sc);
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2, zone = W.zoneAt(i, j);
      g.fillStyle = MAP_COL[zone] || '#444'; g.fillRect((cx - 162) * sc, (cy - 162) * sc, 324 * sc, 324 * sc);
      if (SPECIALS[i + ',' + j]) {
        g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect((cx - 40) * sc, (cy - 40) * sc, 80 * sc, 80 * sc);
      }
    }
    // bridge/island overlay drawn by env
    if (W.overrides) for (const o of W.overrides) {
      if (o.circle) {
        g.fillStyle = '#6f7d4b'; g.beginPath(); g.arc(o.x * sc, o.y * sc, o.r * sc, 0, 7); g.fill();
      } else {
        g.fillStyle = '#7b7361'; g.fillRect(o.x0 * sc, o.y0 * sc, (o.x1 - o.x0) * sc, (o.y1 - o.y0) * sc);
      }
    }
    // road grid on top of blocks? no — draw road lines
    g.fillStyle = '#2b3138';
    for (let i = 0; i <= GRID; i++) { g.fillRect((i * CELL - ROAD / 2) * sc, 0, ROAD * sc, WORLD * sc); }
    for (let j = 0; j <= GRID; j++) { g.fillRect(0, (j * CELL - ROAD / 2) * sc, WORLD * sc, ROAD * sc); }
    // road center lines
    g.strokeStyle = 'rgba(220,190,90,.16)'; g.lineWidth = 0.7;
    W.mapCanvas = cv;
    W.mapScale = sc;
  }
  W.buildMapCanvas = buildMapCanvas;

  /* ------------------------------------------------------------------ build */
  W.build = async function (scene, renderer, progress) {
    W.scene = scene; W.renderer = renderer;
    W.colliders = []; W.pois = []; W.blocks = []; W.parkingSpots = []; W.treeSpots = { oak: [], pine: [], palm: [], bush: [] }; W.landmarks = []; W.signals = []; W.lamps = []; W.overrides = []; W.poiRings = []; W.collectibleSpots = [];
    const step = async (p, msg) => { if (progress) await progress(p, msg); };
    await step(6, 'Traçando as ruas de Leonida…');
    // generate all blocks (buildings, colliders, POIs, parked stalls)
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) W.generateBlock(i, j);
      if (j % 2 === 0) await step(8 + j * 3, 'Erguendo quarteirões… ' + (j + 1) + '/' + GRID);
    }
    W.rehashColliders();
    await step(45, 'Pintando asfalto, calçadas e faixas…');
    paintGround();
    W.treeSpots = W.treeSpots || {};
    // additional tree placement in open spaces
    for (let n = 0; n < 120; n++) {
      const x = U.rand(WORLD - 30, 30), y = U.rand(WORLD - 30, 30);
      if (W.onRoad(x, y) || !W.freeSpot(x, y, 2)) continue;
      const zone = W.zoneAt(Math.floor(x / CELL), Math.floor(y / CELL));
      if (zone === 'park' || zone === 'rural' || zone === 'mansion' || zone === 'beach') (W.treeSpots[zone === 'beach' ? 'palm' : zone === 'rural' ? 'pine' : 'oak'] || W.treeSpots.oak).push({ x, y, s: U.rand(1.2, 0.8), r: Math.random() * 6.28 });
    }
    await step(55, 'Plantando palmeiras e carvalhos…');
    buildTrees();
    // props and environment modules
    if (W.buildProps) await W.buildProps();
    await step(68, 'Instalando semáforos, postes e letreiros…');
    if (W.buildEnvironment) await W.buildEnvironment();
    await step(82, 'Enchendo a baía e acendendo a cidade…');
    // merge static geometry
    let count = 0;
    for (const [key, mb] of W.builders) {
      const mesh = mb.build(mb.mat);
      if (!mesh) continue;
      mesh.name = key; mesh.matrixAutoUpdate = false;
      W.scene.add(mesh); count++;
    }
    W.staticMeshes = count;
    // shop signs after builders (positions are scene-space)
    for (const s of W.SHOP_SIGNS) W.addSign(s.text, s.x, s.y, s.z, s.w, s.h, 's', s.bg, s.fg, s.glow);
    // collectibles: parks, beach, alleys, loading docks
    for (let n = 0; n < 400 && W.collectibleSpots.length < 70; n++) {
      const x = U.rand(WORLD - 40, 40), y = U.rand(WORLD - 40, 40);
      if (W.isBlocked(x, y, 1) || W.onRoad(x, y)) continue;
      const zone = W.zoneAt(Math.floor(x / CELL), Math.floor(y / CELL));
      if (zone === 'park' || zone === 'beach' || zone === 'rural' || zone === 'mansion' || zone === 'outskirts' || zone === 'port' || zone === 'industrial') W.collectibleSpots.push({ x, y });
    }
    buildMapCanvas();
    await step(92, 'Ligando o ciclo de dia e noite…');
    if (W.initEnvironment) W.initEnvironment();
    W.ready = true;
    await step(100, 'Leonida está pronta.');
  };

  console.log('[world] ground builder ready');
})();
