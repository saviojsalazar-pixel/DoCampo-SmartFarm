'use strict';
  const assert = require('assert');
  const fs = require('fs');
  const path = require('path');

  global.window = { jspdf: require(path.join(__dirname, '..', 'www', 'vendor', 'pdf', 'jspdf.umd.min.js')) };
  global.Image = class {
    set src(_) {
      setImmediate(() => this.onerror && this.onerror(new Error('Imagem dispensada no teste Node.')));
    }
  };

  const engine = require(path.join(__dirname, '..', 'www', 'via-solo-engine.js'));
  require(path.join(__dirname, '..', 'www', 'via-solo-pdf.js'));

  (async () => {
    const fields = Array.from({ length: 12 }, (_, index) => {
      const products = index === 0
        ? Array.from({ length: 32 }, (_, productIndex) => ({
            productId: `product-${productIndex}`,
            name: `Produto técnico ${productIndex + 1} com nome prolongado para testar a continuação do mesmo talhão`,
            dose: 1 + productIndex / 10,
            unit: 'L/ha',
            category: 'Via Solo'
          }))
        : [{
            productId: 'product-1',
            name: 'Produto de validação com nome técnico prolongado',
            dose: 1.2,
            unit: 'L/ha',
            category: 'Via Solo'
          }];
      const calculated = engine.calculateField({
        area: 1.5 + index / 10,
        plants: 6000 + index * 500,
        mlPerPlant: 50,
        tankCapacity: 200,
        liquidApplication: true,
        products
      });
      return {
        id: `field-${index}`,
        name: `${index + 1}. Talhão de validação com nome prolongado`,
        density: (6000 + index * 500) / (1.5 + index / 10),
        presentationGroupId: index >= 1 && index <= 3 ? 'group-1' : '',
        ...calculated,
        loadDescription: engine.loadDescription(calculated.loads)
      };
    });
    const snapshot = {
      documentCode: 'VSL-TESTE-0001',
      dateLabel: '15/10/2026',
      farm: 'Fazenda de validação',
      producer: 'Produtor de validação',
      cpf: '000.000.000-00',
      address: 'Zona Rural',
      methods: ['Drench / Esguicho'],
      tankCapacity: 200,
      fields,
      groups: [{
        id: 'group-1',
        label: 'Grupo 1',
        fieldIds: ['field-1', 'field-2', 'field-3'],
        minDensity: Math.min(...fields.slice(1, 4).map(field => field.density)),
        maxDensity: Math.max(...fields.slice(1, 4).map(field => field.density))
      }],
      totals: engine.totals(fields, {}),
      responsible: { name: 'Responsável técnico', credential: 'CREA TESTE' },
      notes: {
        safety: Array.from({ length: 90 }, (_, index) => `Orientação de segurança ${index + 1}: utilizar os equipamentos de proteção e seguir a bula.`).join('\n'),
        firstAid: 'Primeiros socorros.',
        technical: 'Aplicação.',
        precautions: 'Precauções.',
        ipm: 'Manejo integrado.',
        environment: 'Meio ambiente.'
      }
    };
    const dataUri = await window.DoCampoViaSoloPDF.generate(snapshot);
    assert.ok(dataUri.startsWith('data:application/pdf;'));
    const buffer = Buffer.from(dataUri.split(',')[1], 'base64');
    if (process.env.VIA_SOLO_PDF_OUTPUT) fs.writeFileSync(process.env.VIA_SOLO_PDF_OUTPUT, buffer);
    assert.strictEqual(buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buffer.length > 12000, 'O PDF vetorial está inesperadamente vazio.');
    const source = buffer.toString('latin1');
    const count = Array.from(source.matchAll(/\/Type \/Page\b/g)).length;
    assert.ok(count >= 5, 'A paginação automática não foi acionada nos blocos extremos.');
    console.log('via-solo-pdf-layout.test.js aprovado');
  })().catch(error => {
    console.error(error);
    process.exit(1);
  });

