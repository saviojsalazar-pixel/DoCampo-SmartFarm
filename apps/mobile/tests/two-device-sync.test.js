const assert = require('assert');
const { loadDatabase, runFile } = require('./helpers/runtime');

const generation = '8d487154-0a7b-4d39-9228-7c6cc414d979';
const server = { sequence: 0, events: [], ids: new Set() };

async function cloudFetch(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/docampo_app_state')) {
    return response([{ generation }]);
  }
  if (parsed.pathname.endsWith('/docampo_sync_events_v2') && options.method === 'POST') {
    for (const row of JSON.parse(options.body || '[]')) {
      if (server.ids.has(row.id)) continue;
      server.ids.add(row.id);
      server.events.push({
        ...row,
        server_sequence: ++server.sequence,
        server_created_at: new Date(Date.now() + server.sequence).toISOString()
      });
    }
    return response([], 201);
  }
  if (parsed.pathname.endsWith('/docampo_sync_events_v2')) {
    const cursor = Number(String(parsed.searchParams.get('server_sequence') || '').replace(/^gt\./, '')) || 0;
    const limit = Number(parsed.searchParams.get('limit')) || 500;
    return response(server.events.filter(event => event.server_sequence > cursor).slice(0, limit));
  }
  return response({ message: 'Rota inesperada: ' + parsed.pathname }, 404);
}

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(JSON.stringify(data)),
    text: async () => JSON.stringify(data)
  };
}

async function phone() {
  const context = await loadDatabase();
  context.DoCampoCloudConfig = { configured: true, url: 'https://example.supabase.co', anonKey: 'public' };
  context.DoCampoAuth = { accessToken: async () => 'token', status: () => ({ authenticated: true }) };
  context.fetch = cloudFetch;
  runFile(context, 'www/sync-engine.js');
  return context;
}

(async () => {
  const [a, b] = await Promise.all([phone(), phone()]);
  a.DoCampoDB.upsert('farms', { id: 'farm-a', name: 'Fazenda A' });
  b.DoCampoDB.upsert('farms', { id: 'farm-b', name: 'Fazenda B' });
  await Promise.all([a.DoCampoSync.sync(), b.DoCampoSync.sync()]);
  await Promise.all([a.DoCampoSync.sync(), b.DoCampoSync.sync()]);
  for (const context of [a, b]) {
    assert.deepStrictEqual(Array.from(context.DoCampoDB.list('farms'), item => item.id).sort(), ['farm-a', 'farm-b']);
    assert.strictEqual(context.DoCampoDB.status().pending, 0);
  }

  a.DoCampoDB.softDelete('farms', 'farm-a');
  await a.DoCampoSync.sync();
  await b.DoCampoSync.sync();
  assert.strictEqual(b.DoCampoDB.get('farms', 'farm-a').deletedAt != null, true, 'Exclusão sincronizada deve prevalecer no segundo aparelho.');
  console.log('two-device-sync: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
