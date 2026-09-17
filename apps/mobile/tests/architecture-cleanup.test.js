const assert = require('assert');
const fs = require('fs');

const registry = fs.readFileSync('www/registry-loader.js', 'utf8');
const sync = fs.readFileSync('www/sync-engine.js', 'utf8');
const pdf = fs.readFileSync('www/native-pdf.js', 'utf8');

assert(!registry.includes("fetch('pulverizacao.html'"), 'O cadastro central não pode ler dados de um HTML funcional.');
assert(registry.includes("fetch('seed-data.json'"), 'O cadastro-base deve estar isolado em seed-data.json.');
assert(sync.includes('order=created_at.asc,id.asc'), 'Eventos remotos precisam de ordenação estável por data e id.');
assert(!sync.includes('created_at=gt.'), 'O cursor somente por data pode perder eventos simultâneos.');
assert(pdf.includes('let generationJob = null'), 'A geração de PDF precisa bloquear trabalhos concorrentes.');
for (const page of ['pulverizacao.html', 'herbicida.html', 'acompanhamento.html']) {
  const source = fs.readFileSync('www/' + page, 'utf8');
  assert(source.includes('DoCampoPDF.gerarDataUri'), page + ' deve usar o gerador central.');
  assert(!source.includes(".from(clonedContent).outputPdf('datauristring')"), page + ' ainda contém gerador paralelo.');
}
console.log('architecture-cleanup: ok');
