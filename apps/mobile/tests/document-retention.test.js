const assert = require('assert');
const { loadDatabase } = require('./helpers/runtime');

(async () => {
  const { DoCampoDB: db } = await loadDatabase();
  const old = new Date(Date.now() - 8 * 86400000).toISOString();
  const recent = new Date(Date.now() - 2 * 86400000).toISOString();
  db.addDocument({ id: 'old', generatedAt: old, name: 'Antigo' });
  db.addDocument({ id: 'recent', generatedAt: recent, name: 'Recente' });
  assert.strictEqual(db.archiveOldDocuments(7), 1);
  assert.ok(db.get('documents', 'old').deletedAt);
  assert.ok(!db.get('documents', 'recent').deletedAt);
  db.restore('documents', 'old');
  assert.ok(db.get('documents', 'old').restoredAt);
  assert.strictEqual(db.archiveOldDocuments(7), 0, 'Documento restaurado deve ganhar mais sete dias ativo.');
  db.softDelete('documents', 'old');
  assert.ok(db.hardDelete('documents', 'old'));
  assert.strictEqual(db.get('documents', 'old'), null);
  assert(db.pendingEvents().some(event => event.entityId === 'old' && event.operation === 'delete'), 'Exclusão definitiva não pode descartar a lápide ainda não sincronizada.');
  assert.strictEqual(db.applyRemote({
    id: '33333333-3333-4333-8333-333333333333', generation: db.generation,
    entity_type: 'documents', entity_id: 'old', operation: 'upsert', device_id: 'celular-antigo', server_sequence: 50,
    payload: { id: 'old', name: 'Cópia antiga', updatedAt: '2099-01-01T00:00:00.000Z' }
  }), 'purged-tombstone');
  assert.strictEqual(db.get('documents', 'old'), null, 'Aparelho antigo não pode ressuscitar documento excluído definitivamente.');
  await db.flush();
  console.log('document-retention: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
