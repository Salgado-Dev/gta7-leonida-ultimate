/* ============================================================================
   40 · ECONOMY — shops, services, garage, fence, Wenk hacking, trunk, crime hooks.
   ========================================================================== */
(function () {
  'use strict';
  const LL = window.LL, U = LL.U;
  const W = LL.World, V = LL.Vehicles, Player = LL.Player;
  const Econ = (LL.Econ = {});
  const PI = Math.PI;

  Econ.PRICES = {
    fuelPerL: 6.4, repairPerHp: 46, healPerHp: 14, armor: 900, snack: 45,
    registerFee: 850, clothes: 340, hackCooldown: 7, hospitalFee: 320,
  };

  Econ.money = () => Player.state.money;

  Econ.spend = function (n, reason) {
    if (Player.state.money < n) { LL.notify('Dinheiro insuficiente.', 'red', 'CAIXA'); try { LL.Audio.ui('error'); } catch (e) { } return false; }
    Player.addMoney(-n, reason);
    return true;
  };

  /* --------------------------------------------------------------------- fuel */
  Econ.fuelCar = function (car, litres) {
    if (!car) return false;
    const need = Math.max(0, car.spec.tank - car.fuel);
    if (need < 0.5) { LL.notify('O tanque já está cheio.', 'gold', 'POSTO'); return false; }
    const amount = Math.min(litres || need, need);
    const cost = Math.round(amount * Econ.PRICES.fuelPerL);
    if (!Econ.spend(cost, 'combustível')) return false;
    car.refuel(amount);
    LL.notify('Abastecido: ' + amount.toFixed(1) + ' L por ' + U.fmtMoney(cost), 'green', 'POSTO');
    try { LL.Audio.ui('cash'); } catch (e) { }
    return true;
  };

  /* -------------------------------------------------------------------- repair */
  Econ.repairCar = function (car) {
    if (!car) return false;
    const missing = 100 - car.hp;
    if (missing < 1) { LL.notify('O veículo está inteiro.', 'gold', 'OFICINA'); return false; }
    const cost = Math.round(missing * Econ.PRICES.repairPerHp);
    if (!Econ.spend(cost, 'reparo')) return false;
    car.hp = 100; car.damageLevel = 0;
    LL.notify('Reparo completo por ' + U.fmtMoney(cost), 'green', 'OFICINA');
    return true;
  };

  Econ.paintCar = function (car, color) {
    if (!car) return false;
    if (!Econ.spend(1200, 'pintura')) return false;
    car.color = color;
    // rebuild the mesh with the new paint
    const idx = V.list.indexOf(car);
    const wasDriver = car.driver;
    const speed = car.speed, angle = car.angle, hp = car.hp, fuel = car.fuel;
    LL.Vehicles.remove(car);
    const fresh = V.spend = V.spawn(car.type, car.pos.x, car.pos.y, angle, { color, force: true, fuel, hp });
    if (fresh) {
      fresh.driver = wasDriver; fresh.speed = speed;
      if (wasDriver === 'player') { Player.state.vehicle = fresh; V.playerCar = fresh; }
      LL.notify('Pintura aplicada.', 'green', 'OFICINA');
    }
    return true;
  };

  /* ------------------------------------------------------------------- weapons */
  Econ.buyWeapon = function (id, price) {
    if (!Econ.spend(price, 'arma')) return false;
    Player.giveWeapon(id, Player.WEAPONS[id].mag * 3);
    return true;
  };
  Econ.buyAmmo = function (id, price) {
    if (!Econ.spend(price, 'munição')) return false;
    Player.giveWeapon(id, Player.WEAPONS[id].mag * 3);
    return true;
  };
  Econ.buyArmor = function () {
    if (!Econ.spend(Econ.PRICES.armor, 'colete')) return false;
    Player.state.armor = 100;
    LL.notify('Colete balístico equipado.', 'green', 'AMMU-LEONIDA');
    return true;
  };
  Econ.buySnack = function () {
    if (!Econ.spend(Econ.PRICES.snack, 'lanche')) return false;
    Player.state.health = Math.min(Player.state.maxHealth, Player.state.health + 25);
    Player.state.stamina = Math.min(100, Player.state.stamina + 40);
    LL.notify('Energia recuperada.', 'green', 'CONVENIÊNCIA');
    return true;
  };
  Econ.buyClothes = function (variant) {
    if (!Econ.spend(Econ.PRICES.clothes, 'roupas')) return false;
    Player.wearOutfit(variant);
    LL.notify('Novo visual aplicado. A polícia vai demorar a te reconhecer.', 'green', 'CASA VICE');
    return true;
  };
  Econ.heal = function () {
    const missing = Player.state.maxHealth - Player.state.health;
    const cost = Math.max(Econ.PRICES.hospitalFee, Math.round(missing * Econ.PRICES.healPerHp));
    if (missing < 2) { LL.notify('Você está inteiro.', 'gold', 'HOSPITAL'); return false; }
    if (!Econ.spend(cost, 'hospital')) return false;
    Player.state.health = Player.state.maxHealth;
    LL.notify('Tratamento concluído.', 'green', 'HOSPITAL');
    return true;
  };

  /* ------------------------------------------------------------------- garage */
  Econ.buyVehicle = function (type) {
    const spec = V.CATALOG[type];
    if (!spec || spec.police) return false;
    const price = spec.price;
    if (!Econ.spend(price, 'veículo')) return false;
    const g = LL.game;
    g.garage = g.garage || [];
    const entry = { type, color: U.pick(spec.colors), hp: 100, fuel: spec.tank, owned: true, plate: 'LND-' + U.rint(1000, 9999) };
    g.garage.push(entry);
    // spawn it right in front of the dealer
    const poi = W.pois.find((p) => p.service === 'dealer');
    const spot = W.parkingSpots.find((p) => p.tag === 'dealer' && !V.atPoint(p.x, p.y, 6));
    const x = spot ? spot.x : (poi ? poi.x + 30 : g.player.pos.x + 20);
    const y = spot ? spot.y : (poi ? poi.y + 40 : g.player.pos.y);
    const car = V.spawn(type, x, y, spot ? spot.a : 0, { color: entry.color, force: true, owned: true, fuel: spec.tank });
    if (car) LL.notify(spec.name + ' comprado e entregue na concessionária.', 'green', 'AUTO LEONIDA');
    return true;
  };

  Econ.registerCar = function (car) {
    if (!car) return false;
    if (car.owned) { LL.notify('Este veículo já está registrado.', 'gold', 'REGISTRO'); return false; }
    if (!Econ.spend(Econ.PRICES.registerFee, 'registro')) return false;
    car.owned = true; car.tracker = false; car.locked = false; car.alarm = false;
    LL.game.garage = LL.game.garage || [];
    LL.game.garage.push({ type: car.type, color: car.color, hp: car.hp, fuel: car.fuel, owned: true, plate: 'LND-' + U.rint(1000, 9999) });
    LL.notify('Veículo registrado no seu nome.', 'green', 'REGISTRO');
    return true;
  };

  Econ.fenceCar = function (car) {
    if (!car) return false;
    if (car.driver === 'player') { LL.notify('Saia do veículo antes de vender.', 'gold', 'RECEPTADOR'); return false; }
    const base = car.spec.value || 2000;
    const condition = 0.45 + (car.hp / 100) * 0.55;
    const price = Math.round(base * condition);
    const dist = Math.hypot(car.pos.x - Player.state.pos.x, car.pos.y - Player.state.pos.y);
    if (dist > 16) { LL.notify('Traga o veículo até o receptador.', 'gold', 'RECEPTADOR'); return false; }
    V.remove(car);
    Player.addMoney(price, 'venda de veículo');
    LL.game.stats.carsSold = (LL.game.stats.carsSold || 0) + 1;
    LL.notify('Veículo vendido por ' + U.fmtMoney(price), 'green', 'RECEPTADOR');
    try { LL.Audio.ui('cash'); } catch (e) { }
    return true;
  };

  Econ.recoverGarage = function (idx) {
    const g = LL.game;
    const entry = (g.garage || [])[idx];
    if (!entry) return false;
    if (!Econ.spend(150, 'entrega')) return false;
    const poi = W.pois.find((p) => p.service === 'garage');
    const x = (poi ? poi.x : Player.state.pos.x) + U.rand(18, -18);
    const y = (poi ? poi.y : Player.state.pos.y) + U.rand(22, 6);
    const car = V.spawn(entry.type, x, y, U.rand(6.28), { color: entry.color, owned: true, force: true, fuel: entry.fuel, hp: entry.hp });
    if (car) { LL.notify(V.CATALOG[entry.type].name + ' entregue na oficina.', 'green', 'GARAGEM'); return true; }
    return false;
  };

  /* ------------------------------------------------------------------ hacking */
  Econ.hackNearest = function () {
    const S = Player.state;
    if (LL.game.time - (Econ._lastHack || -99) < Econ.PRICES.hackCooldown) return false;
    const car = V.nearest(S.pos.x, S.pos.y, 26, (c) => c.locked);
    if (!car) { LL.notify('Nenhum veículo travado por perto.', 'gold', 'WENK'); return false; }
    Econ._lastHack = LL.game.time;
    car.locked = false;
    car.alarm = false;
    LL.game.stats.hacks = (LL.game.stats.hacks || 0) + 1;
    LL.notify('WENK: trava eletrônica desativada — ' + car.spec.name, 'green', 'WENK');
    try { LL.Audio.ui('confirm'); } catch (e) { }
    return true;
  };

  /* -------------------------------------------------------------------- trunk */
  Econ.trunkAccess = function () {
    const S = Player.state;
    const car = S.inVehicle ? S.vehicle : V.nearest(S.pos.x, S.pos.y, 4.2);
    if (!car) return null;
    car.trunk = car.trunk || { weapons: [], loot: 0 };
    return car;
  };
  Econ.storeWeaponInTrunk = function (car, id) {
    if (!car || !id) return false;
    const w = Player.WEAPONS[id];
    if (!w || w.melee) { LL.notify('Isso não cabe no porta-malas.', 'gold', 'PORTA-MALAS'); return false; }
    car.trunk = car.trunk || { weapons: [], loot: 0 };
    const ammo = Player.state.ammo[id];
    if (!ammo) return false;
    car.trunk.weapons.push({ id, mag: ammo.mag, res: ammo.res });
    delete Player.state.ammo[id];
    if (Player.state.weapon === id) Player.state.weapon = 'fist';
    LL.notify(w.name + ' guardada no porta-malas.', 'green', 'PORTA-MALAS');
    return true;
  };
  Econ.takeWeaponFromTrunk = function (car, idx) {
    if (!car || !car.trunk || !car.trunk.weapons[idx]) return false;
    const w = car.trunk.weapons.splice(idx, 1)[0];
    Player.state.ammo[w.id] = { mag: w.mag, res: w.res };
    Player.selectWeapon(w.id);
    LL.notify(Player.WEAPONS[w.id].name + ' retirada do porta-malas.', 'green', 'PORTA-MALAS');
    return true;
  };
  Econ.storeLoot = function (car) {
    const S = Player.state;
    if (!S.loot) { LL.notify('Você não tem espólios.', 'gold', 'PORTA-MALAS'); return false; }
    car.trunk = car.trunk || { weapons: [], loot: 0 };
    car.trunk.loot += S.loot; S.loot = 0;
    LL.notify('Espólios guardados.', 'green', 'PORTA-MALAS');
    return true;
  };
  Econ.takeLoot = function (car) {
    if (!car.trunk || !car.trunk.loot) return false;
    Player.state.loot = (Player.state.loot || 0) + car.trunk.loot;
    car.trunk.loot = 0;
    LL.notify('Espólios retirados.', 'green', 'PORTA-MALAS');
    return true;
  };

  /* ------------------------------------------------------------------- casino */
  Econ.bet = function (amount) {
    amount = Math.max(50, Math.min(20000, Math.round(amount)));
    if (!Econ.spend(amount, 'aposta')) return false;
    const win = Math.random() < 0.42;
    if (win) {
      const payout = Math.round(amount * U.rand(2.4, 1.4));
      Player.addMoney(payout, 'cassino');
      LL.notify('Você ganhou ' + U.fmtMoney(payout) + ' na roleta!', 'green', 'HOTEL CORAL');
      LL.game.stats.casinoWon = (LL.game.stats.casinoWon || 0) + (payout - amount);
    } else {
      LL.notify('A banca levou ' + U.fmtMoney(amount) + '.', 'red', 'HOTEL CORAL');
    }
    return true;
  };

  /* ------------------------------------------------------------------ robbery */
  Econ.robbableStores = [];
  Econ.buildRobList = function () {
    const names = ['Leonida Mart', 'Sunset Liquor', 'Praia Café', 'Bodega 24H', 'Pawn & Gold', 'Lucky Cigars', 'Surf Shack', 'Tacos El Rey', 'Moonlight Diner'];
    Econ.robbableStores = [];
    const commercial = (W.blocks || []).filter((b) => b.zone === 'commercial' || b.zone === 'entertainment');
    for (let i = 0; i < commercial.length && Econ.robbableStores.length < 14; i++) {
      const b = commercial[i];
      Econ.robbableStores.push({
        id: 'store_' + i,
        name: names[i % names.length],
        x: b.center.x + 148, y: b.center.y + 148,
        value: 180 + Math.round(Math.random() * 320), robbed: false, cooldown: 0,
      });
    }
  };

  Econ.robStore = function (store) {
    if (!store || store.robbed) {
      if (store && store.cooldown > 0) LL.notify('A loja está vazia por enquanto.', 'gold', 'ASSALTO');
      return false;
    }
    if (LL.Police.wanted > 0 && LL.Police.wanted >= 3) {
      // still allowed, but loud
    }
    store.robbed = true;
    store.cooldown = 240;
    Player.state.loot = (Player.state.loot || 0) + store.value;
    Player.addMoney(Math.round(store.value * 0.35), 'assalto');
    if (LL.Peds) LL.Peds.scare(store.x, store.y, 40, { crime: 'assalto' });
    LL.Police.reportCrime('assalto', store.x, store.y, 2);
    LL.game.stats.storesRobbed = (LL.game.stats.storesRobbed || 0) + 1;
    LL.notify('Caixa arrombado: ' + U.fmtMoney(store.value) + ' em espólios.', 'gold', 'ASSALTO');
    try { LL.Audio.alarm(store.x, store.y); } catch (e) { }
    return true;
  };

  Econ.update = function (dt) {
    for (const s of Econ.robbableStores) {
      if (s.cooldown > 0) s.cooldown -= dt;
      if (s.cooldown <= 0 && s.robbed) s.robbed = false;
    }
    // tracker cars call the cops
    for (const car of V.list) {
      if (car.tracker && car.driver === 'player') {
        car._trackT = (car._trackT || 0) + dt;
        if (car._trackT > 22 && !car._tracked) {
          car._tracked = true;
          LL.Police.reportCrime('furto', car.pos.x, car.pos.y, 2);
          LL.notify('Rastreador acionado! A polícia sabe onde você está.', 'red', 'RASTREADOR');
        }
      }
    }
  };

  console.log('[economy] pronto —', Econ.PRICES.fuelPerL, '$/L');
})();
