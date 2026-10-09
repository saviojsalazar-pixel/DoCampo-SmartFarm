const assert = require('assert');
const fs = require('fs');
const { loadDatabase } = require('./helpers/runtime');

(async () => {
  const context = await loadDatabase();
  const db = context.DoCampoDB;
  db.upsert('farms', { id: 'farm-1', name: 'Fazenda segura' });
  await db.flush();
  await assert.rejects(
    db.replaceFromBackup({ generation: 'geracao-antiga', schemaVersion: 1, entities: {} }),
    /outra geração/
  );
  assert.strictEqual(db.get('farms', 'farm-1').name, 'Fazenda segura', 'Backup bloqueado não pode alterar o banco.');
  const shell = fs.readFileSync('www/app-shell.js', 'utf8');
  assert(shell.includes("format: 'DoCampoSmartFarmBackup'"));
  assert(shell.includes('version: 3'));
  assert(shell.includes('backup.generation !== DoCampoDB.generation'));
  assert(!shell.includes('mergeBackupData'), 'Backups antigos não podem ser mesclados silenciosamente.');
  console.log('backup-compatibility: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
