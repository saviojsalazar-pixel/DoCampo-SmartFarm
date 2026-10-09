const assert = require('assert');
const { createStorage, createIndexedDB, loadDatabase } = require('./helpers/runtime');

(async () => {
  const localStorage = createStorage();
  const indexedDB = createIndexedDB();

  const first = await loadDatabase({ localStorage, indexedDB });
  const visitId = 'visit-restart-1';
  first.DoCampoDB.upsert('visits', {
    id: visitId,
    farmName: 'Fazenda Persistente',
    producerName: 'Produtor Persistente',
    status: 'em_andamento',
    checklist: [{ talhao: '1.1', obs: 'Ferrugem no terço médio' }],
    formDraft: {
      farmName: 'Fazenda Persistente',
      talhao: '1.2',
      observacoes: 'Rascunho antes de fechar o aplicativo',
      pontosGps: [{ id: 'ponto-1', latitude: -20.1, longitude: -41.9, photoPath: 'docampo/photos/foto-1.jpg' }]
    }
  });
  first.DoCampoDB.addDocument({
    id: 'doc-restart-1', name: 'Checklist.pdf', typeLabel: 'Checklist de Lavoura',
    generatedAt: new Date().toISOString(), localAvailable: true, localPath: 'documents/doc-restart-1.pdf'
  });
  await first.DoCampoDB.flush();

  const reopened = await loadDatabase({ localStorage, indexedDB });
  const recovered = reopened.DoCampoDB.get('visits', visitId);
  assert(recovered, 'A visita deve existir depois de fechar e reabrir o aplicativo.');
  assert.strictEqual(recovered.checklist[0].obs, 'Ferrugem no terço médio');
  assert.strictEqual(recovered.formDraft.observacoes, 'Rascunho antes de fechar o aplicativo');
  assert.strictEqual(recovered.formDraft.pontosGps[0].photoPath, 'docampo/photos/foto-1.jpg');
  assert.strictEqual(reopened.DoCampoDB.get('documents', 'doc-restart-1').localPath, 'documents/doc-restart-1.pdf');

  reopened.DoCampoDB.upsert('visits', { id: visitId, generalNotes: 'Informação acrescentada após reabrir' });
  reopened.DoCampoDB.softDelete('documents', 'doc-restart-1');
  await reopened.DoCampoDB.flush();

  const reopenedAgain = await loadDatabase({ localStorage, indexedDB });
  const recoveredAgain = reopenedAgain.DoCampoDB.get('visits', visitId);
  assert.strictEqual(recoveredAgain.generalNotes, 'Informação acrescentada após reabrir');
  assert.strictEqual(recoveredAgain.checklist.length, 1, 'Atualização parcial após reinício não pode apagar o checklist.');
  assert.strictEqual(recoveredAgain.formDraft.pontosGps[0].photoPath, 'docampo/photos/foto-1.jpg');
  assert(reopenedAgain.DoCampoDB.get('documents', 'doc-restart-1').deletedAt, 'Documento movido para a lixeira deve continuar lá após reiniciar.');
  console.log('restart-persistence: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
