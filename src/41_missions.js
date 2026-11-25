/* ============================================================================
   41 · MISSIONS — data-driven main story + side jobs, markers, objectives.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U, THREE = window.THREE;
  const W = LL.World, V = LL.Vehicles, Player = LL.Player;
  const M = (LL.Missions = { active: null, completed: [], available: [], stepIndex: 0, timer: 0, markers: [] });

  const POS = {
    safehouseJason: () => { const p = W.pois.find((x) => x.name === 'Casa de Jason'); return p ? { x: p.x, y: p.y + 10 } : { x: 3 * 420, y: 3 * 420 }; },
    safehouseLucia: () => { const p = W.pois.find((x) => x.name === 'Casa de Lucia'); return p ? { x: p.x, y: p.y + 10 } : { x: 6 * 420, y: 9 * 420 }; },
    garage: () => { const p = W.pois.find((x) => x.service === 'garage'); return p ? { x: p.x, y: p.y + 18 } : { x: 3 * 420, y: 3 * 420 }; },
    dealer: () => { const p = W.pois.find((x) => x.service === 'dealer'); return p ? { x: p.x, y: p.y + 34 } : { x: 5 * 420, y: 5 * 420 }; },
    port: () => { const p = W.pois.find((x) => x.service === 'port'); return p ? { x: p.x, y: p.y + 20 } : { x: 10 * 420, y: 8 * 420 }; },
    hospital: () => { const p = W.pois.find((x) => x.service === 'hospital'); return p ? { x: p.x, y: p.y + 16 } : { x: 4 * 420, y: 6 * 420 }; },
    beach: () => { const p = W.pois.find((x) => x.service === 'bar'); return p ? { x: p.x, y: p.y + 14 } : { x: 11 * 420, y: 3 * 420 }; },
    casino: () => { const p = W.pois.find((x) => x.service === 'casino'); return p ? { x: p.x, y: p.y + 12 } : { x: 8 * 420, y: 5 * 420 }; },
    island: () => ({ x: W.env.ISLAND.x + 74, y: W.env.ISLAND.y - 40 }),
    strip: () => ({ x: 7.7 * 420, y: 4.6 * 420 }),
  };
  M.POS = POS;

  /* ---------------------------------------------------------------- mission data */
  M.MISSIONS = [
    {
      id: 'm1', kind: 'main', name: 'Primeira Noite', giver: 'Jason',
      district: 'LITTLE HAVANA', desc: 'Chegue em casa, guarde o dinheiro e durma. Leonida não espera ninguém.',
      start: POS.safehouseJason,
      steps: [
        { type: 'goto', pos: POS.safehouseJason, radius: 9, label: 'Vá até a casa de Jason' },
        { type: 'goto', pos: POS.garage, radius: 10, label: 'Passe na oficina e conheça o lugar' },
        { type: 'goto', pos: POS.safehouseJason, radius: 9, label: 'Volte para casa e durma' },
      ],
      reward: { money: 750, xp: 40 },
      dialogue: { start: [['Jason', 'Leonida te dá uma chance por noite. Hoje você já gastou a sua.'], ['Lucia', 'Então não durma. A cidade tá acordada.']], end: [['Jason', 'Amanhã tem trabalho.']] },
    },
    {
      id: 'm2', kind: 'main', name: 'Carga Rápida', giver: 'Lucia',
      district: 'PORTO LEONIDA', desc: 'Pegue a van no estacionamento do porto e entregue a carga no Cais 7 antes que alguém perceba.',
      start: POS.safehouseLucia,
      steps: [
        { type: 'steal', vehicle: 'van', label: 'Roube a van de carga' },
        { type: 'deliver', pos: POS.port, radius: 14, label: 'Entregue a van no Cais 7' },
      ],
      reward: { money: 1400, xp: 80 },
      dialogue: { start: [['Lucia', 'A van tá no estacionamento. Não risca a pintura, é alugada.']], end: [['Lucia', 'Boa. O comprador nem perguntou de onde veio.']] },
    },
    {
      id: 'm3', kind: 'main', name: 'Dívida de Jogo', giver: 'Coral',
      district: 'NEON STRIP', desc: 'Três pacotes espalhados pela Strip. Colete todos antes que a polícia chegue.',
      start: POS.casino,
      steps: [
        { type: 'goto', pos: () => ({ x: 8.2 * 420, y: 3.2 * 420 }), radius: 8, label: 'Pacote 1 — beco da Strip' },
        { type: 'goto', pos: () => ({ x: 9.1 * 420, y: 4.4 * 420 }), radius: 8, label: 'Pacote 2 — praça do cassino' },
        { type: 'goto', pos: () => ({ x: 7.4 * 420, y: 5.6 * 420 }), radius: 8, label: 'Pacote 3 — estacionamento' },
        { type: 'escape', label: 'Despiste a polícia' },
      ],
      reward: { money: 2200, xp: 140 },
      dialogue: { start: [['Coral', 'Três pacotes. Nenhum é seu. Traga todos.'], ['Jason', 'E se eu abrir um?'], ['Coral', 'Aí você abre o caixão.']], end: [['Coral', 'Você é mais confiável do que parece.']] },
      onStart() { LL.Police.reportCrime('assalto', Player.state.pos.x, Player.state.pos.y, 1); },
    },
    {
      id: 'm4', kind: 'main', name: 'O Rastreador', giver: 'Oficina',
      district: 'DOWNTOWN LEONIDA', desc: 'Roube o esportivo do estacionamento do centro. O carro tem rastreador — a polícia vai saber.',
      start: POS.garage,
      steps: [
        { type: 'steal', vehicle: 'sports', label: 'Roube o esportivo rastreado' },
        { type: 'goto', pos: POS.garage, radius: 12, label: 'Leve o carro para a oficina' },
      ],
      reward: { money: 3200, xp: 220 },
      dialogue: { start: [['Mecânico', 'O carro é bonito, o rastreador é feio. Corte os dois.']], end: [['Mecânico', 'Rastreador instalado no meu bolso. Bom trabalho.']] },
      onStart() {
        M.spawnTargetVehicle('sports', true);
      },
    },
    {
      id: 'm5', kind: 'main', name: 'Cais 7', giver: 'Capitão',
      district: 'BAÍA DE LEONIDA', desc: 'Coloque o barco na água e leve a encomenda até o farol da ilha.',
      start: POS.port,
      steps: [
        { type: 'arena', pos: POS.port, radius: 40, label: 'Entre em um barco no Cais 7' },
        { type: 'deliver', pos: POS.island, radius: 16, label: 'Chegue ao farol da ilha', boat: true },
      ],
      reward: { money: 4200, xp: 300 },
      dialogue: { start: [['Capitão', 'Barco no Cais 7. A ilha é logo ali, não tem erro.']], end: [['Capitão', 'A encomenda chegou seca. Ótimo.']] },
    },
    {
      id: 'm6', kind: 'main', name: 'O Último Negócio', giver: 'Jason',
      district: 'LEONIDA', desc: 'Sobreviva aos reforços policiais por 90 segundos. Depois disso a cidade muda de dono.',
      start: POS.hospital,
      steps: [
        { type: 'survive', seconds: 90, wanted: 3, label: 'Sobreviva ao cerco policial' },
        { type: 'escape', label: 'Saia da área e despiste a polícia' },
      ],
      reward: { money: 9000, xp: 600 },
      dialogue: { start: [['Jason', 'Ou a gente termina isso hoje, ou não termina nunca.']], end: [['Lucia', 'Agora a cidade sabe quem somos.']] },
      onStart() { LL.Police.reportCrime('explosao', Player.state.pos.x, Player.state.pos.y, 3); },
    },

    /* ------------------------------------------------------------------ side */
    {
      id: 's1', kind: 'side', name: 'Corrida da Strip', giver: 'Mecânico', district: 'NEON STRIP',
      desc: 'Passe pelos quatro checkpoints da Strip em menos de 95 segundos.',
      start: POS.strip,
      steps: [
        { type: 'goto', pos: () => ({ x: 7.2 * 420, y: 3.4 * 420 }), radius: 16, label: 'Checkpoint 1' },
        { type: 'goto', pos: () => ({ x: 8.6 * 420, y: 3.9 * 420 }), radius: 16, label: 'Checkpoint 2' },
        { type: 'goto', pos: () => ({ x: 9.2 * 420, y: 5.2 * 420 }), radius: 16, label: 'Checkpoint 3' },
        { type: 'goto', pos: () => ({ x: 7.9 * 420, y: 5.7 * 420 }), radius: 16, label: 'Checkpoint 4' },
      ],
      timeLimit: 95,
      reward: { money: 1800, xp: 120 },
    },
    {
      id: 's2', kind: 'side', name: 'Ferro-Velho', giver: 'Receptador', district: 'EVERGLADES',
      desc: 'Roube qualquer veículo e venda no receptador. Sem perguntas.',
      start: () => { const p = W.pois.find((x) => x.service === 'fence'); return { x: p.x, y: p.y + 14 }; },
      steps: [
        { type: 'stealAny', label: 'Roube um veículo' },
        { type: 'deliver', pos: () => { const p = W.pois.find((x) => x.service === 'fence'); return { x: p.x, y: p.y + 14 }; }, radius: 14, label: 'Venda no receptador', exitVehicle: true },
      ],
      reward: { money: 1500, xp: 90 },
    },
    {
      id: 's3', kind: 'side', name: 'Táxi Ilegal', giver: 'Desconhecido', district: 'OCEAN DRIVE',
      desc: 'Leve o passageiro até o Bar do Sol em uma só peça.',
      start: POS.beach,
      steps: [
        { type: 'stealAny', label: 'Pegue um carro' },
        { type: 'deliver', pos: POS.beach, radius: 15, label: 'Deixe o passageiro no Bar do Sol' },
      ],
      reward: { money: 900, xp: 70 },
    },
    {
      id: 's4', kind: 'side', name: 'Assalto ao Mercado', giver: 'Lucia', district: 'OCEAN DRIVE',
      desc: 'Assalte uma loja e saia antes da polícia fechar o quarteirão.',
      start: POS.dealer,
      steps: [
        { type: 'rob', label: 'Assalte uma loja' },
        { type: 'escape', label: 'Fuja da polícia' },
      ],
      reward: { money: 1200, xp: 100 },
    },
    {
      id: 's5', kind: 'side', name: 'Noite no Cassino', giver: 'Coral', district: 'NEON STRIP',
      desc: 'Ganhe $3.000 na roleta do Hotel Coral. A casa sempre ganha — quase sempre.',
      start: POS.casino, hidden: true,
      canStart: () => true,
      steps: [{ type: 'money', amount: 3000, label: 'Ganhe $3.000 no cassino' }],
      reward: { money: 1000, xp: 60 },
    },
    {
      id: 's6', kind: 'side', name: 'Foguete de Coral', giver: 'Mecânico', district: 'VICE BEACH',
      desc: 'Pegue o carro mais rápido da cidade e passe dos 240 km/h na avenida da praia.',
      start: POS.beach,
      steps: [{ type: 'speed', kmh: 240, label: 'Atingir 240 km/h' }],
      reward: { money: 2600, xp: 150 },
    },
  ];
  M.byId = (id) => M.MISSIONS.find((m) => m.id === id);

  /* --------------------------------------------------------------- markers */
  let markerGroup = null;
  function markers() {
    if (!markerGroup) {
      markerGroup = new THREE.Group();
      markerGroup.name = 'mission-markers';
      if (W.scene) W.scene.add(markerGroup);
    }
    return markerGroup;
  }
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  function makeMarker(x, y, color) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.6, 32), markerMat.clone());
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25;
    ring.material.color.set(color || 0xffcf5c);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 26, 10, 1, true), markerMat.clone());
    beam.position.y = 13;
    beam.material.color.set(color || 0xffcf5c);
    beam.material.opacity = 0.14;
    g.add(ring, beam);
    g.position.set(x, 0, y);
    markers().add(g);
    return { group: g, ring, beam, x, y };
  }

  M.clearMarkers = function () {
    for (const m of M.markers) { try { markers().remove(m.group); } catch (e) { } }
    M.markers.length = 0;
  };

  function setWorldMarkers() {
    M.clearMarkers();
    // one marker for the closest available main mission
    const g = LL.game;
    if (!g || M.active) return;
    const next = M.MISSIONS.find((m) => m.kind === 'main' && !M.completed.includes(m.id));
    if (next) {
      const p = typeof next.start === 'function' ? next.start() : next.start;
      if (p) M.markers.push(makeMarker(p.x, p.y, 0xffcf5c));
    }
  }

  /* ------------------------------------------------------------------ engine */
  M.start = function (id) {
    const def = M.byId(id);
    if (!def) return false;
    if (M.active) { LL.notify('Termine a missão atual primeiro.', 'gold', 'MISSÕES'); return false; }
    M.active = { def, step: 0, timer: 0, checkpoint: 0, target: null, startTime: LL.game.time, earned: 0 };
    M.stepIndex = 0;
    M.clearMarkers();
    if (def.dialogue && def.dialogue.start && LL.Settings.subtitles) {
      for (let i = 0; i < def.dialogue.start.length; i++) {
        const [who, line] = def.dialogue.start[i];
        setTimeout(() => LL.UI.subtitle('<b>' + who + ':</b> ' + line, 4200), i * 2400);
      }
    }
    try { LL.Audio.ui('mission'); } catch (e) { }
    if (def.onStart) { try { def.onStart(); } catch (e) { LL.reportError(e, 'mission.onStart'); } }
    if (def.timeLimit) M.active.timer = def.timeLimit;
    M.enterStep(0);
    LL.emit('mission:started', def);
    return true;
  };

  M.enterStep = function (i) {
    const a = M.active;
    if (!a) return;
    const def = a.def, step = def.steps[i];
    a.step = i;
    M.stepIndex = i;
    if (!step) { M.finish(true); return; }
    M.clearMarkers();
    let pos = step.pos;
    if (typeof pos === 'function') pos = pos();
    if (step.type === 'steal') {
      if (!M._targetCar || M._targetCar.destroyed) M.spawnTargetVehicle(step.vehicle || 'sedan', false);
      if (M._targetCar) M.markers.push(makeMarker(M._targetCar.pos.x, M._targetCar.pos.y, 0x22d3ee));
      LL.UI.setObjective(def.name, step.label);
    } else if (pos) {
      M.markers.push(makeMarker(pos.x, pos.y, 0xffcf5c));
      LL.UI.setObjective(def.name, step.label);
    } else {
      LL.UI.setObjective(def.name, step.label || def.desc);
    }
    if (step.type === 'survive') {
      a.timer = step.seconds;
      if (step.wanted) { LL.Police.setWanted(step.wanted); LL.Police.reportCrime('explosao', Player.state.pos.x, Player.state.pos.y, step.wanted); }
    }
    if (step.type === 'rob') { a.robStart = LL.game.stats.storesRobbed || 0; }
    if (step.type === 'money') { a.moneyStart = LL.game.stats.moneyEarned || 0; }
    LL.emit('mission:step', i, step);
  };

  M.spawnTargetVehicle = function (type, tracker) {
    const S = Player.state;
    // choose a free spot 60-120 m away on a road
    let spot = null;
    for (let n = 0; n < 40 && !spot; n++) {
      const a = Math.random() * Math.PI * 2, d = U.rand(120, 55);
      let x = S.pos.x + Math.cos(a) * d, y = S.pos.y + Math.sin(a) * d;
      if (Math.abs(Math.sin(a)) > Math.abs(Math.cos(a))) y = Math.round(y / 420) * 420 + 24;
      else x = Math.round(x / 420) * 420 + 24;
      if (x < 200 || y < 200 || x > W.WORLD - 200 || y > W.WORLD - 200) continue;
      if (!W.canDrive(x, y)) continue;
      spot = { x, y };
    }
    if (!spot) spot = { x: S.pos.x + 30, y: S.pos.y + 20 };
    const car = V.spawn(type, spot.x, spot.y, U.rand(6.28), { force: true, locked: true, alarm: true, tracker: !!tracker, fuel: 45 });
    if (car) car.quest = true;
    M._targetCar = car;
    return car;
  };

  M.finish = function (ok) {
    const a = M.active;
    if (!a) return;
    const def = a.def;
    M.clearMarkers();
    if (M._targetCar) { M._targetCar.quest = false; M._targetCar = null; }
    if (!ok) {
      M.active = null;
      LL.UI.setObjective('', '');
      LL.notify('Missão falhou: ' + def.name, 'red', 'MISSÕES');
      try { LL.Audio.ui('fail'); } catch (e) { }
      LL.emit('mission:failed', def);
      return;
    }
    if (!M.completed.includes(def.id)) M.completed.push(def.id);
    const r = def.reward || { money: 500, xp: 50 };
    Player.addMoney(r.money, 'missão');
    LL.game.xp = (LL.game.xp || 0) + (r.xp || 0);
    LL.game.stats.missions = (LL.game.stats.missions || 0) + 1;
    if (def.dialogue && def.dialogue.end) {
      for (let i = 0; i < def.dialogue.end.length; i++) {
        const [who, line] = def.dialogue.end[i];
        setTimeout(() => LL.UI.subtitle('<b>' + who + ':</b> ' + line, 4000), i * 2200);
      }
    }
    LL.UI.bigEvent('mission', 'MISSÃO CONCLUÍDA', def.name, 'Recompensa: ' + U.fmtMoney(r.money));
    M.active = null;
    LL.UI.setObjective('', '');
    try { LL.Audio.ui('mission'); } catch (e) { }
    LL.emit('mission:completed', def);
    setTimeout(setWorldMarkers, 2500);
  };

  M.abort = function () {
    if (!M.active) return false;
    M.finish(false);
    return true;
  };

  /* ------------------------------------------------------------------- update */
  M.update = function (dt) {
    M.updateRings(dt);
    const a = M.active;
    if (!a) {
      // refresh world markers occasionally (cheap)
      if (!M._wm) { M._wm = true; setWorldMarkers(); }
      return;
    }
    const def = a.def, step = def.steps[a.step];
    if (!step) { M.finish(true); return; }
    const S = Player.state;

    if (def.timeLimit) {
      a.timer -= dt;
      LL.UI.setObjective(def.name, step.label + ' · ' + Math.max(0, Math.ceil(a.timer)) + 's');
      if (a.timer <= 0) { M.finish(false); return; }
    }

    switch (step.type) {
      case 'goto':
      case 'arena': {
        let p = step.pos; if (typeof p === 'function') p = p();
        const d = Math.hypot(p.x - S.pos.x, p.y - S.pos.y);
        if (step.type === 'arena') {
          if (S.inVehicle) M.advance();
        } else if (d < (step.radius || 8)) M.advance();
        break;
      }
      case 'steal': {
        const car = M._targetCar;
        if (car && S.vehicle === car) { M.advance(); }
        else if (car && car.destroyed) { M.finish(false); }
        break;
      }
      case 'stealAny': {
        if (S.inVehicle && !S.vehicle.owned && S.vehicle.driver === 'player') M.advance();
        break;
      }
      case 'deliver': {
        let p = step.pos; if (typeof p === 'function') p = p();
        const d = Math.hypot(p.x - S.pos.x, p.y - S.pos.y);
        if (step.boat) { if (S.inVehicle && S.vehicle.boat && d < (step.radius || 14)) M.advance(); }
        else if (d < (step.radius || 14)) {
          if (step.exitVehicle && S.inVehicle) {
            LL.Player.exitVehicle();
            setTimeout(() => { if (M.active && M.active.step === a.step) M.advance(); }, 120);
          } else M.advance();
        }
        break;
      }
      case 'escape': {
        if (LL.Police.wanted === 0) M.advance();
        break;
      }
      case 'survive': {
        a.timer -= dt;
        LL.UI.setObjective(def.name, step.label + ' · ' + Math.max(0, Math.ceil(a.timer)) + 's');
        if (a.timer <= 0) M.advance();
        break;
      }
      case 'rob': {
        const now = LL.game.stats.storesRobbed || 0;
        if (now > (a.robStart || 0)) M.advance();
        break;
      }
      case 'money': {
        const now = LL.game.stats.moneyEarned || 0;
        if (now - (a.moneyStart || 0) >= (step.amount || 1000)) M.advance();
        break;
      }
      case 'speed': {
        const car = S.vehicle;
        if (car && car.kmh >= (step.kmh || 200)) M.advance();
        break;
      }
      case 'kill': {
        if ((LL.game.stats.pedsHurt || 0) >= (a.killStart || 0) + (step.count || 1)) M.advance();
        break;
      }
    }
  };

  M.advance = function () {
    const a = M.active;
    if (!a) return;
    a.step++;
    if (a.step >= a.def.steps.length) { M.finish(true); return; }
    M.enterStep(a.step);
  };

  M.updateRings = function (dt) {
    const t = LL.game.time;
    for (const m of M.markers) {
      m.ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
      m.ring.rotation.z += dt * 0.35;
      m.beam.material.opacity = 0.1 + Math.sin(t * 2.4) * 0.05;
      if (M._targetCar && M.active && M.active.def.steps[M.active.step] && M.active.def.steps[M.active.step].type === 'steal') {
        m.group.position.x = M._targetCar.pos.x;
        m.group.position.z = M._targetCar.pos.y;
        m.x = M._targetCar.pos.x; m.y = M._targetCar.pos.y;
      }
    }
  };

  /* -------------------------------------------------------- interaction hooks */
  M.tryStartNearby = function () {
    const S = Player.state;
    for (const m of M.markers) {
      if (Math.hypot(m.x - S.pos.x, m.y - S.pos.y) < 6.5) {
        const next = M.MISSIONS.find((d) => d.kind === 'main' && !M.completed.includes(d.id));
        if (next) { M.start(next.id); return true; }
      }
    }
    return false;
  };

  const origInteract = Player.interact;
  Player.interact = function () {
    if (M.tryStartNearby()) return;
    return origInteract.apply(Player, arguments);
  };

  M.serialize = function () { return { completed: M.completed.slice() }; };
  M.restore = function (d) {
    if (!d) return;
    M.completed = Array.isArray(d.completed) ? d.completed.slice() : [];
    M._wm = false;
    setWorldMarkers();
  };

  M.progress = function () {
    return Math.round((M.completed.filter((id) => { const d = M.byId(id); return d && d.kind === 'main'; }).length / M.MISSIONS.filter((m) => m.kind === 'main').length) * 100);
  };

  M.availableMissions = function () {
    const g = LL.game;
    return M.MISSIONS.filter((m) => !m.hidden && !M.completed.includes(m.id));
  };

  console.log('[missions] prontas —', M.MISSIONS.length, 'missões');
})();
