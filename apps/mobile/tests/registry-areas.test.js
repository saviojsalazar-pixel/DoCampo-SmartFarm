const assert = require('assert');
const { loadDatabase, runFile } = require('./helpers/runtime');

(async () => {
  const context = await loadDatabase();
  runFile(context, 'www/shared-data.js');
  runFile(context, 'www/registry-loader.js');
  context.DoCampoData.mergeFarm({
    farm: 'Fazenda Teste', producer: 'Produtor',
    fields: [{ name: 'Talhão 1', area: 1, plants: 4000 }, { name: 'Talhão 2', area: 2.25, plants: 8500 }]
  });
  const result = await context.DoCampoRegistry.all();
  const farm = result.farms.find(item => item.farm === 'Fazenda Teste');
  assert.deepStrictEqual(Array.from(farm.fields, field => field.name), ['Talhão 1', 'Talhão 2']);
  assert.strictEqual(farm.fields[1].area, 2.25);
  assert.strictEqual(farm.fields[1].plants, 8500);
  console.log('registry-areas: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
