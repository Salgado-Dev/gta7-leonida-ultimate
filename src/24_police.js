/* ============================================================================
   24 · POLICE — wanted levels 1-5, dispatch, pursuit, foot officers, search
   behaviour, roadblocks, helicopter, busted logic.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, P = (LL.Police = { wanted: 0, heat: 0, units: [], officers: [], crimes: [], lastCrime: -999, searchT: 0, dispatchT: 0, bustT: 0 });
  const PI = Math.PI, CELL = W.CELL, WORLD = W.WORLD, ROAD = W.ROAD;

  P.crimeLabels = {
    tiros: 'Disparo de arma de fogo', furto: 'Roubo de veículo', atropelamento: 'Atropelamento',
    assalto: 'Assalto a estabelecimento', explosao: 'Explosão', distúrbio: 'Distúrbio',
    fuga: 'Fuga da polícia', homicidio: 'Homicídio',
  };

  /* ------------------------------------------------------------------ wanted */
  P.reportCrime = function (type, x, y, severity) {
    const now = LL.game ? LL.game.time : 0;
    if (now - P.lastCrime < 0.8 && P.wanted > 0) return;
    P.lastCrime = now;
    const sev = severity || 1;
    const before = P.wanted;
    P.wanted = Math.min(5, Math.max(P.wanted, sev + (Math.random() < 0.25 ? 1 : 0)));
    P.heat = Math.min(1, P.heat + 0.25);
    P.crimes.push({ type, x, y, t: now });
    if (P.crimes.length > 12) P.crimes.shift();
    if (P.wanted > before) {
      LL.emit('wanted:changed', P.wanted);
      try { LL.Audio.ui('star'); } catch (e) { }
      LL.notify(P.crimeLabels[type] || 'Crime registrado', 'red', 'PROCURADO ' + '★'.repeat(P.wanted));
      const el = document.getElementById('wantedFlash');
      if (el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 420); }
    }
    P.dispatchT = Math.min(P.dispatchT, 0.6);
    P.searchT = 0;
  };

  P.clear = function () {
    P.wanted = 0; P.heat = 0; P.crimes.length = 0;
    for (const u of P.units.slice()) removeUnit(u);
    P.units.length = 0;
    for (const o of P.officers.slice()) removeOfficer(o);
    P.officers.length = 0;
    LL.emit('wanted:changed', 0);
  };

  P.setWanted = function (n) {
    P.wanted = U.clamp(Math.round(n), 0, 5);
    LL.emit('wanted:changed', P.wanted);
    if (P.wanted === 0) P.clear();
  };

  /* ------------------------------------------------------------------- units */
  function unitSpawnPoint() {
    const g = LL.game;
    if (!g || !g.player) return null;
    for (let n = 0; n < 22; n++) {
      const a = Math.random() * PI * 2;
      const dist = U.rand(190, 95);
      let x = g.player.pos.x + Math.cos(a) * dist;
      let y = g.player.pos.y + Math.sin(a) * dist;
      // snap to nearest road centre
      const horiz = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a));
      if (horiz) y = Math.round(y / CELL) * CELL + 24 * (Math.sin(a) > 0 ? 1 : -1);
      else x = Math.round(x / CELL) * CELL + 24 * (Math.cos(a) > 0 ? 1 : -1);
      x = U.clamp(x, ROAD, WORLD - ROAD); y = U.clamp(y, ROAD, WORLD - ROAD);
      if (!W.canDrive(x, y)) continue;
      if (Math.hypot(x - g.player.pos.x, y - g.player.pos.y) < 70) continue;
      const angle = Math.atan2(g.player.pos.y - y, g.player.pos.x - x);
      return { x, y, angle };
    }
    return null;
  }

  function spawnUnit() {
    const sp = unitSpawnPoint();
    if (!sp) return null;
    const car = LL.Vehicles.spawn('police', sp.x, sp.y, sp.angle, { force: true, fuel: 80 });
    if (!car) return null;
    car.driver = 'ai';
    car.ai = null; // pursuit steering instead of lane traffic
    car.siren = true;
    car.police = true;
    const unit = { car, state: 'pursue', officers: 0, timer: 0, targetAngle: sp.angle };
    P.units.push(unit);
    // two officers ride along
    unit.crew = 2;
    return unit;
  }

  function removeUnit(u) {
    if (u.car) { u.car.quest = false; LL.Vehicles.remove(u.car); }
    const i = P.units.indexOf(u); if (i >= 0) P.units.splice(i, 1);
  }

  function spawnOfficerOnFoot(x, y) {
    if (P.officers.length >= 9) return null;
    const av = LL.Chars.police();
    av.setArmed(true);
    const o = {
      av, pos: { x, y }, angle: Math.random() * 6.28, speed: 0, state: 'chase',
      hp: 100, fireT: U.rand(1.4, 0.4), lostT: 0, dead: false, reload: 0, burst: 0,
    };
    av.group.position.set(x, 0, y);
    W.scene.add(av.group);
    P.officers.push(o);
    return o;
  }

  function removeOfficer(o) {
    const i = P.officers.indexOf(o); if (i >= 0) P.officers.splice(i, 1);
    try { W.scene.remove(o.av.group); } catch (e) { }
  }

  /* ------------------------------------------------------------------ damage */
  P.hitOfficer = function (o, dmg) {
    if (o.dead) return;
    o.hp -= dmg;
    o.state = 'chase';
    if (o.hp <= 0) {
      o.dead = true; o.av.dead = true;
      LL.emit('cop:dead');
      P.reportCrime('homicidio', o.pos.x, o.pos.y, 3);
      if (LL.game && LL.game.stats) LL.game.stats.copsDown = (LL.game.stats.copsDown || 0) + 1;
    }
  };

  /* ------------------------------------------------------------------- update */
  let heli = null;
  function updateHeli(dt, px, py) {
    if (P.wanted >= 4) {
      if (!heli) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 1.5), new THREE.MeshLambertMaterial({ color: 0x1c2430 }));
        body.position.y = 0;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 3.2), new THREE.MeshLambertMaterial({ color: 0x1c2430 }));
        tail.position.set(-1.6, 0.2, 0);
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b323c }));
        rotor.position.y = 1.0;
        const spot = new THREE.SpotLight(0xffffff, 2.2, 120, 0.42, 0.5, 1.2);
        spot.position.set(0, -0.6, 0); spot.target.position.set(0, -30, 0);
        g.add(body, tail, rotor, spot, spot.target);
        W.scene.add(g);
        heli = { g, rotor, spot, angle: 0, pos: new THREE.Vector3(px + 60, 60, py + 60) };
      }
      heli.angle += dt * 0.5;
      heli.pos.x = U.damp(heli.pos.x, px + Math.cos(heli.angle) * 55, 0.9, dt);
      heli.pos.z = U.damp(heli.pos.z, py + Math.sin(heli.angle) * 55, 0.9, dt);
      heli.pos.y = U.damp(heli.pos.y, 58 + Math.sin(LL.game.time) * 4, 0.8, dt);
      heli.g.position.copy(heli.pos);
      heli.g.rotation.y = heli.angle + PI / 2;
      heli.rotor.rotation.y += dt * 42;
      heli.spot.target.position.set(px, 0, py);
      heli.spot.target.updateMatrixWorld();
      heli.g.visible = true;
    } else if (heli) {
      W.scene.remove(heli.g); heli = null;
    }
  }

  P.update = function (dt) {
    const g = LL.game;
    if (!g || !g.player) return;
    const px = g.player.pos.x, py = g.player.pos.y;
    const seen = P.canSee(px, py);

    // decay
    if (P.wanted > 0) {
      if (!seen) P.searchT += dt; else P.searchT = 0;
      if (P.searchT > 12 && P.wanted > 0) {
        P.searchT = 0;
        P.wanted = Math.max(0, P.wanted - 1);
        LL.emit('wanted:changed', P.wanted);
        if (P.wanted === 0) {
          LL.notify('Você despistou a polícia.', 'green', 'PROCURADO');
          for (const u of P.units.slice()) removeUnit(u);
        } else LL.notify('A polícia está perdendo seu rastro.', 'gold', 'PROCURADO');
      }
    }

    // dispatch
    P.dispatchT -= dt;
    if (P.wanted > 0 && P.dispatchT <= 0) {
      const wantUnits = P.wanted >= 5 ? 4 : P.wanted >= 4 ? 3 : P.wanted >= 3 ? 2 : 1;
      if (P.units.length < wantUnits) {
        spawnUnit();
        P.dispatchT = P.units.length === 0 ? 1.2 : U.rand(9, 4);
      } else P.dispatchT = 3;
    }

    // units
    for (const u of P.units.slice()) {
      const car = u.car;
      if (!car || car.destroyed) {
        if (car && car.destroyed) { ejectCrew(car, u); removeUnit(u); }
        continue;
      }
      const d = Math.hypot(car.pos.x - px, car.pos.y - py);
      if (d > 340) { removeUnit(u); continue; }
      u.timer -= dt;
      if (d < 22 && Math.abs(car.speed) < 9 && u.crew > 0) {
        // deploy officers
        const a = car.angle + PI / 2;
        for (let k = 0; k < u.crew; k++) {
          const ox = car.pos.x + Math.cos(a) * (1.2 + k * 0.8) * (k ? 1 : -1);
          const oy = car.pos.y + Math.sin(a) * (1.2 + k * 0.8) * (k ? 1 : -1);
          const o = spawnOfficerOnFoot(ox, oy);
          if (o) { o.state = 'chase'; }
        }
        u.crew = 0;
        u.state = 'parked';
      }
      if (u.crew > 0) pursueCar(car, u, dt, px, py);
      else { car.speed = U.damp(car.speed, 0, 2, dt); car.angle = U.dampAngle(car.angle, Math.atan2(py - car.pos.y, px - car.pos.x), 1.5, dt); }
      car.siren = P.wanted > 0 && d < 220;
    }

    // officers
    for (const o of P.officers.slice()) {
      updateOfficer(o, dt, px, py);
      if (o.pos && Math.hypot(o.pos.x - px, o.pos.y - py) > 320) removeOfficer(o);
    }

    updateHeli(dt, px, py);
    updateBust(dt, px, py, seen);
    updateAudio(px, py);

    if (P.wanted === 0 && P.officers.length === 0 && P.units.length === 0) P.heat = Math.max(0, P.heat - dt * 0.1);
  };

  function pursueCar(car, u, dt, px, py) {
    const target = { x: px, y: py };
    const d = Math.hypot(px - car.pos.x, py - car.pos.y);
    let desired = Math.atan2(py - car.pos.y, px - car.pos.x);
    // crude obstacle avoidance
    const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const ahead = 12 + Math.abs(car.speed) * 0.6;
    if (!W.canDrive(car.pos.x + fwd.x * ahead, car.pos.y + fwd.y * ahead)) {
      const l = car.angle + 0.8, r = car.angle - 0.8;
      const canL = W.canDrive(car.pos.x + Math.cos(l) * ahead, car.pos.y + Math.sin(l) * ahead);
      const canR = W.canDrive(car.pos.x + Math.cos(r) * ahead, car.pos.y + Math.sin(r) * ahead);
      if (canL && !canR) desired = l;
      else if (canR && !canL) desired = r;
      else desired = car.angle + (Math.sin(car.angle * 3) > 0 ? 1.2 : -1.2);
    }
    const steer = U.clamp(U.shortAngle(desired - car.angle) * 2.4, -1, 1);
    car.steer = U.damp(car.steer, steer, 10, dt);
    const throttle = d > 14 ? 1 : 0.15;
    car.vx += Math.cos(car.angle) * car.spec.power * throttle * dt * 0.9;
    car.vy += Math.sin(car.angle) * car.spec.power * throttle * dt * 0.9;
    // brake when very close
    if (d < 12) { car.vx *= 0.94; car.vy *= 0.94; }
  }

  function ejectCrew(car, u) {
    for (let k = 0; k < (u.crew || 0); k++) {
      const a = car.angle + PI / 2;
      spawnOfficerOnFoot(car.pos.x + Math.cos(a) * 2, car.pos.y + Math.sin(a) * 2);
    }
    u.crew = 0;
  }

  function updateOfficer(o, dt, px, py) {
    if (o.dead) { o.av.anim(dt, 0); return; }
    const dx = px - o.pos.x, dy = py - o.pos.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx);
    const los = !W.segmentBlocked(o.pos.x, o.pos.y, px, py, 1.4);
    o.av.aimT = d < 45 && los ? 1 : 0;
    o.av.anim(dt, o.speed);

    if (o.state === 'chase') {
      o.angle = U.dampAngle(o.angle, desired, 7, dt);
      const stopDist = d < 20 && los ? 2 : 0;
      const targetSpeed = los && d < 26 ? 1.4 : 4.6;
      o.speed = U.damp(o.speed, d > stopDist + 1.4 ? targetSpeed : 0, 6, dt);
    } else if (o.state === 'search') {
      o.speed = U.damp(o.speed, 1.6, 4, dt);
      o.angle += Math.sin(LL.game.time * 0.9 + o.pos.x * 0.01) * 0.9 * dt;
    }
    let nx = o.pos.x + Math.cos(o.angle) * o.speed * dt;
    let ny = o.pos.y + Math.sin(o.angle) * o.speed * dt;
    if (W.isBlocked(nx, ny, 0.4)) {
      if (!W.isBlocked(nx, o.pos.y, 0.4)) ny = o.pos.y;
      else if (!W.isBlocked(o.pos.x, ny, 0.4)) nx = o.pos.x;
      else { nx = o.pos.x; ny = o.pos.y; o.angle += dt * 2.2; }
    }
    o.pos.x = nx; o.pos.y = ny;
    const y = W.heightAt(o.pos.x, o.pos.y);
    o.av.group.position.set(o.pos.x, y, o.pos.y);
    o.av.group.rotation.y = -o.angle;

    // shooting
    if (d < 46 && los && !o.dead) {
      o.fireT -= dt;
      if (o.fireT <= 0) {
        o.fireT = U.rand(1.9, 0.85) - P.wanted * 0.06;
        o.burst = Math.min(3, 1 + (P.wanted > 2 ? 1 : 0));
        const shots = o.burst;
        for (let k = 0; k < shots; k++) {
          setTimeout(() => {
            if (o.dead) return;
            if (Math.hypot(LL.game.player.pos.x - o.pos.x, LL.game.player.pos.y - o.pos.y) > 55) return;
            const acc = U.clamp(0.62 - d * 0.006, 0.22, 0.6);
            if (Math.random() < acc) {
              LL.game.player.hurt(U.rand(9, 4.5), 'tiro');
              LL.notify('Você foi atingido!', 'red');
            }
            if (LL.Audio) LL.Audio.shot('pistol', o.pos.x, o.pos.y);
            LL.emit('cop:shot', o);
          }, k * 130);
        }
      }
      if (LL.game.player.inVehicle === false) {
        // try to arrest when very close
      }
    }
  }

  /* -------------------------------------------------------------- perception */
  P.canSee = function (px, py) {
    if (P.wanted <= 0) return false;
    const g = LL.game;
    const disguise = g.player.disguised ? 0.55 : 1;
    const inCar = g.player.inVehicle;
    const radius = (inCar ? 165 : 115) * disguise;
    for (const u of P.units) {
      if (!u.car) continue;
      const d = Math.hypot(u.car.pos.x - px, u.car.pos.y - py);
      if (d < radius && !W.segmentBlocked(u.car.pos.x, u.car.pos.y, px, py, 3)) return true;
    }
    for (const o of P.officers) {
      if (o.dead) continue;
      const d = Math.hypot(o.pos.x - px, o.pos.y - py);
      if (d < radius * 0.8 && !W.segmentBlocked(o.pos.x, o.pos.y, px, py, 1.4)) return true;
    }
    return false;
  };

  function updateBust(dt, px, py, seen) {
    const g = LL.game;
    if (P.wanted === 0 || g.player.inVehicle) { P.bustT = 0; return; }
    let close = 0;
    for (const o of P.officers) {
      if (o.dead) continue;
      if (Math.hypot(o.pos.x - px, o.pos.y - py) < 2.6) close++;
    }
    if (close > 0 && g.player.speed < 2.4) {
      P.bustT += dt;
      if (P.bustT > 1.6) {
        P.bustT = 0;
        LL.emit('player:busted');
      }
    } else P.bustT = Math.max(0, P.bustT - dt);
  }

  function updateAudio(px, py) {
    let best = null, bd = 320;
    for (const u of P.units) {
      if (!u.car) continue;
      const d = Math.hypot(u.car.pos.x - px, u.car.pos.y - py);
      if (d < bd) { bd = d; best = u.car; }
    }
    P.sirenCar = best;
    P.sirenDist = bd;
    if (LL.Audio) {
      if (best) {
        const pan = 0;
        LL.Audio.setSiren(U.clamp(1 - bd / 300, 0, 1) * 0.9, pan);
      }
    }
  }

  P.reset = function () { P.clear(); };

  console.log('[police] sistema pronto');
})();
