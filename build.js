/* ============================================================================
   BUILD — inlines CSS, Three.js r128 and every game module into one HTML file.
   Usage: node build.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'GTA7_Leonida_Ultimate.html');

// load order matters: world data before builders, systems before main
const ORDER = [
  '00_core.js',
  '05_audio.js',
  '10_world_data.js',
  '11_world_blocks.js',
  '12_world_ground.js',
  '13_world_props.js',
  '14_world_env.js',
  '20_vehicles_data.js',
  '21_vehicles.js',
  '22_characters.js',
  '23_peds.js',
  '24_police.js',
  '30_player.js',
  '40_economy.js',
  '41_missions.js',
  '44_collectibles.js',
  '45_achievements.js',
  '50_ui.js',
  '51_panels.js',
  '60_main.js',
];

function read(p) { return fs.readFileSync(p, 'utf8'); }

function checkNoScriptTag(name, code) {
  if (/<\/script/i.test(code)) {
    throw new Error(name + ' contém "</script" — isso quebra o HTML final.');
  }
  return code;
}

function main() {
  const template = read(path.join(SRC, 'index.template.html'));
  const css = read(path.join(SRC, 'styles.css'));
  const threePath = path.join(ROOT, 'vendor', 'three.min.js');
  if (!fs.existsSync(threePath)) throw new Error('vendor/three.min.js ausente');
  const three = read(threePath);

  let js = '';
  let totalBytes = 0;
  for (const file of ORDER) {
    const full = path.join(SRC, file);
    if (!fs.existsSync(full)) throw new Error('módulo ausente: ' + file);
    const code = checkNoScriptTag(file, read(full));
    totalBytes += code.length;
    js += '\n/* ===== ' + file + ' ===== */\n' + code + '\n';
  }

  let html = template;
  const must = ['/*__CSS__*/', '/*__THREE__*/', '/*__GAME__*/'];
  for (const m of must) {
    if (html.indexOf(m) < 0) throw new Error('placeholder ausente no template: ' + m);
  }
  html = html.replace('/*__CSS__*/', () => checkNoScriptTag('styles.css', css).replace(/<\/style/gi, '<\\/style'));
  html = html.replace('/*__THREE__*/', () => three);
  html = html.replace('/*__GAME__*/', () => js);

  fs.writeFileSync(OUT, html, 'utf8');

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('build ok →', path.basename(OUT));
  console.log('  html total :', kb(html.length));
  console.log('  css        :', kb(css.length));
  console.log('  three r128 :', kb(three.length));
  console.log('  game js    :', kb(totalBytes), '(' + ORDER.length + ' módulos)');
}

try {
  main();
} catch (e) {
  console.error('BUILD FAILED:', e.message);
  process.exit(1);
}
