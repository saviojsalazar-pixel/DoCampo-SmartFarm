'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'www');
const shell = fs.readFileSync(path.join(root, 'app-shell.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
const clients = fs.readFileSync(path.join(root, 'clientes.html'), 'utf8');
const products = fs.readFileSync(path.join(root, 'produtos.html'), 'utf8');
const checklist = fs.readFileSync(path.join(root, 'checklist.html'), 'utf8');

assert.ok(shell.includes('--docampo-visible-height'), 'A altura visível móvel precisa ser compartilhada.');
assert.ok(shell.includes('window.visualViewport'), 'A abertura do teclado deve recalcular a altura disponível.');
assert.ok(shell.includes('--docampo-preview-scale'), 'A página A4 precisa receber uma escala móvel proporcional.');
assert.ok(shell.includes('zoom:var(--docampo-preview-scale'), 'A prévia deve preservar o layout A4 em vez de reorganizar o documento.');
assert.ok(shell.includes('(width - 20) / 794'), 'A escala precisa considerar a largura A4 real da prévia.');
assert.ok(shell.includes('scrollIntoView'), 'O campo em edição precisa permanecer visível acima do teclado.');
assert.ok(admin.includes('grid-template-columns:minmax(0,1fr) 100px 120px 42px'), 'A linha de talhão deve reservar quatro colunas no desktop.');
assert.ok(admin.includes('.fieldrow .fn{grid-column:1/-1}'), 'O nome do talhão deve ocupar toda a largura no celular.');
assert.ok(admin.includes('.modalbox>.actions:last-child'), 'Os botões de salvar precisam permanecer acessíveis no celular.');
assert.ok(clients.includes('class="fp"'), 'O campo de pés de café precisa continuar no editor de propriedades.');
assert.ok(products.includes('id="active"'), 'O ingrediente ativo precisa continuar no editor de produtos.');
assert.ok(checklist.includes('availableWidth / naturalViewport.width'), 'A prévia do checklist deve caber na largura do aparelho.');
assert.ok(checklist.includes('window.devicePixelRatio'), 'A prévia do checklist deve manter resolução legível sem alterar o tamanho visual.');

console.log('mobile-layout: ok');
