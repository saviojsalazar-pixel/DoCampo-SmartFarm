const assert = require('assert');
const { loadDatabase } = require('./helpers/runtime');

(async () => {
  const { DoCampoDB: db } = await loadDatabase();
  let visit = db.upsert('visits', {
    id: 'visit-1', farmName: 'Fazenda', status: 'em_andamento',
    checklist: [{ talhao: '1', obs: 'local' }, { talhao: '2', obs: 'preservar' }]
  });
  const remoteBeforeDelete = JSON.parse(JSON.stringify(visit));

  visit = db.upsert('visits', { id: 'visit-1', status: 'concluida' });
  assert.deepStrictEqual(Array.from(visit.checklist, item => item.talhao), ['1', '2'], 'Atualização parcial não pode apagar a lista do checklist.');

  for (let index = 0; index < 20; index++) {
    visit = db.upsert('visits', { ...visit, generalNotes: 'nota ' + index });
  }
  assert.strictEqual(db.pendingEvents().filter(event => event.entityId === 'visit-1').length, 1, 'Rascunhos repetidos devem manter somente o evento pendente mais recente.');

  visit = db.upsert('visits', { ...visit, checklist: visit.checklist.filter(item => item.talhao !== '2') });
  const remote = {
    id: '22222222-2222-4222-8222-222222222222',
    generation: db.generation,
    entity_type: 'visits', entity_id: 'visit-1', operation: 'upsert', device_id: 'outro',
    server_sequence: 10, server_created_at: '2099-01-02T00:00:00.000Z',
    payload: { ...remoteBeforeDelete, updatedAt: '2099-01-02T00:00:00.000Z', generalNotes: 'nota do outro aparelho' }
  };
  assert.strictEqual(db.applyRemote(remote), 'merged');
  assert.deepStrictEqual(Array.from(db.get('visits', 'visit-1').checklist, item => item.talhao), ['1'], 'Talhão removido não pode ressurgir pela cópia antiga do outro celular.');
  await db.flush();
  console.log('storage-stability: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
