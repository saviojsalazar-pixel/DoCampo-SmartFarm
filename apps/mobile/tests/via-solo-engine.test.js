'use strict';
  const assert = require('assert');
  const path = require('path');
  const engine = require(path.join(__dirname, '..', 'www', 'via-solo-engine.js'));

  assert.strictEqual(engine.number('1.234,56'), 1234.56);
  assert.strictEqual(engine.number('12,5'), 12.5);
  assert.strictEqual(engine.number('2.5'), 2.5);

  const exact = engine.calculateLoads(400, 200);
  assert.deepStrictEqual({ full: exact.fullLoads, partial: exact.partialLiters, actual: exact.actualLoads }, { full: 2, partial: 0, actual: 2 });

  const partial = engine.calculateLoads(429, 200);
  assert.strictEqual(partial.fullLoads, 2);
  assert.strictEqual(partial.partialLiters, 29);
  assert.strictEqual(partial.actualLoads, 3);
  assert.match(engine.loadDescription(partial), /2 cargas completas/);
  assert.match(engine.loadDescription(partial), /1 carga final/);

  const plants = engine.calculatePlants(4, { mode: 'spacing', rowSpacing: 3.2, plantSpacing: 0.67 });
  assert.strictEqual(plants, Math.round(40000 / (3.2 * 0.67)));

  const populationGroups = engine.groupSimilarFields([
    { id: 'a', name: 'A', area: 1, plants: 4000 },
    { id: 'b', name: 'B', area: 1, plants: 4350 },
    { id: 'c', name: 'C', area: 1, plants: 4490 },
    { id: 'd', name: 'D', area: 1, plants: 4520 },
    { id: 'invalid', name: 'Sem área', area: 0, plants: 5000 }
  ], 500);
  assert.deepStrictEqual(populationGroups.groups.map(group => group.fieldIds), [['a', 'b'], ['c', 'd']]);
  assert.deepStrictEqual(populationGroups.singles.map(field => field.id), []);
  assert.deepStrictEqual(populationGroups.invalid.map(field => field.id), ['invalid']);
  assert.ok(populationGroups.groups.every(group => group.maxDensity - group.minDensity <= 500));

  const noAvoidableSingle = engine.groupSimilarFields([
    { id: 'g1', area: 1, plants: 4000 },
    { id: 'g2', area: 1, plants: 4400 },
    { id: 'g3', area: 1, plants: 4500 },
    { id: 'g4', area: 1, plants: 4900 }
  ], 500);
  assert.deepStrictEqual(noAvoidableSingle.groups.map(group => group.fieldIds), [['g1', 'g2'], ['g3', 'g4']]);
  assert.deepStrictEqual(noAvoidableSingle.singles, [], 'O agrupador não deve deixar um talhão isolado quando existe uma partição válida.');

  const exactTolerance = engine.groupSimilarFields([
    { id: 'e', area: 2, plants: 8000 },
    { id: 'f', area: 2, plants: 9000 }
  ], 500);
  assert.deepStrictEqual(exactTolerance.groups[0].fieldIds, ['e', 'f'], 'A diferença exata de 500 plantas/ha deve ser aceita.');

  const signatureA = engine.treatmentSignature({ liquidApplication: true, mlPerPlant: 50, products: [
    { productId: 'p2', dose: 2, unit: 'kg/ha' }, { productId: 'p1', dose: 1, unit: 'L/ha' }
  ] });
  const signatureB = engine.treatmentSignature({ liquidApplication: true, mlPerPlant: 50, products: [
    { productId: 'p1', dose: 1, unit: 'L/ha' }, { productId: 'p2', dose: 2, unit: 'kg/ha' }
  ] });
  assert.strictEqual(signatureA, signatureB, 'A ordem de exibição dos mesmos produtos não pode separar um grupo.');
  assert.notStrictEqual(signatureA, engine.treatmentSignature({ liquidApplication: true, mlPerPlant: 60, products: [
    { productId: 'p1', dose: 1, unit: 'L/ha' }, { productId: 'p2', dose: 2, unit: 'kg/ha' }
  ] }), 'Volumes por planta diferentes precisam separar as recomendações.');

  const field = engine.calculateField({
    area: 4,
    plants: 18571,
    mlPerPlant: 50,
    tankCapacity: 200,
    liquidApplication: true,
    products: [{ productId: 'p1', name: 'Produto A', dose: 1.2, unit: 'L/ha' }]
  });
  assert.strictEqual(field.syrupLiters, 928.55);
  assert.strictEqual(field.loads.fullLoads, 4);
  assert.ok(Math.abs(field.loads.partialLiters - 128.55) < 0.000001);
  assert.strictEqual(field.products[0].total, 4.8);
  assert.ok(Math.abs(field.products[0].reconstructedTotal - field.products[0].total) < 0.000001);

  const granular = engine.calculateField({
    area: 2,
    plants: 8000,
    mlPerPlant: 50,
    tankCapacity: 200,
    liquidApplication: false,
    products: [{ productId: 'g1', name: 'Granulado', dose: 3, unit: 'kg/ha' }]
  });
  assert.strictEqual(granular.syrupLiters, 0);
  assert.strictEqual(granular.products[0].total, 6);
  assert.strictEqual(granular.products[0].reconstructedTotal, 6);

  const separated = engine.consolidate([
    { products: [{ productId: 'same', name: 'Produto', unit: 'L/ha', unitBase: 'L', total: 2 }] },
    { products: [{ productId: 'same', name: 'Produto', unit: 'mL/ha', unitBase: 'mL', total: 500 }] }
  ], {});
  assert.strictEqual(separated.length, 2, 'Unidades incompatíveis não podem ser somadas.');

  const combined = engine.consolidate([
    { products: [{ productId: 'p1', name: 'Produto A', unit: 'L/ha', unitBase: 'L', total: 2, category: 'Via Solo' }] },
    { products: [{ productId: 'p1', name: 'Produto A', unit: 'L/ha', unitBase: 'L', total: 3, category: 'Via Solo' }] }
  ], { 'p1|l/ha': 1.5 });
  assert.strictEqual(combined.length, 1);
  assert.strictEqual(combined[0].total, 5);
  assert.strictEqual(combined[0].inStock, 1.5);
  assert.strictEqual(combined[0].toBuy, 3.5);

  console.log('via-solo-engine.test.js aprovado');

