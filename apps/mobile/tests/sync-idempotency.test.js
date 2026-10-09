const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let request = null, synced = null, flushed = 0;
const event = {
  id: '11111111-1111-4111-8111-111111111111', entityType: 'fields', entityId: 'field-1', operation: 'upsert',
  payload: { name: '1' }, deviceId: 'phone-1', userName: 'Sávio', createdAt: '2026-09-16T10:00:00.000Z',
  baseRevision: 0, appVersion: '1.9.46'
};
const context = {
  console,
  navigator: { onLine: true },
  URLSearchParams,
  CustomEvent: function () {},
  fetch: async (url, options) => { request = { url, options }; return { ok: true, status: 201, json: async () => [], text: async () => '' }; },
  window: { DoCampoCloudConfig: { configured: true, url: 'https://example.supabase.co', anonKey: 'public' }, dispatchEvent() {} },
  DoCampoAuth: { accessToken: async () => 'token' },
  DoCampoDB: {
    generation: '8d487154-0a7b-4d39-9228-7c6cc414d979', appVersion: '1.9.46',
    pendingEvents: () => [event], markSynced: ids => { synced = ids; }, flush: async () => { flushed++; },
    read: () => ({ conflicts: [] }), status: () => ({ pending: 0, lastServerSequence: 0 })
  }
};
context.window.window = context.window;
context.window.DoCampoAuth = context.DoCampoAuth;
context.window.DoCampoDB = context.DoCampoDB;
vm.createContext(context);
vm.runInContext(fs.readFileSync('www/sync-engine.js', 'utf8'), context);

context.window.DoCampoSync.upload().then(() => {
  assert(request.url.endsWith('/docampo_sync_events_v2?on_conflict=id'));
  assert.strictEqual(request.options.headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
  assert.deepStrictEqual(synced, [event.id]);
  assert.strictEqual(flushed, 1, 'Confirmação da fila deve ser persistida.');
  const body = JSON.parse(request.options.body);
  assert.strictEqual(body[0].generation, context.DoCampoDB.generation);
  console.log('sync-idempotency: ok');
}).catch(error => { console.error(error); process.exitCode = 1; });
