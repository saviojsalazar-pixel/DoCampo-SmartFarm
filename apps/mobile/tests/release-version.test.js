'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const database = fs.readFileSync(path.join(root, 'www', 'unified-db.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');
const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');

assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'A versão do pacote precisa ser semântica.');
assert.strictEqual(lock.version, pkg.version, 'package-lock e package.json precisam ter a mesma versão.');
assert.strictEqual(lock.packages[''].version, pkg.version, 'A raiz do package-lock precisa ter a mesma versão.');
assert.ok(database.includes(`const APP_VERSION = '${pkg.version}'`), 'O banco central precisa registrar a versão atual.');
assert.ok(index.includes(`Versão ${pkg.version}`), 'O rodapé do aplicativo precisa mostrar a versão atual.');
assert.ok(gradle.includes(`versionName "${pkg.version}"`), 'O versionName do Android precisa corresponder ao pacote.');
assert.match(gradle, /versionCode\s+\d+/, 'O Android precisa ter um versionCode numérico.');
assert.ok(fs.existsSync(path.join(root, `ATUALIZACAO-v${pkg.version}.md`)), 'A atualização precisa ter documentação própria.');

console.log('release-version: ok');
