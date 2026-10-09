const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

for (const file of fs.readdirSync('www').filter(name => name.endsWith('.js'))) {
  assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join('www', file), 'utf8'), { filename: file }), file + ' possui erro de sintaxe.');
}

for (const file of fs.readdirSync('www').filter(name => name.endsWith('.html'))) {
  const source = fs.readFileSync(path.join('www', file), 'utf8');
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepStrictEqual(duplicates, [], file + ' possui IDs HTML duplicados.');
  let inline = 0;
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    inline++;
    assert.doesNotThrow(() => new vm.Script(match[2], { filename: file + '#inline-' + inline }), file + ' possui script inline inválido.');
  }
  for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const reference = match[1];
    if (/^https?:|^data:/.test(reference)) continue;
    assert(fs.existsSync(path.join('www', reference)), `${file}: arquivo ausente ${reference}`);
  }
}

function filesBelow(root, current = root) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(current, entry.name);
    return entry.isDirectory() ? filesBelow(root, full) : [path.relative(root, full)];
  }).sort();
}

const androidRoot = 'android/app/src/main/assets/public';
const webFiles = filesBelow('www');
const androidFiles = filesBelow(androidRoot);
assert.deepStrictEqual(androidFiles, webFiles, 'Conteúdo web e conteúdo incorporado no Android precisam ter os mesmos arquivos.');
for (const file of webFiles) {
  assert(fs.readFileSync(path.join('www', file)).equals(fs.readFileSync(path.join(androidRoot, file))), `Android desatualizado: ${file}`);
}

console.log('html-syntax-assets: ok');
