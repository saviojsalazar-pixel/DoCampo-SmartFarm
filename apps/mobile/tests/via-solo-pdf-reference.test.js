'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = { jspdf: require(path.join(__dirname, '..', 'www', 'vendor', 'pdf', 'jspdf.umd.min.js')) };
global.Image = class {
  set src(_) { setImmediate(() => this.onerror && this.onerror(new Error('Logo dispensada no teste Node.'))); }
};

const engine = require(path.join(__dirname, '..', 'www', 'via-solo-engine.js'));
require(path.join(__dirname, '..', 'www', 'via-solo-pdf.js'));

const definitions = [
  ['1.', 0.5, 2000, 'Symboll-SC-Albaugh', 5.5, 'L/ha', 'Flutriafol', 'Ferrugem'],
  ['2.', 1.1, 4400, 'Spirit-SC-Iharabras', 2, 'L/ha', 'Dinotefuram; Flutriafol', 'Ferrugem/Bicho Mineiro/Cigarra/Cochonilha'],
  ['3.', 0.3, 1200, 'Spirit-SC-Iharabras', 2, 'L/ha', 'Dinotefuram; Flutriafol', 'Ferrugem/Bicho Mineiro/Cigarra/Cochonilha'],
  ['4.', 0.3, 1200, 'Actara-WG-Syngenta', 1.5, 'kg/ha', 'Tiametoxam', 'Bicho mineiro/Cigarra/Cochonilha'],
  ['5.', 0.9, 3600, 'Sivanto Prime-SL-Bayer', 3, 'L/ha', 'Flupiradifurona', 'Bicho Mineiro/Cigarra/Cochonilha'],
  ['6.', 2.7, 10800, 'Verdadeiro-WG-Syngenta', 1, 'kg/ha', 'Tiametoxam, Ciproconazol', 'Ferrugem/Bicho Mineiro/Cigarra']
];

(async () => {
  const fields = definitions.map((item, index) => {
    const calculated = engine.calculateField({
      area: item[1], plants: item[2], mlPerPlant: 50, tankCapacity: 200, liquidApplication: true,
      products: [{ productId: `product-${index}`, name: item[3], dose: item[4], unit: item[5], active: item[6], target: item[7], category: 'Via Solo' }]
    });
    return {
      id: `field-${index + 1}`,
      name: item[0],
      density: engine.populationDensity({ area: item[1], plants: item[2] }),
      presentationGroupId: '',
      ...calculated,
      loadDescription: engine.loadDescription(calculated.loads)
    };
  });
  const snapshot = {
    documentCode: 'VSL-GLA-TEST-0001', dateLabel: '23/10/2026',
    farm: 'Fazenda Riacho Fundo', producer: 'Mariana Raissa Moreira Martins', cpf: '089.339.946-96',
    address: 'Rua Onofre Martins Chaves, 307, ap. 301, Bairro Centro, Matipó, Minas Gerais',
    methods: ['Drench / Esguicho'], tankCapacity: 200, fields, groups: [],
    totals: engine.totals(fields, {}), responsible: { name: 'Dr. Glaucio Luciano Araujo', credential: 'CREA: MG0000254008D | CFTA: 7926903620' },
    notes: {
      safety: 'Utilizar os EPIs recomendados durante a preparação da calda e aplicação. Respeitar o intervalo de reentrada e carência informados nas bulas dos produtos.',
      firstAid: 'Procure imediatamente um serviço médico de emergência levando a embalagem, rótulo, bula e esta recomendação.',
      technical: 'Utilizar água de boa qualidade. Preencher o tanque até a metade, inserir os produtos na ordem indicada e completar mantendo agitação.',
      precautions: 'Aplique somente nas doses recomendadas e observe o intervalo de segurança.',
      ipm: 'Adotar outras táticas previstas no Manejo Integrado de Pragas e Doenças.',
      environment: 'Não aplique com ventos fortes ou solo encharcado. Faça a tríplice lavagem e devolução das embalagens.'
    }
  };
  snapshot.totals.products = engine.consolidate(fields, {});
  const dataUri = await window.DoCampoViaSoloPDF.generate(snapshot);
  const buffer = Buffer.from(dataUri.split(',')[1], 'base64');
  if (process.env.VIA_SOLO_REFERENCE_OUTPUT) fs.writeFileSync(process.env.VIA_SOLO_REFERENCE_OUTPUT, buffer);
  const source = buffer.toString('latin1');
  const pages = Array.from(source.matchAll(/\/Type \/Page\b/g)).length;
  assert.strictEqual(pages, 2, 'O modelo de referência com seis talhões deve permanecer em duas páginas.');
  assert.ok(buffer.length > 10000);
  console.log('via-solo-pdf-reference: ok');
})().catch(error => { console.error(error); process.exit(1); });
