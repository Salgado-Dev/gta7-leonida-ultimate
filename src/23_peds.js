/* ============================================================================
   23 · PEDESTRIANS — streamed crowd, block patrols, panic, witnesses, corpses.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, Peds = (LL.Peds = { list: [], max: 20, id: 0 });
  const PI = Math.PI;

  const NAMES = ['Marisol', 'Tico', 'Dena', 'Rui', 'Yara', 'Bruno', 'Célia', 'Nando', 'Iris', 'Zeca', 'Lola', 'Kiko', 'Soraia', 'Davi', 'Nina', 'Beto'];

  function pickBlockNear(x, y, minD, maxD) {
    const blocks = W.blocks;
    if (!blocks || !blocks.length) return null;
    for (let n = 0; n < 26; n++) {
      const b = blocks[(Math.random() * blocks.length) | 0];
      const d = Math.hypot(b.center.x - x, b.center.y - y);
      if (d >= minD && d <= maxD && b.zone !== 'rural') return b;
    }
    return null;
  }

  Peds.spawnNear = function (minD, maxD) {
    const g = LL.game;
    if (!g || !g.player) return null;
    if (Peds.list.length >= Peds.max) return null;
    const b = pickBlockNear(g.player.pos.x, g.player.pos.y, minD || 30, maxD || 150);
    if (!b) return null;
    const loop = b.loop;
    const idx = U.rint(0, loop.length - 1);
    const p = loop[idx];
    const jx = U.rand(8, -8), jy = U.rand(8, -8);
    const x = p.x + jx, y = p.y + jy;
    if (W.isBlocked(x, y, 0.4)) return null;
    const av = LL.Chars.create({ variant: U.rint(0, LL.Chars.VARIANTS.length - 1), longHair: Math.random() < 0.4 });
    const ped = {
      id: ++Peds.id, av, pos: { x, y }, angle: Math.random() * 6.28,
      speed: 0, baseSpeed: U.rand(1.9, 1.2), state: 'walk', timer: U.rand(6, 1),
      block: b, wp: idx, target: loop[(idx + 1) % loop.length], hp: 100, dead: false,
      name: U.pick(NAMES), fleeFrom: null, chatter: 0, downT: 0,
    };
    av.group.position.set(x, 0, y);
    av.group.rotation.y = -ped.angle;
    W.scene.add(av.group);
    Peds.list.push(ped);
    return ped;
  };

  Peds.remove = function (ped) {
    const i = Peds.list.indexOf(ped); if (i >= 0) Peds.list.splice(i, 1);
    try { W.scene.remove(ped.av.group); } catch (e) { }
  };

  Peds.nearest = function (x, y, r) {
    let best = null, bd = r || 4;
    for (const p of Peds.list) {
      if (p.dead) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  Peds.scare = function (x, y, radius, opts) {
    opts = opts || {};
    let n = 0;
    for (const p of Peds.list) {
      if (p.dead) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.y - y);
      if (d < radius) {
        p.state = 'flee';
        p.timer = U.rand(7, 3.5);
        p.fleeFrom = { x, y };
        p.speed = p.baseSpeed * U.rand(3.4, 2.2);
        n++;
        if (opts.witness !== false && Math.random() < 0.35 && LL.Police && LL.Police.reportCrime) {
          LL.Police.reportCrime(opts.crime || 'distúrbio', x, y, 1 + (Math.random() < 0.3 ? 1 : 0));
        }
      }
    }
    return n;
  };

  Peds.hit = function (ped, dmg, fromX, fromY) {
    if (ped.dead) return;
    ped.hp -= dmg;
    ped.state = 'flee'; ped.timer = 5;
    if (fromX !== undefined) ped.fleeFrom = { x: fromX, y: fromY };
    ped.speed = ped.baseSpeed * 3;
    if (ped.hp <= 0) Peds.kill(ped, fromX, fromY);
    else {
      try { LL.Audio.hurt(); } catch (e) { }
      Peds.scare(ped.pos.x, ped.pos.y, 22, { crime: 'tiros' });
    }
  };

  Peds.kill = function (ped, fx, fy) {
    if (ped.dead) return;
    ped.dead = true; ped.state = 'dead';
    ped.av.dead = true; ped.av.baseY = 0;
    ped.downT = 0;
    if (LL.game && LL.game.stats) LL.game.stats.pedsHurt = (LL.game.stats.pedsHurt || 0) + 1;
    LL.emit('ped:dead', ped);
  };

  Peds.knockDown = function (ped, fx, fy, force) {
    if (ped.dead) return;
    ped.state = 'down'; ped.timer = 2.6;
    ped.av.dead = false;
    ped.speed = 0;
    try { LL.Audio.impact(ped.pos.x, ped.pos.y, 0.8); } catch (e) { }
    Peds.hit(ped, force || 18, fx, fy);
  };

  /* ------------------------------------------------------------------- update */
  let spawnT = 0;
  Peds.update = function (dt) {
    const g = LL.game;
    if (!g || !g.player) return;
    const px = g.player.pos.x, py = g.player.pos.y;

    spawnT -= dt;
    const target = LL.Settings.quality === 'low' ? 9 : LL.Settings.quality === 'medium' ? 14 : Peds.max;
    if (spawnT <= 0 && Peds.list.length < target) {
      spawnT = 0.7;
      Peds.spawnNear(26, 120);
    }

    for (let i = Peds.list.length - 1; i >= 0; i--) {
      const p = Peds.list[i];
      const d = Math.hypot(p.pos.x - px, p.pos.y - py);
      if (d > 230 || (p.dead && p.downT > 26)) { Peds.remove(p); continue; }
      try { updatePed(p, dt, d); } catch (e) { LL.reportError(e, 'ped'); }
    }
  };

  function updatePed(p, dt, distToPlayer) {
    if (p.dead) {
      p.downT += dt;
      p.av.anim(dt, 0);
      return;
    }
    p.timer -= dt;
    const g = LL.game;
    let moveSpeed = 0;
    let desired = p.angle;

    if (p.state === 'walk' || p.state === 'idle') {
      if (p.state === 'idle') {
        p.speed = U.damp(p.speed, 0, 6, dt);
        if (p.timer <= 0) { p.state = 'walk'; p.timer = U.rand(9, 4); }
        // occasional look around
        p.angle += Math.sin(performance.now() * 0.0004 + p.id) * 0.004;
      } else {
        const t = p.target || p.block.loop[0];
        const dx = t.x - p.pos.x, dy = t.y - p.pos.y;
        if (Math.hypot(dx, dy) < 4) {
          p.wp = (p.wp + 1) % p.block.loop.length;
          p.target = p.block.loop[p.wp];
          if (Math.random() < 0.12) { p.state = 'idle'; p.timer = U.rand(4, 1.2); }
        }
        desired = Math.atan2(dy, dx);
        p.speed = U.damp(p.speed, p.baseSpeed, 3, dt);
      }
    } else if (p.state === 'flee') {
      if (p.fleeFrom) {
        desired = Math.atan2(p.pos.y - p.fleeFrom.y, p.pos.x - p.fleeFrom.x);
        if (!isFinite(desired)) desired = p.angle;
      }
      p.speed = U.damp(p.speed, p.baseSpeed * 3.1, 4, dt);
      if (p.timer <= 0) { p.state = 'walk'; p.speed = p.baseSpeed; p.timer = 8; p.fleeFrom = null; }
    } else if (p.state === 'down') {
      p.speed = U.damp(p.speed, 0, 10, dt);
      p.av.group.rotation.z = U.damp(p.av.group.rotation.z, 1.3, 8, dt);
      if (p.timer <= 0) {
        p.state = 'flee'; p.timer = 4;
        p.av.group.rotation.z = 0;
        p.hp = Math.max(10, p.hp);
      }
    } else if (p.state === 'watch') {
      p.speed = U.damp(p.speed, 0, 5, dt);
      if (p.timer <= 0) { p.state = 'walk'; p.timer = 6; }
    }

    // steering toward desired angle
    p.angle = U.dampAngle(p.angle, desired, 6, dt);
    const fwdX = Math.cos(p.angle), fwdY = Math.sin(p.angle);
    let nx = p.pos.x + fwdX * p.speed * dt;
    let ny = p.pos.y + fwdY * p.speed * dt;

    if (W.isBlocked(nx, ny, 0.34) && p.state !== 'down') {
      // slide or pick a new waypoint
      if (!W.isBlocked(nx, p.pos.y, 0.34)) { ny = p.pos.y; }
      else if (!W.isBlocked(p.pos.x, ny, 0.34)) { nx = p.pos.x; }
      else {
        if (p.block && p.state === 'walk') {
          p.wp = (p.wp + 1) % p.block.loop.length;
          p.target = p.block.loop[p.wp];
        }
        p.angle += U.rand(2.2, 1.2) * (Math.random() < 0.5 ? -1 : 1);
        nx = p.pos.x; ny = p.pos.y;
      }
    }
    p.pos.x = nx; p.pos.y = ny;
    moveSpeed = p.speed;

    // push away from the player so we can't walk through them
    if (g.player && !g.player.inVehicle && distToPlayer < 0.95) {
      const a = Math.atan2(p.pos.y - g.player.pos.y, p.pos.x - g.player.pos.x);
      p.pos.x += Math.cos(a) * 0.03; p.pos.y += Math.sin(a) * 0.03;
    }
    // vehicles knock pedestrians down
    if (LL.Vehicles.list) {
      for (const car of LL.Vehicles.list) {
        if (Math.abs(car.speed) < 4) continue;
        if (Math.hypot(car.pos.x - p.pos.x, car.pos.y - p.pos.y) < car.radius + 0.5) {
          Peds.knockDown(p, car.pos.x, car.pos.y, Math.min(60, Math.abs(car.speed) * 2.2));
          if (car.driver === 'player') LL.Police && LL.Police.reportCrime && LL.Police.reportCrime('atropelamento', p.pos.x, p.pos.y, 1);
          break;
        }
      }
    }

    const y = W.heightAt(p.pos.x, p.pos.y);
    p.av.baseY = y;
    p.av.group.position.set(p.pos.x, y + p.av.group.position.y * 0, p.pos.y);
    p.av.group.rotation.y = -p.angle;
    p.av.aimT = 0;
    p.av.anim(dt, moveSpeed);
    p.av.group.position.y = y + (p.state === 'down' ? 0.1 : 0) + p.av.group.position.y - 0;
    if (p.state === 'down') p.av.group.rotation.z = U.damp(p.av.group.rotation.z, 1.35, 8, dt);
    else if (!p.dead) p.av.group.rotation.z = U.damp(p.av.group.rotation.z, 0, 8, dt);
  }

  Peds.reset = function () {
    for (const p of Peds.list.slice()) Peds.remove(p);
    Peds.list.length = 0;
  };

  console.log('[peds] sistema pronto');
})();
