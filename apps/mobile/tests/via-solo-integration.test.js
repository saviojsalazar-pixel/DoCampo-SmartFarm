'use strict';
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'www', 'via-solo.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'www', 'via-solo.js'), 'utf8');
  const pdf = fs.readFileSync(path.join(root, 'www', 'via-solo-pdf.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');

  [
    'unified-db.js', 'shared-data.js', 'registry-loader.js', 'native-pdf.js',
    'document-code.js', 'form-drafts.js', 'via-solo-engine.js',
    'via-solo-pdf.js', 'via-solo.js'
  ].forEach(asset => assert.ok(html.includes(`src="${asset}"`), `Dependência ausente: ${asset}`));

  assert.ok(index.includes('href="via-solo.html"'), 'O módulo não está disponível no menu.');
  assert.ok(!/https?:\/\//i.test(html), 'A tela via solo não pode depender de internet.');
  assert.ok(!/EMBEDDED_DATABASE|PRODUCT_CATALOG|html2pdf/i.test(html + controller), 'A tela não pode carregar banco ou gerador legado.');
  assert.ok(!/localStorage\.(getItem|setItem)/.test(controller), 'O módulo deve usar somente os serviços centrais.');
  assert.ok(controller.includes('DoCampoRegistry.all()'));
  assert.ok(controller.includes('DoCampoData.mergeFarm'));
  assert.ok(controller.includes('DoCampoData.mergeProduct'));
  assert.ok(controller.includes('DoCampoDrafts.bind'));
  assert.ok(controller.includes("DoCampoDB.upsert('recommendations'"));
  assert.ok(controller.includes("status: 'pdf_pending'"));
  assert.ok(controller.indexOf("status: 'pdf_pending'") < controller.indexOf('DoCampoViaSoloPDF.generate'), 'O snapshot precisa ser salvo antes da geração do PDF.');
  assert.ok(controller.includes('DoCampoPDF.salvarECompartilhar'));
  assert.ok(pdf.includes('new window.jspdf.jsPDF'), 'O PDF deve ser vetorial.');
  assert.ok(!/html2canvas|html2pdf/.test(pdf), 'O PDF via solo não pode rasterizar a tela.');
  assert.ok(html.includes('Ver antes de salvar'));
  assert.ok(html.includes('Salvar e compartilhar PDF'));
  assert.ok(html.includes('Agrupar talhões semelhantes'));
  assert.ok(controller.includes('Engine.groupSimilarFields'));
  assert.ok(controller.includes('Engine.treatmentSignature'));
  assert.ok(controller.includes('Receituario_Via_Solo_${snapshot.farm}_${snapshot.documentCode}'));
  assert.ok(pdf.includes('talhões com população semelhante'));

  console.log('via-solo-integration.test.js aprovado');

