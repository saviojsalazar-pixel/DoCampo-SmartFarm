const assert = require('assert');
const { createStorage, createIndexedDB, loadDatabase } = require('./helpers/runtime');

function seedDatabase(indexedDB, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('docampo_core_v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore().put(value, 'canonical-database');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  });
}

(async () => {
  const indexedDB = createIndexedDB();
  const localStorage = createStorage({
    docampo_data_generation_v2: 'geracao-antiga',
    docampo_supabase_session_v1: '{"access_token":"antigo"}',
    lista_produtores_antiga: '["não pode sobreviver"]'
  });
  await seedDatabase(indexedDB, {
    schemaVersion: 2,
    generation: '8d487154-0a7b-4d39-9228-7c6cc414d979',
    entities: { farms: { antiga: { id: 'antiga', name: 'Fazenda antiga' } } },
    events: [], queue: [], conflicts: [], trash: [], purgedTombstones: {}
  });

  const context = await loadDatabase({ localStorage, indexedDB });
  assert.strictEqual(context.DoCampoDB.list('farms').length, 0, 'Primeira abertura da geração deve começar sem cadastros antigos.');
  assert.strictEqual(localStorage.getItem('docampo_supabase_session_v1'), null, 'Sessão antiga deve ser removida para exigir autenticação limpa.');
  assert.strictEqual(localStorage.getItem('lista_produtores_antiga'), null, 'Chaves antigas não podem repovoar o aplicativo.');
  assert.strictEqual(localStorage.getItem('docampo_factory_cleanup_pending_v2'), '1', 'Arquivos antigos devem ser limpos pelo shell nativo.');
  assert.strictEqual(context.DoCampoDB.userConfirmed(), false, 'Nova instalação deve exigir a confirmação do responsável deste aparelho.');
  context.DoCampoDB.setUser('Dr. Glaucio Luciano Araujo');
  assert.strictEqual(context.DoCampoDB.userConfirmed(), true);
  assert.strictEqual(context.DoCampoDB.user(), 'Dr. Glaucio Luciano Araujo');
  console.log('factory-reset: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
