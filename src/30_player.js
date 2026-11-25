/* ============================================================================
   30 · PLAYER — controller, camera, characters, weapons, vehicles, focus.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, V = LL.Vehicles, PI = Math.PI;
  const P = (LL.Player = {});

  /* ------------------------------------------------------------------ weapons */
  const WEAPONS = {
    fist: { id: 'fist', name: 'MÃOS', short: 'SOC', dmg: 14, mag: 0, rpm: 110, spread: 0, range: 2.4, auto: false, reload: 0, melee: true },
    pistol: { id: 'pistol', name: 'PISTOLA 9MM', short: 'PIST', dmg: 24, mag: 12, rpm: 240, spread: 1.4, range: 130, auto: false, reload: 1.35, pellets: 1, sound: 'pistol' },
    smg: { id: 'smg', name: 'SMG VICE', short: 'SMG', dmg: 16, mag: 30, rpm: 720, spread: 3.1, range: 110, auto: true, reload: 1.8, pellets: 1, sound: 'smg' },
    rifle: { id: 'rifle', name: 'FUZIL CARBINE', short: 'FUZ', dmg: 36, mag: 30, rpm: 540, spread: 1.1, range: 230, auto: true, reload: 2.1, pellets: 1, sound: 'rifle' },
    shotgun: { id: 'shotgun', name: 'ESCOPETA', short: 'ESC', dmg: 13, mag: 6, rpm: 78, spread: 6.5, range: 52, auto: false, reload: 2.4, pellets: 8, sound: 'shotgun' },
    revolver: { id: 'revolver', name: '.357 REVOLVER', short: 'REV', dmg: 52, mag: 6, rpm: 165, spread: 1.7, range: 150, auto: false, reload: 2.0, pellets: 1, sound: 'revolver' },
  };
  P.WEAPONS = WEAPONS;
  P.WEAPON_ORDER = ['fist', 'pistol', 'smg', 'shotgun', 'rifle', 'revolver'];

  /* -------------------------------------------------------------------- state */
  const S = P.state = {
    pos: { x: 6 * 420 + 210, y: 3 * 420 + 300 },
    angle: 0.6, speed: 0, vy: 0, health: 100, maxHealth: 100, armor: 0,
    stamina: 100, focus: 100, focusActive: false, money: 800,
    character: 0, inVehicle: false, vehicle: null, aiming: false,
    weapon: 'pistol', ammo: {}, cooldown: 0, reloading: 0, reloadQueued: false,
    lastDamage: -99, dead: false, invuln: 0, stepPhase: 0,
    clothes: 0, disguised: false, sprint: false, swim: 0, inWater: false,
    kills: 0, arrests: 0, cameraShake: 0, headshot: false,
  };
  P.pos = S.pos;
  // mirrors so other modules can read player.inVehicle / player.speed / player.disguised
  ['inVehicle', 'speed', 'disguised', 'dead', 'vehicle', 'health', 'armor', 'money', 'character', 'aiming', 'focusActive']
    .forEach((k) => Object.defineProperty(P, k, { get() { return S[k]; }, set(v) { S[k] = v; }, configurable: true }));

  P.ammoInit = function () {
    S.ammo = {};
    for (const id of P.WEAPON_ORDER) {
      const w = WEAPONS[id];
      if (w.melee) continue;
      S.ammo[id] = { mag: w.mag, res: w.mag * 4 };
    }
  };

  /* ------------------------------------------------------------------- camera */
  P.cam = { yaw: 0.6, pitch: -0.16, dist: 4.6, height: 1.55, shake: 0, zoom: 1, current: null };

  P.init = function (camera) {
    P.camera = camera;
    P.ammoInit();
    P.av = LL.Chars.jason();
    LL.game.player = P;
    P.av.group.position.set(S.pos.x, 0, S.pos.y);
    W.scene.add(P.av.group);
    P.buildWeaponMesh();
    P.cam.yaw = S.angle;
    LL.Input.init(document.getElementById('gl'));
  };

  P.buildWeaponMesh = function () {
    // a slightly beefier weapon model hung off the right hand than the default prop
    const g = new THREE.Group();
    const mk = (w, h, d, x, y, z, c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c }));
      m.position.set(x, y, z); g.add(m); return m;
    };
    mk(0.46, 0.1, 0.08, 0.1, 0, 0, '#15181c');          // barrel/slide
    mk(0.16, 0.2, 0.1, -0.06, -0.12, 0, '#1b1f24');       // grip
    mk(0.1, 0.05, 0.07, 0.02, -0.05, 0, '#2a3038');       // trigger guard
    g.visible = false;
    P.weaponMesh = g;
    P.av.armR.add(g);
    g.position.set(0.16, -0.62, 0);
    // muzzle flash
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe6a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.scale.set(0.9, 0.9, 1); flash.position.set(0.45, 0, 0);
    g.add(flash);
    P.muzzle = flash;
  };

  /* ------------------------------------------------------------------ helpers */
  function groundAt(x, y) { return W.heightAt(x, y); }

  P.getWeapon = () => WEAPONS[S.weapon] || WEAPONS.fist;
  P.ammoOf = (id) => S.ammo[id] || { mag: 0, res: 0 };
  P.weaponState = function () {
    const w = P.getWeapon(), a = S.ammo[S.weapon];
    return {
      id: w.id, name: w.name, short: w.short,
      mag: a ? a.mag : 0, res: a ? a.res : 0, magSize: w.mag,
      reloading: S.reloading > 0, reloadPct: S.reloading > 0 ? 1 - S.reloading / w.reload : 0,
    };
  };

  /* ---------------------------------------------------------------- inventory */
  P.giveWeapon = function (id, ammo) {
    if (!WEAPONS[id] || WEAPONS[id].melee) return;
    if (!S.ammo[id]) S.ammo[id] = { mag: WEAPONS[id].mag, res: 0 };
    S.ammo[id].res += ammo || WEAPONS[id].mag * 2;
    LL.notify('Adquiriu ' + WEAPONS[id].name, 'green', 'ARSENAL');
  };
  P.selectWeapon = function (id) {
    if (!WEAPONS[id]) return false;
    if (id !== 'fist' && !S.ammo[id]) return false;
    S.weapon = id; S.reloading = 0; S.cooldown = 0.2;
    try { LL.Audio.ui('click'); } catch (e) { }
    LL.emit('weapon:changed', id);
    return true;
  };

  /* -------------------------------------------------------------------- money */
  P.addMoney = function (n, reason) {
    const before = S.money;
    S.money = Math.max(0, S.money + n);
    const delta = S.money - before;
    if (delta !== 0) {
      LL.emit('money:changed', S.money, delta, reason);
      if (delta > 0) { try { LL.Audio.ui('cash'); } catch (e) { } }
    }
    if (LL.game.stats) LL.game.stats.moneyEarned = (LL.game.stats.moneyEarned || 0) + Math.max(0, delta);
    return delta;
  };

  /* --------------------------------------------------------------------- hurt */
  P.hurt = function (dmg, cause) {
    if (S.dead || S.invuln > 0) return;
    let d = dmg;
    if (S.armor > 0) {
      const absorbed = Math.min(S.armor, d * 0.6);
      S.armor -= absorbed; d -= absorbed;
    }
    S.health = Math.max(0, S.health - d);
    S.lastDamage = LL.game.time;
    S.cameraShake = Math.min(1, S.cameraShake + d * 0.02);
    try { LL.Audio.hurt(); } catch (e) { }
    const dmgEl = document.getElementById('damage');
    if (dmgEl) { dmgEl.style.opacity = U.clamp(0.35 + d * 0.02, 0, 0.85); setTimeout(() => { dmgEl.style.opacity = 0; }, 160); }
    LL.emit('player:hurt', d, cause);
    if (S.health <= 0) P.die(cause || 'ferimentos');
  };

  P.die = function (cause) {
    if (S.dead) return;
    S.dead = true;
    S.health = 0;
    if (S.inVehicle) P.exitVehicle(true);
    P.av.dead = true;
    try { LL.Audio.ui('fail'); } catch (e) { }
    if (LL.game.stats) LL.game.stats.deaths = (LL.game.stats.deaths || 0) + 1;
    LL.emit('player:died', cause);
  };

  P.respawn = function (opts) {
    opts = opts || {};
    S.dead = false;
    S.health = opts.health !== undefined ? opts.health : 100;
    S.armor = 0;
    S.stamina = 100;
    S.focus = 100;
    S.invuln = 3;
    S.vy = 0;
    S.dead = false;
    P.av.dead = false;
    P.av.group.rotation.z = 0;
    if (opts.moneyPenalty) P.addMoney(-opts.moneyPenalty, 'hospital');
    const sp = opts.spawn || P.safehousePos();
    S.pos.x = sp.x; S.pos.y = sp.y;
    S.speed = 0; S.angle = sp.a || 0;
    P.cam.yaw = S.angle;
    if (S.inVehicle) P.exitVehicle(true);
    LL.emit('player:respawned');
  };

  P.safehousePos = function () {
    const poi = (W.pois || []).find((p) => p.service === 'safehouse');
    if (poi) return { x: poi.x + 6, y: poi.y + 16, a: 1.2 };
    return { x: 6 * 420 + 210, y: 3 * 420 + 320, a: 1.2 };
  };

  P.busted = function () {
    const fine = Math.min(S.money, 250 + LL.Police.wanted * 180);
    LL.Police.clear();
    P.addMoney(-fine, 'multa');
    S.health = Math.max(40, S.health);
    S.invuln = 3;
    const sp = { x: 5 * 420 + 210 + 20, y: 3 * 420 + 210 + 24, a: 1.5 };
    S.pos.x = sp.x; S.pos.y = sp.y; S.speed = 0;
    if (S.inVehicle) P.exitVehicle(true);
    LL.emit('player:respawned');
  };

  /* ------------------------------------------------------------------- vehicle */
  P.enterVehicle = function (car, breaking) {
    if (!car || S.inVehicle || car.destroyed) return false;
    if (car.boat && !car.forceBoard) { /* boats need to be near the water; allowed */ }
    if (car.locked && !breaking) return false;
    S.inVehicle = true;
    S.vehicle = car;
    S.pos.x = car.pos.x; S.pos.y = car.pos.y;
    car.driver = 'player';
    V.playerCar = car;
    car.parked = false;
    car.locked = false;
    P.av.group.visible = false;
    if (LL.Audio) LL.Audio.startEngine(car.boat ? 'boat' : (car.scooter ? 'scooter' : 'car'));
    S.weapon = S.weapon === 'fist' ? 'pistol' : S.weapon;
    car.setLights(true);
    if (car.alarm) { car.alarm = true; car.alarmTimer = 5; LL.Police.reportCrime('furto', car.pos.x, car.pos.y, 1); }
    if (!car.owned && !car._theftCounted) {
      car._theftCounted = true;
      const st = LL.game && LL.game.stats;
      if (st) st.carsStolen = (st.carsStolen || 0) + 1;
      LL.emit('vehicle:stolen', car);
    }
    if (car.boat && LL.game && LL.game.stats) LL.game.stats.boatTrips = (LL.game.stats.boatTrips || 0) + 1;
    LL.emit('vehicle:entered', car);
    return true;
  };

  P.exitVehicle = function (forced) {
    const car = S.vehicle;
    if (!car) { S.inVehicle = false; return; }
    car.driver = null;
    car.parked = true;
    car.speed *= 0.2;
    car.alarm = false;
    if (V.playerCar === car) V.playerCar = null;
    // find a free side
    const right = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
    const off = car.spec.wid * 0.5 + 1.05;
    const cands = [
      { x: car.pos.x + right.x * off, y: car.pos.y + right.y * off },
      { x: car.pos.x - right.x * off, y: car.pos.y - right.y * off },
      { x: car.pos.x - Math.cos(car.angle) * (car.spec.len * 0.5 + 1.2), y: car.pos.y - Math.sin(car.angle) * (car.spec.len * 0.5 + 1.2) },
    ];
    let spot = null;
    for (const c of cands) { if (!W.isBlocked(c.x, c.y, 0.5)) { spot = c; break; } }
    if (!spot) spot = cands[0];
    S.pos.x = spot.x; S.pos.y = spot.y;
    S.speed = 0;
    S.inVehicle = false;
    S.vehicle = null;
    P.av.group.visible = true;
    P.av.group.position.set(S.pos.x, groundAt(S.pos.x, S.pos.y), S.pos.y);
    if (LL.Audio) LL.Audio.stopEngine();
    if (!forced) LL.emit('vehicle:exited', car);
    return true;
  };

  /* --------------------------------------------------------------------- shoot */
  function muzzleWorld() {
    const a = P.cam.yaw;
    return { x: S.pos.x + Math.cos(a) * 0.8, y: S.pos.y + Math.sin(a) * 0.8, h: 1.35 };
  }

  P.shoot = function () {
    const w = P.getWeapon();
    if (S.reloading > 0 || S.cooldown > 0) return;
    if (w.melee) {
      S.cooldown = 0.45;
      const ped = LL.Peds.nearest(S.pos.x + Math.cos(P.cam.yaw) * 1.2, S.pos.y + Math.sin(P.cam.yaw) * 1.2, 2);
      if (ped) { LL.Peds.hit(ped, w.dmg, S.pos.x, S.pos.y); LL.Police.reportCrime('distúrbio', S.pos.x, S.pos.y, 1); }
      try { LL.Audio.impact(S.pos.x, S.pos.y, 0.4); } catch (e) { }
      return;
    }
    const ammo = S.ammo[w.id];
    if (!ammo) return;
    if (ammo.mag <= 0) {
      try { LL.Audio.ui('empty'); } catch (e) { }
      S.cooldown = 0.25;
      if (ammo.res > 0) P.reload();
      return;
    }
    ammo.mag--;
    S.cooldown = 60 / w.rpm;
    const spread = (w.spread * (S.aiming ? 0.55 : 1) * (S.focusActive ? 0.6 : 1)) * (Math.PI / 180);
    const pellets = w.pellets || 1;
    let hitSomething = false;
    for (let p = 0; p < pellets; p++) {
      const ang = P.cam.yaw + (Math.random() - 0.5) * spread * 2;
      const hit = hitscan(S.pos.x, S.pos.y, ang, w.range, w.dmg);
      if (hit) {
        hitSomething = true;
        applyHit(hit, w.dmg, ang);
      }
    }
    try { LL.Audio.shot(w.sound || 'pistol', S.pos.x, S.pos.y); } catch (e) { }
    // muzzle flash
    if (P.muzzle) {
      P.muzzle.material.opacity = 1;
      P.muzzle.scale.setScalar(U.rand(1.2, 0.7));
      setTimeout(() => { if (P.muzzle) P.muzzle.material.opacity = 0; }, 55);
    }
    S.cameraShake = Math.min(1, S.cameraShake + 0.14);
    if (hitSomething) {
      const ch = document.getElementById('crosshair');
      if (ch) { ch.classList.add('hit'); setTimeout(() => ch.classList.remove('hit'), 110); }
      try { LL.Audio.hitmarker('body'); } catch (e) { }
    }
    if (LL.Police.wanted > 0 || Math.random() < 0.5) {
      LL.Police.reportCrime('tiros', S.pos.x, S.pos.y, LL.Police.wanted > 0 ? 1 : 1);
    }
    LL.Peds.scare(S.pos.x, S.pos.y, 55, { crime: 'tiros' });
    LL.emit('player:shot', w.id);
  };

  function hitscan(x, y, ang, range, dmg) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = null, bestD = range;
    // pedestrians
    for (const ped of LL.Peds.list) {
      if (ped.dead) continue;
      const rel = relHit(x, y, dx, dy, ped.pos.x, ped.pos.y, 0.55, bestD);
      if (rel) { bestD = rel.d; best = { kind: 'ped', ped, d: rel.d }; }
    }
    // officers
    for (const o of LL.Police.officers) {
      if (o.dead) continue;
      const rel = relHit(x, y, dx, dy, o.pos.x, o.pos.y, 0.5, bestD);
      if (rel) { bestD = rel.d; best = { kind: 'cop', cop: o, d: rel.d }; }
    }
    // vehicles
    for (const car of V.list) {
      const rel = relHit(x, y, dx, dy, car.pos.x, car.pos.y, car.radius, bestD);
      if (rel) { bestD = rel.d; best = { kind: 'car', car, d: rel.d }; }
    }
    return best;
  }

  function relHit(x, y, dx, dy, tx, ty, radius, maxD) {
    const px = tx - x, py = ty - y;
    const proj = px * dx + py * dy;
    if (proj < 0.3 || proj > maxD) return null;
    const perp = Math.abs(px * -dy + py * dx);
    if (perp > radius) return null;
    if (W.segmentBlocked(x, y, tx, ty, 1.2)) return null;
    return { d: proj };
  }

  function applyHit(hit, dmg, ang) {
    if (hit.kind === 'ped') LL.Peds.hit(hit.ped, dmg, S.pos.x, S.pos.y);
    else if (hit.kind === 'cop') LL.Police.hitOfficer(hit.cop, dmg);
    else if (hit.kind === 'car') {
      hit.car.damage(dmg * 0.5);
      if (LL.Audio) LL.Audio.impact(hit.car.pos.x, hit.car.pos.y, 0.7);
      if (hit.car.spec.police && !hit.car.driver) LL.Police.reportCrime('tiros', hit.car.pos.x, hit.car.pos.y, 2);
      if (hit.car.alarm) { hit.car.alarmTimer = 4; }
    }
  }

  P.reload = function () {
    const w = P.getWeapon();
    if (w.melee || S.reloading > 0) return;
    const a = S.ammo[w.id];
    if (!a || a.mag >= w.mag || a.res <= 0) return;
    S.reloading = w.reload;
    try { LL.Audio.ui('reload'); } catch (e) { }
  };

  /* ------------------------------------------------------------------ interaction */
  P.interactTarget = function () {
    if (S.inVehicle) return null;
    const near = V.nearest(S.pos.x, S.pos.y, 4.0, (c) => !c.destroyed);
    if (near) return { kind: 'vehicle', car: near, label: near.locked ? 'Arrombar ' + near.spec.name : 'Entrar em ' + near.spec.name };
    const ped = LL.Peds.nearest(S.pos.x, S.pos.y, 2.6);
    if (ped && !ped.dead) return { kind: 'ped', ped, label: 'Falar com ' + ped.name };
    for (const poi of W.pois) {
      const s = poi.service;
      if (s === 'landmark') continue;
      if (Math.hypot(poi.x - S.pos.x, poi.y - S.pos.y) < (poi.radius || 5) + 3.2) {
        return { kind: 'poi', poi, label: poi.name + ' — ' + (poi.icon || '●') };
      }
    }
    return null;
  };

  P.interact = function () {
    if (S.dead) return;
    if (S.inVehicle) { P.exitVehicle(); return; }
    const target = P.interactTarget();
    if (!target) return;
    if (target.kind === 'vehicle') {
      const car = target.car;
      if (car.locked) {
        // break-in takes 1.4 s and trips the alarm
        LL.UI.hint('Forçando a fechadura…');
        P.breakT = 1.4;
        P.breakTarget = car;
      } else P.enterVehicle(car);
    } else if (target.kind === 'poi') {
      LL.UI.openService(target.poi);
    } else if (target.kind === 'ped') {
      const ped = target.ped;
      if (S.weapon !== 'fist' || S.aiming) {
        // mugging: gun out means they hand it over
        const take = Math.round(U.rand(145, 45));
        S.loot = (S.loot || 0) + take;
        P.addMoney(Math.round(take * 0.4), 'assalto a pedestre');
        if (LL.game && LL.game.stats) LL.game.stats.pedsRobbed = (LL.game.stats.pedsRobbed || 0) + 1;
        LL.Peds.scare(ped.pos.x, ped.pos.y, 26, { crime: 'assalto' });
        LL.Police.reportCrime('assalto', ped.pos.x, ped.pos.y, 1);
        LL.notify(ped.name + ' entregou ' + U.fmtMoney(take) + ' em espólios.', 'gold', 'ASSALTO');
        LL.UI.subtitle('<b>' + ped.name + ':</b> ' + U.pick(['Leva o que quiser, só não atira!', 'Tá bom, tá bom! Pega tudo!', 'Meu Deus… meu Deus…']));
        try { LL.Audio.ui('cash'); } catch (e) { }
        LL.emit('ped:robbed', ped);
        ped.state = 'flee'; ped.timer = 8; ped.fleeFrom = { x: S.pos.x, y: S.pos.y }; ped.speed = ped.baseSpeed * 3.2;
      } else {
        const lines = [
          'Tá doido? Sai de perto.', 'Bonito carro. Se é que é seu.', 'Essa cidade não dorme, amigo.',
          'Cuidado com a rua à noite.', 'Você viu aquele barulho?', 'Não me mete em confusão.',
          'Dizem que a polícia anda comprada.', 'Se for vender algo, fala com o Ferro-Velho.',
        ];
        LL.UI.subtitle('<b>' + ped.name + ':</b> ' + U.pick(lines));
      }
    }
  };

  /* -------------------------------------------------------------------- update */
  const keys = LL.Input ? null : null;

  P.update = function (dt) {
    const I = LL.Input;
    if (S.dead) { P.updateCamera(dt); return; }
    if (S.invuln > 0) S.invuln -= dt;
    S.cooldown = Math.max(0, S.cooldown - dt);

    // reload
    if (S.reloading > 0) {
      S.reloading -= dt;
      if (S.reloading <= 0) {
        const w = P.getWeapon(), a = S.ammo[w.id];
        if (a) {
          const need = w.mag - a.mag, take = Math.min(need, a.res);
          a.mag += take; a.res -= take;
        }
      }
    }

    // break-in progress
    if (P.breakT !== undefined && P.breakT > 0) {
      if (I.down('KeyE') && P.breakTarget && Math.hypot(P.breakTarget.pos.x - S.pos.x, P.breakTarget.pos.y - S.pos.y) < 4.2) {
        P.breakT -= dt;
        LL.UI.progress(P.breakT / 1.4, 'Arrombando…');
        if (P.breakT <= 0) {
          const car = P.breakTarget;
          car.locked = false;
          car.alarm = true; car.alarmTimer = 6;
          if (LL.Audio) LL.Audio.alarm(car.pos.x, car.pos.y);
          LL.Police.reportCrime('furto', car.pos.x, car.pos.y, 1);
          LL.Peds.scare(car.pos.x, car.pos.y, 26);
          if (LL.game && LL.game.stats) LL.game.stats.smashGrab = (LL.game.stats.smashGrab || 0) + 1;
          LL.emit('vehicle:brokein', car);
          P.enterVehicle(car, true);
          LL.UI.progress(-1);
          P.breakT = 0; P.breakTarget = null;
        }
      } else { LL.UI.progress(-1); P.breakT = 0; }
    }

    // weapon switching
    const numKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    for (let i = 0; i < numKeys.length; i++) {
      if (I.consume(numKeys[i])) {
        const id = P.WEAPON_ORDER[i];
        if (id) P.selectWeapon(id);
      }
    }
    if (I.consume('KeyR')) P.reload();
    const wheel = I.mouse.wheel;
    if (wheel && !S.inVehicle) {
      const list = P.WEAPON_ORDER.filter((id) => id === 'fist' || S.ammo[id]);
      let idx = list.indexOf(S.weapon);
      idx = (idx + (wheel > 0 ? 1 : -1) + list.length) % list.length;
      P.selectWeapon(list[idx]);
    }

    // focus (bullet-time lite)
    if (I.down('KeyF') && S.focus > 0 && !S.inVehicle) {
      S.focusActive = true;
      S.focus = Math.max(0, S.focus - dt * 24);
    } else {
      S.focusActive = false;
      S.focus = Math.min(100, S.focus + dt * 9);
    }
    LL.game.timeScale = S.focusActive ? 0.72 : 1;

    if (S.inVehicle && S.vehicle) {
      updateDriving(dt);
    } else {
      updateOnFoot(dt);
    }
    updateWeaponSway(dt);
    P.updateCamera(dt);
    updateAvatar(dt);
  };

  function updateDriving(dt) {
    const car = S.vehicle;
    if (!car) { S.inVehicle = false; return; }
    S.pos.x = car.pos.x; S.pos.y = car.pos.y;
    S.angle = car.angle;
    const I = LL.Input;
    // handbrake visual / horn / lights / radio
    if (I.consume('KeyH')) { try { LL.Audio.horn(car.pos.x, car.pos.y); } catch (e) { } LL.Peds.scare(car.pos.x, car.pos.y, 30); }
    if (I.consume('KeyL')) car.setLights(!car.lights);
    if (I.consume('KeyQ')) LL.emit('radio:next');
    // camera follows the car
    const wantYaw = car.angle;
    P.cam.yaw = U.dampAngle(P.cam.yaw, wantYaw, 2.4, dt);
    const speedRatio = U.clamp(Math.abs(car.speed) / car.spec.maxSpeed, 0, 1);
    P.cam.dist = U.damp(P.cam.dist, 7.2 + speedRatio * 3.4 + (car.spec.cat === 'van' || car.spec.cat === 'suv' ? 1.4 : 0), 4, dt);
    P.cam.height = U.damp(P.cam.height, 3.1 + speedRatio * 0.7, 4, dt);
    if (LL.Audio) LL.Audio.updateEngine(speedRatio, I.down('KeyW') ? 1 : 0, car.kmh);
    // distance driven, in kilometres
    if (LL.game && LL.game.stats) {
      LL.game.stats.kmDriven = (LL.game.stats.kmDriven || 0) + (Math.abs(car.speed) * dt) / 1000;
    }
    // tyre screech
    if (LL.Audio) {
      const slip = Math.abs(car.steer) * speedRatio;
      LL.Audio.setScreech(slip > 0.55 && Math.abs(car.speed) > 12 ? (slip - 0.55) * 1.6 : 0);
    }
    if (I.consume('KeyE') && Math.abs(car.speed) < 12) P.exitVehicle();
  }

  function updateOnFoot(dt) {
    const I = LL.Input;
    const fwd = { x: Math.cos(P.cam.yaw), y: Math.sin(P.cam.yaw) };
    const right = { x: -fwd.y, y: fwd.x };
    let mx = 0, my = 0;
    if (I.down('KeyW') || I.down('ArrowUp')) { mx += fwd.x; my += fwd.y; }
    if (I.down('KeyS') || I.down('ArrowDown')) { mx -= fwd.x; my -= fwd.y; }
    if (I.down('KeyD') || I.down('ArrowRight')) { mx += right.x; my += right.y; }
    if (I.down('KeyA') || I.down('ArrowLeft')) { mx -= right.x; my -= right.y; }
    const len = Math.hypot(mx, my);
    if (len > 0.01) { mx /= len; my /= len; }

    S.sprint = (I.down('ShiftLeft') || I.down('ShiftRight')) && S.stamina > 2 && len > 0.1;
    const maxSpeed = S.sprint ? 8.6 : 4.4;
    if (S.sprint) S.stamina = Math.max(0, S.stamina - dt * 17);
    else S.stamina = Math.min(100, S.stamina + dt * 11);

    const targetSpeed = len > 0.01 ? maxSpeed : 0;
    S.speed = U.damp(S.speed, targetSpeed, len > 0.01 ? 8 : 11, dt);
    if (len > 0.01) {
      S.angle = U.dampAngle(S.angle, Math.atan2(my, mx), 11, dt);
      const nx = S.pos.x + mx * S.speed * dt;
      const ny = S.pos.y + my * S.speed * dt;
      movePlayer(nx, ny);
    }
    // wading
    S.inWater = W.isWater(S.pos.x, S.pos.y);
    if (S.inWater) {
      S.speed *= 0.55;
      if (Math.random() < 0.1) { try { LL.Audio.splash(S.pos.x, S.pos.y); } catch (e) { } }
    }

    // footsteps
    if (S.speed > 0.6) {
      S.stepPhase += dt * S.speed * 1.5;
      if (S.stepPhase > 1.9) {
        S.stepPhase = 0;
        try { LL.Audio.footstep(W.surfaceAt(S.pos.x, S.pos.y)); } catch (e) { }
      }
    }

    // aiming + shooting
    S.aiming = I.mouse.right || I.down('ControlLeft');
    if (I.locked && (I.mouse.down || I.mouse.right)) {
      const w = P.getWeapon();
      if (w.auto) P.shoot();
      else if (I.mouse.justDown) P.shoot();
    }

    // health regen
    if (LL.game.time - S.lastDamage > 9 && S.health < 100) S.health = Math.min(100, S.health + dt * 2.4);
    if (I.consume('KeyE')) P.interact();
    if (I.consume('KeyG')) LL.UI && LL.UI.quickSwitch && LL.UI.quickSwitch();
    if (I.consume('Tab')) LL.emit('character:switch');
  }

  function movePlayer(nx, ny) {
    if (!W.isBlocked(nx, ny, 0.42)) { S.pos.x = nx; S.pos.y = ny; return; }
    if (!W.isBlocked(nx, S.pos.y, 0.42)) { S.pos.x = nx; return; }
    if (!W.isBlocked(S.pos.x, ny, 0.42)) { S.pos.y = ny; return; }
  }

  function updateWeaponSway(dt) { }

  function updateAvatar(dt) {
    if (S.inVehicle) return;
    const a = P.av;
    const y = groundAt(S.pos.x, S.pos.y);
    a.group.visible = true;
    a.baseY = y;
    a.group.position.x = S.pos.x;
    a.group.position.z = S.pos.y;
    a.group.rotation.y = -S.angle;
    a.aimT = S.aiming ? 1 : 0;
    const w = P.getWeapon();
    if (P.weaponMesh) {
      P.weaponMesh.visible = !w.melee;
      P.av.gun.visible = false;
    }
    a.anim(dt, S.speed);
    if (S.aiming) a.group.rotation.y = -P.cam.yaw;
    if (S.dead) { a.dead = true; a.anim(dt, 0); }
  }

  /* -------------------------------------------------------------------- camera */
  P.updateCamera = function (dt) {
    const cam = P.camera;
    if (!cam) return;
    const I = LL.Input;
    const sens = 0.0022 * (LL.Settings.sensitivity || 1);
    if (I.locked && !S.dead) {
      P.cam.yaw -= I.mouse.dx * sens;
      P.cam.pitch = U.clamp(P.cam.pitch - I.mouse.dy * sens * (LL.Settings.invertY ? -1 : 1), -1.1, 0.72);
    }
    if (!S.inVehicle && !I.locked && (I.mouse.down || I.mouse.right)) {
      P.cam.yaw -= I.mouse.dx * sens * 0.6;
      P.cam.pitch = U.clamp(P.cam.pitch - I.mouse.dy * sens * 0.6, -1.0, 0.6);
    }
    // auto-align while driving fast
    if (S.inVehicle && S.vehicle && Math.abs(S.vehicle.speed) > 16 && !I.locked) {
      P.cam.yaw = U.dampAngle(P.cam.yaw, S.vehicle.angle, 1.6, dt);
    }

    const dist = P.cam.dist * (S.aiming && !S.inVehicle ? 0.62 : 1);
    const tx = S.inVehicle && S.vehicle ? S.vehicle.pos.x : S.pos.x;
    const ty = S.inVehicle && S.vehicle ? S.vehicle.pos.y : S.pos.y;
    const baseH = S.inVehicle ? P.cam.height : 1.55;
    const h = baseH + (S.aiming ? 0.12 : 0);

    const yaw = P.cam.yaw, pitch = P.cam.pitch;
    let cx = tx - Math.cos(yaw) * Math.cos(pitch) * dist;
    let cy = h + Math.sin(-pitch) * dist * -1 + Math.sin(pitch) * dist * 0;
    let cz = ty - Math.sin(yaw) * Math.cos(pitch) * dist;
    cy = h - Math.sin(pitch) * dist;

    // camera collision: pull in if the point is inside a building
    let step = 0.5;
    while (step < 1) {
      const px = U.lerp(tx, cx, step), py = U.lerp(ty, cz, step);
      if (!W.isBlocked(px, py, 0.6)) break;
      step -= 0.08;
      if (step < 0.2) { step = 0.2; break; }
    }
    cx = U.lerp(tx, cx, step); cz = U.lerp(ty, cz, step);
    if (cy < 0.6) cy = 0.6;

    // shake
    S.cameraShake = Math.max(0, S.cameraShake - dt * 2.4);
    const sh = LL.Settings.cameraShake ? S.cameraShake * 0.18 : 0;
    cx += (Math.random() - 0.5) * sh; cy += (Math.random() - 0.5) * sh; cz += (Math.random() - 0.5) * sh;

    cam.position.set(cx, cy, cz);
    const lookH = S.inVehicle ? h + 0.4 : h + 0.1;
    const lx = tx + Math.cos(yaw) * 6;
    const ly = lookH - Math.sin(pitch) * 6;
    const lz = ty + Math.sin(yaw) * 6;
    cam.lookAt(lx, ly, lz);

    // fov
    const fov = (LL.Settings.fov || 66) * (S.focusActive ? 0.88 : 1) * (S.inVehicle ? 1.03 : 1);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = U.damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix(); }
  };

  /* -------------------------------------------------------------- char switch */
  P.switchCharacter = function () {
    if (S.inVehicle) { LL.notify('Saia do veículo para trocar de personagem.', 'gold', 'TROCA'); return false; }
    const next = S.character === 0 ? 1 : 0;
    S.character = next;
    try {
      W.scene.remove(P.av.group);
      P.av = next === 0 ? LL.Chars.jason() : LL.Chars.lucia();
      W.scene.add(P.av.group);
      P.buildWeaponMesh();
      P.av.group.position.set(S.pos.x, groundAt(S.pos.x, S.pos.y), S.pos.y);
    } catch (e) { LL.reportError(e, 'switch'); }
    try { LL.Audio.ui('confirm'); } catch (e) { }
    LL.notify(next === 0 ? 'Agora você é Jason.' : 'Agora você é Lucia.', 'green', 'TROCA DE PERSONAGEM');
    LL.emit('character:changed', next);
    return true;
  };

  /* ------------------------------------------------------------------ clothes */
  P.wearOutfit = function (idx) {
    S.clothes = idx;
    S.disguised = true;
    LL.emit('outfit:changed', idx);
    if (LL.Police.wanted > 0) { LL.Police.searchT = 0; LL.notify('A roupa nova confunde a polícia por um tempo.', 'gold', 'DISFARCE'); }
    // swap the avatar's clothing variant
    try {
      W.scene.remove(P.av.group);
      const opts = { variant: idx, longHair: S.character === 1, key: 'outfit' + idx };
      P.av = LL.Chars.create(opts);
      W.scene.add(P.av.group);
      P.buildWeaponMesh();
      P.av.group.position.set(S.pos.x, groundAt(S.pos.x, S.pos.y), S.pos.y);
    } catch (e) { }
  };

  /* --------------------------------------------------------------- save hooks */
  P.serialize = function () {
    return {
      pos: { x: S.pos.x, y: S.pos.y }, angle: S.angle, health: S.health, armor: S.armor,
      stamina: S.stamina, focus: S.focus, money: S.money, character: S.character,
      weapon: S.weapon, ammo: S.ammo, clothes: S.clothes, disguised: S.disguised,
    };
  };
  P.restore = function (d) {
    if (!d) return;
    S.pos.x = d.pos?.x ?? S.pos.x;
    S.pos.y = d.pos?.y ?? S.pos.y;
    S.angle = d.angle ?? 0;
    S.health = d.health ?? 100;
    S.armor = d.armor ?? 0;
    S.stamina = d.stamina ?? 100;
    S.focus = d.focus ?? 100;
    S.money = d.money ?? 800;
    S.character = d.character ?? 0;
    S.clothes = d.clothes ?? 0;
    S.disguised = !!d.disguised;
    if (d.ammo) S.ammo = d.ammo;
    if (d.weapon && WEAPONS[d.weapon]) S.weapon = d.weapon;
    P.cam.yaw = S.angle;
    if (P.av) { W.scene.remove(P.av.group); }
    P.av = S.character === 1 ? LL.Chars.lucia() : LL.Chars.jason();
    W.scene.add(P.av.group);
    P.buildWeaponMesh();
    P.av.group.position.set(S.pos.x, groundAt(S.pos.x, S.pos.y), S.pos.y);
  };

  console.log('[player] controller pronto');
})();
