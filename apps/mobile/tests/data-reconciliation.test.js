const assert = require('assert');
const { loadDatabase, runFile } = require('./helpers/runtime');

(async () => {
  const context = await loadDatabase();
  runFile(context, 'www/shared-data.js');
  const data = context.DoCampoData;
  const db = context.DoCampoDB;

  data.mergeFarm({
    farm: 'Fazenda Teste', producer: 'Produtor', cpf: '',
    fields: [{ name: '1.', area: 2, plants: 8000 }, { name: '2.', area: 3, plants: 9000 }]
  });
  let farm = data.read().farms[0];
  assert.deepStrictEqual(Array.from(farm.fields, field => field.name), ['1.', '2.']);
  assert.throws(() => data.mergeFarm({
    farm: 'Fazenda Teste', producer: 'Produtor',
    fields: [{ name: '1.', area: 2 }, { name: '1', area: 2 }]
  }), /Talhão duplicado/, 'Duplicidade não pode ser mesclada silenciosamente fora da revisão da planilha.');

  data.mergeFarm({ farm: 'Fazenda Teste', producer: 'Produtor Atualizado', cpf: '123.456.789-00', fields: [{ name: '1.', area: 2.5, plants: 8200 }] });
  farm = data.read().farms[0];
  assert.strictEqual(farm.fields.length, 1);
  assert.strictEqual(farm.fields[0].area, 2.5);
  assert.strictEqual(db.list('producers').length, 1, 'Atualizar CPF/nome não pode duplicar o produtor.');
  assert.strictEqual(db.list('fields', { deleted: true }).length, 1, 'Talhão retirado deve ir para a lixeira.');
  await db.flush();
  console.log('data-reconciliation: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
