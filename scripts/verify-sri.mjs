// Controleert of de SRI-hashes in cdn-libs.js overeenkomen met de bestanden die jsDelivr nu serveert.
// Gebruik (met internet): node scripts/verify-sri.mjs   → exitcode 0 bij volledige overeenstemming.
// Draai dit vóór het mergen of wijzigen van een bibliotheekversie.
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
const require = createRequire(import.meta.url);
const { LIBS, sriOf } = require('../cdn-libs.js');

let failed = 0;
for (const [name, lib] of Object.entries(LIBS)) {
  try {
    const res = await fetch(lib.url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const actual = await sriOf(await res.arrayBuffer(), webcrypto.subtle);
    const ok = actual === lib.integrity;
    if (!ok) failed += 1;
    console.log(`${ok ? 'OK  ' : 'FOUT'} ${name} ${lib.url}${ok ? '' : `\n     verwacht ${lib.integrity}\n     gekregen ${actual}`}`);
  } catch (error) {
    failed += 1;
    console.log(`FOUT ${name} ${lib.url}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
