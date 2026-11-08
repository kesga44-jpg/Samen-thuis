// Werkt de precache-lijst in sw.js bij op basis van index.html en zet een nieuwe cachenaam.
// Gebruik: node scripts/sync-sw-assets.mjs samen-thuis-v38-onderwerp
// Draai dit bij elke wijziging aan een asset of ?v=-versie; sw-assets.test.js controleert het resultaat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = process.argv[2];
if (!/^samen-thuis-v\d+-[a-z0-9-]+$/.test(cache || '')) { console.error('Geef een cachenaam als samen-thuis-v38-onderwerp'); process.exit(1); }
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const assets = ['./', './index.html',
  // Alleen eigen bestanden; externe scripts (http/https) worden nooit gecachet.
  ...[...html.matchAll(/<link rel="stylesheet" href="(?!https?:)([^"]+)"/g)].map(m => './' + m[1]),
  ...[...html.matchAll(/<script src="(?!https?:)([^"]+)"/g)].map(m => './' + m[1]),
  './manifest.webmanifest', './icon.svg'];
const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE='[^']*';/, `const CACHE='${cache}';`).replace(/const ASSETS=\[[^\]]*\];/, `const ASSETS=[${assets.map(a => `'${a}'`).join(',')}];`);
fs.writeFileSync(swPath, sw);
console.log(`sw.js: ${assets.length} assets, cache ${cache}`);
