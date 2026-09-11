const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};
const embedded = [{ farm: 'Fazenda Teste', proprietor: 'Produtor', fields: [{ name: 'Talhão 1', area: 1, plants: 4000 }] }];
const context = {
  console, localStorage, CustomEvent: function () {},
  fetch: async () => ({ text: async () => `const EMBEDDED_DATABASE = ${JSON.stringify(embedded)}; const PRODUCT_CATALOG = {};` }),
  window: { dispatchEvent() {} },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('www/shared-data.js', 'utf8'), context);
context.window.DoCampoDB = {
  list(type) {
    if (type === 'farms') return [{ id: 'f1', name: 'Fazenda Teste', producerName: 'Produtor' }];
    if (type === 'fields') return [{ id: 'a1', farmId: 'f1', name: 'Talhão 1', area: 1, plants: 4000 }];
    return [];
  },
  upsert(type, value) { return type === 'farms' ? { ...value, id: value.id || 'f1' } : value; },
};
context.DoCampoDB = context.window.DoCampoDB;
context.DoCampoData = context.window.DoCampoData;
context.window.DoCampoData.mergeFarm({ farm: 'Fazenda Teste', producer: 'Produtor', fields: [
  { name: 'Talhão 1', area: 1, plants: 4000 },
  { name: 'Talhão 2', area: 2.25, plants: 8500 },
] });
vm.runInContext(fs.readFileSync('www/registry-loader.js', 'utf8'), context);
context.window.DoCampoRegistry.all().then(result => {
  const farm = result.farms.find(x => x.farm === 'Fazenda Teste');
  assert.deepStrictEqual(Array.from(farm.fields, x => x.name), ['Talhão 1', 'Talhão 2']);
  assert.strictEqual(farm.fields[1].area, 2.25);
  assert.strictEqual(farm.fields[1].plants, 8500);
  console.log('registry-areas: ok');
}).catch(error => { console.error(error); process.exitCode = 1; });
