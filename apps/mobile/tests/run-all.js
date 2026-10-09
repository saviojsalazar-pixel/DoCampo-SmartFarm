const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const files = fs.readdirSync(__dirname)
  .filter(name => name.endsWith('.test.js'))
  .sort();

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed++;
}
if (failed) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log(`\n${files.length} testes aprovados.`);
