/* ============================================================================
   50 · UI CORE — HUD, minimap, toasts, subtitles, overlay, big events.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U;
  const W = LL.World;
  const UI = (LL.UI = {});
  const $ = (id) => document.getElementById(id);
  const D = (UI.dom = {});
  const cache = {};

  UI.init = function () {
    const ids = ['boot', 'bootFill', 'bootMsg', 'menu', 'hud', 'cash', 'cashDelta', 'charAvatar', 'charName', 'charDistrict',
      'missionCard', 'missionTitle', 'missionDesc', 'wanted', 'clock', 'weather', 'weatherName', 'hpBar', 'hpTxt', 'stBar',
      'stTxt', 'arBar', 'arTxt', 'fcBar', 'fcTxt', 'weaponIcon', 'weaponName', 'ammoMag', 'ammoRes', 'reloadBar',
      'vehicleHud', 'speedVal', 'gearVal', 'fuelBar', 'hullBar', 'vehicleName', 'minimap', 'mapDistrict', 'crosshair',
      'interact', 'objective', 'subtitle', 'toasts', 'damage', 'focusFx', 'fps', 'wantedFlash', 'hint', 'bigEvent',
      'bigKicker', 'bigTitle', 'bigDesc', 'bigBtn', 'pause', 'pauseSub', 'overlay', 'overlayKicker', 'overlayTitle',
      'overlayBody', 'overlayClose', 'confirm', 'confirmTitle', 'confirmText', 'confirmYes', 'confirmNo', 'fade',
      'contInfo', 'saveMain', 'saveMeta', 'garageInfo', 'achInfo', 'menuTip', 'radioTrack', 'menuNav', 'pauseGrid'];
    for (const id of ids) D[id] = $(id);
    D.wantedIcons = [];
    if (D.wanted) {
      D.wanted.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('i');
        s.textContent = '★';
        D.wanted.appendChild(s);
        D.wantedIcons.push(s);
      }
    }
    D.mapCtx = D.minimap ? D.minimap.getContext('2d') : null;
    UI.toasts = [];
    UI._acc = 0; UI._mapAcc = 0;
    UI.overlayOpen = false;
    UI.bindOverlayClose();
  };

  /* ------------------------------------------------------------------- toasts */
  UI.pushToast = function (n) {
    if (!D.toasts) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (n.kind || '');
    el.innerHTML = (n.label ? '<small>' + escapeHtml(n.label) + '</small>' : '') + escapeHtml(n.text);
    D.toasts.appendChild(el);
    while (D.toasts.children.length > 4) D.toasts.removeChild(D.toasts.firstChild);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
  };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  UI.esc = escapeHtml;

  UI.subtitle = function (html, ms) {
    if (!D.subtitle) return;
    if (!LL.Settings.subtitles) return;
    D.subtitle.innerHTML = html;
    D.subtitle.classList.remove('hidden');
    clearTimeout(UI._subT);
    UI._subT = setTimeout(() => D.subtitle.classList.add('hidden'), ms || 3200);
  };

  UI.hint = function (text) {
    if (!D.hint) return;
    if (!text) { D.hint.classList.add('hidden'); return; }
    D.hint.textContent = text;
    D.hint.classList.remove('hidden');
  };

  UI.setObjective = function (title, desc) {
    if (!D.missionCard) return;
    if (!title && !desc) { D.missionCard.style.display = 'none'; return; }
    D.missionCard.style.display = '';
    if (D.missionTitle) D.missionTitle.textContent = title || '';
    if (D.missionDesc) D.missionDesc.textContent = desc || '';
  };

  UI.progress = function (pct, label) {
    if (pct < 0) { UI._progressOn = false; UI.hint(''); return; }
    UI._progressOn = true;
    UI.hint((label || 'Aguarde') + ' ' + Math.round(pct * 100) + '%');
  };

  /* ----------------------------------------------------------------- big event */
  UI.bigEvent = function (kind, kicker, title, desc, btnLabel) {
    const el = D.bigEvent;
    if (!el) return;
    $('bigKicker').textContent = kicker || '';
    const t = $('bigTitle');
    t.textContent = title || '';
    t.className = kind === 'wasted' ? 'wasted' : kind === 'busted' ? 'busted' : kind === 'win' ? 'win' : '';
    $('bigDesc').textContent = desc || '';
    $('bigBtn').textContent = btnLabel || (kind === 'wasted' || kind === 'busted' ? 'CONTINUAR' : 'VOLTAR AO JOGO');
    el.classList.add('on');
    UI._bigKind = kind;
    UI._bigOpen = true;
  };
  UI.hideBig = function () { if (D.bigEvent) D.bigEvent.classList.remove('on'); UI._bigOpen = false; };

  /* -------------------------------------------------------------------- confirm */
  UI.confirm = function (title, text, onYes, onNo) {
    if (!D.confirm) return;
    D.confirmTitle.textContent = title;
    D.confirmText.textContent = text || '';
    D.confirm.classList.add('on');
    const yes = D.confirmYes, no = D.confirmNo;
    const close = () => {
      D.confirm.classList.remove('on');
      yes.onclick = null; no.onclick = null;
    };
    yes.onclick = () => { close(); if (onYes) onYes(); };
    no.onclick = () => { close(); if (onNo) onNo(); };
  };

  /* -------------------------------------------------------------------- overlay */
  UI.bindOverlayClose = function () {
    if (D.overlayClose) D.overlayClose.onclick = () => UI.closeOverlay();
  };
  UI.openOverlay = function (kicker, title, html) {
    if (!D.overlay) return;
    D.overlayKicker.textContent = kicker || 'LEONIDA';
    D.overlayTitle.textContent = title || '';
    D.overlayBody.innerHTML = html;
    D.overlay.classList.add('on');
    UI.overlayOpen = true;
    if (LL.Input) LL.Input.unlock();
    try { LL.Audio.ui('click'); } catch (e) { }
  };
  UI.closeOverlay = function () {
    if (!D.overlay) return;
    D.overlay.classList.remove('on');
    UI.overlayOpen = false;
    try { LL.Audio.ui('back'); } catch (e) { }
    if (LL.Game && LL.Game.onOverlayClosed) LL.Game.onOverlayClosed();
  };

  /* -------------------------------------------------------------------- minimap */
  const MAP_RANGE = 210; // metres across the minimap
  UI.drawMinimap = function () {
    if (!D.mapCtx || !W.mapCanvas || !LL.game.player) return;
    const g = D.mapCtx, Wc = D.minimap.width, Hc = D.minimap.height;
    const S = LL.game.player.state.pos;
    const scale = W.mapScale || 1400 / W.WORLD;
    const px = S.x * scale, py = S.y * scale;
    const span = MAP_RANGE * scale;
    g.clearRect(0, 0, Wc, Hc);
    g.save();
    g.beginPath(); g.arc(Wc / 2, Hc / 2, Wc / 2 - 2, 0, 7); g.clip();
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, Wc, Hc);
    g.drawImage(W.mapCanvas, px - span, py - span, span * 2, span * 2, 0, 0, Wc, Hc);
    // subtle grid
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * Wc / 4, 0); g.lineTo(i * Wc / 4, Hc); g.stroke();
      g.beginPath(); g.moveTo(0, i * Hc / 4); g.lineTo(Wc, i * Hc / 4); g.stroke();
    }
    const toScreen = (x, y) => ({ x: Wc / 2 + ((x - S.x) / MAP_RANGE) * (Wc / 2), y: Hc / 2 + ((y - S.y) / MAP_RANGE) * (Hc / 2) });
    // POIs
    for (const p of W.pois) {
      const s = toScreen(p.x, p.y);
      if (s.x < -10 || s.y < -10 || s.x > Wc + 10 || s.y > Hc + 10) continue;
      g.fillStyle = p.color || '#ffcf5c';
      g.beginPath(); g.arc(s.x, s.y, 3.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.stroke();
    }
    // mission markers
    if (LL.Missions) for (const m of LL.Missions.markers) {
      const s = toScreen(m.x, m.y);
      g.fillStyle = '#ffcf5c';
      g.save(); g.translate(s.x, s.y); g.rotate(Math.PI / 4);
      g.fillRect(-4, -4, 8, 8); g.restore();
      g.strokeStyle = 'rgba(255,207,92,.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(s.x, s.y, 9 + Math.sin(LL.game.time * 3) * 2, 0, 7); g.stroke();
    }
    // vehicles
    for (const c of LL.Vehicles.list) {
      const s = toScreen(c.pos.x, c.pos.y);
      if (s.x < 0 || s.y < 0 || s.x > Wc || s.y > Hc) continue;
      g.fillStyle = c.spec.police ? '#5c8dff' : c.owned ? '#33e19a' : 'rgba(220,230,245,.55)';
      g.fillRect(s.x - 1.6, s.y - 1.6, 3.2, 3.2);
    }
    // police
    if (LL.Police) {
      for (const u of LL.Police.units) {
        if (!u.car) continue;
        const s = toScreen(u.car.pos.x, u.car.pos.y);
        g.fillStyle = Math.sin(LL.game.time * 7) > 0 ? '#5c8dff' : '#ff4d6a';
        g.beginPath(); g.arc(s.x, s.y, 3.4, 0, 7); g.fill();
      }
      for (const o of LL.Police.officers) {
        if (o.dead) continue;
        const s = toScreen(o.pos.x, o.pos.y);
        g.fillStyle = 'rgba(120,170,255,.8)';
        g.beginPath(); g.arc(s.x, s.y, 2.2, 0, 7); g.fill();
      }
    }
    // player arrow
    g.save();
    g.translate(Wc / 2, Hc / 2);
    g.rotate(LL.game.player.state.inVehicle ? LL.game.player.state.vehicle.angle : LL.game.player.state.angle);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 5); g.lineTo(-2, 0); g.lineTo(-5, -5); g.closePath(); g.fill();
    g.strokeStyle = '#ff3d6e'; g.lineWidth = 1.4; g.stroke();
    g.restore();
    g.restore();
    // frame ring
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2;
    g.beginPath(); g.arc(Wc / 2, Hc / 2, Wc / 2 - 2, 0, 7); g.stroke();
  };

  /* ------------------------------------------------------------------ HUD tick */
  const setText = (el, v) => { if (el && cache[el.id] !== v) { el.textContent = v; cache[el.id] = v; } };
  const setWidth = (el, pct) => { if (el) el.style.width = U.clamp(pct, 0, 100).toFixed(1) + '%'; };

  UI.updateHUD = function (dt) {
    const P = LL.Player;
    if (!P || !D.hud) return;
    const S = P.state;
    const g = LL.game;

    // vitals (every frame is fine — cheap transforms)
    setWidth(D.hpBar, S.health);
    setWidth(D.stBar, S.stamina);
    setWidth(D.arBar, S.armor);
    setWidth(D.fcBar, S.focus);
    UI._acc += dt;
    if (UI._acc > 0.12) {
      UI._acc = 0;
      setText(D.hpTxt, Math.round(S.health));
      setText(D.stTxt, Math.round(S.stamina));
      setText(D.arTxt, Math.round(S.armor));
      setText(D.fcTxt, Math.round(S.focus));
      setText(D.cash, U.fmtNum(S.money).replace(/^/, ''));
      setText(D.charName, S.character === 0 ? 'JASON' : 'LUCIA');
      setText(D.charAvatar, S.character === 0 ? 'J' : 'L');
      setText(D.charDistrict, W.districtAt(S.pos.x, S.pos.y));
      setText(D.mapDistrict, W.districtAt(S.pos.x, S.pos.y));
      const hour = W.env ? W.env.hour : 9;
      setText(D.clock, U.clock(hour));
      if (W.env) {
        const wn = W.env.weatherNames[W.env.weather] || ['CÉU LIMPO', '☀'];
        setText(D.weatherName, wn[0]);
        setText(D.weather, wn[1] + ' ' + Math.round(W.env.temp) + '°C');
      }
      // weapon
      const ws = P.weaponState();
      setText(D.weaponName, ws.id === 'fist' ? 'MÃOS' : ws.name);
      setText(D.ammoMag, ws.id === 'fist' ? '—' : String(ws.mag));
      setText(D.ammoRes, ws.id === 'fist' ? '' : String(ws.res));
      if (D.reloadBar) D.reloadBar.style.width = ws.reloading ? (ws.reloadPct * 100).toFixed(0) + '%' : '0%';
      // wanted
      for (let i = 0; i < 5; i++) {
        const on = i < LL.Police.wanted;
        if (D.wantedIcons[i]) D.wantedIcons[i].classList.toggle('on', on);
      }
      D.wanted.classList.toggle('hot', LL.Police.wanted >= 4);
      // vehicle hud
      if (S.inVehicle && S.vehicle) {
        D.vehicleHud.style.display = '';
        const v = S.vehicle;
        setText(D.speedVal, String(Math.round(v.kmh)));
        setText(D.gearVal, v.speed < -0.5 ? 'R' : Math.abs(v.speed) < 0.4 ? 'N' : 'D');
        setWidth(D.fuelBar, v.spec.tank > 0 ? (v.fuel / v.spec.tank) * 100 : 100);
        setWidth(D.hullBar, v.hp);
        setText(D.vehicleName, v.spec.name);
      } else D.vehicleHud.style.display = 'none';
      // crosshair
      if (D.crosshair) {
        const show = !S.inVehicle && !S.dead;
        D.crosshair.classList.toggle('hidden', !show);
        if (show) {
          const spread = 1 + (S.aiming ? -0.28 : 0.35) + (S.speed / 9) * 0.5 + (S.focusActive ? -0.2 : 0);
          D.crosshair.style.setProperty('--spread', spread.toFixed(2));
        }
      }
      if (D.focusFx) D.focusFx.style.opacity = S.focusActive ? 1 : 0;
      if (D.fps) { D.fps.classList.toggle('hidden', !LL.Settings.showFps); if (LL.Settings.showFps) setText(D.fps, Math.round(g.fps || 60) + ' FPS'); }
    }

    // interaction prompt (every frame, only when it changes)
    const prompt = UI.buildPrompt();
    if (prompt !== UI._prompt) {
      UI._prompt = prompt;
      if (!prompt) D.interact.classList.add('hidden');
      else { D.interact.innerHTML = prompt; D.interact.classList.remove('hidden'); }
    }

    UI._mapAcc += dt;
    if (UI._mapAcc > 0.08) { UI._mapAcc = 0; UI.drawMinimap(); }
  };

  UI.buildPrompt = function () {
    const P = LL.Player;
    if (!P || P.state.dead) return '';
    const S = P.state;
    if (S.inVehicle) {
      let extra = '';
      if (S.vehicle && S.vehicle.fuel < S.vehicle.spec.tank * 0.98) extra = ' · <b>G</b> abastecer';
      return '<b>E</b> sair do veículo · <b>H</b> buzina · <b>L</b> faróis' + extra;
    }
    const t = P.interactTarget();
    if (t) return '<b>E</b> ' + UI.esc(t.label);
    if (LL.Missions && !LL.Missions.active) {
      for (const m of LL.Missions.markers) {
        if (Math.hypot(m.x - S.pos.x, m.y - S.pos.y) < 6.5) return '<b>E</b> iniciar missão';
      }
    }
    if (LL.Econ) {
      for (const s of LL.Econ.robbableStores) {
        if (!s.robbed && Math.hypot(s.x - S.pos.x, s.y - S.pos.y) < 2.8) return '<b>E</b> assaltar ' + UI.esc(s.name);
      }
    }
    return '';
  };

  UI.setMenuVisible = function (on, playing) {
    if (!D.menu) return;
    D.menu.classList.toggle('on', !!on);
    D.menu.classList.toggle('playing', !!playing);
  };
  UI.setHudVisible = function (on) {
    if (D.hud) D.hud.classList.toggle('hidden', !on);
  };

  console.log('[ui] core pronto');
})();
