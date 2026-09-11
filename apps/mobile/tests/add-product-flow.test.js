const assert = require('assert');
const fs = require('fs');

for (const file of ['www/pulverizacao.html', 'www/herbicida.html']) {
  const source = fs.readFileSync(file, 'utf8');
  assert(source.includes('value="__ADD_NEW_PRODUCT__">＋ Adicionar novo produto</option>'), `${file}: ação de cadastro ausente`);
  assert(!source.includes('Outros / Personalizado'), `${file}: opção antiga Outros ainda presente`);
  assert(source.includes('DoCampoData.mergeProduct(cat, prodObj)'), `${file}: produto não é enviado à Central`);
  assert(source.includes('rowProduct.value = name'), `${file}: produto novo não é selecionado na linha atual`);
  assert(source.includes('onProductSelect(pendingRow)'), `${file}: dose/unidade do produto novo não são aplicadas`);
}

console.log('add-product-flow: ok');
