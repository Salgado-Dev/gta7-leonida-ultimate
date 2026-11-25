/* ============================================================================
   14 · WORLD ENVIRONMENT — sky, sun/moon, stars, clouds, bay water, island,
   bridge, rain, weather state machine, day/night lighting.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, WORLD = W.WORLD, CELL = W.CELL, WATER_Y = W.WATER_Y;
  const PI = Math.PI;

  const E = (W.env = {
    hour: 9.2, dayLength: 45 * 24, // real seconds for a full day
    night: 0, rain: 0, rainTarget: 0, wet: 0, fog: 0, fogTarget: 0,
    weather: 'clear', weatherTimer: 28, wind: 0.2, water: 0.5, urban: 0.5,
    duckMusic: 0, lightning: 0, temp: 27, nextLightning: 0,
    sun: null, moon: null, hemi: null, stars: null, sky: null, waterMesh: null,
    rainPoints: null, cloudGroup: null, sunSprite: null, moonSprite: null,
    weatherNames: {
      clear: ['CÉU LIMPO', '☀'], cloudy: ['NUBLADO', '☁'], rain: ['CHUVA', '🌧'],
      storm: ['TEMPESTADE', '⛈'], fog: ['NEVOEIRO', '🌫'],
    },
  });

  const WATER_END = W.WATER_END;
  const ISLAND = { x: WORLD + 620, y: WATER_Y + 240, r: 175 };
  const BRIDGE = { x0: WORLD - 8, y0: WATER_Y + 218, x1: ISLAND.x - ISLAND.r + 12, y1: WATER_Y + 262 };
  E.ISLAND = ISLAND; E.BRIDGE = BRIDGE;

  /* --------------------------------------------------------------------- sky */
  function buildSky() {
    const geo = new THREE.SphereGeometry(3200, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x1a4d8f) },
        mid: { value: new THREE.Color(0x88b6d8) },
        bot: { value: new THREE.Color(0xf3c99a) },
        sunDir: { value: new THREE.Vector3(0.4, 0.6, -0.5) },
        sunCol: { value: new THREE.Color(0xffd9a0) },
        night: { value: 0 },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunCol; uniform vec3 sunDir; uniform float night;',
        'void main(){',
        '  float h = clamp(vDir.y*1.05+0.06, -1.0, 1.0);',
        '  vec3 c = h > 0.16 ? mix(mid, top, clamp((h-0.16)/0.84,0.0,1.0)) : mix(bot, mid, clamp((h+0.12)/0.28,0.0,1.0));',
        '  float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  c += sunCol * pow(sd, 220.0) * (1.0-night*0.85) * 1.15;',
        '  c += sunCol * pow(sd, 6.0) * 0.10 * (1.0-night*0.7);',
        '  float g = 1.0 - night;',
        '  c *= mix(0.16, 1.0, g);',
        '  c = mix(c, vec3(0.03,0.05,0.11), night*0.55);',
        '  gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false; sky.renderOrder = -10;
    W.scene.add(sky);
    E.sky = sky;
    return sky;
  }

  function buildStars() {
    const N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * PI * 2, e = Math.acos(U.rand(1, 0.05));
      const r = 2800;
      pos[i * 3] = Math.cos(a) * Math.sin(e) * r;
      pos[i * 3 + 1] = Math.abs(Math.cos(e)) * r * 0.9 + 40;
      pos[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r;
      c.setHSL(U.rand(1), U.rand(0.35, 0), U.rand(1, 0.6));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 13, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false; p.renderOrder = -9;
    W.scene.add(p); E.stars = p;
  }

  function cloudTexture(seed) {
    const C = 256, cv = document.createElement('canvas'); cv.width = C; cv.height = C;
    const g = cv.getContext('2d'), rnd = U.seed(seed);
    g.clearRect(0, 0, C, C);
    for (let i = 0; i < 26; i++) {
      const x = C * 0.5 + (rnd() - 0.5) * C * 0.72, y = C * 0.55 + (rnd() - 0.5) * C * 0.5;
      const r = C * (0.07 + rnd() * 0.14);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,.62)');
      grd.addColorStop(0.55, 'rgba(255,255,255,.24)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 2;
    return t;
  }

  function buildClouds() {
    const group = new THREE.Group();
    group.name = 'clouds';
    const texA = cloudTexture(11);
    const texB = cloudTexture(29);
    const matA = new THREE.MeshBasicMaterial({ map: texA, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    const matB = new THREE.MeshBasicMaterial({ map: texB, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
    const list = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), i % 2 ? matA : matB);
      const ang = U.rand(PI * 2), rad = U.rand(2300, 500);
      m.position.set(WORLD / 2 + Math.cos(ang) * rad, U.rand(430, 210), WATER_Y + Math.sin(ang) * rad);
      m.scale.set(U.rand(520, 260), U.rand(200, 100), 1);
      m.renderOrder = -8;
      group.add(m);
      list.push({ m, speed: U.rand(7, 2), phase: Math.random() * 7 });
    }
    W.scene.add(group);
    E.cloudGroup = group; E.clouds = list;
  }

  function sprite(kind) {
    const C = 128, cv = document.createElement('canvas'); cv.width = cv.height = C;
    const g = cv.getContext('2d');
    if (kind === 'sun') {
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      grd.addColorStop(0, 'rgba(255,255,240,1)');
      grd.addColorStop(0.18, 'rgba(255,236,180,.95)');
      grd.addColorStop(0.45, 'rgba(255,190,110,.35)');
      grd.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = grd; g.fillRect(0, 0, C, C);
    } else {
      const grd = g.createRadialGradient(64, 64, 6, 64, 64, 60);
      grd.addColorStop(0, 'rgba(240,246,255,1)');
      grd.addColorStop(0.4, 'rgba(200,216,240,.75)');
      grd.addColorStop(1, 'rgba(160,190,230,0)');
      g.fillStyle = grd; g.fillRect(0, 0, C, C);
    }
    const t = new THREE.CanvasTexture(cv);
    return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
  }

  function buildLights() {
    W.scene.add(new THREE.AmbientLight(0x445566, 0.55));
    const hemi = new THREE.HemisphereLight(0xa9c9ff, 0x4a4438, 0.55);
    W.scene.add(hemi); E.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff0d2, 1.15);
    sun.castShadow = true;
    const S = sun.shadow;
    S.mapSize.set(LL.Settings.quality === 'low' ? 1024 : 2048, LL.Settings.quality === 'low' ? 1024 : 2048);
    S.camera.near = 1; S.camera.far = 620;
    const D = 175;
    S.camera.left = -D; S.camera.right = D; S.camera.top = D; S.camera.bottom = -D;
    S.bias = -0.0008; S.normalBias = 0.05;
    sun.position.set(240, 320, 180);
    W.scene.add(sun); W.scene.add(sun.target);
    E.sun = sun;

    const moon = new THREE.DirectionalLight(0x9fc0ff, 0);
    moon.position.set(-260, 300, -180);
    W.scene.add(moon); E.moon = moon;

    const sunSp = new THREE.Sprite(sprite('sun')); sunSp.scale.set(220, 220, 1); sunSp.frustumCulled = false;
    W.scene.add(sunSp); E.sunSprite = sunSp;
    const moonSp = new THREE.Sprite(sprite('moon')); moonSp.scale.set(120, 120, 1); moonSp.frustumCulled = false;
    W.scene.add(moonSp); E.moonSprite = moonSp;
  }

  /* ------------------------------------------------------------------- water */
  function waterNormalMap() {
    const C = 256, cv = document.createElement('canvas'); cv.width = cv.height = C;
    const g = cv.getContext('2d');
    const img = g.createImageData(C, C), d = img.data;
    const waves = [];
    for (let i = 0; i < 14; i++) waves.push({ a: U.rand(1, 0.25), kx: U.rand(3, 0.5) * (Math.random() < 0.5 ? -1 : 1), ky: U.rand(3, 0.5) * (Math.random() < 0.5 ? -1 : 1), p: Math.random() * 6.28 });
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const v = Math.cos((x / C) * w.kx * 6.283 + (y / C) * w.ky * 6.283 + w.p) * w.a;
        dx += v * w.kx * 0.12; dy += v * w.ky * 0.12;
      }
      const nx = dx * 0.5, ny = dy * 0.5, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * C + x) * 4;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    return t;
  }

  function buildWater() {
    const nrm = waterNormalMap();
    const mat = new THREE.MeshPhongMaterial({
      color: 0x1d5f7a, specular: 0xbfeaff, shininess: 90,
      normalMap: nrm, normalScale: new THREE.Vector2(0.55, 0.55),
      transparent: true, opacity: 0.94,
    });
    const w = 2600, h = WORLD + 3200;
    const geo = new THREE.PlaneGeometry(w, h, 72, 72);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -PI / 2;
    mesh.position.set(WORLD + w / 2 - 320, -0.55, WATER_Y);
    mesh.receiveShadow = false;
    W.scene.add(mesh);
    E.waterMesh = mesh; E.waterMat = mat; E.waterNormals = nrm;
    // wave displacement on the GPU (small, no collision impact)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        ['#include <begin_vertex>',
          'float wv = sin(position.x*0.035 + uTime*0.9) * 0.32 + sin(position.y*0.052 - uTime*1.3) * 0.22;',
          'transformed.z += wv;'].join('\n')
      );
      E.waterShader = sh;
    };
    // foam strip along the shore
    const foamCv = document.createElement('canvas'); foamCv.width = 64; foamCv.height = 512;
    const fg = foamCv.getContext('2d');
    const grd = fg.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.55, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,.9)');
    fg.fillStyle = grd; fg.fillRect(0, 0, 64, 512);
    const foamTex = new THREE.CanvasTexture(foamCv);
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping; foamTex.repeat.set(1, 40);
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(26, WORLD),
      new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    foam.rotation.x = -PI / 2; foam.position.set(WORLD + 8, 0.09, WATER_Y);
    W.scene.add(foam); E.foam = foam; E.foamTex = foamTex;
  }

  /* --------------------------------------------------------- island & bridge */
  function buildIsland() {
    const db = W.getDB(ISLAND.x, ISLAND.y);
    const segs = 46, r = ISLAND.r;
    // beach skirt
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 16, r + 26, 1.1, segs, 1),
      new THREE.MeshLambertMaterial({ color: 0xd9c08c })
    );
    shell.position.set(ISLAND.x, -0.15, ISLAND.y); shell.receiveShadow = true;
    W.scene.add(shell);
    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r + 4, 1.5, segs, 1),
      new THREE.MeshLambertMaterial({ color: 0x6f8b4a })
    );
    grass.position.set(ISLAND.x, 0.25, ISLAND.y); grass.receiveShadow = true;
    W.scene.add(grass);
    W.addWalkOverride({ circle: true, x: ISLAND.x, y: ISLAND.y, r: r + 2, h: 0.6, surface: 'grass', kind: 'island' });

    // lighthouse
    const lh = { x: ISLAND.x + 74, y: ISLAND.y - 74 };
    db.box(lh.x, 0.6, lh.y, 12, 5, 12, W.col('#cfc8b4'));
    for (let i = 0; i < 5; i++) {
      const hh = 12 - i * 1.4;
      const w = 9 - i * 1.25;
      db.box(lh.x, 0.6 + i * 6.2, lh.y, w, 6.4, w, W.col(i % 2 ? '#f2ede0' : '#c8392f'));
    }
    db.box(lh.x, 37, lh.y, 7, 2.4, 7, W.col('#2f353a'));
    W.addCollider(lh.x, lh.y, 12, 12, 40, 'lighthouse');
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.set(lh.x, 40, lh.y); W.scene.add(lamp); E.lightHouseLamp = lamp;
    const beacon = new THREE.SpotLight(0xffeec0, 0, 220, 0.5, 0.55, 1.4);
    beacon.position.set(lh.x, 39.4, lh.y);
    beacon.target.position.set(lh.x + 90, 4, lh.y);
    W.scene.add(beacon, beacon.target);
    E.beacon = beacon;

    // villa + palms + dock
    db.box(ISLAND.x - 60, 0.6, ISLAND.y + 40, 62, 8, 46, W.col('#e6dcc4'));
    db.box(ISLAND.x - 60, 8.6, ISLAND.y + 40, 66, 0.8, 50, W.col('#8a6f4d'));
    db.box(ISLAND.x - 60, 8.4, ISLAND.y + 40, 46, 3, 30, W.col('#d8cdb4'));
    W.addCollider(ISLAND.x - 60, ISLAND.y + 40, 62, 46, 10, 'building');
    // pool
    const pool = new THREE.Mesh(new THREE.CircleGeometry(13, 24), new THREE.MeshPhongMaterial({ color: 0x2fa7c4, shininess: 120, transparent: true, opacity: 0.9 }));
    pool.rotation.x = -PI / 2; pool.position.set(ISLAND.x + 26, 0.72, ISLAND.y + 8);
    W.scene.add(pool);
    // palms
    const spots = W.treeSpots || (W.treeSpots = { oak: [], pine: [], palm: [], bush: [] });
    for (let i = 0; i < 26; i++) {
      const a = U.rand(6.28), rr = U.rand(r - 22, 18);
      spots.palm.push({ x: ISLAND.x + Math.cos(a) * rr, y: ISLAND.y + Math.sin(a) * rr, s: U.rand(1.35, 0.85), r: Math.random() * 6.28 });
    }
    for (let i = 0; i < 10; i++) {
      const a = U.rand(6.28), rr = U.rand(r - 40, 24);
      spots.bush.push({ x: ISLAND.x + Math.cos(a) * rr, y: ISLAND.y + Math.sin(a) * rr, s: U.rand(1.4, 0.9), r: Math.random() * 6.28 });
    }
    // dock
    const dx0 = ISLAND.x - 6, dx1 = ISLAND.x + 44, dy = ISLAND.y + 128;
    for (let x = dx0; x < dx1; x += 9) db.box(x + 4.5, 0.35, dy, 8.6, 0.3, 20, W.col('#8b6a44'));
    for (let x = dx0 + 6; x < dx1; x += 20) { db.box(x, -2.2, dy - 9, 0.6, 5, 0.6, W.col('#4a3524')); db.box(x, -2.2, dy + 9, 0.6, 5, 0.6, W.col('#4a3524')); }
    W.addWalkOverride({ x0: dx0, y0: dy - 10, x1: dx1, y1: dy + 10, h: 0.35, surface: 'wood', kind: 'islanddock' });
    W.boatSpots.push({ x: dx1 + 30, y: dy, a: PI, kind: 'island' });

    // island POI (treasure / safe drop)
    W.addPOI({ name: 'Farol de Coral', service: 'landmark', icon: '▲', color: '#ffcf5c', desc: 'Ilha particular na baía. Farol, villa e doca.' }, ISLAND.x + 74, ISLAND.y - 40, { landmark: true });
  }

  function buildBridge() {
    const x0 = BRIDGE.x0, x1 = BRIDGE.x1, y0 = BRIDGE.y0, y1 = BRIDGE.y1, cy = (y0 + y1) / 2;
    const db = W.getDB((x0 + x1) / 2, cy);
    // deck
    for (let x = x0; x < x1; x += 12) {
      db.box(x + 6, 0.55, cy, 11.8, 0.9, 44, W.col('#7d7f7e'));
    }
    // guard rails
    db.box((x0 + x1) / 2, 1.6, y0, x1 - x0, 0.9, 0.7, W.col('#c9c6ba'));
    db.box((x0 + x1) / 2, 1.6, y1, x1 - x0, 0.9, 0.7, W.col('#c9c6ba'));
    // pylons
    for (let x = x0 + 40; x < x1; x += 92) {
      db.box(x, -3.5, y0 + 4, 4, 9, 4, W.col('#8d8a80'));
      db.box(x, -3.5, y1 - 4, 4, 9, 4, W.col('#8d8a80'));
      W.addCollider(x, y0 + 4, 4, 4, 1, 'pylon');
      W.addCollider(x, y1 - 4, 4, 4, 1, 'pylon');
    }
    // lamps on bridge
    for (let x = x0 + 26; x < x1; x += 60) {
      db.box(x, 0.9, y0 + 1.2, 0.3, 7, 0.3, W.col('#3b4045'));
      db.box(x, 0.9, y1 - 1.2, 0.3, 7, 0.3, W.col('#3b4045'));
    }
    W.addWalkOverride({ x0: x0 - 4, y0: y0 + 3, x1: x1 + 4, y1: y1 - 3, h: 1.0, surface: 'road', kind: 'bridge' });
    E.bridgeRect = { x0, y0, x1, y1 };
  }

  /* -------------------------------------------------------------------- rain */
  function buildRain() {
    const N = 1600;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = U.rand(120, -120); pos[i * 3 + 1] = U.rand(70, 0); pos[i * 3 + 2] = U.rand(120, -120);
      vel[i] = U.rand(58, 36);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xbcd6ef, size: 0.8, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    W.scene.add(p);
    E.rainPoints = p; E.rainVel = vel; E.rainCount = N;

    // puddles: a handful of additive discs near the player that fade in with wetness
    E.puddles = [];
    const pg = new THREE.CircleGeometry(1, 16);
    const pm = new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(pg, pm.clone());
      mesh.rotation.x = -PI / 2; mesh.visible = false;
      W.scene.add(mesh);
      E.puddles.push({ mesh, x: 0, y: 0, r: U.rand(4.5, 2) });
    }
  }

  /* ------------------------------------------------------------------ lights */
  const PALETTE = {
    dawn: { top: 0x21456e, mid: 0xd98f6a, bot: 0xffc08a, sun: 0xffb37a, amb: 0x54607a, hemiS: 0xb8a8c0, hemiG: 0x4a4038, fog: 0xc7a68f },
    day: { top: 0x1c5fa8, mid: 0x8dc2e6, bot: 0xd8e9f2, sun: 0xfff4dc, amb: 0x5d7a96, hemiS: 0xbcd8ff, hemiG: 0x5b5344, fog: 0xb9d2e4 },
    dusk: { top: 0x2b2258, mid: 0xc4557a, bot: 0xff9a5c, sun: 0xff8f52, amb: 0x5b4a6a, hemiS: 0xc9a0c0, hemiG: 0x4a3b30, fog: 0xd08a6e },
    night: { top: 0x05070f, mid: 0x0b1424, bot: 0x16202e, sun: 0x6a86c0, amb: 0x1d2634, hemiS: 0x2c3f5c, hemiG: 0x1a1a1c, fog: 0x0b1220 },
  };
  for (const palette of Object.values(PALETTE)) {
    for (const key of Object.keys(palette)) palette[key] = new THREE.Color(palette[key]);
  }
  const cA = new THREE.Color(), cB = new THREE.Color();
  function mixPal(a, b, t) {
    return {
      top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), t),
      mid: new THREE.Color(a.mid).lerp(new THREE.Color(b.mid), t),
      bot: new THREE.Color(a.bot).lerp(new THREE.Color(b.bot), t),
      sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), t),
      amb: new THREE.Color(a.amb).lerp(new THREE.Color(b.amb), t),
      hemiS: new THREE.Color(a.hemiS).lerp(new THREE.Color(b.hemiS), t),
      hemiG: new THREE.Color(a.hemiG).lerp(new THREE.Color(b.hemiG), t),
      fog: new THREE.Color(a.fog).lerp(new THREE.Color(b.fog), t),
    };
  }
  function paletteFor(h) {
    if (h < 5) return { p: PALETTE.night, n: 1, k: 0 };
    if (h < 7.2) { const t = (h - 5) / 2.2; return { p: mixPal(PALETTE.night, PALETTE.dawn, t), n: 1 - t * 0.75, k: t }; }
    if (h < 9.2) { const t = (h - 7.2) / 2; return { p: mixPal(PALETTE.dawn, PALETTE.day, t), n: 0.25 * (1 - t), k: 1 }; }
    if (h < 16.4) return { p: PALETTE.day, n: 0, k: 1 };
    if (h < 18.6) { const t = (h - 16.4) / 2.2; return { p: mixPal(PALETTE.day, PALETTE.dusk, t), n: t * 0.45, k: 1 - t * 0.2 }; }
    if (h < 20.6) { const t = (h - 18.6) / 2; return { p: mixPal(PALETTE.dusk, PALETTE.night, t), n: 0.45 + t * 0.55, k: 0.8 * (1 - t) }; }
    return { p: PALETTE.night, n: 1, k: 0 };
  }

  function updateSky(dt) {
    const h = E.hour;
    const pal = paletteFor(h);
    E.night = pal.n;
    const sky = E.sky.material.uniforms;
    sky.top.value.copy(pal.p.top); sky.mid.value.copy(pal.p.mid); sky.bot.value.copy(pal.p.bot);
    sky.night.value = pal.n;
    sky.sunCol.value.copy(pal.p.sun);

    // sun orbit: rises in the east (x+) and sets west
    const ang = ((h - 6) / 12) * PI;
    const sunY = Math.sin(ang), sunX = Math.cos(ang);
    const sunDir = new THREE.Vector3(sunX * 0.9, sunY, -0.42 + Math.sin(ang * 0.5) * 0.1);
    if (sunDir.lengthSq() < 0.001) sunDir.set(0, 1, 0);
    sunDir.normalize();
    sky.sunDir.value.copy(sunDir);

    const g = LL.game;
    const px = g && g.player ? g.player.pos.x : WORLD / 2;
    const py = g && g.player ? g.player.pos.y : WATER_Y;
    const dist = 2600;
    E.sunSprite.position.set(px + sunDir.x * dist, sunDir.y * dist, py + sunDir.z * dist);
    E.sunSprite.material.opacity = U.clamp(sunDir.y * 2.2, 0, 1) * (1 - E.night * 0.9);
    E.sunSprite.visible = E.sunSprite.material.opacity > 0.02;

    const moonDir = sunDir.clone().negate();
    E.moonSprite.position.set(px + moonDir.x * dist, Math.abs(moonDir.y) * dist + 120, py + moonDir.z * dist);
    E.moonSprite.material.opacity = E.night * 0.9;
    E.moonSprite.visible = E.night > 0.05;

    // directional lights follow the player so the shadow box stays tight
    const sun = E.sun;
    sun.position.set(px + sunDir.x * 210, Math.max(35, sunDir.y * 260), py + sunDir.z * 210 + 60);
    sun.target.position.set(px, 0, py); sun.target.updateMatrixWorld();
    sun.color.copy(pal.p.sun);
    sun.intensity = U.clamp(0.25 + sunDir.y * 1.55, 0.03, 1.55) * (1 - E.rain * 0.55) * (1 - E.fog * 0.35);
    sun.castShadow = LL.Settings.shadows && sun.intensity > 0.12;

    E.moon.position.set(px - sunDir.x * 200, Math.max(60, -sunDir.y * 240), py - sunDir.z * 200);
    E.moon.intensity = E.night * 0.32;
    E.hemi.color.copy(pal.p.hemiS); E.hemi.groundColor.copy(pal.p.hemiG);
    E.hemi.intensity = 0.26 + pal.k * 0.42;

    const amb = W.scene.children.find((c) => c.isAmbientLight);
    if (amb) { amb.color.copy(pal.p.amb); amb.intensity = 0.32 + pal.k * 0.35; }

    // fog + clear colour
    const fogCol = pal.p.fog.clone().lerp(new THREE.Color(0x8e9aa8), E.fog * 0.55).lerp(new THREE.Color(0x2a3947), E.rain * 0.5);
    if (!W.scene.fog) W.scene.fog = new THREE.Fog(fogCol.getHex(), 260, 900);
    W.scene.fog.color.copy(fogCol);
    W.scene.fog.near = U.lerp(180, 40, E.fog) - E.rain * 30;
    W.scene.fog.far = U.lerp(LL.Settings.drawDistance, 260, Math.max(E.fog, E.rain * 0.8));
    if (W.scene.fog.far < W.scene.fog.near + 60) W.scene.fog.far = W.scene.fog.near + 60;

    // stars & facades
    if (E.stars) E.stars.material.opacity = U.clamp((E.night - 0.25) * 1.5, 0, 1) * (1 - E.rain * 0.9);
    W.setNight(E.night);
    if (W.lampHeads) W.lampHeads.material.color.setRGB(0.6 + E.night * 0.4, 0.58 + E.night * 0.32, 0.5 + E.night * 0.2);
    if (W.lampPoolMat) W.lampPoolMat.opacity = E.night * 0.85;
    if (E.beacon) E.beacon.intensity = E.night * 2.4;
    if (E.lightHouseLamp) E.lightHouseLamp.material.color.setRGB(1, 0.72 + E.night * 0.24, 0.4 + E.night * 0.3);
    if (W.groundMat) {
      const k = 0.36 + pal.k * 0.64;
      W.groundMat.color.setRGB(k, k, k);
      W.groundMat.normalScale = null;
    }
    E.temp = Math.round(22 + pal.k * 7 - E.rain * 4 + Math.sin(h * 0.4) * 2.4);
  }

  /* -------------------------------------------------------------- weather AI */
  const WEATHER_ORDER = ['clear', 'clear', 'cloudy', 'rain', 'clear', 'cloudy', 'storm', 'fog', 'clear', 'cloudy'];
  let weatherIdx = 0;
  function rollWeather() {
    weatherIdx = (weatherIdx + 1 + ((Math.random() * 3) | 0)) % WEATHER_ORDER.length;
    E.weather = WEATHER_ORDER[weatherIdx];
    E.weatherTimer = U.rand(70, 34);
    if (E.weather === 'clear') { E.rainTarget = 0; E.fogTarget = 0; }
    else if (E.weather === 'cloudy') { E.rainTarget = 0; E.fogTarget = 0.12; }
    else if (E.weather === 'rain') { E.rainTarget = 0.62; E.fogTarget = 0.3; }
    else if (E.weather === 'storm') { E.rainTarget = 1; E.fogTarget = 0.55; }
    else { E.rainTarget = 0.08; E.fogTarget = 0.8; }
    LL.emit('weather:changed', E.weather);
  }

  function updateWeather(dt, t) {
    E.weatherTimer -= dt;
    if (E.weatherTimer <= 0) rollWeather();
    E.rain = U.damp(E.rain, E.rainTarget, 0.32, dt);
    E.fog = U.damp(E.fog, E.fogTarget, 0.22, dt);
    E.wet = U.damp(E.wet, E.rain > 0.15 ? 1 : 0, 0.06, dt);
    E.wind = 0.14 + E.rain * 0.7 + Math.sin(t * 0.11) * 0.06;
    if (E.weather === 'storm') {
      E.nextLightning -= dt;
      if (E.nextLightning <= 0) {
        E.nextLightning = U.rand(11, 4);
        E.lightning = 1;
        if (LL.Audio) LL.Audio.thunder();
        LL.emit('lightning');
      }
    }
    E.lightning = Math.max(0, E.lightning - dt * 2.4);
    // rain particles follow the camera
    if (E.rainPoints) {
      const m = E.rainPoints.material;
      m.opacity = E.rain * 0.85;
      E.rainPoints.visible = E.rain > 0.02;
      if (E.rainPoints.visible) {
        const g = LL.game;
        const cx = g && g.camera ? g.camera.position.x : WORLD / 2;
        const cz = g && g.camera ? g.camera.position.z : WATER_Y;
        const cy = g && g.camera ? g.camera.position.y : 6;
        const pos = E.rainPoints.geometry.attributes.position.array;
        const N = E.rainCount;
        for (let i = 0; i < N; i++) {
          const iy = i * 3 + 1;
          pos[iy] -= E.rainVel[i] * dt * (0.6 + E.rain * 0.7);
          pos[i * 3] += E.wind * 9 * dt;
          if (pos[iy] < cy - 12) {
            pos[iy] = cy + U.rand(52, 26);
            pos[i * 3] = cx + U.rand(80, -80);
            pos[i * 3 + 2] = cz + U.rand(80, -80);
          }
        }
        E.rainPoints.geometry.attributes.position.needsUpdate = true;
      }
    }
    // puddles
    if (E.puddles) {
      const g = LL.game;
      const px = g && g.player ? g.player.pos.x : WORLD / 2;
      const py = g && g.player ? g.player.pos.y : WATER_Y;
      for (let i = 0; i < E.puddles.length; i++) {
        const p = E.puddles[i];
        const on = E.wet > 0.25;
        p.mesh.visible = on;
        if (!on) continue;
        if (!p.init || Math.hypot(p.mesh.position.x - px, p.mesh.position.z - py) > 150) {
          const a = U.rand(6.28), r = U.rand(70, 12);
          const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
          if (W.onRoad(x, y) || W.surfaceAt(x, y) === 'concrete' || W.surfaceAt(x, y) === 'road') {
            p.mesh.position.set(x, 0.06, y);
            p.mesh.position.y = W.heightAt(x, y) + 0.06;
            p.mesh.scale.setScalar(p.r * U.rand(1.5, 0.7));
            p.init = true;
          }
        }
        p.mesh.material.opacity = E.wet * 0.18 * (0.5 + Math.sin(t * 1.4 + i) * 0.2);
      }
    }
    // water normal scroll
    if (E.waterNormals) { E.waterNormals.offset.x = (t * 0.011) % 1; E.waterNormals.offset.y = (t * 0.007) % 1; }
    if (E.waterShader && E.waterShader.uniforms.uTime) E.waterShader.uniforms.uTime.value = t;
    if (E.waterMat) E.waterMat.color.setHSL(0.545, 0.52, 0.2 + E.night * -0.09 + E.rain * 0.03);
    if (E.foamTex) E.foamTex.offset.y = (t * 0.02) % 1;
    if (E.foam) E.foam.material.opacity = 0.32 + E.wind * 0.3;
    // clouds drift + tint
    if (E.clouds) {
      for (const c of E.clouds) {
        c.m.position.x += c.speed * dt * (0.5 + E.wind);
        if (c.m.position.x > WORLD / 2 + 2400) c.m.position.x = WORLD / 2 - 2400;
        if (E.cloudGroup) {
          const tint = 1 - E.night * 0.78;
          c.m.material.color.setRGB(tint, tint, tint * (1 + E.rain * 0.05));
        }
      }
      if (E.cloudGroup) E.cloudGroup.position.y = E.rain * 40;
    }
    // light flicker during storm
    if (E.lightning > 0.02) {
      const f = E.lightning * (0.4 + Math.random() * 0.6);
      E.sun.intensity += f * 2.2;
      E.hemi.intensity += f * 1.4;
    }
    // audio environment values
    E.urban = 0.55 + E.night * 0.15;
    E.water = U.clamp(1 - Math.hypot((LL.game && LL.game.player ? LL.game.player.pos.x : WORLD) - WORLD, 0) / 900, 0, 1);
    E.duckMusic = E.rain > 0.4 ? 1 : 0;
  }

  /* --------------------------------------------------------------- init/update */
  E.init = function () {
    buildSky(); buildStars(); buildClouds(); buildLights(); buildRain();
  };

  W.initEnvironment = function () {
    // lights/sky already created during build; sync first frame
    updateSky(0.016);
    W.setNight(E.night);
  };

  W.buildEnvironment = async function () {
    E.init();
    buildWater();
    buildBridge();
    buildIsland();
    E.weatherTimer = 40;
    updateSky(0.016);
  };

  W.setTime = function (h) { E.hour = ((h % 24) + 24) % 24; updateSky(0.016); };
  W.setWeather = function (name) {
    if (!E.weatherNames[name]) return false;
    E.weather = name;
    E.weatherTimer = 90;
    E.rainTarget = name === 'rain' ? 0.62 : name === 'storm' ? 1 : name === 'fog' ? 0.08 : 0;
    E.fogTarget = name === 'fog' ? 0.8 : name === 'storm' ? 0.55 : name === 'rain' ? 0.3 : name === 'cloudy' ? 0.12 : 0;
    return true;
  };

  W.update = function (dt, t) {
    E.hour = (E.hour + (dt * 24) / E.dayLength) % 24;
    updateSky(dt);
    updateWeather(dt, t);
    if (W.updateSignals) W.updateSignals(t);
    // POI ring pulse
    if (W.poiRings) {
      for (const r of W.poiRings) {
        const s = 1 + Math.sin(t * 2 + r.phase) * 0.09;
        r.ring.scale.set(s, s, s);
        r.ring.material.opacity = 0.24 + Math.sin(t * 2 + r.phase) * 0.12;
      }
    }
    // pool shimmer
    if (W.pools) for (let i = 0; i < W.pools.length; i++) {
      const p = W.pools[i];
      p.mesh.material.opacity = p.base + Math.sin(t * 1.6 + i) * 0.06;
    }
    // lighthouse beacon sweep
    if (E.beacon) {
      const a = t * 0.55;
      E.beacon.target.position.set(ISLAND.x + Math.cos(a) * 160, 6, ISLAND.y + Math.sin(a) * 160);
    }
  };

  console.log('[world] environment ready');
})();
