/* ============================================================================
   60 · MAIN — renderer, boot pipeline, game state, loop, saves, menus.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, V = LL.Vehicles, Player = LL.Player, UI = LL.UI, M = LL.Missions, A = LL.Achievements;
  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------- game state */
  const G = (LL.Game = {
    started: false, paused: false, booted: false, time: 0, timeScale: 1,
    fps: 60, _fpsAcc: 0, _fpsFrames: 0, stats: {}, garage: [], xp: 0, level: 1,
    playtime: 0, progress: 0, radioTrack: 0, camera: null, player: Player,
    contextLost: false, _autosaveT: 0, _menuAt: 0,
  });
  LL.game = G;

  const RADIO = [
    { name: 'NEON TIDE', artist: 'Leonida FM' },
    { name: 'VICE FM', artist: 'Sunset Sessions' },
    { name: 'CORAL WAVES', artist: 'Onda Coral' },
    { name: 'EVERGLADES DUB', artist: 'Pântano Sound' },
    { name: 'STRIP STATIC', artist: 'Neon Strip Radio' },
    { name: 'MIAMI 1984', artist: 'Retrowave' },
    { name: 'LATE NIGHT LEONIDA', artist: 'After Hours' },
    { name: 'SUNSET DRIVE', artist: 'Cruzeiro' },
  ];

  function freshStats() {
    return {
      carsStolen: 0, carsSold: 0, storesRobbed: 0, pedsRobbed: 0, smashGrab: 0,
      flamingos: 0, escapes: 0, escapesHigh: 0, outfitsUsed: 0, hacks: 0,
      kmDriven: 0, boatTrips: 0, copsDown: 0, missions: 0, moneyEarned: 0,
      moneySpent: 0, deaths: 0, casinoWon: 0, pedsHurt: 0, crashes: 0,
      topSpeed: 0, maxWanted: 0, survivedSieges: 0, achievements: 0,
      cashFound: 0, weaponsFound: 0, armorsFound: 0, customs: 0,
    };
  }

  /* ---------------------------------------------------------------- renderer */
  let renderer, scene, camera, clockLast = performance.now(), bootDone = false;

  function setupRenderer() {
    const canvas = $('gl');
    if (!canvas) throw new Error('canvas #gl ausente');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: LL.Settings.quality !== 'low', powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LL.Settings.quality === 'low' ? 1 : 1.75));
    renderer.shadowMap.enabled = !!LL.Settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setClearColor(0x0a1220, 1);

    scene = new THREE.Scene();
    scene.matrixWorldAutoUpdate = true;
    camera = new THREE.PerspectiveCamera(LL.Settings.fov || 66, innerWidth / innerHeight, 0.35, 4200);
    G.camera = camera;
    G.renderer = renderer;
    G.scene = scene;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      G.contextLost = true;
      LL.notify('O contexto 3D caiu. O jogo vai recarregar.', 'red', 'RENDERIZADOR');
      const err = $('webglError');
      if (err) err.classList.add('on');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => { G.contextLost = false; });

    addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer || !camera) return;
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LL.Settings.quality === 'low' ? 1 : 1.75));
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  G.applySettings = function () {
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LL.Settings.quality === 'low' ? 1 : LL.Settings.quality === 'ultra' ? 2 : 1.75));
    renderer.shadowMap.enabled = !!LL.Settings.shadows;
    if (W.env && W.env.sun) W.env.sun.castShadow = !!LL.Settings.shadows;
    if (camera) { camera.fov = LL.Settings.fov || 66; camera.updateProjectionMatrix(); }
    if (W.scene && W.scene.fog) W.scene.fog.far = LL.Settings.drawDistance;
    UI.setHudVisible(!!LL.Settings.minimap || true);
    const map = document.querySelector('.minimap-shell');
    if (map) map.style.display = LL.Settings.minimap ? '' : 'none';
  };

  /* --------------------------------------------------------------- boot flow */
  function progress(p, msg) {
    const fill = $('bootFill'), m = $('bootMsg');
    if (fill) fill.style.width = Math.max(2, Math.min(100, p)) + '%';
    if (m && msg) m.textContent = msg;
    return new Promise((r) => setTimeout(r, 0));
  }

  async function boot() {
    try {
      if (!window.THREE) throw new Error('Three.js não carregou');
      progress(3, 'Aquecendo o motor gráfico…');
      setupRenderer();
      progress(5, 'Molhando as ruas de Leonida…');
      await W.build(scene, renderer, progress);

      progress(94, 'Acordando Jason e Lucia…');
      Player.init(camera);
      G.player = Player;

      progress(96, 'Espalhando colecionáveis…');
      LL.Collect.build();

      progress(97, 'Ligando o som…');
      LL.Achievements.init();
      UI.init();
      UI.initPanels();
      EconInit();
      bindGameEvents();
      bindMenu();
      bindKeys();
      G.stats = freshStats();
      refreshMenuInfo();
      G.loop = true;
      lastFrame = performance.now();
      requestAnimationFrame(frame);

      progress(100, 'Leonida está pronta.');
      await new Promise((r) => setTimeout(r, 260));
      const bootEl = $('boot');
      if (bootEl) bootEl.classList.add('done');
      const menu = $('menu');
      if (menu) menu.classList.add('on');
      G.booted = true;
      G._menuAt = performance.now();
    } catch (e) {
      LL.reportError(e, 'boot');
      const m = $('bootMsg');
      if (m) m.textContent = 'Falha ao iniciar: ' + (e.message || e);
      const err = $('webglError');
      if (err) { err.classList.add('on'); const p = err.querySelector('p'); if (p) p.textContent = String(e.message || e); }
    }
  }

  function EconInit() {
    if (LL.Econ && LL.Econ.buildRobList) {
      try { LL.Econ.buildRobList(); } catch (e) { LL.reportError(e, 'roblist'); }
    }
  }

  /* ---------------------------------------------------------------- new game */
  G.newGame = function () {
    G.stats = freshStats();
    G.garage = [];
    G.xp = 0; G.level = 1; G.progress = 0; G.playtime = 0; G.time = 0; G.radioTrack = 0;
    G.paused = false;

    LL.Invuln = false;
    LL.Police.clear();
    LL.Peds.reset();
    for (const c of V.list.slice()) V.remove(c);
    if (M) { M.completed = []; M.active = null; M.clearMarkers(); M._wm = false; }
    A.reset();
    LL.Collect.reset();
    if (LL.Econ) { for (const s of LL.Econ.robbableStores) { s.robbed = false; s.cooldown = 0; } }
    W.setTime(9.2);
    W.setWeather('clear');

    const S = Player.state;
    S.money = 800; S.health = 100; S.armor = 0; S.stamina = 100; S.focus = 100;
    S.weapon = 'pistol'; S.character = 0; S.clothes = 0; S.disguised = false;
    S.dead = false; S.loot = 0; S.invuln = 2;
    Player.ammoInit();
    Player.restore({
      pos: Player.safehousePos(), angle: 1.2, health: 100, armor: 0, stamina: 100,
      focus: 100, money: 800, character: 0, weapon: 'pistol', clothes: 0, disguised: false,
    });
    Player.addMoney(0, 'start');
    startPlay();
    LL.notify('Novo jogo iniciado. Bem-vindo a Leonida.', 'green', 'LEONIDA');
    G.saveGame('new');
  };

  G.continueGame = function () {
    const ok = LL.Save.load();
    if (!ok) {
      LL.notify('Nenhum save válido encontrado — começando um novo jogo.', 'gold', 'SALVAMENTO');
      G.newGame();
      return false;
    }
    G.stats = G.stats && Object.keys(G.stats).length ? G.stats : freshStats();
    startPlay();
    LL.notify('Progresso restaurado.', 'green', 'SALVAMENTO');
    return true;
  };

  function startPlay() {
    G.started = true;
    G.paused = false;
    UI.setMenuVisible(false, false);
    UI.setHudVisible(true);
    const hud = $('hud');
    if (hud) hud.classList.remove('hidden');
    $('bigEvent') && $('bigEvent').classList.remove('on');
    $('pause') && $('pause').classList.remove('on');
    if (LL.Audio) { try { LL.Audio.resume(); LL.Audio.musicStart && LL.Audio.musicStart(); } catch (e) { } }
    LL.Input.lock();
    updateRadioLabel();
    G._autosaveT = 0;
    LL.emit('game:started');
  }

  /* ------------------------------------------------------------------ to menu */
  G.toMainMenu = function () {
    G.saveGame('menu');
    G.started = false;
    G.paused = false;
    UI.setHudVisible(false);
    UI.closeOverlay();
    $('pause') && $('pause').classList.remove('on');
    $('bigEvent') && $('bigEvent').classList.remove('on');
    UI.setMenuVisible(true, false);
    LL.Input.unlock();
    refreshMenuInfo();
    G._menuAt = performance.now();
  };

  G.onOverlayClosed = function () {
    if (G.started && !G.paused) LL.Input.lock();
  };

  G.pause = function () {
    if (!G.started || G.paused) return;
    G.paused = true;
    LL.Input.unlock();
    const el = $('pause');
    if (el) {
      el.classList.add('on');
      const sub = $('pauseSub');
      if (sub) {
        const S = Player.state;
        sub.textContent = (S.character === 0 ? 'Jason' : 'Lucia') + ' · ' + W.districtAt(S.pos.x, S.pos.y) +
          ' · ' + U.clock(W.env ? W.env.hour : 9);
      }
    }
    try { LL.Audio.ui('back'); } catch (e) { }
  };

  G.resume = function () {
    if (!G.started) return;
    G.paused = false;
    $('pause') && $('pause').classList.remove('on');
    UI.closeOverlay();
    LL.Input.lock();
  };

  /* -------------------------------------------------------------------- save */
  G.saveGame = function (reason) {
    if (!G.started && reason !== 'menu') return false;
    const ok = LL.Save.write(reason || 'auto');
    if (ok) {
      const el = $('fade');
      if (el && reason === 'manual') { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 180); }
    }
    refreshMenuInfo();
    return ok;
  };

  function collectSave() {
    return {
      playtime: G.playtime, progress: G.progress, radioTrack: G.radioTrack,
      xp: G.xp, level: G.level, garage: G.garage.slice(), stats: Object.assign({}, G.stats),
      player: Player.serialize(), missions: M.serialize(), achievements: A.serialize(),
      collect: LL.Collect.serialize(),
      world: { hour: W.env ? W.env.hour : 9, weather: W.env ? W.env.weather : 'clear' },
      police: { wanted: LL.Police.wanted },
    };
  }

  function restoreSave(d) {
    if (!d || typeof d !== 'object') return false;
    G.playtime = d.playtime || 0;
    G.xp = d.xp || 0; G.level = d.level || 1;
    G.garage = Array.isArray(d.garage) ? d.garage.slice() : [];
    G.stats = Object.assign(freshStats(), d.stats || {});
    G.radioTrack = d.radioTrack || 0;
    if (d.world) {
      if (W.env) { W.env.hour = d.world.hour || 9; W.setWeather(d.world.weather || 'clear'); }
    }
    if (d.player) {
      Player.restore(d.player);
    }
    if (d.missions) M.restore(d.missions);
    if (d.achievements) A.restore(d.achievements);
    if (d.collect) LL.Collect.restore(d.collect);
    if (d.police && d.police.wanted) LL.Police.setWanted(d.police.wanted);
    G.progress = A.percent();
    updateRadioLabel();
    refreshMenuInfo();
    return true;
  }

  LL.Save.register(collectSave, restoreSave);

  /* -------------------------------------------------------------- menu wiring */
  function refreshMenuInfo() {
    const meta = LL.Save.meta();
    const saveMain = $('saveMain'), saveMeta = $('saveMeta'), contInfo = $('contInfo');
    if (meta) {
      const when = new Date(meta.savedAt);
      const diff = (Date.now() - meta.savedAt) / 1000;
      const rel = diff < 60 ? 'agora há pouco' : diff < 3600 ? Math.floor(diff / 60) + ' min atrás'
        : diff < 86400 ? Math.floor(diff / 3600) + ' h atrás' : when.toLocaleDateString('pt-BR');
      if (saveMain) saveMain.textContent = meta.character + ' · ' + U.fmtMoney(meta.money);
      if (saveMeta) saveMeta.textContent = rel + ' · ' + meta.missions + ' missões · ' + meta.percent + '% · ' + U.duration(meta.playtime);
      if (contInfo) contInfo.textContent = 'nível ' + (meta.level || 1) + ' · ' + meta.percent + '%';
    } else {
      if (saveMain) saveMain.textContent = 'Nenhum save encontrado';
      if (saveMeta) saveMeta.textContent = 'Crie um novo jogo para começar';
      if (contInfo) contInfo.textContent = 'sem progresso salvo';
    }
    const gInfo = $('garageInfo');
    if (gInfo) gInfo.textContent = (G.garage || []).length + ' veículos';
    const aInfo = $('achInfo');
    if (aInfo) aInfo.textContent = A.unlocked.length + ' / ' + A.LIST.length;
    const cont = document.querySelector('[data-menu="continue"]');
    if (cont) { if (meta) cont.removeAttribute('disabled'); else cont.setAttribute('disabled', 'disabled'); }
    const tip = $('menuTip');
    if (tip) {
      const tips = [
        'A polícia memoriza sua roupa e seu carro. Troque os dois para sumir do radar.',
        'Buzine perto de pedestres: alguns correm, outros revidam.',
        'O Ferro-Velho paga em dinheiro vivo, sem nota fiscal e sem testemunha.',
        'Wenk destrava qualquer carro moderno a até 26 metros. Tem recarga de 7 segundos.',
        'Dirigir 8 km completa um item do checklist de 100%.',
        'A lancha rápida do Cais 7 chega à ilha em menos de um minuto.',
        'Cada arma tem recarga própria. Escopeta resolve corredor, fuzil resolve quarteirão.',
        'Chuva deixa o asfalto escorregadio: solte o acelerador antes da curva.',
      ];
      tip.textContent = U.pick(tips);
    }
  }

  function bindMenu() {
    const nav = $('menuNav');
    if (nav) {
      nav.addEventListener('click', (e) => {
        const b = e.target.closest('[data-menu]');
        if (!b) return;
        const which = b.getAttribute('data-menu');
        if (which === 'continue') {
          if (!LL.Save.exists()) { LL.notify('Nenhum save encontrado.', 'gold', 'LEONIDA'); return; }
          G.continueGame();
        } else if (which === 'new') {
          if (LL.Save.exists()) {
            UI.confirm('Começar um novo jogo?', 'O save atual será sobrescrito quando o novo jogo salvar. Deseja continuar?', () => G.newGame());
          } else G.newGame();
        }
      });
    }
    const big = $('bigBtn');
    if (big) big.addEventListener('click', onBigButton);
    const canvas = $('gl');
    if (canvas) {
      canvas.addEventListener('mousedown', () => {
        if (G.started && !G.paused && !UI.overlayOpen && !LL.Input.locked) LL.Input.lock();
      });
    }
    LL.on('pointerlock', (locked) => {
      if (!G.started) return;
      if (!locked && !G.paused && !UI.overlayOpen && !G._ignoreUnlock) {
        G.pause();
      }
    });
  }

  /* --------------------------------------------------------------- keybinds */
  function bindKeys() {
    LL.Input.onKey.push((code) => {
      if (!G.started) return;
      if (code === 'Escape') {
        if (G.paused) G.resume(); else G.pause();
        return;
      }
      if (code === 'KeyP') { if (G.paused) G.resume(); else G.pause(); return; }
      if (G.paused) return;
      if (code === 'KeyM') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showMap(); }
      else if (code === 'KeyJ') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showMissions(); }
      else if (code === 'KeyI') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showInventory(); }
      else if (code === 'KeyO') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showSettings(); }
      else if (code === 'KeyC') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showGarage(); }
      else if (code === 'KeyK') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showAchievements(); }
      else if (code === 'KeyU') { if (UI.overlayOpen) UI.closeOverlay(); else UI.showStats(); }
    });

    LL.on('character:switch', () => { UI.quickSwitch(); });
    LL.on('radio:next', () => {
      G.radioTrack = (G.radioTrack + 1) % RADIO.length;
      updateRadioLabel();
      LL.notify(RADIO[G.radioTrack].name + ' — ' + RADIO[G.radioTrack].artist, 'info', 'LEONIDA FM');
    });
  }

  function updateRadioLabel() {
    const el = $('radioTrack');
    if (el) el.textContent = RADIO[G.radioTrack % RADIO.length].name;
  }

  /* --------------------------------------------------------- game events */
  function bindGameEvents() {
    LL.on('player:died', () => {
      setTimeout(() => {
        const S = Player.state;
        const penalty = Math.round(S.money * 0.1);
        UI.bigEvent('wasted', 'WASTED', 'JASON & LUCIA NÃO MORREM', 'O hospital cobrou ' + U.fmtMoney(penalty) + ' pelo atendimento.', 'SAIR DO HOSPITAL');
        G._deathPenalty = penalty;
      }, 900);
    });

    LL.on('player:busted', () => {
      const fine = Math.min(Player.state.money, 320 + Math.max(1, LL.Police.wanted) * 220);
      UI.bigEvent('busted', 'PRESO', 'A POLÍCIA TE PEGOU', 'Fiança: ' + U.fmtMoney(fine) + '. As armas continuam com você.', 'PAGAR FIANÇA');
    });

    LL.on('vehicle:destroyed', (car) => {
      if (Player.state.inVehicle && Player.state.vehicle === car) {
        LL.notify('O veículo explodiu.', 'red', 'VEÍCULO');
      }
    });

    LL.on('wanted:changed', (n) => {
      if (n >= 4 && !G._heliWarned) { G._heliWarned = true; LL.notify('Helicóptero da LPD no ar.', 'red', 'PROCURADO'); }
      if (n === 0) G._heliWarned = false;
    });

    LL.on('weather:changed', (w) => {
      const names = { clear: 'Céu limpo', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade', fog: 'Nevoeiro' };
      if (LL.Settings.subtitles) LL.notify('Tempo: ' + (names[w] || w), 'info', 'LEONIDA');
    });

    LL.on('settings:changed', () => { if (G.applySettings) G.applySettings(); });

    LL.on('mission:failed', () => { G._missionFailAt = performance.now(); });

    addEventListener('resize', () => { if (innerWidth < 620) LL.notify('Leonida pede teclado e mouse.', 'gold', 'DISPOSITIVO'); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.started && LL.Settings.autosave) G.saveGame('blur');
      } else if (G.started && !G.paused) {
        LL.Input.lock();
      }
    });
  }

  function onBigButton() {
    const kind = UI._bigKind;
    UI.hideBig();
    if (kind === 'wasted') {
      const penalty = G._deathPenalty || Math.round(Player.state.money * 0.1);
      Player.respawn({ health: 100, moneyPenalty: penalty });
      Player.state.invuln = 3;
      LL.Input.lock();
      LL.notify('Você acordou no Hospital Leonida.', 'green', 'HOSPITAL');
    } else if (kind === 'busted') {
      Player.busted();
      LL.Input.lock();
      LL.notify('Fiança paga. Não faça de novo.', 'gold', 'POLÍCIA');
    } else {
      if (G.started) LL.Input.lock();
    }
    UI._bigKind = null;
  }

  /* -------------------------------------------------------------------- loop */
  let lastFrame = performance.now(), acc = 0;

  function frame(now) {
    if (!G.loop) return;
    requestAnimationFrame(frame);
    const raw = Math.min(0.05, (now - lastFrame) / 1000) || 0.016;
    lastFrame = now;

    // fps (smoothed over half a second)
    G._fpsAcc += raw; G._fpsFrames++;
    if (G._fpsAcc > 0.4) {
      G.fps = Math.round(G._fpsFrames / G._fpsAcc);
      G._fpsAcc = 0; G._fpsFrames = 0;
    }

    if (!G.booted) return;
    if (!G.started) { menuCamera(raw); renderFrame(); return; }

    const paused = G.paused || UI.overlayOpen || G.contextLost || UI._bigOpen;
    if (paused) {
      // keep the world lit and the camera alive, but freeze gameplay
      if (W.update) W.update(0, G.time);
      UI.updateHUD(0);
      renderFrame();
      return;
    }

    // bullet-time comes from the focus ability
    const scale = U.clamp(G.timeScale || 1, 0.2, 1.2);
    const dt = raw * scale;
    G.time += dt;
    G.playtime += raw;
    G.level = 1 + Math.floor(G.xp / 600);

    try { Player.update(dt); } catch (e) { LL.reportError(e, 'player.update'); }
    try { V.update(dt); } catch (e) { LL.reportError(e, 'vehicles.update'); }
    try { LL.Peds.update(dt); } catch (e) { LL.reportError(e, 'peds.update'); }
    try { LL.Police.update(dt); } catch (e) { LL.reportError(e, 'police.update'); }
    try { M.update(dt); } catch (e) { LL.reportError(e, 'missions.update'); }
    try { LL.Collect.update(dt); } catch (e) { LL.reportError(e, 'collect.update'); }
    try { LL.Econ.update(dt); } catch (e) { LL.reportError(e, 'economy.update'); }
    try { A.update(dt); } catch (e) { LL.reportError(e, 'ach.update'); }
    try { W.update(dt, G.time); } catch (e) { LL.reportError(e, 'world.update'); }
    try { UI.updateHUD(raw); } catch (e) { LL.reportError(e, 'ui.update'); }

    if (LL.Audio) {
      try {
        LL.Audio.update(raw, {
          urban: W.env ? W.env.urban : 0.5,
          wind: W.env ? W.env.wind : 0.2,
          water: W.env ? W.env.water : 0,
          rain: W.env ? W.env.rain : 0,
          duckMusic: W.env ? W.env.duckMusic : 0,
          siren: LL.Police.sirenCar ? U.clamp(1 - LL.Police.sirenDist / 300, 0, 0.9) : 0,
          chopper: LL.Police.wanted >= 4 ? 0.6 : 0,
        });
      } catch (e) { }
    }

    // autosave
    if (LL.Settings.autosave) {
      G._autosaveT += raw;
      if (G._autosaveT > 90) { G._autosaveT = 0; G.saveGame('auto'); }
    }

    // cash delta animation
    updateCashDelta();

    LL.Input.endFrame();
    renderFrame();
  }

  let lastCash = -1, cashTimer = 0;
  function updateCashDelta() {
    const S = Player.state;
    const el = $('cashDelta');
    if (!el) return;
    if (lastCash < 0) lastCash = S.money;
    if (S.money !== lastCash) {
      const d = S.money - lastCash;
      lastCash = S.money;
      el.textContent = (d > 0 ? '+' : '−') + U.fmtNum(Math.abs(d));
      el.classList.toggle('neg', d < 0);
      el.classList.add('show');
      cashTimer = 2.2;
    }
    if (cashTimer > 0) {
      cashTimer -= 0.016;
      if (cashTimer <= 0) el.classList.remove('show');
    }
  }

  function renderFrame() {
    if (!renderer || !scene || !camera || G.contextLost) return;
    try { renderer.render(scene, camera); } catch (e) { if (!G._renderErr) { G._renderErr = true; LL.reportError(e, 'render'); } }
  }

  /* ------------------------------------------------------------ menu camera */
  let menuAngle = 0;
  function menuCamera(dt) {
    if (!camera || !W.ready) return;
    menuAngle += dt * 0.045;
    const cx = W.WORLD * 0.52, cy = W.WATER_Y;
    const r = 980;
    const y = 190 + Math.sin(menuAngle * 0.7) * 40;
    camera.position.set(cx + Math.cos(menuAngle) * r, y, cy + Math.sin(menuAngle) * r);
    camera.lookAt(cx + Math.cos(menuAngle + 1.9) * 260, 30, cy + Math.sin(menuAngle + 1.9) * 260);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    // keep the world alive behind the menu
    if (W.update) W.update(dt, G.time += dt);
  }

  /* ------------------------------------------------------------------- boot */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('[main] Leonida Ultimate Overhaul carregado');
})();
