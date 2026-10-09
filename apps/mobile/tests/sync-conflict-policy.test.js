const assert = require('assert');
const { loadDatabase } = require('./helpers/runtime');

(async () => {
  const { DoCampoDB: db } = await loadDatabase();
  db.upsert('fields', { id: 'field-1', name: 'Talhão local', farmId: 'farm-1' });
  const remote = {
    id: '11111111-1111-4111-8111-111111111111', generation: db.generation,
    entity_type: 'fields', entity_id: 'field-1', operation: 'upsert', device_id: 'celular-2', server_sequence: 1,
    server_created_at: '2099-01-01T00:00:00.000Z',
    payload: { id: 'field-1', name: 'Talhão remoto', farmId: 'farm-1', updatedAt: '2099-01-01T00:00:00.000Z' }
  };
  assert.strictEqual(db.applyRemote(remote), 'conflict');
  assert.strictEqual(db.applyRemote(remote), 'known');
  assert.strictEqual(db.read().conflicts.filter(item => !item.resolvedAt).length, 1);
  const conflict = db.read().conflicts.find(item => !item.resolvedAt);
  db.resolveConflict(conflict.id, 'remote');
  assert.strictEqual(db.get('fields', 'field-1').name, 'Talhão remoto');
  assert.strictEqual(db.read().conflicts.filter(item => !item.resolvedAt).length, 0);
  assert.strictEqual(db.pendingEvents().filter(event => event.entityId === 'field-1').length, 1, 'Resolução deve substituir a edição pendente anterior.');
  await db.flush();
  console.log('sync-conflict-policy: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
