/* ============================================================================
   22 · CHARACTERS — shared low-poly humanoid rig, variants, procedural animation.
   Faces +X. Feet at y = 0. Height ≈ 1.8 m.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const Ch = (LL.Chars = {});
  const V = LL.Vehicles;
  const PI = Math.PI;

  const personMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  Ch.personMat = personMat;

  const SKIN = ['#c98a63', '#8a5a3b', '#e0ab84', '#6d432c', '#d99b74', '#a9744e'];
  const HAIR = ['#1a1410', '#3a2418', '#6b4a26', '#111214', '#a5732f', '#4b2f1e', '#d8c08a'];

  const OUTFITS = [
    { shirt: '#2f6f8f', pants: '#2b3240', shoes: '#1b1e22', hat: null },
    { shirt: '#c85a6a', pants: '#e2dccb', shoes: '#3a3a3a', hat: null },
    { shirt: '#e8e4d8', pants: '#4a5468', shoes: '#22262b', hat: null },
    { shirt: '#3f7a4a', pants: '#3a3f34', shoes: '#242822', hat: 'cap' },
    { shirt: '#8a4fbf', pants: '#22242c', shoes: '#111318', hat: null },
    { shirt: '#f0b02a', pants: '#2c3444', shoes: '#2a2a2a', hat: null },
    { shirt: '#d86a2a', pants: '#5a4230', shoes: '#33291f', hat: 'cap' },
    { shirt: '#1d2733', pants: '#1d2733', shoes: '#0e1114', hat: null },
  ];

  const geoCache = new Map();
  function makePersonGeo(outfit, opts) {
    opts = opts || {};
    const key = JSON.stringify([outfit, opts]) + (opts.key || '');
    if (geoCache.has(key)) return geoCache.get(key);
    const skin = opts.skin || U.pick(SKIN);
    const hair = opts.hair || U.pick(HAIR);
    const o = outfit;
    const stat = { p: [], n: [], c: [] }, arm = { p: [], n: [], c: [] }, leg = { p: [], n: [], c: [] };
    const add = V.addBox;
    // torso
    add(stat, 0.42, 0.56, 0.26, 0, 1.2, 0, o.shirt);
    add(stat, 0.44, 0.1, 0.28, 0, 1.46, 0, o.shirt);
    // hips
    add(stat, 0.38, 0.2, 0.25, 0, 0.94, 0, o.pants);
    // belt
    add(stat, 0.4, 0.06, 0.27, 0, 1.06, 0, '#1a1c1f');
    // neck + head
    add(stat, 0.11, 0.07, 0.11, 0, 1.53, 0, skin);
    add(stat, 0.23, 0.25, 0.22, 0.01, 1.68, 0, skin);
    // jaw shadow / nose
    add(stat, 0.06, 0.06, 0.06, 0.13, 1.66, 0, skin);
    // hair
    add(stat, 0.25, 0.1, 0.24, -0.005, 1.82, 0, hair);
    if (opts.longHair) add(stat, 0.12, 0.26, 0.24, -0.12, 1.7, 0, hair);
    else add(stat, 0.05, 0.1, 0.22, -0.11, 1.74, 0, hair);
    // eyes
    add(stat, 0.02, 0.035, 0.035, 0.115, 1.71, 0.06, '#15181c');
    add(stat, 0.02, 0.035, 0.035, 0.115, 1.71, -0.06, '#15181c');
    // hat
    if (o.hat === 'cap') {
      add(stat, 0.26, 0.06, 0.25, 0, 1.87, 0, o.hatCol || '#1d2733');
      add(stat, 0.14, 0.03, 0.22, 0.15, 1.85, 0, o.hatCol || '#1d2733');
    }
    if (opts.vest) {
      add(stat, 0.46, 0.36, 0.3, 0, 1.24, 0, opts.vest);
    }
    if (opts.badge) {
      add(stat, 0.03, 0.07, 0.07, 0.22, 1.3, 0.09, '#ffcf5c');
    }
    // arms (pivot at origin, hanging down)
    add(arm, 0.13, 0.34, 0.15, 0, -0.17, 0, o.shirt);
    add(arm, 0.12, 0.26, 0.14, 0, -0.44, 0, skin);
    add(arm, 0.1, 0.1, 0.12, 0, -0.6, 0, skin);
    // legs (pivot at origin)
    add(leg, 0.17, 0.46, 0.19, 0, -0.24, 0, o.pants);
    add(leg, 0.15, 0.4, 0.17, 0, -0.66, 0, o.pants);
    add(leg, 0.16, 0.1, 0.24, 0.03, -0.87, 0, o.shoes);
    const res = { stat: V.toMesh(stat, personMat), arm: V.toMesh(arm, personMat, false), leg: V.toMesh(leg, personMat, false), height: 1.86 };
    geoCache.set(key, res);
    return res;
  }
  Ch.makePersonGeo = makePersonGeo;

  Ch.VARIANTS = OUTFITS.map((o, i) => ({ outfit: o, skin: SKIN[i % SKIN.length], hair: HAIR[i % HAIR.length] }));

  /* ------------------------------------------------------------------ avatar */
  Ch.create = function (opts) {
    opts = opts || {};
    let variant = opts.variant;
    if (variant === undefined) variant = U.rint(0, OUTFITS.length - 1);
    const outfit = OUTFITS[variant % OUTFITS.length];
    const geo = makePersonGeo(outfit, {
      skin: opts.skin, hair: opts.hair, longHair: opts.longHair, vest: opts.vest,
      badge: opts.badge, key: opts.key || ('v' + variant + (opts.male ? 'm' : 'f') + (opts.longHair ? 'l' : '')),
    });
    const g = new THREE.Group();
    const body = geo.stat.isMesh ? geo.stat.clone() : geo.stat;
    const armL = geo.arm.clone(), armR = geo.arm.clone();
    const legL = geo.leg.clone(), legR = geo.leg.clone();
    armL.position.set(0.02, 1.42, 0.29); armR.position.set(0.02, 1.42, -0.29);
    legL.position.set(0, 0.94, 0.12); legR.position.set(0, 0.94, -0.12);
    body.castShadow = true; armL.castShadow = true; armR.castShadow = true;
    legL.castShadow = true; legR.castShadow = true;
    g.add(body, armL, armR, legL, legR);
    // simple weapon prop in the right hand
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.07), new THREE.MeshLambertMaterial({ color: 0x14171b }));
    gun.position.set(0.16, -0.62, 0);
    gun.visible = false;
    armR.add(gun);

    const av = {
      group: g, body, armL, armR, legL, legR, gun,
      phase: Math.random() * 6.28, state: 'idle', aimT: 0, dead: false, deathT: 0,
      height: 1.86, variant,
      setState(s) { if (this.state !== s) { this.state = s; } },
      setArmed(on) { this.gun.visible = !!on; },
      anim(dt, moveSpeed, opts2) {
        opts2 = opts2 || {};
        const sp = Math.abs(moveSpeed || 0);
        const run = sp > 4.6;
        const amp = sp < 0.15 ? 0.02 : U.clamp(sp * 0.1, 0.18, 0.78);
        const rate = sp < 0.15 ? 1.1 : (run ? 7.2 : 5.4) * U.clamp(sp / 3.2, 0.45, 1.4);
        this.phase += dt * rate;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        if (this.dead) {
          this.deathT = Math.min(1, this.deathT + dt * 2.4);
          const t = U.easeOut(this.deathT);
          this.group.rotation.z = t * 1.5;
          this.group.position.y = this.baseY - t * 0.18;
          this.armL.rotation.z = U.lerp(this.armL.rotation.z, 1.6, t);
          this.armR.rotation.z = U.lerp(this.armR.rotation.z, -1.2, t);
          this.legL.rotation.z = U.lerp(this.legL.rotation.z, -0.4, t);
          this.legR.rotation.z = U.lerp(this.legR.rotation.z, 0.2, t);
          return;
        }
        this.legL.rotation.z = s * amp;
        this.legR.rotation.z = -s * amp;
        this.legL.rotation.x = 0; this.legR.rotation.x = 0;
        if (this.aimT > 0.02) {
          // aiming: both arms forward, one supporting
          this.armR.rotation.z = U.lerp(this.armR.rotation.z, 1.45, this.aimT);
          this.armR.rotation.x = U.lerp(this.armR.rotation.x, 0, this.aimT);
          this.armL.rotation.z = U.lerp(this.armL.rotation.z, 1.1, this.aimT);
          this.armL.rotation.x = U.lerp(this.armL.rotation.x, -0.25, this.aimT);
        } else {
          this.armL.rotation.z = -s * amp * 0.9;
          this.armR.rotation.z = s * amp * 0.9;
          this.armL.rotation.x = U.damp(this.armL.rotation.x, 0, 6, dt);
          this.armR.rotation.x = U.damp(this.armR.rotation.x, 0, 6, dt);
        }
        this.body.rotation.y = s * 0.04 * (sp > 0.15 ? 1 : 0);
        // vertical bob
        this.group.position.y = this.baseY + Math.abs(c) * (sp > 0.2 ? 0.035 : 0.008) + (sp > 0.15 ? 0 : Math.sin(this.phase * 0.5) * 0.008);
        if (opts2.crouch) this.group.position.y -= 0.25;
      },
    };
    av.baseY = 0;
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
    return av;
  };

  /* ------------------------------------------------------ hero presets */
  Ch.jason = function () {
    return Ch.create({ variant: 7, skin: '#a9744e', hair: '#2a1c12', key: 'jason', male: true });
  };
  Ch.lucia = function () {
    return Ch.create({ variant: 1, skin: '#8a5a3b', hair: '#160f0b', longHair: true, key: 'lucia' });
  };
  Ch.police = function () {
    return Ch.create({ variant: 7, skin: U.pick(SKIN), hair: '#1a1410', vest: '#1b2330', badge: true, key: 'cop', male: true });
  };

  console.log('[chars] rig pronto');
})();
