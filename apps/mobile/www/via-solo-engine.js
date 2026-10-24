(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DoCampoViaSoloEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPSILON = 0.000001;

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value == null ? '' : value).trim().replace(/\s+/g, '');
    if (!text) return 0;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (comma >= 0) {
      text = text.replace(',', '.');
    }
    text = text.replace(/[^0-9eE+\-.]/g, '');
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function positive(value) {
    return Math.max(0, number(value));
  }

  function clean(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function key(value) {
    return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function unitBase(unit) {
    return clean(unit || 'L/ha').replace(/\s*\/\s*ha$/i, '') || 'L';
  }

  function calculateLoads(volumeLiters, tankCapacity) {
    const volume = positive(volumeLiters);
    const capacity = positive(tankCapacity);
    if (!volume || !capacity) {
      return { volume, capacity, equivalentTanks: 0, fullLoads: 0, partialLiters: 0, actualLoads: 0 };
    }
    let fullLoads = Math.floor((volume + EPSILON) / capacity);
    let partialLiters = volume - fullLoads * capacity;
    if (Math.abs(partialLiters) < 0.001) partialLiters = 0;
    if (partialLiters < 0) {
      fullLoads = Math.max(0, fullLoads - 1);
      partialLiters = volume - fullLoads * capacity;
    }
    return {
      volume,
      capacity,
      equivalentTanks: volume / capacity,
      fullLoads,
      partialLiters,
      actualLoads: fullLoads + (partialLiters > 0 ? 1 : 0)
    };
  }

  function calculatePlants(area, state) {
    const data = state || {};
    if (data.mode === 'spacing') {
      const rowSpacing = positive(data.rowSpacing);
      const plantSpacing = positive(data.plantSpacing);
      if (!rowSpacing || !plantSpacing) return 0;
      return Math.max(0, Math.round((positive(area) * 10000) / (rowSpacing * plantSpacing)));
    }
    return Math.max(0, Math.round(positive(data.plantsCount)));
  }

  function populationDensity(field) {
    const area = positive(field && field.area);
    const plants = Math.max(0, Math.round(positive(field && field.plants)));
    return area > 0 && plants > 0 ? plants / area : 0;
  }

  function groupSimilarFields(fields, tolerance) {
    const limit = Math.max(0, positive(tolerance) || 500);
    const valid = [];
    const invalid = [];
    (Array.isArray(fields) ? fields : []).forEach((field, originalIndex) => {
      const density = populationDensity(field);
      const item = { ...field, density, originalIndex };
      if (!density) invalid.push(item);
      else valid.push(item);
    });
    valid.sort((a, b) => a.density - b.density || a.originalIndex - b.originalIndex);

    // Particiona a lista ordenada procurando abranger o maior número possível
    // de talhões. Uma estratégia gulosa poderia agrupar 4.000, 4.400 e 4.500,
    // deixando 4.900 isolado, embora 4.000/4.400 e 4.500/4.900 formem dois
    // grupos válidos. Em toda opção a amplitude continua limitada a 500.
    const plans = new Array(valid.length + 1);
    plans[valid.length] = { buckets: [], singles: [], grouped: 0, spread: 0 };
    const isBetter = (candidate, current) => {
      if (!current) return true;
      if (candidate.grouped !== current.grouped) return candidate.grouped > current.grouped;
      if (candidate.buckets.length !== current.buckets.length) return candidate.buckets.length < current.buckets.length;
      if (Math.abs(candidate.spread - current.spread) > EPSILON) return candidate.spread < current.spread;
      return false;
    };
    for (let index = valid.length - 1; index >= 0; index--) {
      const next = plans[index + 1];
      let best = {
        buckets: next.buckets,
        singles: [valid[index], ...next.singles],
        grouped: next.grouped,
        spread: next.spread
      };
      for (let end = index + 1; end < valid.length; end++) {
        const range = valid[end].density - valid[index].density;
        if (range > limit + EPSILON) break;
        const remainder = plans[end + 1];
        const bucket = valid.slice(index, end + 1);
        const candidate = {
          buckets: [bucket, ...remainder.buckets],
          singles: remainder.singles,
          grouped: bucket.length + remainder.grouped,
          spread: range + remainder.spread
        };
        if (isBetter(candidate, best)) best = candidate;
      }
      plans[index] = best;
    }
    const buckets = plans[0].buckets;
    const plannedSingles = plans[0].singles;

    const groups = [];
    const singles = plannedSingles.slice();
    buckets.forEach(bucket => {
      const area = bucket.reduce((sum, field) => sum + positive(field.area), 0);
      const plants = bucket.reduce((sum, field) => sum + Math.max(0, Math.round(positive(field.plants))), 0);
      groups.push({
        id: `population-group-${groups.length + 1}`,
        fieldIds: bucket.map(field => field.id),
        fields: bucket,
        minDensity: bucket[0].density,
        maxDensity: bucket[bucket.length - 1].density,
        weightedDensity: area > 0 ? plants / area : 0,
        area,
        plants,
        tolerance: limit
      });
    });
    return { tolerance: limit, groups, singles, invalid };
  }

  function treatmentSignature(field) {
    const normalizedProducts = (Array.isArray(field && field.products) ? field.products : []).map(product => ({
      product: clean(product.productId) || key(product.name),
      dose: Math.round(positive(product.dose) * 1000000) / 1000000,
      unit: key(product.unit)
    })).sort((a, b) => `${a.product}|${a.unit}|${a.dose}`.localeCompare(`${b.product}|${b.unit}|${b.dose}`));
    return JSON.stringify({
      liquidApplication: field && field.liquidApplication !== false,
      mlPerPlant: Math.round(positive(field && field.mlPerPlant) * 1000000) / 1000000,
      products: normalizedProducts
    });
  }

  function calculateField(input) {
    const source = input || {};
    const area = positive(source.area);
    const plants = Math.max(0, Math.round(positive(source.plants)));
    const mlPerPlant = positive(source.mlPerPlant);
    const liquidApplication = source.liquidApplication !== false;
    const syrupLiters = liquidApplication ? (plants * mlPerPlant) / 1000 : 0;
    const loads = calculateLoads(syrupLiters, source.tankCapacity);
    const products = (Array.isArray(source.products) ? source.products : [])
      .filter(item => clean(item && item.name) && positive(item && item.dose) > 0)
      .map(item => {
        const dose = positive(item.dose);
        const total = dose * area;
        const perLiter = syrupLiters > 0 ? total / syrupLiters : 0;
        const fullTankQuantity = liquidApplication && loads.capacity ? perLiter * loads.capacity : 0;
        const partialQuantity = liquidApplication && loads.partialLiters ? perLiter * loads.partialLiters : 0;
        const reconstructedTotal = liquidApplication
          ? fullTankQuantity * loads.fullLoads + partialQuantity
          : total;
        return {
          ...item,
          name: clean(item.name),
          dose,
          unit: clean(item.unit || 'L/ha'),
          total,
          unitBase: unitBase(item.unit),
          fullTankQuantity,
          partialQuantity,
          reconstructedTotal
        };
      });
    return { area, plants, mlPerPlant, syrupLiters, liquidApplication, loads, products };
  }

  function consolidate(fields, stockMap) {
    const grouped = new Map();
    (Array.isArray(fields) ? fields : []).forEach(field => {
      (field.products || []).forEach(product => {
        // A unidade faz parte da identidade. Isso impede somar, por exemplo,
        // litros e mililitros quando uma dose foi corrigida manualmente.
        const identity = `${clean(product.productId) || key(product.name)}|${key(product.unit)}`;
        if (!grouped.has(identity)) {
          grouped.set(identity, {
            productId: clean(product.productId),
            name: clean(product.name),
            unit: clean(product.unit),
            unitBase: unitBase(product.unit),
            category: clean(product.category),
            active: clean(product.active),
            target: clean(product.target),
            total: 0
          });
        }
        grouped.get(identity).total += positive(product.total);
      });
    });
    return Array.from(grouped.values()).map(item => {
      const stockKey = `${item.productId || key(item.name)}|${key(item.unit)}`;
      const inStock = positive(stockMap && (stockMap[stockKey] ?? stockMap[item.productId] ?? stockMap[item.name]));
      return { ...item, inStock, toBuy: Math.max(0, item.total - inStock) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }

  function loadDescription(loads, format) {
    const fmt = typeof format === 'function' ? format : value => String(Math.round(value * 10) / 10);
    if (!loads || !loads.capacity || !loads.volume) return 'Sem calda calculada';
    const parts = [];
    if (loads.fullLoads) parts.push(`${loads.fullLoads} ${loads.fullLoads === 1 ? 'carga completa' : 'cargas completas'} de ${fmt(loads.capacity)} L`);
    if (loads.partialLiters) parts.push(`1 carga final de ${fmt(loads.partialLiters)} L`);
    return parts.join(' + ') || 'Sem carga';
  }

  function totals(fields, stockMap) {
    const list = Array.isArray(fields) ? fields : [];
    return {
      area: list.reduce((sum, field) => sum + positive(field.area), 0),
      plants: list.reduce((sum, field) => sum + Math.max(0, Math.round(positive(field.plants))), 0),
      syrupLiters: list.reduce((sum, field) => sum + positive(field.syrupLiters), 0),
      products: consolidate(list, stockMap)
    };
  }

  return {
    number,
    positive,
    clean,
    key,
    unitBase,
    calculateLoads,
    calculatePlants,
    populationDensity,
    groupSimilarFields,
    treatmentSignature,
    calculateField,
    consolidate,
    loadDescription,
    totals
  };
});
