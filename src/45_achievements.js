/* ============================================================================
   45 · ACHIEVEMENTS + 100% CHECKLIST
   Keeps the original 12-item checklist and expands it with named achievements,
   XP, notifications and a weighted completion percentage.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U;
  const A = (LL.Achievements = {});

  const S = () => (LL.game && LL.game.stats) || {};

  /* ------------------------------------------------------- original checklist */
  // label, value getter, target, help text
  A.CHECKS = [
    { id: 'cars', label: 'Carros roubados', get: () => S().carsStolen || 0, target: 8, hint: 'Entre em qualquer veículo que não seja seu.' },
    { id: 'sold', label: 'Veículos vendidos', get: () => S().carsSold || 0, target: 4, hint: 'Venda carros roubados no Ferro-Velho.' },
    { id: 'stores', label: 'Lojas assaltadas', get: () => S().storesRobbed || 0, target: 4, hint: 'Assalte lojas de bairro e fuja antes da polícia.' },
    { id: 'peds', label: 'Pedestres roubados', get: () => S().pedsRobbed || 0, target: 8, hint: 'Aponte uma arma para um pedestre e pressione E.' },
    { id: 'smash', label: 'Smash e grab', get: () => S().smashGrab || 0, target: 6, hint: 'Arrombe carros trancados com o alarme ligado.' },
    { id: 'flam', label: 'Flamingos de cocaína', get: () => S().flamingos || 0, target: 15, hint: 'Os flamingos de plástico estão espalhados por Leonida.' },
    { id: 'escapes', label: 'Fugas da polícia', get: () => S().escapes || 0, target: 3, hint: 'Chegue a 2 estrelas e desapareça da visão deles.' },
    { id: 'clothes', label: 'Roupas usadas', get: () => S().outfitsUsed || 0, target: 4, hint: 'Compre disfarces na Casa Vice.' },
    { id: 'hacks', label: 'Hackeamentos Wenk', get: () => S().hacks || 0, target: 3, hint: 'Use o aplicativo Wenk para destravar um carro.' },
    { id: 'km', label: 'Distância dirigida (km)', get: () => Math.floor(S().kmDriven || 0), target: 8, hint: 'Rode pela cidade. Só isso.' },
    { id: 'boat', label: 'Viagem de barco', get: () => S().boatTrips || 0, target: 1, hint: 'Pegue um barco no Cais 7 ou na doca da ilha.' },
    { id: 'cops', label: 'Policiais abatidos', get: () => S().copsDown || 0, target: 5, hint: 'Cuidado: cada oficial derrubado aumenta o nível.' },
  ];

  /* ---------------------------------------------------------- named awards */
  // check: function returning true once earned
  A.LIST = [
    { id: 'first_blood', name: 'Primeira Noite', desc: 'Conclua a primeira missão da história.', xp: 40, check: () => (S().missions || 0) >= 1 },
    { id: 'story', name: 'Dono da Cidade', desc: 'Conclua todas as missões principais.', xp: 400, check: () => LL.Missions && LL.Missions.progress() >= 100 },
    { id: 'hustler', name: 'Bico Honesto', desc: 'Complete 4 missões secundárias.', xp: 150, check: () => LL.Missions && LL.Missions.completed.filter((id) => (LL.Missions.byId(id) || {}).kind === 'side').length >= 4 },
    { id: 'thief', name: 'Mão Leve', desc: 'Roube 5 veículos.', xp: 60, check: () => (S().carsStolen || 0) >= 5 },
    { id: 'chopshop', name: 'Desmanche', desc: 'Venda 3 veículos no receptador.', xp: 80, check: () => (S().carsSold || 0) >= 3 },
    { id: 'bandit', name: 'Assaltante de Bairro', desc: 'Assalte 3 lojas.', xp: 90, check: () => (S().storesRobbed || 0) >= 3 },
    { id: 'mugger', name: 'Pega Tudo', desc: 'Roube 5 pedestres.', xp: 60, check: () => (S().pedsRobbed || 0) >= 5 },
    { id: 'hacker', name: 'Wenk, na Veia', desc: 'Destrave 3 carros pelo celular.', xp: 70, check: () => (S().hacks || 0) >= 3 },
    { id: 'flamingo5', name: 'Jardim Cor-de-Rosa', desc: 'Colete 5 flamingos de cocaína.', xp: 80, check: () => (S().flamingos || 0) >= 5 },
    { id: 'flamingo15', name: 'Zoológico de Leonida', desc: 'Colete os 15 flamingos de cocaína.', xp: 300, check: () => (S().flamingos || 0) >= 15 },
    { id: 'clean', name: 'Invisível', desc: 'Despiste a polícia em 3.º nível ou acima.', xp: 150, check: () => (S().escapesHigh || 0) >= 1 },
    { id: 'wanted5', name: 'Procurado Nacional', desc: 'Alcance 5 estrelas de procurado.', xp: 200, check: () => (S().maxWanted || 0) >= 5 },
    { id: 'survive', name: 'Sobrevivente', desc: 'Sobreviva a um cerco policial de 90 segundos.', xp: 180, check: () => (S().survivedSieges || 0) >= 1 },
    { id: 'rich', name: 'Primeiro Milhão', desc: 'Acumule $1.000.000.', xp: 500, check: () => LL.Player && LL.Player.state.money >= 1000000 },
    { id: 'driver', name: 'Táxi de Leonida', desc: 'Dirija 5 km.', xp: 70, check: () => (S().kmDriven || 0) >= 5 },
    { id: 'sailor', name: 'Pé na Água', desc: 'Pilote um barco até a ilha.', xp: 90, check: () => (S().boatTrips || 0) >= 1 },
    { id: 'racer', name: 'Foguete de Coral', desc: 'Passe dos 240 km/h.', xp: 160, check: () => (S().topSpeed || 0) >= 240 },
    { id: 'collector', name: 'Colecionador', desc: 'Encontre 10 itens espalhados pelo mapa.', xp: 120, check: () => (S().cashFound || 0) > 0 && (S().weaponsFound || 0) + (S().armorsFound || 0) >= 6 },
    { id: 'cook', name: 'Bem na Foto', desc: 'Gaste $10.000 na cidade.', xp: 100, check: () => (S().moneySpent || 0) >= 10000 },
    { id: 'surgeon', name: 'Mãos de Tesoura', desc: 'Faça 12 reparos ou pinturas.', xp: 90, check: () => (S().customs || 0) >= 12 },
    { id: 'outfits', name: 'Passarela Vice', desc: 'Compre 4 roupas diferentes.', xp: 110, check: () => (S().outfitsUsed || 0) >= 4 },
    { id: 'deaths', name: 'Má Sorte Crônica', desc: 'Morra 3 vezes. Leonida cobra caro.', xp: 30, check: () => (S().deaths || 0) >= 3 },
    { id: 'hundred', name: '100% Leonida', desc: 'Complete a lista inteira de 100%.', xp: 1000, check: () => A.percent() >= 100 },
  ];

  A.unlocked = [];
  A._seen = {};

  A.byId = (id) => A.LIST.find((a) => a.id === id);

  A.unlock = function (id, silent) {
    if (A.unlocked.includes(id)) return false;
    const def = A.byId(id);
    if (!def) return false;
    A.unlocked.push(id);
    if (LL.game) LL.game.xp = (LL.game.xp || 0) + (def.xp || 0);
    if (S().achievements === undefined) S().achievements = 0;
    S().achievements = A.unlocked.length;
    if (!silent) {
      LL.notify(def.name + ' — ' + def.desc, 'gold', 'CONQUISTA');
      try { LL.Audio.ui('ach'); } catch (e) { }
      if (LL.UI && LL.UI.bigEvent) {
        // only the big card for rare ones so it doesn't get spammy
        if ((def.xp || 0) >= 200) LL.UI.bigEvent('win', 'CONQUISTA DESBLOQUEADA', def.name, def.desc + ' · +' + def.xp + ' XP');
      }
    }
    LL.emit('achievement:unlocked', def);
    return true;
  };

  /* ------------------------------------------------------------ percentages */
  A.checkValue = function (c) {
    try { return Math.min(c.target, Math.max(0, c.get())); }
    catch (e) { return 0; }
  };

  A.percent = function () {
    const listDone = A.LIST.filter((a) => A.unlocked.includes(a.id)).length;
    const listPct = listDone / Math.max(1, A.LIST.length);
    const checkDone = A.CHECKS.reduce((acc, c) => acc + A.checkValue(c) / c.target, 0) / A.CHECKS.length;
    const missionPct = LL.Missions ? LL.Missions.progress() / 100 : 0;
    // 60% checklist, 25% missions, 15% achievements
    return Math.round((checkDone * 0.6 + missionPct * 0.25 + listPct * 0.15) * 100);
  };

  /* ----------------------------------------------------------------- events */
  function bindEvents() {
    let prevWanted = 0;
    LL.on('wanted:changed', (n) => {
      const st = S();
      if (n > (st.maxWanted || 0)) st.maxWanted = n;
      if (prevWanted > 0 && n === 0) {
        st.escapes = (st.escapes || 0) + 1;
        if (prevWanted >= 3) st.escapesHigh = (st.escapesHigh || 0) + 1;
      }
      prevWanted = n;
    });
    LL.on('outfit:changed', (idx) => {
      const st = S();
      if (!st._outfits) st._outfits = [];
      if (!st._outfits.includes(idx)) {
        st._outfits.push(idx);
        st.outfitsUsed = st._outfits.length;
      }
    });
    LL.on('vehicle:crash', (car) => {
      if (!car) return;
      const kmh = Math.abs(car.speed || 0) * 3.6;
      const st = S();
      if (kmh > (st.topSpeed || 0)) st.topSpeed = Math.round(kmh);
      st.crashes = (st.crashes || 0) + 1;
    });
    LL.on('mission:completed', (def) => {
      if (!def) return;
      if (def.steps && def.steps.some((s) => s.type === 'survive')) S().survivedSieges = (S().survivedSieges || 0) + 1;
      if (def.id === 's6') STATS().topSpeed = Math.max(STATS().topSpeed || 0, 240);
    });
    LL.on('money:changed', (money, delta) => {
      if (delta < 0) S().moneySpent = (S().moneySpent || 0) + Math.min(0, -delta);
    });
    LL.on('collectible:flamingo', () => A.refresh(true));
  }
  function STATS() { return S(); }

  // rate-limited refresh so the HUD/page doesn't get hammered every frame
  let acc = 0;
  A.refresh = function (force) {
    if (!LL.game) return;
    for (const a of A.LIST) {
      if (A.unlocked.includes(a.id)) continue;
      let ok = false;
      try { ok = !!a.check(); } catch (e) { ok = false; }
      if (ok) A.unlock(a.id);
    }
  };

  A.update = function (dt) {
    acc += dt;
    if (acc < 0.7) return;
    acc = 0;
    A.refresh();
    const pct = A.percent();
    if (LL.game) LL.game.progress = pct;
    const el = document.getElementById('achInfo');
    if (el) {
      const txt = A.unlocked.length + ' / ' + A.LIST.length;
      if (el.textContent !== txt) el.textContent = txt;
    }
  };

  A.serialize = function () {
    return { unlocked: A.unlocked.slice(), outfits: (S()._outfits || []).slice() };
  };
  A.restore = function (d) {
    if (!d) return;
    A.unlocked = Array.isArray(d.unlocked) ? d.unlocked.slice() : [];
    const st = S();
    if (Array.isArray(d.outfits)) { st._outfits = d.outfits.slice(); st.outfitsUsed = st._outfits.length; }
    st.achievements = A.unlocked.length;
  };

  A.reset = function () { A.unlocked.length = 0; };

  A.init = function () { bindEvents(); };

  console.log('[achievements] ' + A.LIST.length + ' conquistas, ' + A.CHECKS.length + ' itens de checklist');
})();
