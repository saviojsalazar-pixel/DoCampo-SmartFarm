const assert = require('assert');
const fs = require('fs');

const registry = fs.readFileSync('www/registry-loader.js', 'utf8');
const sync = fs.readFileSync('www/sync-engine.js', 'utf8');
const pdf = fs.readFileSync('www/native-pdf.js', 'utf8');
const checklist = fs.readFileSync('www/checklist.html', 'utf8');
const sql = fs.readFileSync('supabase/setup-v2.sql', 'utf8');

assert(!registry.includes('fetch('), 'O registro oficial não pode buscar dados em HTML, JSON ou catálogo paralelo.');
assert(registry.includes('return { farms: [], products: {} }'), 'Banco vazio deve permanecer vazio após a restauração.');
assert(!fs.existsSync('www/seed-data.json'), 'Seed antigo não pode repovoar o banco limpo.');
assert(!fs.existsSync('www/herbicide-catalog.js'), 'Catálogo paralelo de herbicidas precisa permanecer removido.');
assert(!fs.existsSync('supabase-documentos.sql'), 'SQL antigo do bucket não pode concorrer com o script oficial.');
assert(!fs.existsSync('supabase/restauracao-fabrica-v2.sql'), 'A implantação deve possuir um único script oficial.');
assert(sql.includes('truncate table public.docampo_sync_events_v2 restart identity'), 'Script oficial deve limpar eventos somente depois de criar a estrutura.');
assert(sql.includes("excluded.payload ->> 'restoredAt'"), 'Servidor não pode materializar uma cópia antiga sobre uma exclusão sem restauração explícita.');
assert(sync.includes("server_sequence: 'gt.' + cursor"), 'Sincronização deve usar sequência monotônica do servidor.');
assert(sync.includes('const outgoing = await sendPending(true)'), 'Fila não pode ser confirmada antes da releitura oficial do servidor.');
assert(pdf.includes('let generationJob = null'), 'PDF HTML precisa bloquear gerações concorrentes.');
assert(pdf.includes('native ? await tarefa : await comPrazo'), 'Android não pode abandonar uma conversão ainda ativa e iniciar outra em paralelo.');
assert(pdf.includes('const failures = []'), 'Falha em um upload não pode impedir a tentativa dos demais PDFs pendentes.');
assert(checklist.includes('let checklistPdfActive = false'), 'PDF do checklist também precisa bloquear duplo toque.');
assert(!checklist.includes('salvarPropriedades()'), 'Checklist não pode manter o antigo mesclador que fazia exclusões reaparecerem.');
assert(checklist.includes('DoCampoData.removeFarm(fazendaSel)'), 'Exclusão no checklist deve gravar um tombstone no banco central.');
assert(checklist.includes('await recarregarCadastrosCentrais()'), 'A tela só deve atualizar depois da confirmação da persistência central.');

for (const page of ['pulverizacao.html', 'herbicida.html', 'acompanhamento.html']) {
  const source = fs.readFileSync('www/' + page, 'utf8');
  assert(source.includes('DoCampoPDF.gerarDataUri'), page + ' deve usar o gerador central.');
  assert(!source.includes(".from(clonedContent).outputPdf('datauristring')"), page + ' ainda contém gerador paralelo.');
}

console.log('architecture-cleanup: ok');
