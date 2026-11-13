// Opt-in database integration checks for the named local Supabase stack only.
const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const container = 'supabase_db_samen-thuis-staging';
const probe = cp.spawnSync('docker', ['inspect', '--format', '{{.State.Running}}', container], { encoding: 'utf8' });
const skip = probe.status === 0 && probe.stdout.trim() === 'true'
  ? false
  : /permission denied/i.test(probe.stderr || '')
    ? 'Huidige gebruiker heeft geen toegang tot Docker'
    : probe.error
      ? 'Docker CLI is niet beschikbaar'
      : 'Lokale Supabase-container is niet gestart; zie docs/LOCAL_STAGING.md';

test('lokale Supabase PostgreSQL 15: grants, RLS, RPCs en synthetische fixtures', { skip }, t => {
  const sqlPath = path.join(__dirname, 'supabase', 'test-support', 'local_security.sql');
  const result = cp.spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    { encoding: 'utf8', input: fs.readFileSync(sqlPath, 'utf8') }
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  for (const warning of (result.stderr.match(/WARNING: .+/g) || [])) t.diagnostic(warning);
});
