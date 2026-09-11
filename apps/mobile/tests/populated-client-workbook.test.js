const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  console, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, URL, setTimeout,
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { pathname: '/clientes.html' },
  document: { getElementById: () => null, querySelector: () => null, body: {}, addEventListener: () => {} },
};
context.window = { addEventListener: () => {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('www/bulk-import.js', 'utf8'), context);

(async () => {
  const template = fs.readFileSync('www/assets/Modelo_Importacao_SmartFarm.xlsx');
  const farms = [{ producer: 'José & Filhos', cpf: '01234567890', farm: 'Fazenda Café', address: 'Reduto - MG', fields: [{ name: '3.1', area: 1.6, plants: 5639, culture: 'Café' }] }];
  const blob = await context.window.DoCampoBulkImport.populatedModel(template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength), farms);
  fs.writeFileSync('tests/populated-client-workbook.inspect.xlsx', Buffer.from(await blob.arrayBuffer()));
  assert(blob.size > 0);
  console.log('populated-client-workbook: ok');
})().catch(error => { console.error(error); process.exit(1); });
