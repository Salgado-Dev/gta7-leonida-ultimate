/* ============================================================================
   21 · VEHICLES — physics, wheels, damage, fuel, traffic AI, streaming.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const V = LL.Vehicles, W = LL.World;
  const PI = Math.PI, CELL = W.CELL, WORLD = W.WORLD, ROAD = W.ROAD;
  const LANE = 24;

  V.list = [];
  V.playerCar = null;
  V.maxVehicles = 34;
  V._id = 0;

  /* --------------------------------------------------------------- vehicle */
  const SMOKE_TEX = (function () {
    const C = 64, cv = document.createElement('canvas'); cv.width = cv.height = C;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(70,70,75,.85)');
    grd.addColorStop(1, 'rgba(45,45,50,0)');
    g.fillStyle = grd; g.fillRect(0, 0, C, C);
    return new THREE.CanvasTexture(cv);
  })();
  const CONE_TEX = (function () {
    const C = 128, cv = document.createElement('canvas'); cv.width = C; cv.height = C;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, C);
    grd.addColorStop(0, 'rgba(255,240,200,.75)');
    grd.addColorStop(0.45, 'rgba(255,230,170,.25)');
    grd.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = grd; g.fillRect(0, 0, C, C);
    return new THREE.CanvasTexture(cv);
  })();

  class Vehicle {
    constructor(type, x, y, angle, opts) {
      opts = opts || {};
      this.id = ++V._id;
      this.type = type;
      this.spec = V.CATALOG[type] || V.CATALOG.sedan;
      this.cat = this.spec.cat;
      this.color = opts.color || U.pick(this.spec.colors);
      this.pos = { x, y };
      this.angle = angle || 0;
      this.vx = 0; this.vy = 0;
      this.speed = 0; // forward speed, m/s
      this.steer = 0;
      this.wheelSpin = 0;
      this.hp = opts.hp !== undefined ? opts.hp : 100;
      this.fuel = opts.fuel !== undefined ? opts.fuel : (this.spec.tank || 0);
      this.locked = !!opts.locked;
      this.alarm = !!opts.alarm;
      this.alarmTimer = 0;
      this.tracker = !!opts.tracker;
      this.owned = !!opts.owned;
      this.parked = !!opts.parked;
      this.ai = null;
      this.driver = null; // 'player' | 'ai' | null
      this.boat = !!this.spec.water;
      this.scooter = this.spec.cat === 'scooter';
      this.radius = this.spec.len * 0.42;
      this.lights = true;
      this.siren = false;
      this.sirenPhase = 0;
      this.damageLevel = 0;
      this.smokeT = 0;
      this.destroyed = false;
      this.lastHit = 0;
      this.hull = 1; // boats
      this.bob = Math.random() * 6.28;
      this.height = 0;
      this._build(opts);
    }

    _build(opts) {
      const m = V.buildModel(this.type, this.color, opts.accent);
      this.group = m.group; this.bodyMesh = m.body; this.glassMesh = m.glass;
      const spec = this.spec;
      this.group.position.set(this.pos.x, 0, this.pos.y);
      this.group.rotation.y = -this.angle;
      W.scene.add(this.group);

      // wheels
      this.wheels = []; this.frontWheels = [];
      if (spec.wheelR > 0) {
        const r = spec.wheelR, wdt = 0.26;
        const wg = V.wheelGeo(r, wdt), rg = V.rimGeo(r);
        const wx = spec.len * 0.31, wz = spec.wid * 0.5 - 0.02, wy = r;
        const layout = [[wx, wz, 1], [wx, -wz, 1], [-wx, wz, 0], [-wx, -wz, 0]];
        for (const [px, pz, front] of layout) {
          const wm = new THREE.Mesh(wg, V.mats.wheelMat);
          wm.position.set(px, wy, pz); wm.castShadow = true;
          const rim = new THREE.Mesh(rg, V.mats.rimMat);
          rim.position.set(px, wy, pz + (pz > 0 ? wdt * 0.52 : -wdt * 0.52));
          rim.castShadow = false;
          this.group.add(wm, rim);
          this.wheels.push({ mesh: wm, rim, front: !!front, baseZ: pz });
          if (front) this.frontWheels.push(this.wheels[this.wheels.length - 1]);
        }
      }

      // headlight cone (only meaningful at night, cheap single quad)
      if (!this.boat) {
        const cone = new THREE.Mesh(
          new THREE.PlaneGeometry(16, 26),
          new THREE.MeshBasicMaterial({ map: CONE_TEX, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        cone.rotation.x = -PI / 2;
        cone.position.set(spec.len * 0.5 + 10, 0.12, 0);
        cone.renderOrder = 4;
        this.group.add(cone);
        this.cone = cone;
      }

      // damage smoke sprite
      this.smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_TEX, transparent: true, opacity: 0, depthWrite: false }));
      this.smoke.scale.set(4, 4, 1);
      this.smoke.position.set(spec.len * 0.44, 1.3, 0);
      this.group.add(this.smoke);

      if (this.spec.police) {
        this.lightBarL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), V.mats.blueMat);
        this.lightBarR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), V.mats.redMat);
        this.lightBarL.position.set(-0.02, 1.62, 0.3);
        this.lightBarR.position.set(-0.02, 1.62, -0.3);
        this.group.add(this.lightBarL, this.lightBarR);
      }
    }

    get kmh() { return Math.abs(this.speed) * 3.6; }
    get forward() { return { x: Math.cos(this.angle), y: Math.sin(this.angle) }; }

    setLights(on) {
      this.lights = on;
      if (this.cone) this.cone.material.opacity = on ? 0.5 : 0;
    }

    damage(n, x, y) {
      if (this.destroyed) return;
      this.hp = U.clamp(this.hp - n, 0, 100);
      this.damageLevel = 1 - this.hp / 100;
      if (this.alarm) { this.alarmTimer = Math.max(this.alarmTimer, 4.5); if (LL.Audio) LL.Audio.alarm(this.pos.x, this.pos.y); }
      if (this.hp <= 0) { this.hp = 0; this.blowUp(); }
    }

    blowUp() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.speed *= 0.2;
      if (typeof LL.game !== 'undefined' && LL.game && LL.game.player && this.driver === 'player') {
        LL.emit('vehicle:destroyed', this);
      }
      try {
        const f = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        f.position.set(this.pos.x, 1.4, this.pos.y); f.scale.setScalar(2);
        W.scene.add(f);
        const start = performance.now();
        const tick = () => {
          const t = (performance.now() - start) / 700;
          f.scale.setScalar(2 + t * 12);
          f.material.opacity = Math.max(0, 0.9 * (1 - t));
          if (t < 1) requestAnimationFrame(tick); else W.scene.remove(f);
        };
        tick();
      } catch (e) { }
      if (LL.Audio) LL.Audio.crash(this.pos.x, this.pos.y, 26);
    }

    refuel(amount) {
      this.fuel = U.clamp(this.fuel + amount, 0, this.spec.tank);
    }

    seatPositions() {
      const L = this.spec.len, Wd = this.spec.wid;
      return [
        { x: L * 0.08, y: 0, z: Wd * 0.26 },
        { x: L * 0.08, y: 0, z: -Wd * 0.26 },
        { x: -L * 0.2, y: 0, z: Wd * 0.26 },
        { x: -L * 0.2, y: 0, z: -Wd * 0.26 },
      ];
    }

    /* ---------------------------------------------------------------- physics */
    update(dt, isPlayer) {
      const spec = this.spec;
      let throttle = 0, brake = 0, steerIn = 0;

      if (isPlayer) {
        const I = LL.Input;
        throttle = I.down('KeyW') || I.down('ArrowUp') ? 1 : 0;
        brake = I.down('KeyS') || I.down('ArrowDown') ? 1 : 0;
        steerIn = (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0) - (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0);
        if (I.down('Space')) brake = 1;
        if (I.down('ShiftLeft') || I.down('ShiftRight')) throttle *= 1;
      } else if (this.ai) {
        const a = this._aiDrive(dt);
        throttle = a.throttle; brake = a.brake; steerIn = a.steer;
      }

      const noFuel = spec.tank > 0 && this.fuel <= 0;
      if (noFuel) throttle = 0;
      if (this.destroyed) throttle = 0;

      const fwdX = Math.cos(this.angle), fwdY = Math.sin(this.angle);
      const rightX = -fwdY, rightY = fwdX;
      let vf = this.vx * fwdX + this.vy * fwdY;
      let vl = this.vx * rightX + this.vy * rightY;

      const powerFactor = 1 - this.damageLevel * 0.45;
      const accel = spec.power * powerFactor * throttle;
      vf += accel * dt;

      // brake / reverse
      const braking = brake > 0;
      if (braking) {
        if (vf > 0.6) vf = Math.max(0, vf - spec.brake * dt);
        else vf -= spec.power * 0.55 * brake * dt;
      }
      // drag + rolling resistance
      vf -= vf * Math.abs(vf) * (this.boat ? 0.012 : 0.0036) * dt;
      vf -= vf * (this.boat ? 0.55 : 0.42) * dt;

      const maxV = spec.maxSpeed * (1 - this.damageLevel * 0.32);
      if (vf > maxV) vf = maxV;
      if (vf < -maxV * 0.35) vf = -maxV * 0.35;

      // lateral grip: boats slide, sports cars drift a little
      const gripK = spec.grip * (this.boat ? 1.7 : 1) * (1 - this.damageLevel * 0.25);
      vl *= Math.exp(-gripK * dt);
      if (!this.boat && Math.abs(vf) > 8) vl += steerIn * vf * 0.055 * dt;
      if (this.boat) vl += steerIn * vf * 0.09 * dt;

      // steer
      const speedFactor = U.clamp(Math.abs(vf) / 9, 0, 1);
      const steerRate = (this.scooter ? 2.5 : this.boat ? 0.95 : 1.75) * speedFactor / (1 + Math.abs(vf) * (this.boat ? 0.02 : 0.028));
      this.steer = U.damp(this.steer, steerIn, 9, dt);
      this.angle += this.steer * steerRate * dt * (vf < -0.4 ? -1 : 1);
      if (this.angle > PI) this.angle -= PI * 2;
      if (this.angle < -PI) this.angle += PI * 2;

      this.vx = fwdX * vf + rightX * vl;
      this.vy = fwdY * vf + rightY * vl;
      this.speed = vf;

      // fuel
      if (spec.tank > 0) {
        const burn = spec.burn * (0.16 + Math.abs(throttle) * 0.9 + Math.abs(vf) * 0.012) * dt / 60;
        this.fuel = Math.max(0, this.fuel - burn);
        if (this.fuel < spec.tank * 0.12 && !this._fuelWarned && isPlayer) { this._fuelWarned = true; LL.notify('Combustível na reserva — procure um posto.', 'gold', 'VEÍCULO'); }
        if (this.fuel > spec.tank * 0.2) this._fuelWarned = false;
      }

      // integration + collision
      let nx = this.pos.x + this.vx * dt;
      let ny = this.pos.y + this.vy * dt;
      const test = this.boat ? (x, y) => W.canBoat(x, y) : (x, y) => W.canDrive(x, y) && !this._otherCarAt(x, y);
      if (!test(nx, ny)) {
        const canX = test(nx, this.pos.y), canY = test(this.pos.x, ny);
        if (canX) { ny = this.pos.y; this.vy *= -0.15; }
        else if (canY) { nx = this.pos.x; this.vx *= -0.15; }
        else {
          nx = this.pos.x; ny = this.pos.y;
          const impact = Math.abs(this.speed);
          this.vx *= -0.22; this.vy *= -0.22; this.speed *= -0.18;
          if (impact > 6) this._collide(impact);
        }
        if (Math.abs(this.speed) > 7) this._collide(Math.abs(this.speed));
      }
      this.pos.x = U.clamp(nx, -50, W.WATER_END);
      this.pos.y = U.clamp(ny, -50, WORLD + 50);

      // ground height / water bobbing
      if (this.boat) {
        this.bob += dt * (1.4 + Math.abs(vf) * 0.06);
        this.height = Math.sin(this.bob) * 0.22 + Math.sin(this.bob * 2.1) * 0.08;
        this.group.rotation.z = Math.sin(this.bob * 0.8) * 0.035;
        this.group.rotation.x = Math.cos(this.bob * 1.1) * 0.03 + vf * 0.004;
      } else {
        this.height = W.heightAt(this.pos.x, this.pos.y);
        if (this.height > 1.2) this.height = 0;
      }
      this.group.position.set(this.pos.x, this.height + (this.boat ? 0.2 : 0), this.pos.y);
      this.group.rotation.y = -this.angle;
      // body roll on turns
      if (!this.boat) {
        const roll = U.clamp(-this.steer * Math.abs(vf) * 0.006, -0.08, 0.08);
        this.group.rotation.z = U.damp(this.group.rotation.z, roll, 6, dt);
        this.group.rotation.x = U.damp(this.group.rotation.x, -U.clamp(vf * 0.0016, -0.03, 0.03), 4, dt);
      }

      // wheels
      this.wheelSpin -= (vf / (spec.wheelR || 0.34)) * dt;
      for (const w of this.wheels) {
        w.mesh.rotation.set(0, w.front ? this.steer * 0.5 : 0, this.wheelSpin);
        w.rim.rotation.set(0, 0, this.wheelSpin);
        w.mesh.visible = true;
      }

      // lights & smoke
      const night = W.env ? W.env.night : 0;
      if (this.cone) this.cone.material.opacity = (this.lights || night > 0.4) ? (this.driver ? 0.55 : 0.3) + night * 0.25 : 0;
      const smokeAmt = this.hp < 45 && !this.destroyed ? (1 - this.hp / 45) : this.destroyed ? 0.7 : 0;
      if (smokeAmt > 0.05) {
        this.smokeT += dt;
        this.smoke.material.opacity = smokeAmt * (0.5 + Math.sin(this.smokeT * 6) * 0.2);
        this.smoke.position.y = 1.25 + Math.sin(this.smokeT * 2) * 0.12;
        this.smoke.scale.setScalar(2.4 + smokeAmt * 3);
      } else if (this.smoke.material.opacity > 0) this.smoke.material.opacity = 0;

      if (this.spec.police && this.lightBarL) {
        this.sirenPhase += dt * (this.siren ? 9 : 0);
        const on = this.siren ? (Math.sin(this.sirenPhase) > 0) : false;
        this.lightBarL.material = on ? V.mats.blueMat : V.mats.redMat;
        this.lightBarR.material = on ? V.mats.redMat : V.mats.blueMat;
      }

      // alarm beep
      if (this.alarmTimer > 0) {
        this.alarmTimer -= dt;
        if (this.alarmTimer <= 0 && this.alarm) this.alarm = false;
      }
    }

    _collide(strength) {
      const now = performance.now();
      if (now - this.lastHit < 220) return;
      this.lastHit = now;
      const dmg = U.clamp(strength * 0.9, 0.5, 34);
      this.damage(dmg);
      if (LL.Audio) LL.Audio.crash(this.pos.x, this.pos.y, strength);
      if (this.driver === 'player' && LL.game && LL.game.player) LL.game.player.hurt(dmg * 0.32, 'colisão');
      LL.emit('vehicle:crash', this, strength);
    }

    _otherCarAt(x, y) {
      if (!V.list) return false;
      for (let i = 0; i < V.list.length; i++) {
        const o = V.list[i];
        if (o === this || o.boat) continue;
        if (Math.abs(o.pos.x - x) < o.radius * 0.8 && Math.abs(o.pos.y - y) < o.radius * 0.8) return true;
      }
      return false;
    }

    /* ------------------------------------------------------------------- AI */
    _aiDrive(dt) {
      const a = this.ai;
      if (!a || this.destroyed) return { throttle: 0, brake: 1, steer: 0 };
      const fwd = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      // waypoint on the current lane
      let tx, ty;
      if (a.axis === 0) { tx = a.next; ty = a.lane; }
      else { tx = a.lane; ty = a.next; }
      const dx = tx - this.pos.x, dy = ty - this.pos.y;
      const dist = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      let steer = U.clamp(U.shortAngle(desired - this.angle) * 1.9, -1, 1);

      // reached the waypoint → advance / turn
      if (dist < 12) {
        const cross = a.axis === 0 ? Math.round(this.pos.x / CELL) : Math.round(this.pos.y / CELL);
        if (Math.abs(cross * CELL - (a.axis === 0 ? this.pos.x : this.pos.y)) < 34) {
          // at an intersection: maybe turn
          const r = Math.random();
          if (r < 0.14) { a.axis = 1 - a.axis; a.dir = -a.dir; }
          else if (r < 0.24) { a.axis = 1 - a.axis; a.dir = Math.random() < 0.5 ? 1 : -1; }
        }
        if (a.axis === 0) {
          a.next = U.clamp(a.next + a.dir * CELL, ROAD, WORLD - ROAD);
          a.lane = Math.round(a.lane / CELL) * CELL + a.dir * LANE;
          if (a.lane < ROAD * 0.5 || a.lane > WORLD - ROAD * 0.5) a.dir *= -1;
        } else {
          a.next = U.clamp(a.next + a.dir * CELL, ROAD, WORLD - ROAD);
          a.lane = Math.round(a.lane / CELL) * CELL - a.dir * LANE;
          if (a.lane < ROAD * 0.5 || a.lane > WORLD - ROAD * 0.5) a.dir *= -1;
        }
        // keep lane snapped to a real road line
        a.lane = U.clamp(Math.round(a.lane / CELL) * CELL + (a.axis === 0 ? a.dir * LANE : -a.dir * LANE), ROAD * 0.5, WORLD - ROAD * 0.5);
        a.next = U.clamp(Math.round(a.next / CELL) * CELL, ROAD * 0.5, WORLD - ROAD * 0.5);
      }

      // traffic signal check
      let brake = 0;
      const axis = a.axis, dir = a.dir;
      const along = axis === 0 ? this.pos.x : this.pos.y;
      const roadLine = Math.round((axis === 0 ? this.pos.y : this.pos.x) / CELL) * CELL;
      const i = axis === 0 ? Math.round((a.next) / CELL) : Math.round(roadLine / CELL);
      const j = axis === 0 ? Math.round(roadLine / CELL) : Math.round((a.next) / CELL);
      if (i > 0 && j > 0 && i < W.GRID && j < W.GRID) {
        const state = W.signalState(i, j, axis === 0 ? 0 : 1, LL.game && LL.game.time ? LL.game.time : 0);
        const toStop = (a.next - along) * dir;
        if (state !== 'green' && toStop > 0 && toStop < 30) brake = state === 'red' ? 1 : 0.6;
      }

      // obstacle ahead (other cars / player on foot)
      const ahead = 15 + Math.abs(this.speed) * 0.55;
      const px = this.pos.x + fwd.x * ahead, py = this.pos.y + fwd.y * ahead;
      if (!W.canDrive(px, py)) brake = Math.max(brake, 0.75);
      if (this._otherCarAt(px, py)) brake = Math.max(brake, 1);
      const pl = LL.game && LL.game.player;
      if (pl && !pl.inVehicle) {
        const d = Math.hypot(pl.pos.x - px, pl.pos.y - py);
        if (d < 7) brake = 1;
      }
      const throttle = brake > 0.5 ? 0 : U.clamp((dist - 6) / 26, 0.35, 1);
      return { throttle, brake, steer };
    }

    dispose() {
      try {
        W.scene.remove(this.group);
        this.group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material !== V.mats.bodyMat && o.material !== V.mats.glassMat && o.material !== V.mats.wheelMat && o.material !== V.mats.rimMat) {
            if (o.material.map && o.material.map !== SMOKE_TEX && o.material.map !== CONE_TEX) { }
            o.material.dispose();
          }
        });
      } catch (e) { }
    }
  }
  V.Vehicle = Vehicle;

  /* --------------------------------------------------------------- spawning */
  V.spawn = function (type, x, y, angle, opts) {
    opts = opts || {};
    if (V.list.length >= V.maxVehicles && !opts.force) {
      // recycle the furthest parked/traffic car
      let far = null, fd = -1;
      for (const c of V.list) {
        if (c.driver) continue;
        const d = Math.hypot(c.pos.x - x, c.pos.y - y);
        if (d > fd) { fd = d; far = c; }
      }
      if (far && fd > 200) V.remove(far);
      else if (V.list.length >= V.maxVehicles + 12) return null;
    }
    const car = new Vehicle(type, x, y, angle, opts);
    V.list.push(car);
    return car;
  };

  V.remove = function (car) {
    const i = V.list.indexOf(car);
    if (i >= 0) V.list.splice(i, 1);
    if (V.playerCar === car) V.playerCar = null;
    car.dispose();
  };

  V.clearTraffic = function () {
    for (const c of V.list.slice()) if (!c.owned && c.driver !== 'player' && !c.quest) V.remove(c);
  };

  function randomLaneCar(nearX, nearY, minD, maxD) {
    const axis = Math.random() < 0.5 ? 0 : 1;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const base = axis === 0 ? nearY : nearX;
    const roadIdx = Math.round((base + (Math.random() - 0.5) * (maxD * 2)) / CELL);
    let line = roadIdx * CELL;
    line = U.clamp(line, ROAD * 0.5, WORLD - ROAD * 0.5);
    const along = U.clamp((axis === 0 ? nearX : nearY) + dir * U.rand(maxD, minD), ROAD, WORLD - ROAD);
    const lane = line + (axis === 0 ? dir * LANE : -dir * LANE);
    const x = axis === 0 ? along : lane;
    const y = axis === 0 ? lane : along;
    if (!W.canDrive(x, y)) return null;
    const angle = axis === 0 ? (dir > 0 ? 0 : PI) : (dir > 0 ? PI / 2 : -PI / 2);
    return { x, y, angle, axis, dir, lane, next: Math.round(along / CELL) * CELL + dir * CELL };
  }

  V.spawnTraffic = function (count) {
    const g = LL.game;
    if (!g || !g.player) return 0;
    let made = 0;
    for (let n = 0; n < count * 3 && made < count; n++) {
      const data = randomLaneCar(g.player.pos.x, g.player.pos.y, 70, 230);
      if (!data) continue;
      if (V.list.some((c) => Math.hypot(c.pos.x - data.x, c.pos.y - data.y) < 14)) continue;
      const type = U.chance(0.08) ? 'police' : U.chance(0.1) ? 'taxi' : U.pick(['sedan', 'sedan', 'compact', 'sports', 'suv', 'van', 'pickup']);
      const car = V.spawn(type, data.x, data.y, data.angle, { fuel: 60 });
      if (!car) break;
      car.ai = { axis: data.axis, dir: data.dir, lane: data.lane, next: data.next };
      car.driver = 'ai';
      car.parked = false;
      made++;
    }
    return made;
  };

  V.spawnParkedNear = function (count) {
    const g = LL.game;
    if (!g || !g.player) return 0;
    const spots = (W.parkingSpots || []).slice();
    let made = 0;
    for (let n = 0; n < spots.length && made < count; n++) {
      const p = spots[(Math.random() * spots.length) | 0];
      const d = Math.hypot(p.x - g.player.pos.x, p.y - g.player.pos.y);
      if (d < 55 || d > 260) continue;
      if (V.list.some((c) => Math.hypot(c.pos.x - p.x, c.pos.y - p.y) < 16)) continue;
      if (!W.canDrive(p.x, p.y)) continue;
      const type = U.chance(0.05) ? 'sports' : U.chance(0.08) ? 'van' : U.pick(['sedan', 'compact', 'suv', 'pickup', 'taxi', 'sedan']);
      const car = V.spawn(type, p.x, p.y, p.a || 0, { fuel: U.rand(58, 24), parked: true, locked: Math.random() < 0.34, alarm: Math.random() < 0.42 });
      if (!car) break;
      made++;
    }
    return made;
  };

  V.spawnBoat = function (x, y, angle, type) {
    const car = V.spawn(type || (Math.random() < 0.25 ? 'speedboat' : 'boat'), x, y, angle, { fuel: 80, force: true });
    return car;
  };

  /* ------------------------------------------------------------------ query */
  V.nearest = function (x, y, radius, filter) {
    let best = null, bd = radius;
    for (const c of V.list) {
      if (filter && !filter(c)) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  V.atPoint = function (x, y, r) {
    return V.list.find((c) => Math.hypot(c.pos.x - x, c.pos.y - y) < (r || 4));
  };
  V.playerVehicle = function () {
    const p = LL.game && LL.game.player;
    if (!p || !p.vehicle) return null;
    return p.vehicle;
  };

  /* ----------------------------------------------------------------- update */
  let spawnTimer = 0;
  V.update = function (dt) {
    const g = LL.game;
    const px = g && g.player ? g.player.pos.x : WORLD / 2;
    const py = g && g.player ? g.player.pos.y : WORLD / 2;
    for (let i = V.list.length - 1; i >= 0; i--) {
      const car = V.list[i];
      const d = Math.hypot(car.pos.x - px, car.pos.y - py);
      const isPlayer = car.driver === 'player';
      if (!isPlayer && !car.owned && !car.quest && (d > 560 || car.destroyed && d > 120)) {
        V.remove(car); continue;
      }
      // LOD: freeze far traffic physics, keep player
      if (!isPlayer && d > 320) {
        if (car.ai) {
          // cheap straight-line advancement so they don't look frozen when approached
          car.pos.x += Math.cos(car.angle) * 6 * dt;
          car.pos.y += Math.sin(car.angle) * 6 * dt;
          if (!W.canDrive(car.pos.x, car.pos.y)) { car.pos.x -= Math.cos(car.angle) * 6 * dt; car.pos.y -= Math.sin(car.angle) * 6 * dt; car.angle += PI; }
          car.group.position.set(car.pos.x, car.height, car.pos.y);
          car.group.rotation.y = -car.angle;
        }
        continue;
      }
      try { car.update(dt, isPlayer); } catch (e) { LL.reportError(e, 'vehicle.update'); }
    }
    // streaming
    spawnTimer -= dt;
    if (spawnTimer <= 0 && g && g.started) {
      spawnTimer = 2.2;
      const trafficTarget = LL.Settings.quality === 'low' ? 6 : LL.Settings.quality === 'medium' ? 10 : 14;
      let traffic = 0, parked = 0;
      for (const c of V.list) { if (c.driver === 'ai') traffic++; else if (c.parked) parked++; }
      if (traffic < trafficTarget) V.spawnTraffic(Math.min(4, trafficTarget - traffic));
      if (parked < 8) V.spawnParkedNear(Math.min(3, 8 - parked));
    }
  };

  V.updateHUD = function () {
    const car = V.playerCar;
    if (!car) return null;
    return { kmh: Math.round(car.kmh), fuel: car.fuel, tank: car.spec.tank, hp: car.hp, name: car.spec.name, gear: car.speed < -0.5 ? 'R' : Math.abs(car.speed) < 0.4 ? 'N' : 'D' };
  };

  console.log('[vehicles] sistema pronto —', Object.keys(V.CATALOG).length, 'modelos');
})();
