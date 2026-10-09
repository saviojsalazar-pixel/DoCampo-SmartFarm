(function () {
  'use strict';

  /*
   * Adaptador único de cadastros.
   * Mantém a API usada pelas telas antigas, mas não cria cópias em
   * localStorage. Produtores, fazendas, talhões e produtos vivem somente no
   * DoCampoDB.
   */
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const digits = value => String(value || '').replace(/\D/g, '');
  const fieldKey = value => key(value).replace(/[.\-–—,:;]+\s*$/, '').trim();
  const fieldCompare = (a, b) => clean(a?.name).localeCompare(clean(b?.name), 'pt-BR', { numeric: true, sensitivity: 'base' });

  function normalizeField(field) {
    const source = typeof field === 'object' && field ? field : { name: field };
    return {
      ...source,
      name: clean(source.name || source.talhao),
      area: Number(source.area) || 0,
      plants: Math.max(0, Math.round(Number(source.plants) || 0)),
      rowSpacing: Number(source.rowSpacing) || 0,
      plantSpacing: Number(source.plantSpacing) || 0,
      culture: clean(source.culture),
      notes: clean(source.notes)
    };
  }

  function normalizeFields(fields) {
    const result = [];
    const seen = new Set();
    (Array.isArray(fields) ? fields : []).map(normalizeField).filter(field => field.name).forEach(field => {
      const id = fieldKey(field.name);
      if (seen.has(id)) throw new Error('Talhão duplicado no mesmo cadastro: ' + field.name);
      seen.add(id);
      result.push(field);
    });
    return result.sort(fieldCompare);
  }

  function requireDatabase() {
    if (!window.DoCampoDB) throw new Error('O banco central não foi carregado.');
  }

  function producerForFarm(farm, producers) {
    return producers.find(item => item.id === farm.producerId) || null;
  }

  function read() {
    requireDatabase();
    const producers = DoCampoDB.list('producers');
    const fields = DoCampoDB.list('fields');
    const farms = DoCampoDB.list('farms').map(farm => {
      const producer = producerForFarm(farm, producers);
      return {
        id: farm.id,
        farm: farm.name,
        producerId: farm.producerId || producer?.id || '',
        producer: producer?.name || farm.producerName || '',
        proprietor: producer?.name || farm.producerName || '',
        cpf: producer?.cpf || farm.cpf || '',
        address: farm.address || producer?.address || '',
        notes: farm.notes || '',
        fields: fields
          .filter(field => field.farmId === farm.id)
          .map(field => ({ ...field, name: field.name || field.talhao || '' }))
          .sort(fieldCompare)
      };
    });
    const products = {};
    DoCampoDB.list('products').forEach(product => {
      const category = clean(product.category) || 'Outros';
      if (!products[category]) products[category] = [];
      products[category].push({ ...product });
    });
    Object.values(products).forEach(list => list.sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'pt-BR')));
    return { farms, products, updatedAt: DoCampoDB.status().lastSyncAt };
  }

  function locateProducer(data) {
    const cpf = digits(data.cpf);
    const name = key(data.producer || data.proprietor);
    const producers = DoCampoDB.list('producers');
    return (cpf && producers.find(item => digits(item.cpf) === cpf)) ||
      (name && producers.find(item => key(item.name) === name)) || null;
  }

  function mergeFarmInternal(input) {
    requireDatabase();
    if (!input || !clean(input.farm || input.name)) throw new Error('Informe o nome da propriedade.');
    const fields = normalizeFields(input.fields);
    const farmName = clean(input.farm || input.name);
    const producerName = clean(input.producer || input.proprietor || input.producerName);
    if (!producerName) throw new Error('Informe o produtor.');

    const previousProducer = locateProducer(input);
    const producer = DoCampoDB.upsert('producers', {
      id: input.producerId || previousProducer?.id || DoCampoDB.stableId('producer', digits(input.cpf) || key(producerName)),
      name: producerName,
      cpf: clean(input.cpf),
      address: clean(input.producerAddress || input.address),
      verified: input.verified !== false,
      importBatchId: clean(input.importBatchId),
      importSource: clean(input.importSource)
    });

    const matches = DoCampoDB.list('farms').filter(item =>
      item.id === input.id || key(item.name) === key(farmName)
    );
    if (matches.length > 1) throw new Error('Há mais de uma propriedade ativa com o nome ' + farmName + '. Resolva a duplicidade antes de editar.');
    const oldFarm = matches[0];
    const farm = DoCampoDB.upsert('farms', {
      id: input.id || oldFarm?.id || DoCampoDB.stableId('farm', key(farmName)),
      name: farmName,
      producerId: producer.id,
      producerName,
      cpf: clean(input.cpf),
      address: clean(input.address),
      notes: clean(input.notes),
      verified: input.verified !== false,
      importBatchId: clean(input.importBatchId),
      importSource: clean(input.importSource)
    });

    if (oldFarm?.producerId && oldFarm.producerId !== producer.id) {
      const stillUsed = DoCampoDB.list('farms').some(item => item.id !== farm.id && item.producerId === oldFarm.producerId);
      if (!stillUsed) DoCampoDB.softDelete('producers', oldFarm.producerId, {
        removalReason: 'Produtor substituído no cadastro oficial da propriedade'
      });
    }

    const activeFields = DoCampoDB.list('fields').filter(item => item.farmId === farm.id);
    const incomingKeys = new Set(fields.map(field => fieldKey(field.name)));
    activeFields.forEach(field => {
      if (!incomingKeys.has(fieldKey(field.name))) DoCampoDB.softDelete('fields', field.id, {
        removalReason: 'Cadastro substituído pela fonte oficial',
        importBatchId: clean(input.importBatchId)
      });
    });
    fields.forEach(field => {
      const same = activeFields.filter(item => fieldKey(item.name) === fieldKey(field.name));
      if (same.length > 1) throw new Error('Duplicidade interna detectada no talhão ' + field.name + '.');
      DoCampoDB.upsert('fields', {
        ...field,
        id: field.id || same[0]?.id || DoCampoDB.stableId('field', farm.id + '|' + fieldKey(field.name)),
        farmId: farm.id,
        verified: input.verified !== false,
        importBatchId: clean(input.importBatchId),
        importSource: clean(input.importSource)
      });
    });
    return read();
  }

  function mergeFarm(input) {
    requireDatabase();
    return DoCampoDB.transaction(() => mergeFarmInternal(input));
  }

  function removeFarmInternal(nameOrId) {
    requireDatabase();
    const farm = DoCampoDB.list('farms').find(item => item.id === nameOrId || key(item.name) === key(nameOrId));
    if (!farm) return false;
    DoCampoDB.list('fields').filter(field => field.farmId === farm.id).forEach(field => DoCampoDB.softDelete('fields', field.id));
    DoCampoDB.softDelete('farms', farm.id);
    const otherFarm = DoCampoDB.list('farms').some(item => item.id !== farm.id && item.producerId === farm.producerId);
    if (!otherFarm && farm.producerId) DoCampoDB.softDelete('producers', farm.producerId);
    return true;
  }

  function removeFarm(nameOrId) {
    requireDatabase();
    return DoCampoDB.transaction(() => removeFarmInternal(nameOrId));
  }

  function mergeProductInternal(category, product) {
    requireDatabase();
    category = clean(category || product?.category);
    const name = clean(product?.name);
    if (!category || !name) throw new Error('Informe a categoria e o nome do produto.');
    const matches = DoCampoDB.list('products').filter(item => key(item.category) === key(category) && key(item.name) === key(name));
    if (matches.length > 1) throw new Error('Há produtos duplicados: ' + name + '. Resolva a duplicidade antes de editar.');
    DoCampoDB.upsert('products', {
      ...product,
      id: product.id || matches[0]?.id || DoCampoDB.stableId('product', key(category) + '|' + key(name)),
      name,
      category,
      dose: Number(product.dose) || 0,
      verified: product.verified === true
    });
    return read();
  }

  function mergeProduct(category, product) {
    requireDatabase();
    return DoCampoDB.transaction(() => mergeProductInternal(category, product));
  }

  function removeProduct(category, nameOrId) {
    requireDatabase();
    const item = DoCampoDB.list('products').find(product =>
      product.id === nameOrId || (key(product.category) === key(category) && key(product.name) === key(nameOrId))
    );
    return item ? DoCampoDB.softDelete('products', item.id) : false;
  }

  function restoreFarm(id) {
    requireDatabase();
    const farm = DoCampoDB.get('farms', id);
    if (!farm) return false;
    if (farm.producerId && DoCampoDB.get('producers', farm.producerId)?.deletedAt) DoCampoDB.restore('producers', farm.producerId);
    DoCampoDB.restore('farms', id);
    DoCampoDB.list('fields', { deleted: true }).filter(field => field.farmId === id).forEach(field => DoCampoDB.restore('fields', field.id));
    return true;
  }

  function restoreProduct(id) {
    requireDatabase();
    return DoCampoDB.restore('products', id);
  }

  function findDuplicates() {
    requireDatabase();
    const groups = [];
    const collect = (type, identity) => {
      const map = new Map();
      DoCampoDB.list(type).forEach(item => {
        const id = identity(item);
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(item);
      });
      map.forEach(items => { if (items.length > 1) groups.push({ type, identity: identity(items[0]), items }); });
    };
    collect('producers', item => digits(item.cpf) || key(item.name));
    collect('farms', item => key(item.name));
    collect('fields', item => item.farmId + '|' + fieldKey(item.name));
    collect('products', item => key(item.category) + '|' + key(item.name));
    return groups;
  }

  window.DoCampoData = {
    read,
    mergeFarm,
    removeFarm,
    mergeProduct,
    removeProduct,
    restoreFarm,
    restoreProduct,
    normalizeFields,
    fieldKey,
    key,
    findDuplicates
  };
})();
