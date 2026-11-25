/* ============================================================================
   51 · PANELS — map, stats, achievements, settings, controls, garage,
   inventory, missions and every service UI (shops, gas, hospital, fence…).
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U;
  const W = LL.World, V = LL.Vehicles, Player = LL.Player, Econ = LL.Econ, M = LL.Missions;
  const UI = LL.UI;
  const D = UI.dom;
  const esc = UI.esc;

  const money = () => (Player && Player.state ? Player.state.money : 0);
  const cash = (n) => U.fmtMoney(n);
  const fmt = (n) => U.fmtNum(Math.round(n));

  /* -------------------------------------------------------- action registry */
  const acts = (UI._acts = UI._acts || Object.create(null));
  let actSeq = 0;
  function act(fn) { const id = 'act' + (++actSeq); acts[id] = fn; return id; }
  UI.bindActions = function () {
    if (UI._actsBound || !D.overlayBody) return;
    UI._actsBound = true;
    D.overlayBody.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const fn = acts[el.getAttribute('data-act')];
      if (!fn) return;
      e.preventDefault();
      try { fn(el, e); } catch (err) { LL.reportError(err, 'panel.action'); }
    });
    D.overlayBody.addEventListener('input', (e) => {
      const el = e.target.closest('[data-set]');
      if (!el) return;
      applySetting(el);
    });
  };

  function applySetting(el) {
    const key = el.getAttribute('data-set');
    const kind = el.getAttribute('data-kind') || 'range';
    let val;
    if (kind === 'switch') val = el.classList.toggle('on');
    else if (kind === 'range') val = Number(el.value);
    else if (kind === 'select') val = el.value;
    if (key === 'quality') { LL.Settings.applyQuality(val); }
    else LL.Settings.set(key, val);
    if (LL.Game && LL.Game.applySettings) LL.Game.applySettings();
    const out = el.parentElement && el.parentElement.querySelector('output');
    if (out && kind === 'range') out.textContent = val;
    if (kind === 'select' || kind === 'switch') UI.showSettings();
  }

  /* -------------------------------------------------------------- shared bits */
  function shopHead(extra) {
    return '<div class="shop-head"><div><div class="section-label" style="margin:0">CAIXA</div>' +
      '<div class="shop-money"><small>DINHEIRO DISPONÍVEL</small>' + cash(money()) + '</div></div>' +
      '<div class="btn-row">' + (extra || '') + '</div></div>';
  }
  function card(title, sub, price, actId, btnLabel, disabled) {
    return '<div class="card shop-item">' +
      '<div><div class="name">' + esc(title) + '</div><div class="sub">' + sub + '</div></div>' +
      '<div class="bottom"><div class="price">' + price + '</div>' +
      '<button class="btn small" data-act="' + actId + '"' + (disabled ? ' disabled' : '') + '>' + (btnLabel || 'COMPRAR') + '</button></div>' +
      '</div>';
  }
  function currentCar(radius) {
    const S = Player.state;
    if (S.inVehicle && S.vehicle) return S.vehicle;
    return V.nearest(S.pos.x, S.pos.y, radius || 14);
  }
  function refresh() { if (UI._currentService) UI.openService(UI._currentService, true); }

  /* -------------------------------------------------------------------- map */
  UI.showMap = function () {
    const S = Player.state;
    const legend = [
      ['#33e19a', 'Serviços'], ['#ffcf5c', 'Missões'], ['#ff3d6e', 'Você'], ['#5c8dff', 'Polícia'],
    ].map(([c, l]) => '<span><i style="background:' + c + '"></i>' + l + '</span>').join('');
    const districts = (W.districts || []).map((d) => '<span class="chip">' + esc(d.name || d) + '</span>').join('');
    UI.openOverlay('LEONIDA', 'MAPA DA CIDADE',
      '<div class="map-head"><div>Arraste o mapa com o mouse. Cada quarteirão tem algo dentro.</div>' +
      '<div>' + W.pois.length + ' pontos de interesse · ' + (W.blocks || []).length + ' quarteirões</div></div>' +
      '<div class="map-wrap"><canvas id="bigMap" width="900" height="900" style="width:100%;height:auto;display:block"></canvas>' +
      '<div class="map-legend">' + legend + '</div></div>' +
      '<div class="section-label">DISTRITOS</div><div class="district-chips">' + districts + '</div>' +
      '<div class="section-label">PONTOS DE INTERESSE PRÓXIMOS</div>' +
      nearbyPoiList(S.pos.x, S.pos.y));
    requestAnimationFrame(() => drawBigMap());
  };

  function nearbyPoiList(px, py) {
    const list = (W.pois || []).slice()
      .map((p) => ({ p, d: Math.hypot(p.x - px, p.y - py) }))
      .sort((a, b) => a.d - b.d).slice(0, 12);
    if (!list.length) return '<div class="empty">Nenhum serviço registrado.</div>';
    return list.map(({ p, d }) =>
      '<div class="item-row"><div><div class="nm">' + esc(p.name) + '</div><div class="ds">' + esc(p.desc || '') + '</div></div>' +
      '<div class="rt"><span class="tag">' + Math.round(d) + ' m</span></div></div>').join('');
  }

  function drawBigMap() {
    const cv = document.getElementById('bigMap');
    if (!cv || !W.mapCanvas) return;
    const g = cv.getContext('2d'), S = cv.width;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#08131c'; g.fillRect(0, 0, S, S);
    const sc = S / W.mapCanvas.width;
    g.drawImage(W.mapCanvas, 0, 0, S, S);
    const toS = (x, y) => ({ x: x * W.mapScale * sc, y: y * W.mapScale * sc });
    // POIs
    for (const p of W.pois) {
      const q = toS(p.x, p.y);
      g.fillStyle = p.color || '#ffcf5c';
      g.beginPath(); g.arc(q.x, q.y, 5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 1.5; g.stroke();
    }
    // missions
    if (M) for (const m of M.markers) {
      const q = toS(m.x, m.y);
      g.save(); g.translate(q.x, q.y); g.rotate(Math.PI / 4);
      g.fillStyle = '#ffcf5c'; g.fillRect(-6, -6, 12, 12); g.restore();
    }
    // player
    const S2 = Player.state;
    const q = toS(S2.pos.x, S2.pos.y);
    g.save(); g.translate(q.x, q.y); g.rotate(S2.angle);
    g.fillStyle = '#ff3d6e'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, 7); g.lineTo(-3, 0); g.lineTo(-7, -7); g.closePath();
    g.fill(); g.stroke(); g.restore();
    // district labels
    g.font = 'bold 13px Rajdhani, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(233,238,247,.55)';
    for (const d of (W.districts || [])) {
      if (d.x === undefined) continue;
      const c = toS(d.x, d.y);
      g.fillText(String(d.name || '').toUpperCase(), c.x, c.y);
    }
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.font = '11px system-ui, sans-serif';
    g.fillText('BAÍA DE LEONIDA', S * 0.88, S * 0.55);
  }

  /* ------------------------------------------------------------------ stats */
  UI.showStats = function () {
    const st = LL.game.stats || {};
    const S = Player.state;
    const played = LL.game.playtime || 0;
    const totalAch = (LL.Achievements && LL.Achievements.LIST.length) || 1;
    const doneAch = (LL.Achievements && LL.Achievements.unlocked.length) || 0;
    const rows = [
      ['Personagem', S.character === 0 ? 'Jason' : 'Lucia'],
      ['Distrito atual', W.districtAt(S.pos.x, S.pos.y)],
      ['Dinheiro', cash(S.money)],
      ['Nível / XP', (LL.game.level || 1) + ' · ' + fmt(LL.game.xp || 0) + ' XP'],
      ['Tempo de jogo', U.duration(played)],
      ['Missões concluídas', String(st.missions || 0)],
      ['Progresso total', (LL.game.progress || 0) + '%'],
      ['Conquistas', doneAch + ' / ' + totalAch],
      ['Carros roubados', String(st.carsStolen || 0)],
      ['Veículos vendidos', String(st.carsSold || 0)],
      ['Lojas assaltadas', String(st.storesRobbed || 0)],
      ['Pedestres roubados', String(st.pedsRobbed || 0)],
      ['Flamingos coletados', (st.flamingos || 0) + ' / 15'],
      ['Policiais abatidos', String(st.copsDown || 0)],
      ['Fugas da polícia', String(st.escapes || 0)],
      ['Maior nível procurado', String(st.maxWanted || 0) + ' ★'],
      ['Distância dirigida', (st.kmDriven || 0).toFixed(1) + ' km'],
      ['Velocidade máxima', Math.round(st.topSpeed || 0) + ' km/h'],
      ['Dinheiro ganho', cash(st.moneyEarned || 0)],
      ['Dinheiro gasto', cash(st.moneySpent || 0)],
      ['Mortes', String(st.deaths || 0)],
      ['Hackeamentos Wenk', String(st.hacks || 0)],
    ];
    UI.openOverlay('SEU HISTÓRICO', 'ESTATÍSTICAS',
      '<div class="two-col"><div>' +
      rows.slice(0, 11).map((r) => '<div class="stat-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
      '</div><div>' +
      rows.slice(11).map((r) => '<div class="stat-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
      '</div></div>' +
      '<div class="section-label">PROGRESSO DO MUNDO</div>' +
      '<div class="grid-3">' +
      '<div class="card"><h4>MISSÕES</h4><p>História principal concluída.</p><div class="price">' + (M ? M.progress() : 0) + '%</div><div class="progress-line"><i style="width:' + (M ? M.progress() : 0) + '%"></i></div></div>' +
      '<div class="card"><h4>CHECKLIST</h4><p>Itens de 100% completos.</p><div class="price">' + (LL.Achievements ? LL.Achievements.percent() : 0) + '%</div><div class="progress-line"><i style="width:' + (LL.Achievements ? LL.Achievements.percent() : 0) + '%"></i></div></div>' +
      '<div class="card"><h4>CONQUISTAS</h4><p>Medalhas desbloqueadas.</p><div class="price">[' + esc(String(doneAch)) + '/' + esc(String(totalAch)) + ']</div><div class="progress-line"><i style="width:' + (doneAch / totalAch * 100) + '%"></i></div></div>' +
      '</div>');
  };

  /* ------------------------------------------------------------- achievements */
  UI.showAchievements = function () {
    const A = LL.Achievements;
    if (!A) { UI.openOverlay('LEONIDA', 'CONQUISTAS', '<div class="empty">Módulo indisponível.</div>'); return; }
    const pct = A.percent();
    const checks = A.CHECKS.map((c) => {
      const v = A.checkValue(c), done = v >= c.target;
      return '<div class="ach' + (done ? ' done' : '') + '">' +
        '<div class="ico">' + (done ? '✓' : '○') + '</div>' +
        '<div class="txt"><h4>' + esc(c.label) + '</h4><p>' + esc(c.hint) + '</p>' +
        '<div class="progress-line"><i style="width:' + (v / c.target * 100).toFixed(0) + '%"></i></div></div>' +
        '<div class="val">' + v + ' / ' + c.target + '</div></div>';
    }).join('');
    const list = A.LIST.map((a) => {
      const done = A.unlocked.includes(a.id);
      return '<div class="ach' + (done ? ' done' : '') + '">' +
        '<div class="ico">' + (done ? '★' : '☆') + '</div>' +
        '<div class="txt"><h4>' + esc(a.name) + '</h4><p>' + esc(a.desc) + '</p></div>' +
        '<div class="val">' + a.xp + ' XP</div></div>';
    }).join('');
    UI.openOverlay('CHECKLIST DE 100%', 'CONQUISTAS · ' + pct + '%',
      '<div class="two-col"><div>' +
      '<div class="section-label" style="margin-top:0">LISTA CLÁSSICA</div>' + checks +
      '</div><div><div class="section-label" style="margin-top:0">MEDALHAS · ' +
      A.unlocked.length + '/' + A.LIST.length + '</div>' + list + '</div></div>');
  };

  /* ---------------------------------------------------------------- settings */
  function settingRow(label, desc, control) {
    return '<div class="setting"><div><div class="label">' + label + '</div><div class="desc">' + desc + '</div></div>' +
      '<div class="setting-control">' + control + '</div></div>';
  }
  function range(key, min, max, step, val, unit) {
    return '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" ' +
      'data-set="' + key + '" data-kind="range" style="width:130px;accent-color:#ff3d6e">' +
      '<output>' + val + (unit || '') + '</output>';
  }
  function toggle(key, on) {
    return '<div class="switch' + (on ? ' on' : '') + '" data-set="' + key + '" data-kind="switch"></div>';
  }
  function seg(key, options, val) {
    return '<div class="seg">' + options.map((o) =>
      '<button data-set="' + key + '" data-kind="select" data-val="' + o.v + '" class="' + (val === o.v ? 'on' : '') + '">' + o.l + '</button>').join('') + '</div>';
  }

  UI.showSettings = function () {
    const S = LL.Settings;
    UI.openOverlay('CONFIGURAÇÕES', 'GRÁFICOS, ÁUDIO E CÂMERA',
      '<div class="two-col"><div>' +
      '<div class="section-label" style="margin-top:0">GRÁFICOS</div>' +
      settingRow('Qualidade', 'Controla sombras, distância de visão e densidade de tráfego.', seg('quality', [
        { v: 'low', l: 'BAIXO' }, { v: 'medium', l: 'MÉDIO' }, { v: 'high', l: 'ALTO' }, { v: 'ultra', l: 'ULTRA' },
      ], S.quality)) +
      settingRow('Sombras', 'Sombras dinâmicas do sol e dos veículos.', toggle('shadows', S.shadows)) +
      settingRow('Distância de visão', 'Névoa e alcance de renderização.', range('drawDistance', 380, 1100, 20, S.drawDistance, ' m')) +
      settingRow('Campo de visão', 'Abertura da câmera.', range('fov', 55, 95, 1, S.fov, '°')) +
      settingRow('Mostrar FPS', 'Contador no canto superior direito.', toggle('showFps', S.showFps)) +
      '<div class="section-label">CÂMERA</div>' +
      settingRow('Sensibilidade', 'Velocidade do mouse.', range('sensitivity', 0.25, 2.5, 0.05, S.sensitivity, 'x')) +
      settingRow('Inverter eixo Y', 'Inverte o movimento vertical do mouse.', toggle('invertY', S.invertY)) +
      settingRow('Tremor de câmera', 'Impactos, tiros e explosões sacodem a tela.', toggle('cameraShake', S.cameraShake)) +
      '</div><div>' +
      '<div class="section-label" style="margin-top:0">ÁUDIO</div>' +
      settingRow('Volume geral', 'Soma de todos os canais.', range('master', 0, 1, 0.05, S.master, '')) +
      settingRow('Música', 'Rádio sintética de Leonida FM.', range('music', 0, 1, 0.05, S.music, '')) +
      settingRow('Efeitos', 'Motores, tiros, sirenes e passos.', range('sfx', 0, 1, 0.05, S.sfx, '')) +
      settingRow('Interface', 'Cliques e confirmações.', range('ui', 0, 1, 0.05, S.ui, '')) +
      '<div class="section-label">JOGO</div>' +
      settingRow('Legendas', 'Diálogos e falas de pedestres.', toggle('subtitles', S.subtitles)) +
      settingRow('Minimapa', 'Mapa circular no canto inferior direito.', toggle('minimap', S.minimap)) +
      settingRow('Salvamento automático', 'Grava a cada 90 segundos e ao trocar de área.', toggle('autosave', S.autosave)) +
      settingRow('Conversa nas ruas', 'Pedestres reagem ao que você faz.', toggle('voiceChatter', S.voiceChatter)) +
      '<div class="section-label">PERIGO</div>' +
      '<div class="btn-row"><button class="btn ghost small" data-act="' + act(() => {
        LL.Settings.applyQuality(LL.DEFAULT_SETTINGS.quality);
        Object.assign(LL.Settings, LL.DEFAULT_SETTINGS);
        LL.Settings.save();
        if (LL.Game && LL.Game.applySettings) LL.Game.applySettings();
        UI.showSettings();
        LL.notify('Configurações restauradas.', 'gold', 'SISTEMA');
      }) + '">RESTAURAR PADRÕES</button>' +
      '<button class="btn danger small" data-act="' + act(() => {
        UI.confirm('Apagar progresso?', 'Isso remove o save e as conquistas deste navegador. Não dá para desfazer.', () => {
          LL.Save.clear();
          LL.notify('Progresso apagado.', 'red', 'SISTEMA');
          if (LL.Game && LL.Game.refreshMenuInfo) LL.Game.refreshMenuInfo();
        });
      }) + '">APAGAR PROGRESSO</button></div>' +
      '</div></div>');
    // the segment buttons need a click path (they carry data-set too)
    D.overlayBody.querySelectorAll('.seg button').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.getAttribute('data-set');
        const val = b.getAttribute('data-val');
        if (key === 'quality') LL.Settings.applyQuality(val);
        else LL.Settings.set(key, val);
        if (LL.Game && LL.Game.applySettings) LL.Game.applySettings();
        UI.showSettings();
      });
    });
  };

  /* ---------------------------------------------------------------- controls */
  UI.showControls = function () {
    const rows = [
      ['W A S D', 'Mover / dirigir'], ['Mouse', 'Olhar / mirar'], ['Shift', 'Correr / acelerar'],
      ['Espaço', 'Freio de mão'], ['E', 'Interagir / entrar / sair'], ['F', 'Foco (tempo lento)'],
      ['G', 'Trocar de personagem'], ['TAB', 'Trocar Jason / Lucia'], ['R', 'Recarregar arma'],
      ['1 – 6', 'Selecionar arma'], ['Botão esquerdo', 'Atirar / soco'], ['Botão direito', 'Mirar'],
      ['H', 'Buzina / hackear carro (Wenk)'], ['L', 'Faróis'], ['Q', 'Próxima faixa de rádio'],
      ['P / ESC', 'Pausar'], ['M', 'Mapa'], ['J', 'Missões'], ['I', 'Inventário'],
      ['O', 'Configurações'], ['C', 'Garagem'], ['K', 'Conquistas'], ['U', 'Estatísticas'],
    ];
    const half = Math.ceil(rows.length / 2);
    const group = (arr) => arr.map(([k, v]) => '<div class="ctrl-row"><span>' + v + '</span><b class="tag">' + k + '</b></div>').join('');
    UI.openOverlay('REFERÊNCIA', 'CONTROLES',
      '<div class="ctrl-grid"><div>' + group(rows.slice(0, half)) + '</div><div>' + group(rows.slice(half)) + '</div></div>' +
      '<div class="section-label">MOUSE</div>' +
      '<div class="desc" style="font-size:10px;color:#8b96aa;line-height:1.7">Clique na tela para capturar o mouse. ESC libera o cursor e abre a pausa. ' +
      'No celular, o jogo mostra um aviso: use um teclado e um mouse para a experiência completa.</div>' +
      '<div class="section-label">DICAS DA CASA</div>' +
      '<div class="grid-2">' +
      '<div class="card"><h4>ARRISCAR</h4><p>Arrombar um carro trancado leva 1,4 s e dispara o alarme. O Wenk resolve em um toque, mas tem recarga de 7 s.</p></div>' +
      '<div class="card"><h4>SUMIÇO</h4><p>A polícia perde seu rastro após 12 s sem visão. Roupa nova reduz o alcance em 45%.</p></div>' +
      '</div>');
  };

  /* ------------------------------------------------------------------ garage */
  UI.showGarage = function () {
    const Catalog = V.CATALOG;
    const garage = (LL.game.garage || []);
    const owned = garage.map((entry, i) => {
      const spec = Catalog[entry.type] || Catalog.sedan;
      return '<div class="item-row"><div><div class="nm">' + esc(spec.name) + '</div>' +
        '<div class="ds">' + esc(spec.cat) + ' · placa ' + esc(entry.plate || '—') + ' · tanque ' + Math.round(entry.fuel || 0) + ' L</div></div>' +
        '<div class="rt"><button class="btn small" data-act="' + act(() => {
          if (Econ.recoverGarage(i)) { refresh(); }
        }) + '">ENTREGAR $150</button></div></div>';
    }).join('');
    const buyable = V.ORDER.filter((t) => !Catalog[t].police && !Catalog[t].water && t !== 'scooter')
      .map((t) => {
        const spec = Catalog[t];
        return card(spec.name, '<span class="tag">' + spec.cat + '</span> ' + esc(spec.desc) +
          '<div class="stat-mini"><span>MÁX <b>' + Math.round(spec.maxSpeed * 3.6) + ' km/h</b></span>' +
          '<span>LUGARES <b>' + spec.seats + '</b></span><span>TANQUE <b>' + spec.tank + ' L</b></span></div>',
          cash(spec.price), act(() => {
            if (Econ.buyVehicle(t)) refresh();
          }), 'COMPRAR', money() < spec.price);
      }).join('');
    const scooter = Catalog.scooter;
    UI.openOverlay('AUTO LEONIDA', 'GARAGEM',
      shopHead('<button class="btn ghost small" data-act="' + act(() => UI.showGarage()) + '">ATUALIZAR</button>') +
      '<div class="section-label">SEUS VEÍCULOS · ' + garage.length + '</div>' +
      (garage.length ? owned : '<div class="empty">Nenhum veículo registrado. Compre um abaixo ou registre o que roubou na oficina.</div>') +
      '<div class="section-label">CONCESSIONÁRIA</div>' +
      '<div class="grid-2">' + buyable +
      card(scooter.name, '<span class="tag">scooter</span> ' + esc(scooter.desc), cash(scooter.price), act(() => {
        if (Econ.buyVehicle('scooter')) refresh();
      }), 'COMPRAR', money() < scooter.price) +
      '</div>' +
      '<div class="section-label">BARCO</div>' +
      '<div class="grid-2">' + ['boat', 'speedboat'].map((t) => {
        const spec = Catalog[t];
        return card(spec.name, '<span class="tag green">barco</span> ' + esc(spec.desc), cash(spec.price), act(() => {
          if (Econ.buyVehicle(t)) refresh();
        }), 'COMPRAR', money() < spec.price);
      }).join('') + '</div>');
    bindGarageActions();
  };

  function bindGarageActions() {
    // registration lives in the delegate handler on the body; nothing else needed
  }

  /* --------------------------------------------------------------- inventory */
  UI.showInventory = function () {
    const S = Player.state;
    const car = currentCar(6);
    const weapons = Player.WEAPON_ORDER.filter((id) => Player.WEAPONS[id] && !Player.WEAPONS[id].melee).map((id) => {
      const w = Player.WEAPONS[id], a = S.ammo[id];
      const owned = !!a;
      return '<div class="item-row"><div><div class="nm">' + esc(w.name) + '</div>' +
        '<div class="ds">' + (owned ? ('pente ' + a.mag + ' · reserva ' + a.res) : 'não adquirida') + ' · dano ' + w.dmg + '</div></div>' +
        '<div class="rt">' + (owned
          ? '<button class="btn small" data-act="' + act(() => {
            if (car) { Econ.storeWeaponInTrunk(car, id); UI.showInventory(); }
            else LL.notify('Traga um veículo para perto.', 'gold', 'PORTA-MALAS');
          }) + '">GUARDAR</button>'
          : '<span class="tag red">—</span>') + '</div></div>';
    }).join('');
    const trunk = car && car.trunk ? (car.trunk.weapons || []).map((w, i) =>
      '<div class="item-row"><div><div class="nm">' + esc((Player.WEAPONS[w.id] || {}).name || w.id) + '</div>' +
      '<div class="ds">pente ' + w.mag + ' · reserva ' + w.res + '</div></div>' +
      '<div class="rt"><button class="btn small" data-act="' + act(() => {
        Econ.takeWeaponFromTrunk(car, i); UI.showInventory();
      }) + '">PEGAR</button></div></div>').join('') : '';
    const outfits = LL.Chars.VARIANTS.map((v, i) => {
      const o = v.outfit;
      return '<div class="item-row"><div><div class="nm">Visual ' + (i + 1) + '</div>' +
        '<div class="ds">' + esc(o.shirt) + ' / ' + esc(o.pants) + (S.clothes === i ? ' · em uso' : '') + '</div></div>' +
        '<div class="rt">' + (S.clothes === i ? '<span class="owned">EQUIPADO</span>'
          : '<button class="btn small" data-act="' + act(() => {
            if (Player.wearOutfit(i)) { LL.game.stats.outfitsUsed = (LL.game.stats.outfitsUsed || 0) + 1; UI.showInventory(); }
          }) + '">VESTIR</button>') + '</div></div>';
    }).join('');
    UI.openOverlay('SEU PERSONAGEM', 'INVENTÁRIO',
      '<div class="two-col"><div>' +
      '<div class="section-label" style="margin-top:0">ARMAS</div>' + weapons +
      '<div class="section-label">PORTA-MALAS' + (car ? ' · ' + esc(car.spec.name) : '') + '</div>' +
      (car ? (trunk || '<div class="empty">Porta-malas vazio.</div>') +
        '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn small" data-act="' + act(() => { Econ.storeLoot(car); UI.showInventory(); }) + '">GUARDAR ESPÓLIOS</button>' +
        '<button class="btn small" data-act="' + act(() => { Econ.takeLoot(car); UI.showInventory(); }) + '">RETIRAR ESPÓLIOS</button>' +
        '</div>'
        : '<div class="empty">Nenhum veículo por perto.</div>') +
      '</div><div>' +
      '<div class="section-label" style="margin-top:0">ROUPAS E DISFARCES</div>' + outfits +
      '<div class="section-label">PROTEÇÃO</div>' +
      '<div class="stat-row"><span>Colete</span><b>' + Math.round(S.armor) + '%</b></div>' +
      '<div class="stat-row"><span>Vida</span><b>' + Math.round(S.health) + ' / ' + S.maxHealth + '</b></div>' +
      '<div class="stat-row"><span>Espólios</span><b>' + cash(S.loot || 0) + '</b></div>' +
      '<div class="stat-row"><span>Personagem</span><b>' + (S.character === 0 ? 'Jason' : 'Lucia') + '</b></div>' +
      '<div class="btn-row" style="margin-top:10px"><button class="btn gold small" data-act="' + act(() => {
        UI.closeOverlay(); Player.switchCharacter();
      }) + '">TROCAR DE PERSONAGEM (TAB)</button></div>' +
      '</div></div>');
  };

  /* ---------------------------------------------------------------- missions */
  UI.showMissions = function () {
    const listed = (M.MISSIONS || []).map((m) => {
      const done = M.completed.includes(m.id);
      const active = M.active && M.active.def.id === m.id;
      const tag = done ? '<span class="tag green">CONCLUÍDA</span>' : active ? '<span class="tag gold">EM ANDAMENTO</span>' : '<span class="tag">' + (m.kind === 'main' ? 'HISTÓRIA' : 'SECUNDÁRIA') + '</span>';
      return '<div class="item-row"><div><div class="nm">' + esc(m.name) + ' ' + tag + '</div>' +
        '<div class="ds">' + esc(m.district || '') + ' · ' + esc(m.desc) + '</div></div>' +
        '<div class="rt">' + (done ? '<span class="owned">✓</span>' :
          active ? '<button class="btn small danger" data-act="' + act(() => { M.abort(); UI.showMissions(); }) + '">ABANDONAR</button>' :
            '<button class="btn small" data-act="' + act(() => {
              if (M.start(m.id)) { UI.closeOverlay(); }
              else UI.showMissions();
            }) + '"' + (M.active ? ' disabled' : '') + '>INICIAR</button>') + '</div></div>';
    }).join('');
    UI.openOverlay('TRABALHO', 'MISSÕES · ' + M.progress() + '%',
      '<div class="map-head"><div>Missões podem ser iniciadas por aqui ou pelo marcador dourado no mapa.</div>' +
      '<div>' + M.completed.length + ' concluídas de ' + M.MISSIONS.length + '</div></div>' + listed);
  };

  /* ---------------------------------------------------------------- services */
  UI.openService = function (poi, keepOpen) {
    if (!poi) return;
    UI._currentService = poi;
    UI.bindActions();
    const service = poi.service || 'landmark';
    const fn = SERVICES[service] || SERVICES.landmark;
    fn(poi, keepOpen);
  };

  function serviceShell(poi, kicker, body) {
    UI.openOverlay((kicker || poi.name).toUpperCase(), poi.name.toUpperCase(), body + footerNote(poi));
  }
  function footerNote(poi) {
    return '<div class="section-label">SOBRE</div><div class="desc" style="font-size:10px;color:#8793a8;line-height:1.6">' +
      esc(poi.desc || '') + '</div>';
  }

  const SERVICES = {
    gas(poi) {
      const car = currentCar(18);
      const need = car ? Math.max(0, car.spec.tank - car.fuel) : 0;
      const fullCost = Math.round(need * Econ.PRICES.fuelPerL);
      serviceShell(poi, 'POSTO DE COMBUSTÍVEL',
        shopHead() +
        '<div class="section-label">VEÍCULO</div>' +
        (car ? '<div class="item-row"><div><div class="nm">' + esc(car.spec.name) + '</div>' +
          '<div class="ds">' + car.fuel.toFixed(1) + ' / ' + car.spec.tank + ' L · ' + Math.round(need) + ' L para encher</div>' +
          '<div class="progress-line"><i style="width:' + (car.fuel / Math.max(1, car.spec.tank) * 100) + '%"></i></div></div>' +
          '<div class="rt"><button class="btn small" data-act="' + act(() => { Econ.fuelCar(car, 20); refresh(); }) + '">+20 L</button>' +
          '<button class="btn gold small" data-act="' + act(() => { Econ.fuelCar(car, need); refresh(); }) + '">' + cash(fullCost) + '</button></div></div>'
          : '<div class="empty">Nenhum veículo próximo. Traga um até a bomba.</div>') +
        '<div class="section-label">CONVENIÊNCIA</div><div class="grid-2">' +
        card('Lanche e café', 'Recupera 25 de vida e 40 de energia.', cash(Econ.PRICES.snack), act(() => { if (Econ.buySnack()) refresh(); }), 'COMPRAR') +
        card('Galão de reserva', 'Enche o tanque em 20 litros na hora.', cash(Math.round(20 * Econ.PRICES.fuelPerL * 1.2)), act(() => {
          if (car) { if (Econ.fuelCar(car, 20)) refresh(); }
          else LL.notify('Nenhum veículo próximo.', 'gold', 'POSTO');
        }), 'COMPRAR') +
        '</div>');
    },

    garage(poi) {
      const car = currentCar(18);
      const paint = ['#c8ccd2', '#1d2733', '#7c1f2a', '#2b4a63', '#e3e1d8', '#e0304d', '#f2c02c', '#2fd0b4', '#7a2ec4', '#101319'];
      serviceShell(poi, 'OFICINA',
        shopHead() +
        '<div class="section-label">SEU VEÍCULO</div>' +
        (car ? '<div class="item-row"><div><div class="nm">' + esc(car.spec.name) + '</div>' +
          '<div class="ds">integridade ' + Math.round(car.hp) + '% · tanque ' + Math.round(car.fuel) + ' L</div>' +
          '<div class="progress-line"><i style="width:' + car.hp + '%"></i></div></div>' +
          '<div class="rt"><button class="btn small" data-act="' + act(() => { Econ.repairCar(car); refresh(); }) + '">REPARAR ' + cash(Math.round((100 - car.hp) * Econ.PRICES.repairPerHp)) + '</button>' +
          '<button class="btn small" data-act="' + act(() => { Econ.registerCar(car); refresh(); }) + '"' + (car.owned ? ' disabled' : '') + '>REGISTRAR ' + cash(Econ.PRICES.registerFee) + '</button></div></div>' +
          '<div class="section-label">PINTURA · $1.200</div><div class="paint-grid">' +
          paint.map((c) => '<span class="color-dot" data-act="' + act(() => { Econ.paintCar(car, c); refresh(); }) + '" style="background:' + c + ';width:22px;height:22px"></span>').join('') + '</div>'
          : '<div class="empty">Nenhum veículo por perto.</div>') +
        '<div class="section-label">GARAGEM</div>' +
        '<div class="btn-row"><button class="btn small" data-act="' + act(() => UI.showGarage()) + '">ABRIR GARAGEM</button>' +
        '<button class="btn small" data-act="' + act(() => UI.showInventory()) + '">PORTA-MALAS</button></div>');
    },

    dealer(poi) {
      serviceShell(poi, 'CONCESSIONÁRIA',
        shopHead('<button class="btn ghost small" data-act="' + act(() => UI.showGarage()) + '">GARAGEM</button>') +
        '<div class="grid-2">' + V.ORDER.filter((t) => !V.CATALOG[t].police).map((t) => {
          const spec = V.CATALOG[t];
          return card(spec.name, '<span class="tag">' + spec.cat + '</span> ' + esc(spec.desc), cash(spec.price), act(() => {
            if (Econ.buyVehicle(t)) refresh();
          }), 'COMPRAR', money() < spec.price);
        }).join('') + '</div>');
    },

    clothes(poi) {
      serviceShell(poi, 'CASA VICE',
        shopHead() +
        '<div class="grid-2">' + LL.Chars.VARIANTS.map((v, i) => {
          const o = v.outfit;
          return '<div class="card shop-item"><div><div class="name">Visual ' + (i + 1) + '</div>' +
            '<div class="sub">Camisa <span style="color:' + o.shirt + '">■</span> Calça <span style="color:' + o.pants + '">■</span>' +
            ' Sapato <span style="color:' + o.shoes + '">■</span>' + (o.hat ? ' · boné' : '') + '</div></div>' +
            '<div class="bottom"><div class="price">' + cash(Econ.PRICES.clothes) + '</div>' +
            '<button class="btn small" data-act="' + act(() => {
              if (Econ.buyClothes(i)) refresh();
            }) + '"' + (Player.state.clothes === i ? ' disabled' : '') + '>' + (Player.state.clothes === i ? 'EM USO' : 'COMPRAR') + '</button></div></div>';
        }).join('') + '</div>');
    },

    gunshop(poi) {
      const S = Player.state;
      serviceShell(poi, 'AMMU-LEONIDA',
        shopHead() +
        '<div class="grid-2">' + ['pistol', 'smg', 'rifle', 'shotgun', 'revolver'].map((id) => {
          const w = Player.WEAPONS[id];
          const price = { pistol: 1200, smg: 3400, rifle: 6200, shotgun: 4800, revolver: 3900 }[id];
          const owned = !!S.ammo[id];
          return card(w.name, '<span class="tag">' + (owned ? 'PENTE ' + S.ammo[id].mag + ' · RESERVA ' + S.ammo[id].res : 'NOVA') + '</span> dano ' + w.dmg +
            ' · alcance ' + w.range + ' m', cash(price), act(() => {
              if (Econ.buyWeapon(id, price)) refresh();
            }), owned ? 'MUNIÇÃO' : 'COMPRAR', money() < price);
        }).join('') + '</div>' +
        '<div class="section-label">EQUIPAMENTO</div><div class="grid-2">' +
        card('Colete balístico', 'Proteção 100% contra o primeiro dano.', cash(Econ.PRICES.armor), act(() => {
          if (Econ.buyArmor()) refresh();
        }), 'COMPRAR', money() < Econ.PRICES.armor) +
        card('Lanche', 'Recupera vida e energia na hora.', cash(Econ.PRICES.snack), act(() => { if (Econ.buySnack()) refresh(); }), 'COMPRAR') +
        '</div>');
    },

    hospital(poi) {
      const S = Player.state;
      const missing = S.maxHealth - S.health;
      const cost = Math.max(Econ.PRICES.hospitalFee, Math.round(missing * Econ.PRICES.healPerHp));
      serviceShell(poi, 'PRONTO-SOCORRO',
        shopHead() +
        '<div class="stat-row"><span>Vida atual</span><b>' + Math.round(S.health) + ' / ' + S.maxHealth + '</b></div>' +
        '<div class="stat-row"><span>Colete</span><b>' + Math.round(S.armor) + '%</b></div>' +
        '<div class="section-label">TRATAMENTO</div><div class="grid-2">' +
        card('Atendimento completo', 'Restaura toda a vida. Custa conforme o ferimento.', cash(cost), act(() => {
          if (Econ.heal()) refresh();
        }), 'TRATAR', missing < 2) +
        card('Soro rápido', 'Um pouco de vida e adrenalina sem internação.', cash(220), act(() => {
          if (Econ.spend(220, 'soro')) {
            Player.state.health = Math.min(S.maxHealth, S.health + 30);
            Player.state.stamina = 100;
            LL.notify('Soro aplicado.', 'green', 'HOSPITAL');
            refresh();
          }
        }), 'APLICAR') +
        '</div>');
    },

    bar(poi) {
      serviceShell(poi, 'BAR',
        shopHead() +
        '<div class="grid-2">' +
        card('Caipirinha', 'Vida e energia cheias, cabeça leve por 20 s.', '$180', act(() => {
          if (!Econ.spend(180, 'bebida')) return;
          Player.state.health = Math.min(100, Player.state.health + 45);
          Player.state.stamina = 100;
          Player.state.invuln = Math.max(Player.state.invuln, 1.2);
          LL.notify('Caipirinha na mão. Leonida fica mais bonita.', 'green', 'BAR DO SOL');
          refresh();
        }), 'PEDIR') +
        card('Rodada da casa', 'Todos os pedestres por perto ficam amigos.', '$420', act(() => {
          if (!Econ.spend(420, 'rodada')) return;
          LL.Peds.scare(Player.state.pos.x, Player.state.pos.y, 0.1, { witness: false });
          for (const p of LL.Peds.list) {
            if (Math.hypot(p.pos.x - Player.state.pos.x, p.pos.y - Player.state.pos.y) < 26) {
              p.state = 'watch'; p.timer = 6;
            }
          }
          LL.UI.subtitle('<b>Bar do Sol:</b> "Rodada da casa! Ninguém lembra de nada depois."');
          refresh();
        }), 'PAGAR') +
        card('Informação', 'Um marinheiro marca um ponto útil no mapa.', '$260', act(() => {
          if (!Econ.spend(260, 'informação')) return;
          LL.notify('Entregue de barco: a doca da ilha paga bem.', 'gold', 'INFORMAÇÃO');
          refresh();
        }), 'OUVIR') +
        '</div>');
    },

    fence(poi) {
      const car = currentCar(16);
      const loot = Player.state.loot || 0;
      serviceShell(poi, 'RECEPTADOR',
        shopHead() +
        '<div class="section-label">VEÍCULO NA PORTA</div>' +
        (car ? '<div class="item-row"><div><div class="nm">' + esc(car.spec.name) + '</div>' +
          '<div class="ds">' + Math.round(car.hp) + '% de integridade · avaliação em ' + cash(Math.round((car.spec.value || 2000) * (0.45 + car.hp / 100 * 0.55))) + '</div></div>' +
          '<div class="rt"><button class="btn gold small" data-act="' + act(() => { if (Econ.fenceCar(car)) refresh(); }) + '">VENDER</button></div></div>'
          : '<div class="empty">Traga um veículo até aqui andando a pé.</div>') +
        '<div class="section-label">ESPÓLIOS</div>' +
        '<div class="item-row"><div><div class="nm">Espólios em mãos</div><div class="ds">' + cash(loot) + ' em mercadoria</div></div>' +
        '<div class="rt"><button class="btn small" data-act="' + act(() => {
          if (!loot) { LL.notify('Você não tem espólios.', 'gold', 'RECEPTADOR'); return; }
          const pay = Math.round(loot * 0.8);
          Player.state.loot = 0;
          Player.addMoney(pay, 'receptador');
          LL.notify('Espólios vendidos por ' + cash(pay) + '.', 'green', 'RECEPTADOR');
          refresh();
        }) + '">VENDER</button></div></div>' +
        '<div class="desc" style="font-size:10px;color:#8793a8;margin-top:10px">Assaltos passam a limpar o estoque em 4 minutos. O receptador não pergunta a origem.</div>');
    },

    casino(poi) {
      serviceShell(poi, 'HOTEL CORAL',
        shopHead() +
        '<div class="section-label">ROLETA</div><div class="grid-4">' +
        [100, 500, 2000, 10000].map((v) =>
          '<div class="card shop-item"><div><div class="name">' + cash(v) + '</div><div class="sub">Chance de 42% · paga até 3x</div></div>' +
          '<button class="btn small" data-act="' + act(() => { Econ.bet(v); refresh(); }) + '"' + (money() < v ? ' disabled' : '') + '>APOSTAR</button></div>').join('') +
        '</div>' +
        '<div class="section-label">CASSINO</div>' +
        '<div class="stat-row"><span>Ganhos no cassino</span><b>' + cash((LL.game.stats.casinoWon || 0)) + '</b></div>' +
        '<div class="desc" style="font-size:10px;color:#8793a8;margin-top:8px">A casa sempre ganha — até a noite em que não ganha.</div>');
    },

    safehouse(poi) {
      const S = Player.state;
      serviceShell(poi, 'CASA SEGURA',
        '<div class="stat-row"><span>Dinheiro</span><b>' + cash(money()) + '</b></div>' +
        '<div class="stat-row"><span>Vida</span><b>' + Math.round(S.health) + ' / ' + S.maxHealth + '</b></div>' +
        '<div class="stat-row"><span>Horário</span><b>' + U.clock(W.env ? W.env.hour : 9) + '</b></div>' +
        '<div class="section-label">O QUE FAZER EM CASA</div><div class="grid-2">' +
        card('Salvar jogo', 'Grava tudo neste navegador. Autosave continua ativo.', 'GRÁTIS', act(() => {
          if (LL.Game && LL.Game.saveGame) { LL.Game.saveGame('manual'); refresh(); }
        }), 'SALVAR') +
        card('Dormir 8 horas', 'Recupera vida, energia e foco. O tempo passa.', 'GRÁTIS', act(() => {
          if (W.env) W.setTime(W.env.hour + 8);
          S.health = S.maxHealth; S.stamina = 100; S.focus = 100;
          LL.notify('Você dormiu. Leonida continua lá fora.', 'green', 'CASA SEGURA');
          refresh();
        }), 'DORMIR') +
        card('Trocar de roupa', 'Acesso ao guarda-roupa, sem custo.', 'GRÁTIS', act(() => UI.showInventory()), 'ABRIR') +
        card('Trocar de personagem', 'Jason e Lucia dividem o mesmo dinheiro.', 'GRÁTIS', act(() => {
          Player.switchCharacter(); refresh();
        }), 'TROCAR') +
        '</div>' +
        (LL.Save.exists() ? '<div class="desc" style="font-size:10px;color:#8793a8;margin-top:10px">Último save: ' +
          new Date(LL.Save.meta().savedAt).toLocaleString('pt-BR') + '</div>' : ''));
    },

    police(poi) {
      const wanted = LL.Police.wanted;
      serviceShell(poi, 'DELEGACIA',
        '<div class="stat-row"><span>Nível procurado</span><b>' + '★'.repeat(wanted) + (wanted ? '' : 'nenhum') + '</b></div>' +
        '<div class="stat-row"><span>Crimes registrados</span><b>' + LL.Police.crimes.length + '</b></div>' +
        '<div class="section-label">NA RECEPÇÃO</div><div class="grid-2">' +
        card('Se entregar', 'Paga a fiança e zera o procurado. Armas ficam com você.', wanted ? cash(320 + wanted * 260) : 'GRÁTIS', act(() => {
          if (!wanted) { LL.notify('Você não é procurado.', 'gold', 'POLÍCIA'); return; }
          const fine = Math.min(money(), 320 + wanted * 260);
          Player.addMoney(-fine, 'fiança');
          LL.Police.clear();
          LL.notify('Fiança paga: ' + cash(fine) + '.', 'green', 'POLÍCIA');
          refresh();
        }), 'PAGAR', !wanted) +
        card('Puxar ficha', 'Lista os crimes ainda frescos na sua conta.', 'GRÁTIS', act(() => {
          const list = LL.Police.crimes.slice(-6).map((c) => '• ' + (LL.Police.crimeLabels[c.type] || c.type)).join('<br>') || 'Ficha limpa.';
          LL.UI.subtitle('<b>Ficha:</b><br>' + list, 6000);
          LL.notify('Ficha consultada.', 'gold', 'POLÍCIA');
        }), 'CONSULTAR') +
        '</div>');
    },

    club(poi) {
      serviceShell(poi, 'CLUB NEON',
        shopHead() +
        '<div class="grid-2">' +
        card('Entrada VIP', 'Bebida grátis, energia cheia e ninguém te incomoda.', '$500', act(() => {
          if (!Econ.spend(500, 'entrada')) return;
          Player.state.stamina = 100;
          Player.state.focus = 100;
          if (W.env) W.setTime(23.4);
          LL.notify('Club Neon: a noite começou agora.', 'green', 'NEON');
          refresh();
        }), 'ENTRAR') +
        card('Comprar discrição', 'Reduz o procurado em 1 estrela.', '$1.400', act(() => {
          if (!Econ.spend(1400, 'discrição')) return;
          LL.Police.setWanted(Math.max(0, LL.Police.wanted - 1));
          LL.notify('O segurança conversou com os contatos certos.', 'green', 'NEON');
          refresh();
        }), 'PAGAR', LL.Police.wanted === 0) +
        '</div>');
    },

    port(poi) {
      serviceShell(poi, 'CAIS',
        shopHead() +
        '<div class="grid-2">' +
        card('Alugar lancha', 'Um barco aparece na água em frente ao cais.', '$900', act(() => {
          if (!Econ.spend(900, 'lancha')) return;
          const b = V.spawnBoat(W.WORLD + 190, (W.env ? W.env.ISLAND.y - 190 : 700), Math.PI * 0.9);
          if (b) { LL.notify('Lancha liberada no cais.', 'green', 'CAIS 7'); Player.addMoney(0); }
          refresh();
        }), 'ALUGAR') +
        card('Compra de carga', 'Adquire mercadoria para revender no receptador.', '$700', act(() => {
          if (!Econ.spend(700, 'carga')) return;
          Player.state.loot = (Player.state.loot || 0) + 1100;
          LL.notify('Carga no porta-malas: $1.100 em espólios.', 'green', 'CAIS 7');
          refresh();
        }), 'COMPRAR') +
        '</div>');
    },

    landmark(poi) {
      serviceShell(poi, 'PONTO TURÍSTICO',
        '<div class="card"><h4>' + esc(poi.name) + '</h4><p>' + esc(poi.desc || 'Um lugar de Leonida.') + '</p></div>' +
        '<div class="section-label">DICA</div><div class="desc" style="font-size:10px;color:#8793a8;line-height:1.7">' +
        'A ilha tem farol, villa e doca. Vá de barco e volte antes do amanhecer.</div>');
    },
  };
  SERVICES['garages'] = SERVICES.garage;

  /* ------------------------------------------------------------ quick switch */
  UI.quickSwitch = function () {
    if (Player.state.inVehicle) {
      LL.notify('Saia do veículo para trocar.', 'gold', 'TROCA');
      return false;
    }
    return Player.switchCharacter();
  };

  /* ---------------------------------------------------------------- key opens */
  UI.openPanel = function (name) {
    switch (name) {
      case 'map': UI.showMap(); break;
      case 'stats': UI.showStats(); break;
      case 'ach': case 'achievements': UI.showAchievements(); break;
      case 'settings': UI.showSettings(); break;
      case 'controls': UI.showControls(); break;
      case 'garage': UI.showGarage(); break;
      case 'inventory': UI.showInventory(); break;
      case 'missions': UI.showMissions(); break;
      default: break;
    }
  };

  UI.initPanels = function () {
    UI.bindActions();
    if (D.menuNav) {
      D.menuNav.addEventListener('click', (e) => {
        const b = e.target.closest('[data-menu]');
        if (!b) return;
        const which = b.getAttribute('data-menu');
        if (which === 'map' || which === 'stats' || which === 'ach' || which === 'settings' || which === 'controls' || which === 'garage') {
          UI.openPanel(which);
        }
      });
    }
    if (D.pauseGrid) {
      D.pauseGrid.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pause]');
        if (!b) return;
        const which = b.getAttribute('data-pause');
        if (which === 'resume') { if (LL.Game) LL.Game.resume(); return; }
        if (which === 'save') {
          if (LL.Game && LL.Game.saveGame) {
            const ok = LL.Game.saveGame('manual');
            LL.notify(ok ? 'Progresso gravado.' : 'Não foi possível salvar.', ok ? 'green' : 'red', 'SALVAMENTO');
          }
          return;
        }
        if (which === 'menu') {
          UI.confirm('Ir para o menu?', 'O progresso será salvo automaticamente.', () => { if (LL.Game) LL.Game.toMainMenu(); });
          return;
        }
        UI.openPanel(which);
      });
    }
    console.log('[ui] painéis prontos');
  };
})();
