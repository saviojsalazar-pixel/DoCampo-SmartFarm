const assert = require('assert');
const { loadDatabase, runFile } = require('./helpers/runtime');

(async () => {
  const context = await loadDatabase();
  runFile(context, 'www/form-drafts.js');
  const before = context.DoCampoDB.status().pending;
  context.DoCampoDrafts.save('pulverizacao', { farm: 'Fazenda A', field: '1.1', dose: 2 });
  await context.DoCampoDB.flush();
  assert(context.DoCampoDrafts.load('pulverizacao'), 'Rascunho local precisa ser recuperável.');
  assert.strictEqual(context.DoCampoDB.status().pending, before, 'Rascunho exclusivo do aparelho não deve entrar na fila da nuvem.');
  context.DoCampoDrafts.clear('pulverizacao');
  await context.DoCampoDB.flush();
  assert.strictEqual(context.DoCampoDrafts.load('pulverizacao'), null);
  assert.strictEqual(context.DoCampoDB.status().pending, before, 'Limpeza do rascunho local também não deve entrar na fila.');
  console.log('local-drafts: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
