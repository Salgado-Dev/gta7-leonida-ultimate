/* ============================================================================
   44 · COLLECTIBLES — cocaine flamingos, cash bags, weapon crates, armor.
   Preserves the original "Flamingos de cocaína" checklist (15 units, +$250).
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, Player = LL.Player;
  const C = (LL.Collect = { items: [], taken: [], group: null, scanned: 0 });

  C.FLAMINGO_TOTAL = 15;
  C.CASH_TOTAL = 18;
  C.CRATE_TOTAL = 8;
  C.ARMOR_TOTAL = 5;

  /* --------------------------------------------------------------- geometry */
  const matPink = new THREE.MeshLambertMaterial({ color: 0xff5f9e });
  const matPinkDark = new THREE.MeshLambertMaterial({ color: 0xd93f7c });
  const matBeak = new THREE.MeshLambertMaterial({ color: 0x1a1418 });
  const matLeg = new THREE.MeshLambertMaterial({ color: 0xf0a2c0 });
  const matCash = new THREE.MeshLambertMaterial({ color: 0x2f9e6b });
  const matCrate = new THREE.MeshLambertMaterial({ color: 0x4a5a2a });
  const matArmor = new THREE.MeshLambertMaterial({ color: 0x5c7bd8 });
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const SPH = new THREE.SphereGeometry(0.5, 10, 8);

  function part(parent, geo, mat, x, y, z, sx, sy, sz, ry) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx || 1, sy || 1, sz || 1);
    if (ry) m.rotation.y = ry;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function flamingoMesh() {
    const g = new THREE.Group();
    part(g, SPH, matPink, 0, 1.0, 0, 0.62, 0.52, 0.9);          // body
    part(g, SPH, matPinkDark, -0.42, 1.12, 0, 0.34, 0.32, 0.34); // tail
    const neck = part(g, BOX, matPink, 0.44, 1.5, 0, 0.12, 1.1, 0.12, 0);
    neck.rotation.z = -0.16;
    part(g, SPH, matPink, 0.6, 2.02, 0, 0.26, 0.24, 0.24);       // head
    const beak = part(g, BOX, matBeak, 0.82, 1.96, 0, 0.28, 0.09, 0.1);
    beak.rotation.z = 0.35;
    part(g, BOX, matLeg, 0.06, 0.5, 0.12, 0.06, 1.0, 0.06);
    part(g, BOX, matLeg, -0.06, 0.5, -0.12, 0.06, 1.0, 0.06);
    part(g, BOX, matPink, 0, 1.0, 0, 0.5, 0.08, 1.5);            // wing split
    return g;
  }

  function cashMesh() {
    const g = new THREE.Group();
    const bag = part(g, SPH, matCash, 0, 0.34, 0, 0.5, 0.46, 0.5);
    bag.scale.y = 0.42;
    part(g, BOX, matCash, 0, 0.6, 0, 0.2, 0.18, 0.2);
    part(g, BOX, matBeak, 0, 0.32, 0, 0.34, 0.06, 0.34);
    return g;
  }

  function crateMesh() {
    const g = new THREE.Group();
    part(g, BOX, matCrate, 0, 0.34, 0, 0.86, 0.68, 0.62);
    part(g, BOX, matBeak, 0, 0.68, 0, 0.9, 0.06, 0.66);
    part(g, BOX, matBeak, 0, 0.34, 0.32, 0.9, 0.08, 0.04);
    return g;
  }

  function armorMesh() {
    const g = new THREE.Group();
    part(g, BOX, matArmor, 0, 0.42, 0, 0.62, 0.72, 0.26);
    part(g, BOX, matArmor, 0, 0.78, 0, 0.3, 0.12, 0.26);
    part(g, BOX, matBeak, 0, 0.42, 0.14, 0.2, 0.3, 0.04);
    return g;
  }

  /* ------------------------------------------------------------------ spots */
  function shuffledSpots() {
    const spots = (W.collectibleSpots || []).slice();
    for (let i = spots.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = spots[i]; spots[i] = spots[j]; spots[j] = t;
    }
    return spots;
  }

  function addItem(kind, x, y, id) {
    let group;
    if (kind === 'flamingo') group = flamingoMesh();
    else if (kind === 'cash') group = cashMesh();
    else if (kind === 'crate') group = crateMesh();
    else group = armorMesh();
    const gy = W.heightAt(x, y);
    group.position.set(x, gy, y);
    group.rotation.y = Math.random() * 6.28;
    C.group.add(group);
    const item = { id, kind, x, y, group, gy, phase: Math.random() * 6.28, active: true };
    C.items.push(item);
    return item;
  }

  C.build = function () {
    C.group = new THREE.Group();
    C.group.name = 'collectibles';
    W.scene.add(C.group);
    C.items.length = 0;
    const spots = shuffledSpots();
    let n = 0;
    const next = () => spots[n++] || null;
    // flamingos first — 15 spread across the map
    for (let i = 0; i < C.FLAMINGO_TOTAL; i++) {
      const s = next(); if (!s) break;
      addItem('flamingo', s.x, s.y, 'fl' + i);
    }
    for (let i = 0; i < C.CASH_TOTAL; i++) {
      const s = next(); if (!s) break;
      addItem('cash', s.x, s.y, 'cash' + i);
    }
    for (let i = 0; i < C.CRATE_TOTAL; i++) {
      const s = next(); if (!s) break;
      addItem('crate', s.x, s.y, 'crate' + i);
    }
    for (let i = 0; i < C.ARMOR_TOTAL; i++) {
      const s = next(); if (!s) break;
      addItem('armor', s.x, s.y, 'armor' + i);
    }
    console.log('[collect] ' + C.items.length + ' ítens espalhados por Leonida');
  };

  /* --------------------------------------------------------------- collecting */
  const WEAPON_POOL = ['smg', 'rifle', 'shotgun', 'revolver'];

  function collect(item) {
    const S = Player.state;
    const st = LL.game.stats;
    item.active = false;
    C.group.remove(item.group);
    C.taken.push(item.id);
    if (item.kind === 'flamingo') {
      st.flamingos = (st.flamingos || 0) + 1;
      Player.addMoney(250, 'flamingo');
      LL.notify('Flamingo de cocaína coletado +$250 (' + st.flamingos + '/' + C.FLAMINGO_TOTAL + ')', 'gold', 'COLECIONÁVEL');
      LL.UI.subtitle('<b>Colecionável:</b> mais um flamingo de plástico no porta-malas.');
    } else if (item.kind === 'cash') {
      const v = U.rint(45, 170);
      st.cashFound = (st.cashFound || 0) + v;
      Player.addMoney(v, 'dinheiro encontrado');
      LL.notify('Achou ' + U.fmtMoney(v) + ' no chão.', 'green', 'DINHEIRO');
    } else if (item.kind === 'crate') {
      const id = U.pick(WEAPON_POOL);
      Player.giveWeapon(id, Player.WEAPONS[id].mag * 2 + 12);
      st.weaponsFound = (st.weaponsFound || 0) + 1;
      LL.notify('Caixa de suprimentos: ' + Player.WEAPONS[id].name, 'green', 'ARSENAL');
    } else {
      S.armor = Math.min(100, S.armor + 55);
      st.armorsFound = (st.armorsFound || 0) + 1;
      LL.notify('Colete reforçado: ' + Math.round(S.armor) + '% de proteção.', 'green', 'EQUIPAMENTO');
    }
    try { LL.Audio.ui(item.kind === 'flamingo' ? 'confirm' : 'cash'); } catch (e) { }
    LL.emit('collectible:' + item.kind, item);
  }

  /* ----------------------------------------------------------------- update */
  let t = 0;
  C.update = function (dt) {
    const g = LL.game;
    if (!g || !g.player) return;
    t += dt;
    const S = g.player.state;
    const px = S.pos.x, py = S.pos.y;
    C.scanned += dt;
    const fullScan = C.scanned > 0.25;
    if (fullScan) C.scanned = 0;
    for (const item of C.items) {
      if (!item.active) continue;
      const dx = item.x - px, dy = item.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > 420 * 420) { item.group.visible = false; continue; }
      item.group.visible = true;
      // bob + spin so they read as pickups from a distance
      item.group.position.y = item.gy + 0.16 + Math.sin(t * 1.8 + item.phase) * 0.09;
      item.group.rotation.y += dt * (item.kind === 'flamingo' ? 0.7 : 1.1);
      if (d2 < 3.0 * 3.0 && !S.dead) collect(item);
    }
  };

  /* ------------------------------------------------------------- save hooks */
  C.serialize = function () { return { taken: C.taken.slice() }; };
  C.restore = function (d) {
    if (!d || !Array.isArray(d.taken)) return;
    const taken = new Set(d.taken);
    // rebuild first (idempotent) so restoring works from a fresh page too
    if (!C.group) return;
    C.taken = d.taken.slice();
    for (const item of C.items) {
      if (taken.has(item.id) && item.active) {
        item.active = false;
        C.group.remove(item.group);
      }
    }
  };

  C.reset = function () {
    if (C.group) { W.scene.remove(C.group); C.group = null; }
    C.items.length = 0; C.taken.length = 0;
    C.build();
  };

  console.log('[collect] módulo pronto');
})();
