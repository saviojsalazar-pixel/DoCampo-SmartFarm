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

  return { number, positive, clean, key, unitBase, calculateLoads, calculatePlants, calculateField, consolidate, loadDescription, totals };
});
