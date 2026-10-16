(function () {
  'use strict';

  const MODULE = 'via-solo';
  const Engine = window.DoCampoViaSoloEngine;
  const DEFAULT_CATEGORIES = [
    'Via Solo (Inseticida/Fungicida)',
    'Via Solo (Inseticida)',
    'Via Solo (Fungicida)',
    'Via Solo (Fungicida/Nematicida)',
    'Via Solo (Nematicida)',
    'Via Solo (Nutrição)'
  ];
  const AGRONOMISTS = [
    { name: 'Dr. Glaucio Luciano Araujo', credential: 'CREA: MG0000254008D | CFTA: 7926903620' },
    { name: 'M.Sc. Sávio José Souza Salazar', credential: 'CREA: MG142362346-0' }
  ];

  let registry = { farms: [], products: {} };
  let currentFarm = null;
  let selectedFields = new Set();
  let fieldState = {};
  let productStockMap = {};
  let selectedAgronomistIndex = 0;
  let newFarmFieldCounter = 0;
  let restoring = false;
  let initialized = false;
  let busy = false;
  let pendingPreviewSnapshot = null;
  let pendingRecommendationId = null;

  const $ = id => document.getElementById(id);
  const clean = value => String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  const multiline = value => String(value == null ? '' : value).replace(/\r\n?/g, '\n')
    .split('\n').map(line => line.trim().replace(/[ \t]+/g, ' ')).join('\n').trim();
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const fmt = (value, min = 0, max = 2) => Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max
  });
  const clone = value => JSON.parse(JSON.stringify(value));

  function categories() {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...Object.keys(registry.products || {})]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }

  function allProducts() {
    return Object.entries(registry.products || {}).flatMap(([category, products]) =>
      (products || []).map(product => ({ ...product, category }))
    );
  }

  function productById(id) {
    return allProducts().find(product => product.id === id) || null;
  }

  function productsForCategory(category) {
    return (registry.products?.[category] || []).slice().sort((a, b) =>
      clean(a.name).localeCompare(clean(b.name), 'pt-BR', { sensitivity: 'base' })
    );
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function showAlert(message, title = 'Atenção', kind = 'warning') {
    setText('alert-modal-title', title);
    setText('alert-modal-msg', message);
    const icon = $('alert-modal-icon');
    if (icon) {
      icon.className = 'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ' +
        (kind === 'success' ? 'bg-emerald-100 text-emerald-700' : kind === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
      icon.innerHTML = kind === 'success'
        ? '<i class="fa-solid fa-circle-check"></i>'
        : kind === 'error'
          ? '<i class="fa-solid fa-circle-xmark"></i>'
          : '<i class="fa-solid fa-triangle-exclamation"></i>';
    }
    $('custom-alert-modal')?.classList.remove('hidden');
  }

  function closeCustomAlert() {
    $('custom-alert-modal')?.classList.add('hidden');
  }

  function togglePanel(panelId, textId, iconId) {
    const panel = $(panelId);
    if (!panel) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    setText(textId, opening ? 'Recolher Formulário' : 'Expandir Formulário');
    const icon = $(iconId)?.querySelector('i');
    icon?.classList.toggle('fa-chevron-down', !opening);
    icon?.classList.toggle('fa-chevron-up', opening);
  }

  function toggleNewFarmPanel() {
    togglePanel('new-farm-panel', 'toggle-new-farm-text', 'toggle-new-farm-icon');
    if (!$('new-farm-fields-container')?.children.length) addNewFarmFieldRow();
  }

  function toggleNewProductPanel() {
    togglePanel('new-product-panel', 'toggle-new-product-text', 'toggle-new-product-icon');
  }

  function addNewFarmFieldRow(value) {
    const container = $('new-farm-fields-container');
    if (!container) return;
    const rowId = `new-farm-field-row-${++newFarmFieldCounter}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'grid grid-cols-1 sm:grid-cols-[1fr_130px_150px_auto] gap-2 items-end bg-white border border-slate-200 rounded-xl p-3';
    row.innerHTML = `
      <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Nome do talhão *</label><input class="new-field-name w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" value="${esc(value?.name || '')}" placeholder="Ex: 1.1 Terreiro"></div>
      <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Área (ha) *</label><input class="new-field-area w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" inputmode="decimal" value="${esc(value?.area || '')}" placeholder="0,00"></div>
      <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Pés de café</label><input class="new-field-plants w-full border border-slate-300 rounded-lg px-3 py-2 text-xs" inputmode="numeric" value="${esc(value?.plants || '')}" placeholder="Opcional"></div>
      <button type="button" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold" aria-label="Remover talhão"><i class="fa-solid fa-trash"></i></button>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  async function saveAndSelectNewFarm() {
    try {
      const farm = clean($('new-farm-name')?.value);
      const producer = clean($('new-producer-name')?.value);
      if (!farm || !producer) throw new Error('Informe o nome da propriedade e o produtor.');
      if (registry.farms.some(item => Engine.key(item.farm) === Engine.key(farm))) {
        throw new Error('Esta propriedade já existe no banco central. Faça a alteração pela tela de Produtores, fazendas e talhões para evitar substituir dados por engano.');
      }
      const fields = Array.from($('new-farm-fields-container')?.children || []).map(row => ({
        name: clean(row.querySelector('.new-field-name')?.value),
        area: Engine.positive(row.querySelector('.new-field-area')?.value),
        plants: Math.round(Engine.positive(row.querySelector('.new-field-plants')?.value))
      })).filter(field => field.name || field.area || field.plants);
      if (!fields.length || fields.some(field => !field.name || field.area <= 0)) {
        throw new Error('Cadastre pelo menos um talhão com nome e área maior que zero.');
      }
      DoCampoData.mergeFarm({
        farm,
        producer,
        cpf: clean($('new-producer-cpf')?.value),
        address: clean($('new-producer-address')?.value),
        fields,
        verified: false,
        importSource: 'Cadastro na recomendação via solo'
      });
      await DoCampoDB.flush();
      await loadRegistry();
      const saved = registry.farms.find(item => Engine.key(item.farm) === Engine.key(farm));
      if (!saved) throw new Error('A propriedade foi salva, mas não pôde ser recarregada.');
      $('farm-select').value = saved.id;
      onFarmChange();
      ['new-farm-name', 'new-producer-name', 'new-producer-cpf', 'new-producer-address'].forEach(id => { if ($(id)) $(id).value = ''; });
      $('new-farm-fields-container').innerHTML = '';
      addNewFarmFieldRow();
      showAlert('A propriedade e os talhões foram gravados no banco central e já estão selecionados.', 'Cadastro concluído', 'success');
    } catch (error) {
      showAlert(error.message || 'Não foi possível salvar a propriedade.', 'Cadastro não concluído', 'error');
    }
  }

  function populateCategoryControls() {
    const values = categories();
    const newSelect = $('new-prod-category');
    const current = newSelect?.value || DEFAULT_CATEGORIES[0];
    if (newSelect) {
      newSelect.innerHTML = values.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
      newSelect.value = values.includes(current) ? current : values[0] || '';
    }
    const filter = $('manage-cat-filter');
    const filterValue = filter?.value || 'ALL';
    if (filter) {
      filter.innerHTML = '<option value="ALL">Todas as categorias</option>' +
        values.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
      filter.value = filterValue === 'ALL' || values.includes(filterValue) ? filterValue : 'ALL';
    }
  }

  async function saveNewProduct() {
    try {
      const category = clean($('new-prod-category')?.value);
      const product = {
        name: clean($('new-prod-name')?.value),
        dose: Engine.positive($('new-prod-dose')?.value),
        unit: clean($('new-prod-unit')?.value || 'L/ha'),
        target: clean($('new-prod-target')?.value),
        active: clean($('new-prod-active')?.value),
        verified: false
      };
      if (!category || !product.name || product.dose <= 0) throw new Error('Informe categoria, nome e dose padrão maior que zero.');
      if (allProducts().some(item => Engine.key(item.category) === Engine.key(category) && Engine.key(item.name) === Engine.key(product.name))) {
        throw new Error('Este produto já existe nessa categoria. Edite-o pela tela central de Produtos para evitar duplicidade.');
      }
      DoCampoData.mergeProduct(category, product);
      await DoCampoDB.flush();
      await loadRegistry();
      ['new-prod-name', 'new-prod-dose', 'new-prod-target', 'new-prod-active'].forEach(id => { if ($(id)) $(id).value = ''; });
      renderFields();
      showAlert('O produto foi salvo no catálogo central e está disponível nos demais receituários.', 'Produto cadastrado', 'success');
    } catch (error) {
      showAlert(error.message || 'Não foi possível salvar o produto.', 'Produto não cadastrado', 'error');
    }
  }

  function openManageProductsModal() {
    populateCategoryControls();
    renderManageProductsList();
    $('manage-products-modal')?.classList.remove('hidden');
  }

  function closeManageProductsModal() {
    $('manage-products-modal')?.classList.add('hidden');
  }

  function renderManageProductsList() {
    const container = $('manage-products-list');
    if (!container) return;
    const filter = $('manage-cat-filter')?.value || 'ALL';
    const products = allProducts().filter(product => filter === 'ALL' || product.category === filter)
      .sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'pt-BR', { sensitivity: 'base' }));
    if (!products.length) {
      container.innerHTML = '<div class="text-center py-10 text-slate-500 border border-dashed border-slate-300 rounded-xl">Nenhum produto encontrado.</div>';
      return;
    }
    container.innerHTML = products.map(product => `
      <div class="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-bold text-slate-900">${esc(product.name)}</p>
          <p class="text-xs text-slate-600 mt-1">${esc(product.category)} • ${fmt(product.dose, 0, 3)} ${esc(product.unit || '')}${product.target ? ` • Alvo: ${esc(product.target)}` : ''}</p>
          ${product.verified === false ? '<span class="inline-block mt-2 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 font-bold">Cadastro local — conferir</span>' : ''}
        </div>
        <button type="button" data-delete-product="${esc(product.id)}" class="shrink-0 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold"><i class="fa-solid fa-trash"></i> Excluir</button>
      </div>`).join('');
    container.querySelectorAll('[data-delete-product]').forEach(button => {
      button.addEventListener('click', () => deleteProductFromCatalog(button.dataset.deleteProduct));
    });
  }

  async function deleteProductFromCatalog(productId) {
    const product = productById(productId);
    if (!product || !confirm(`Mover "${product.name}" para a lixeira?`)) return;
    try {
      if (!DoCampoData.removeProduct(product.category, product.id)) throw new Error('Produto não encontrado.');
      await DoCampoDB.flush();
      await loadRegistry();
      renderManageProductsList();
      renderFields();
    } catch (error) {
      showAlert(error.message || 'Não foi possível excluir o produto.', 'Exclusão não concluída', 'error');
    }
  }

  function populateFarmSelect() {
    const select = $('farm-select');
    if (!select) return;
    const current = select.value;
    const farms = (registry.farms || []).slice().sort((a, b) =>
      clean(a.farm).localeCompare(clean(b.farm), 'pt-BR', { sensitivity: 'base' })
    );
    select.innerHTML = '<option value="">-- Selecione uma propriedade --</option>' +
      farms.map(farm => `<option value="${esc(farm.id)}">${esc(farm.farm)} — ${esc(farm.producer || 'Produtor não informado')}</option>`).join('');
    if (farms.some(farm => farm.id === current)) select.value = current;
  }

  async function loadRegistry() {
    registry = await DoCampoRegistry.all();
    populateFarmSelect();
    populateCategoryControls();
  }

  function defaultFieldState(field) {
    const hasSpacing = Engine.positive(field.rowSpacing) > 0 && Engine.positive(field.plantSpacing) > 0;
    return {
      mode: !Engine.positive(field.plants) && hasSpacing ? 'spacing' : 'plants',
      plantsCount: Math.round(Engine.positive(field.plants) || Engine.positive(field.area) * 4000),
      rowSpacing: Engine.positive(field.rowSpacing),
      plantSpacing: Engine.positive(field.plantSpacing),
      mlPerPlant: 50,
      products: [{ productId: '', category: DEFAULT_CATEGORIES[0], name: '', dose: 0, unit: 'L/ha', target: '', active: '' }]
    };
  }

  function onFarmChange(options) {
    const preserve = options && options.preserve;
    const farmId = $('farm-select')?.value || '';
    const farm = registry.farms.find(item => item.id === farmId) || null;
    currentFarm = farm;
    if ($('producer-display')) $('producer-display').value = farm?.producer || '';
    if ($('producer-cpf-display')) $('producer-cpf-display').value = farm?.cpf || '';
    if ($('producer-address-display')) $('producer-address-display').value = farm?.address || '';
    if (!preserve) {
      selectedFields = new Set();
      fieldState = {};
    }
    (farm?.fields || []).forEach(field => {
      if (!fieldState[field.id]) fieldState[field.id] = defaultFieldState(field);
    });
    Object.keys(fieldState).forEach(id => {
      if (!(farm?.fields || []).some(field => field.id === id)) delete fieldState[id];
    });
    selectedFields = new Set(Array.from(selectedFields).filter(id => (farm?.fields || []).some(field => field.id === id)));
    renderFields();
  }

  function productSlotHtml(fieldIndex, productIndex, slot) {
    const categoryValues = categories();
    if (slot.category && !categoryValues.includes(slot.category)) categoryValues.push(slot.category);
    const productValues = productsForCategory(slot.category);
    const selectedExists = slot.productId && productValues.some(product => product.id === slot.productId);
    const productOptions = [
      '<option value="">-- Selecione o produto --</option>',
      ...productValues.map(product => `<option value="${esc(product.id)}" ${product.id === slot.productId ? 'selected' : ''}>${esc(product.name)}</option>`),
      ...(!selectedExists && slot.productId ? [`<option value="${esc(slot.productId)}" selected>${esc(slot.name || 'Produto do rascunho')} (não está no catálogo ativo)</option>`] : [])
    ].join('');
    return `
      <div class="grid grid-cols-1 lg:grid-cols-[210px_1fr_120px_115px_auto] gap-2 items-end bg-white border border-slate-200 rounded-xl p-3">
        <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Categoria</label>
          <select id="field-${fieldIndex}-category-${productIndex}" onchange="updateFieldCategory(${fieldIndex},${productIndex})" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold">
            ${categoryValues.map(category => `<option value="${esc(category)}" ${category === slot.category ? 'selected' : ''}>${esc(category)}</option>`).join('')}
          </select>
        </div>
        <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Produto</label>
          <select id="field-${fieldIndex}-prod-${productIndex}" onchange="updateFieldProduct(${fieldIndex},${productIndex})" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold">${productOptions}</select>
        </div>
        <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Dose/ha</label>
          <input id="field-${fieldIndex}-dose-${productIndex}" value="${esc(slot.dose || '')}" inputmode="decimal" oninput="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold">
        </div>
        <div><label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Unidade</label>
          <select id="field-${fieldIndex}-unit-${productIndex}" onchange="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold">
            ${['L/ha', 'kg/ha', 'mL/ha', 'g/ha'].map(unit => `<option ${unit === slot.unit ? 'selected' : ''}>${unit}</option>`).join('')}
          </select>
        </div>
        <button type="button" onclick="removeProductSlotFromField(${fieldIndex},${productIndex})" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg p-2 text-xs" aria-label="Remover produto"><i class="fa-solid fa-trash"></i></button>
      </div>`;
  }

  function renderFields() {
    const container = $('fields-container');
    if (!container) return;
    const fields = currentFarm?.fields || [];
    if (!currentFarm) {
      container.innerHTML = '<div class="py-8 text-center text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl">Selecione uma fazenda no Passo 1 para carregar os talhões.</div>';
      calculateTotals();
      return;
    }
    if (!fields.length) {
      container.innerHTML = '<div class="py-8 text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">Esta propriedade não possui talhões ativos. Atualize o cadastro antes de prescrever.</div>';
      calculateTotals();
      return;
    }
    container.innerHTML = fields.map((field, index) => {
      const state = fieldState[field.id] || defaultFieldState(field);
      fieldState[field.id] = state;
      const selected = selectedFields.has(field.id);
      return `
        <section class="border ${selected ? 'border-emerald-400 ring-1 ring-emerald-100' : 'border-slate-200'} rounded-2xl overflow-hidden bg-white">
          <button type="button" onclick="toggleField(${index})" class="w-full flex items-center justify-between gap-3 p-4 text-left ${selected ? 'bg-emerald-50' : 'bg-slate-50'}">
            <span class="flex items-center gap-3"><span class="w-5 h-5 rounded border-2 flex items-center justify-center ${selected ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-300'}">${selected ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}</span><span><strong class="block text-sm text-slate-900">${esc(field.name)}</strong><small class="text-slate-500">${fmt(field.area, 2, 2)} ha${field.plants ? ` • ${fmt(field.plants, 0, 0)} pés cadastrados` : ''}</small></span></span>
            <span class="text-xs font-bold ${selected ? 'text-emerald-800' : 'text-slate-500'}">${selected ? 'Selecionado' : 'Selecionar'}</span>
          </button>
          ${selected ? `
          <div class="p-4 space-y-4 border-t border-emerald-100">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <p class="text-[10px] uppercase font-black tracking-wider text-slate-600">População do talhão</p>
                <div class="flex flex-wrap gap-3 text-xs font-semibold">
                  <label><input type="radio" name="field-mode-${index}" ${state.mode !== 'spacing' ? 'checked' : ''} onchange="onFieldCalcModeChange(${index},'plants')"> Informar pés</label>
                  <label><input type="radio" name="field-mode-${index}" ${state.mode === 'spacing' ? 'checked' : ''} onchange="onFieldCalcModeChange(${index},'spacing')"> Calcular por espaçamento</label>
                </div>
                ${state.mode === 'spacing' ? `
                  <div class="grid grid-cols-2 gap-2"><div><label class="text-[10px] font-bold text-slate-600">Entre linhas (m)</label><input id="field-${index}-row-spacing" inputmode="decimal" value="${esc(state.rowSpacing || '')}" oninput="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs"></div><div><label class="text-[10px] font-bold text-slate-600">Entre plantas (m)</label><input id="field-${index}-plant-spacing" inputmode="decimal" value="${esc(state.plantSpacing || '')}" oninput="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs"></div></div>
                ` : `
                  <div><label class="text-[10px] font-bold text-slate-600">Quantidade de pés</label><input id="field-${index}-plants-count" inputmode="numeric" value="${esc(state.plantsCount || '')}" oninput="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold"></div>
                `}
                <p class="text-xs text-emerald-800 font-bold">População calculada: <span id="field-${index}-plants-display">0</span> plantas</p>
                ${!field.plants ? '<p class="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">A quantidade de pés não está no cadastro. Confirme o valor ou informe o espaçamento antes de salvar.</p>' : ''}
              </div>
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <p class="text-[10px] uppercase font-black tracking-wider text-slate-600">Volume e cargas</p>
                <div><label class="text-[10px] font-bold text-slate-600">Volume por planta (mL/planta)</label><input id="field-${index}-dose-ml-plant" inputmode="decimal" value="${esc(state.mlPerPlant || '')}" oninput="calculateTotals()" class="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold"></div>
                <p class="text-xs text-slate-700">Calda: <strong id="field-${index}-syrup-display" class="text-emerald-800">0 L</strong></p>
                <p id="field-${index}-tanks-display" class="text-xs text-emerald-800 font-bold">Sem carga calculada</p>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3"><p class="text-[10px] uppercase font-black tracking-wider text-slate-600">Produtos prescritos neste talhão</p><button type="button" onclick="addProductSlotToField(${index})" class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5"><i class="fa-solid fa-plus"></i> Adicionar produto</button></div>
              <div class="space-y-2">${(state.products || []).map((slot, productIndex) => productSlotHtml(index, productIndex, slot)).join('')}</div>
            </div>
          </div>` : ''}
        </section>`;
    }).join('');
    calculateTotals();
  }

  function captureFieldsFromDOM() {
    (currentFarm?.fields || []).forEach((field, index) => {
      if (!selectedFields.has(field.id)) return;
      const state = fieldState[field.id] || defaultFieldState(field);
      state.plantsCount = Engine.positive($(`field-${index}-plants-count`)?.value ?? state.plantsCount);
      state.rowSpacing = Engine.positive($(`field-${index}-row-spacing`)?.value ?? state.rowSpacing);
      state.plantSpacing = Engine.positive($(`field-${index}-plant-spacing`)?.value ?? state.plantSpacing);
      state.mlPerPlant = Engine.positive($(`field-${index}-dose-ml-plant`)?.value ?? state.mlPerPlant);
      state.products = (state.products || []).map((slot, productIndex) => {
        const productId = $(`field-${index}-prod-${productIndex}`)?.value || slot.productId || '';
        const catalog = productById(productId);
        return {
          ...slot,
          productId,
          category: $(`field-${index}-category-${productIndex}`)?.value || slot.category || catalog?.category || '',
          name: catalog?.name || slot.name || '',
          dose: Engine.positive($(`field-${index}-dose-${productIndex}`)?.value ?? slot.dose),
          unit: $(`field-${index}-unit-${productIndex}`)?.value || slot.unit || catalog?.unit || 'L/ha',
          target: catalog?.target || slot.target || '',
          active: catalog?.active || slot.active || ''
        };
      });
      fieldState[field.id] = state;
    });
  }

  function toggleField(index) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[index];
    if (!field) return;
    if (selectedFields.has(field.id)) selectedFields.delete(field.id);
    else selectedFields.add(field.id);
    renderFields();
  }

  function selectAllFields(select) {
    captureFieldsFromDOM();
    selectedFields = new Set(select ? (currentFarm?.fields || []).map(field => field.id) : []);
    renderFields();
  }

  function onFieldCalcModeChange(index, mode) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[index];
    if (!field) return;
    fieldState[field.id].mode = mode;
    renderFields();
  }

  function updateFieldCategory(fieldIndex, productIndex) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[fieldIndex];
    if (!field) return;
    const slot = fieldState[field.id].products[productIndex];
    slot.category = $(`field-${fieldIndex}-category-${productIndex}`)?.value || DEFAULT_CATEGORIES[0];
    slot.productId = '';
    slot.name = '';
    slot.dose = 0;
    slot.unit = 'L/ha';
    renderFields();
  }

  function updateFieldProduct(fieldIndex, productIndex) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[fieldIndex];
    const slot = field && fieldState[field.id]?.products?.[productIndex];
    if (!slot) return;
    const product = productById($(`field-${fieldIndex}-prod-${productIndex}`)?.value);
    if (product) {
      Object.assign(slot, {
        productId: product.id,
        category: product.category,
        name: product.name,
        dose: Engine.positive(product.dose),
        unit: product.unit || 'L/ha',
        target: product.target || '',
        active: product.active || ''
      });
    }
    renderFields();
  }

  function addProductSlotToField(index) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[index];
    if (!field) return;
    fieldState[field.id].products.push({ productId: '', category: DEFAULT_CATEGORIES[0], name: '', dose: 0, unit: 'L/ha', target: '', active: '' });
    renderFields();
  }

  function removeProductSlotFromField(fieldIndex, productIndex) {
    captureFieldsFromDOM();
    const field = currentFarm?.fields?.[fieldIndex];
    if (!field) return;
    fieldState[field.id].products.splice(productIndex, 1);
    if (!fieldState[field.id].products.length) {
      fieldState[field.id].products.push({ productId: '', category: DEFAULT_CATEGORIES[0], name: '', dose: 0, unit: 'L/ha', target: '', active: '' });
    }
    renderFields();
  }

  function methods() {
    return ['spray-type-drench', 'spray-type-fertirrigation', 'spray-type-granulated']
      .map(id => $(id)).filter(element => element?.checked).map(element => element.value);
  }

  function stages() {
    return Array.from(document.querySelectorAll('.crop-stage-cb:checked')).map(element => element.value);
  }

  function calculatedFields() {
    captureFieldsFromDOM();
    const tankCapacity = Engine.positive($('tank-capacity')?.value);
    const liquidApplication = methods().some(method => !/granulado/i.test(method));
    return (currentFarm?.fields || []).filter(field => selectedFields.has(field.id)).map(field => {
      const state = fieldState[field.id] || defaultFieldState(field);
      const plants = Engine.calculatePlants(field.area, state);
      const calculated = Engine.calculateField({
        area: field.area,
        plants,
        mlPerPlant: state.mlPerPlant,
        tankCapacity,
        liquidApplication,
        products: (state.products || []).filter(product => product.productId && product.name)
      });
      return {
        id: field.id,
        name: field.name,
        culture: clean($('crop-name')?.value),
        stage: stages(),
        ...calculated,
        loadDescription: Engine.loadDescription(calculated.loads, value => fmt(value, 0, 2))
      };
    });
  }

  function stockIdentity(product) {
    return `${product.productId || Engine.key(product.name)}|${Engine.key(product.unit)}`;
  }

  function updateStock(identity, value) {
    productStockMap[decodeURIComponent(identity)] = Engine.positive(value);
    calculateTotals();
  }

  function renderProductSummary(totals) {
    const container = $('total-products-summary-cards');
    if (!container) return;
    if (!totals.products.length) {
      container.innerHTML = '<div class="text-xs text-emerald-700 italic col-span-full">Selecione produtos válidos nos talhões para visualizar o totalizador.</div>';
      return;
    }
    container.innerHTML = totals.products.map(product => {
      const identity = stockIdentity(product);
      const stock = Engine.positive(productStockMap[identity] ?? product.inStock);
      const toBuy = Math.max(0, product.total - stock);
      product.inStock = stock;
      product.toBuy = toBuy;
      return `
        <div class="bg-white border border-emerald-200 rounded-xl p-3 space-y-2">
          <div><p class="font-black text-slate-900 text-sm">${esc(product.name)}</p><p class="text-[10px] text-slate-500">${esc(product.category || '')}</p></div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div><span class="block text-[9px] uppercase text-slate-500">Necessário</span><strong>${fmt(product.total, 2, 3)} ${esc(product.unitBase)}</strong></div>
            <label><span class="block text-[9px] uppercase text-slate-500">Em estoque</span><input onchange="updateStock('${encodeURIComponent(identity)}',this.value)" value="${esc(stock || '')}" inputmode="decimal" class="w-full border border-slate-300 rounded px-2 py-1 font-bold"></label>
            <div><span class="block text-[9px] uppercase text-slate-500">A comprar</span><strong class="${toBuy > 0 ? 'text-amber-700' : 'text-emerald-700'}">${fmt(toBuy, 2, 3)} ${esc(product.unitBase)}</strong></div>
          </div>
        </div>`;
    }).join('');
  }

  function calculateTotals() {
    if (!Engine) return null;
    const fields = calculatedFields();
    const totals = Engine.totals(fields, productStockMap);
    fields.forEach(field => {
      const index = (currentFarm?.fields || []).findIndex(item => item.id === field.id);
      setText(`field-${index}-plants-display`, fmt(field.plants, 0, 0));
      setText(`field-${index}-syrup-display`, `${fmt(field.syrupLiters, 1, 2)} L`);
      setText(`field-${index}-tanks-display`, field.loadDescription);
    });
    setText('selected-area-display', fmt(totals.area, 2, 2));
    setText('selected-plants-display', fmt(totals.plants, 0, 0));
    setText('selected-volume-display', fmt(totals.syrupLiters, 1, 2));
    setText('total-syrup-volume', `${fmt(totals.syrupLiters, 1, 2)} L`);
    const loads = Engine.calculateLoads(totals.syrupLiters, Engine.positive($('tank-capacity')?.value));
    setText('total-tanks-count', loads.actualLoads
      ? `${loads.actualLoads} ${loads.actualLoads === 1 ? 'carga' : 'cargas'}${loads.partialLiters ? ` • final ${fmt(loads.partialLiters, 0, 2)} L` : ''}`
      : '0 cargas');
    const covered = loads.equivalentTanks > 0 ? totals.area / loads.equivalentTanks : 0;
    setText('ha-per-tank', `${fmt(covered, 2, 2)} ha`);
    renderProductSummary(totals);
    return { fields, totals };
  }

  function onTankCapacityChange() {
    calculateTotals();
  }

  function selectAgronomist(index) {
    selectedAgronomistIndex = Number(index) === 1 ? 1 : 0;
    AGRONOMISTS.forEach((_, itemIndex) => {
      const selected = itemIndex === selectedAgronomistIndex;
      const button = $(`agro-btn-${itemIndex}`);
      button?.classList.toggle('border-emerald-600', selected);
      button?.classList.toggle('bg-emerald-50', selected);
      button?.classList.toggle('border-slate-200', !selected);
      $(`agro-check-${itemIndex}`)?.classList.toggle('opacity-0', !selected);
    });
    const preview = DoCampoDocumentCode.previa('VSL', AGRONOMISTS[selectedAgronomistIndex].name);
    if ($('rec-number-input') && !pendingRecommendationId) $('rec-number-input').value = preview;
  }

  function validateSnapshot(fields) {
    if (!currentFarm) throw new Error('Selecione uma propriedade.');
    if (!fields.length) throw new Error('Selecione pelo menos um talhão.');
    if (!clean($('crop-name')?.value)) throw new Error('Informe a cultura.');
    if (!methods().length) throw new Error('Selecione pelo menos um método de aplicação.');
    const liquidApplication = methods().some(method => !/granulado/i.test(method));
    if (liquidApplication && Engine.positive($('tank-capacity')?.value) <= 0) throw new Error('Informe uma capacidade de tanque válida.');
    fields.forEach(field => {
      if (field.plants <= 0) throw new Error(`Informe a população do talhão ${field.name}.`);
      if (liquidApplication && field.mlPerPlant <= 0) throw new Error(`Informe o volume em mL/planta do talhão ${field.name}.`);
      if (!field.products.length) throw new Error(`Selecione ao menos um produto no talhão ${field.name}.`);
      if (field.products.some(product => product.dose <= 0)) throw new Error(`Há produto sem dose válida no talhão ${field.name}.`);
      const inactive = field.products.find(product => !productById(product.productId));
      if (inactive) throw new Error(`O produto ${inactive.name} não está mais no catálogo ativo. Substitua-o no talhão ${field.name}.`);
    });
  }

  function notes() {
    return {
      safety: multiline($('safety-notes')?.value),
      firstAid: multiline($('first-aid-notes')?.value),
      technical: multiline($('tech-notes')?.value),
      precautions: multiline($('precautions-notes')?.value),
      ipm: multiline($('ipm-notes')?.value),
      environment: multiline($('environment-notes')?.value)
    };
  }

  function buildSnapshot(documentCode) {
    const result = calculateTotals();
    const fields = result?.fields || [];
    validateSnapshot(fields);
    const responsible = AGRONOMISTS[selectedAgronomistIndex];
    const totalProducts = Engine.consolidate(fields, productStockMap).map(product => {
      const identity = stockIdentity(product);
      const inStock = Engine.positive(productStockMap[identity]);
      return { ...product, inStock, toBuy: Math.max(0, product.total - inStock) };
    });
    const now = new Date();
    return {
      schemaVersion: 1,
      module: MODULE,
      typeLabel: 'Recomendação Via Solo',
      sourceAppVersion: DoCampoDB.appVersion,
      documentCode: documentCode || DoCampoDocumentCode.previa('VSL', responsible.name),
      generatedAt: now.toISOString(),
      dateLabel: now.toLocaleDateString('pt-BR'),
      farmId: currentFarm.id,
      farm: currentFarm.farm,
      producer: currentFarm.producer,
      cpf: currentFarm.cpf || '',
      address: currentFarm.address || '',
      culture: clean($('crop-name')?.value),
      cropStages: stages(),
      methods: methods(),
      tankCapacity: Engine.positive($('tank-capacity')?.value),
      fields: clone(fields),
      totals: { ...clone(result.totals), products: totalProducts },
      notes: notes(),
      responsible: clone(responsible),
      createdBy: DoCampoDB.user(),
      deviceId: DoCampoDB.deviceId()
    };
  }

  function previewHtml(snapshot) {
    const productSummary = snapshot.totals.products.length
      ? snapshot.totals.products.map(product => `
          <div class="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
            <strong>${esc(product.name)}</strong>
            <div class="grid grid-cols-3 gap-2 mt-2 text-xs"><span>Total<br><b>${fmt(product.total, 2, 3)} ${esc(product.unitBase)}</b></span><span>Estoque<br><b>${fmt(product.inStock, 2, 3)} ${esc(product.unitBase)}</b></span><span>A comprar<br><b class="${product.toBuy > 0 ? 'text-amber-700' : 'text-emerald-700'}">${fmt(product.toBuy, 2, 3)} ${esc(product.unitBase)}</b></span></div>
          </div>`).join('')
      : '<p class="text-slate-500">Nenhum produto.</p>';
    return `
      <div class="flex items-center justify-between gap-4 border-b-2 border-emerald-700 pb-3">
        <div class="flex items-center gap-3"><img src="assets/logo.png" class="w-14 h-14 object-contain" alt=""><div><h2 class="font-black text-emerald-800 text-lg">DO CAMPO AGRONEGÓCIOS</h2><p class="text-xs font-bold text-slate-500 uppercase">Recomendação de Fungicida, Inseticida e Nematicida Via Solo</p></div></div>
        <div class="text-right"><b class="text-emerald-800">${esc(snapshot.documentCode)}</b><br><span class="text-xs text-slate-500">${esc(snapshot.dateLabel)}</span></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
        <div><small class="font-bold text-slate-500 uppercase">Fazenda</small><p class="font-bold">${esc(snapshot.farm)}</p></div>
        <div><small class="font-bold text-slate-500 uppercase">Produtor</small><p class="font-bold">${esc(snapshot.producer)}${snapshot.cpf ? ` • CPF ${esc(snapshot.cpf)}` : ''}</p></div>
        <div class="sm:col-span-2"><small class="font-bold text-slate-500 uppercase">Endereço</small><p>${esc(snapshot.address || '--')}</p></div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-xs">
        <div class="border rounded-lg p-3"><span class="text-slate-500">Método</span><strong class="block mt-1">${esc(snapshot.methods.join(', '))}</strong></div>
        <div class="border rounded-lg p-3"><span class="text-slate-500">Plantas</span><strong class="block mt-1">${fmt(snapshot.totals.plants, 0, 0)}</strong></div>
        <div class="border rounded-lg p-3"><span class="text-slate-500">Área</span><strong class="block mt-1">${fmt(snapshot.totals.area, 2, 2)} ha</strong></div>
        <div class="border rounded-lg p-3"><span class="text-slate-500">Calda</span><strong class="block mt-1">${fmt(snapshot.totals.syrupLiters, 1, 2)} L</strong></div>
      </div>
      <h3 class="font-black uppercase text-xs tracking-wider mt-5 mb-2 text-slate-700">Detalhamento por talhão</h3>
      <div class="space-y-3">${snapshot.fields.map(field => `
        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex flex-wrap justify-between gap-2 border-b pb-2"><strong>${esc(field.name)} • ${fmt(field.area, 2, 2)} ha</strong><span class="text-xs font-bold text-emerald-800">${field.liquidApplication ? esc(field.loadDescription) : 'Aplicação sem tanque'}</span></div>
          <p class="text-xs text-slate-600 mt-2">${fmt(field.plants, 0, 0)} plantas${field.liquidApplication ? ` • ${fmt(field.mlPerPlant, 0, 2)} mL/planta • ${fmt(field.syrupLiters, 1, 2)} L de calda` : ''}</p>
          <div class="mt-2 space-y-2">${field.products.map(product => `
            <div class="bg-slate-50 rounded-lg p-2 text-xs"><b>${esc(product.name)}</b> • ${fmt(product.dose, 0, 3)} ${esc(product.unit)} • Total: <b>${fmt(product.total, 2, 3)} ${esc(product.unitBase)}</b>${field.liquidApplication ? `<br><span class="text-emerald-800">Carga cheia: ${fmt(product.fullTankQuantity, 2, 3)} ${esc(product.unitBase)}${field.loads.partialLiters ? ` • Carga final: ${fmt(product.partialQuantity, 2, 3)} ${esc(product.unitBase)}` : ''}</span>` : ''}</div>`).join('')}</div>
        </div>`).join('')}</div>
      <h3 class="font-black uppercase text-xs tracking-wider mt-5 mb-2 text-slate-700">Resumo de retirada e compra</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${productSummary}</div>
      <div class="mt-5 border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-amber-950"><b>Conferência:</b> valide propriedade, talhões, produtos, doses, capacidade do tanque e quantidades por carga antes de salvar.</div>
      <div class="grid grid-cols-2 gap-6 mt-10 text-center text-xs"><div class="border-t border-slate-700 pt-2"><b>${esc(snapshot.responsible.name)}</b><br>${esc(snapshot.responsible.credential)}</div><div class="border-t border-slate-700 pt-2"><b>Ciente do Produtor / Aplicador</b></div></div>`;
  }

  function renderPreview(snapshot, recommendationId) {
    pendingPreviewSnapshot = clone(snapshot);
    pendingRecommendationId = recommendationId || null;
    $('preview-content').innerHTML = previewHtml(snapshot);
    const saved = recommendationId ? DoCampoDB.get('recommendations', recommendationId) : null;
    setText('preview-save-text', saved?.status === 'final' ? 'Abrir ou compartilhar PDF' : recommendationId ? 'Gerar PDF pendente' : 'Salvar e compartilhar PDF');
    $('pdf-content-wrapper')?.classList.remove('hidden');
    $('pdf-content-wrapper')?.scrollTo({ top: 0 });
  }

  function openPDFPreview() {
    try {
      const responsible = AGRONOMISTS[selectedAgronomistIndex];
      const snapshot = buildSnapshot(DoCampoDocumentCode.previa('VSL', responsible.name));
      renderPreview(snapshot, null);
    } catch (error) {
      showAlert(error.message || 'Revise os campos obrigatórios.', 'Não foi possível abrir a prévia', 'error');
    }
  }

  function closePDFModal() {
    $('pdf-content-wrapper')?.classList.add('hidden');
    pendingPreviewSnapshot = null;
    pendingRecommendationId = null;
    selectAgronomist(selectedAgronomistIndex);
  }

  async function finalizeAndShare() {
    if (busy || !pendingPreviewSnapshot) return;
    busy = true;
    const button = $('preview-save-button');
    if (button) button.disabled = true;
    let recommendation = null;
    let snapshot = clone(pendingPreviewSnapshot);
    try {
      if (pendingRecommendationId) {
        recommendation = DoCampoDB.get('recommendations', pendingRecommendationId);
        if (!recommendation || recommendation.deletedAt) throw new Error('A recomendação selecionada não está mais disponível.');
        snapshot = clone(recommendation.snapshot);
        if (recommendation.status === 'final' && recommendation.documentId) {
          const existingDocument = DoCampoDB.get('documents', recommendation.documentId);
          if (existingDocument && !existingDocument.deletedAt) {
            try {
              setText('preview-save-text', 'Abrindo PDF salvo...');
              await DoCampoPDF.shareDocument(existingDocument, 'Abrir ou compartilhar recomendação via solo');
              $('pdf-content-wrapper')?.classList.add('hidden');
              showAlert('O PDF salvo foi aberto sem criar uma cópia duplicada.', 'Documento disponível', 'success');
              return;
            } catch (_) {
              // Se o arquivo ainda não chegou a este aparelho, o snapshot
              // imutável permite reconstruí-lo com o mesmo código abaixo.
            }
          }
        }
      } else {
        snapshot.documentCode = DoCampoDocumentCode.reservar('VSL', snapshot.responsible.name);
        snapshot.generatedAt = new Date().toISOString();
        snapshot.dateLabel = new Date(snapshot.generatedAt).toLocaleDateString('pt-BR');
        recommendation = DoCampoDB.upsert('recommendations', {
          module: MODULE,
          kind: 'via-solo',
          status: 'pdf_pending',
          documentCode: snapshot.documentCode,
          farmId: snapshot.farmId,
          farm: snapshot.farm,
          producer: snapshot.producer,
          responsible: snapshot.responsible.name,
          fieldIds: snapshot.fields.map(field => field.id),
          snapshot,
          finalizedAt: snapshot.generatedAt
        });
        await DoCampoDB.flush();
      }
      setText('preview-save-text', 'Gerando PDF vetorial...');
      const dataUri = await DoCampoViaSoloPDF.generate(snapshot);
      const filename = DoCampoDocumentCode.arquivo(`${snapshot.documentCode}_${snapshot.farm}_Via_Solo`) + '.pdf';
      const result = await DoCampoPDF.salvarECompartilhar(dataUri, filename, 'Recomendação Técnica Via Solo', {
        typeLabel: 'Recomendação Via Solo',
        producer: snapshot.producer,
        farm: snapshot.farm,
        fields: snapshot.fields.map(field => field.name),
        responsible: snapshot.responsible.name,
        documentCode: snapshot.documentCode,
        snapshot: { recommendationId: recommendation.id, module: MODULE, culture: snapshot.culture }
      });
      recommendation = DoCampoDB.upsert('recommendations', {
        ...recommendation,
        status: 'final',
        snapshot,
        documentId: result?.document?.id || recommendation.documentId || '',
        pdfGeneratedAt: new Date().toISOString(),
        lastError: ''
      });
      // Impede que o clique de confirmação recrie um rascunho depois que o
      // documento final já foi persistido. "Nova Recomendação" reabre limpo.
      initialized = false;
      DoCampoDrafts.clear(MODULE);
      await DoCampoDB.flush();
      if ($('rec-number-input')) $('rec-number-input').value = snapshot.documentCode;
      $('pdf-content-wrapper')?.classList.add('hidden');
      pendingPreviewSnapshot = snapshot;
      pendingRecommendationId = recommendation.id;
      showAlert('A recomendação foi registrada no histórico e o PDF foi salvo. Se o compartilhamento foi cancelado, ele continua disponível em Documentos gerados.', 'Documento concluído', 'success');
    } catch (error) {
      if (recommendation) {
        try {
          DoCampoDB.upsert('recommendations', {
            ...recommendation,
            status: 'pdf_pending',
            snapshot,
            lastError: clean(error.message),
            lastAttemptAt: new Date().toISOString()
          });
          await DoCampoDB.flush();
        } catch (_) {}
      }
      showAlert(
        recommendation
          ? `A recomendação foi preservada no histórico, mas o PDF ficou pendente. Você poderá tentar novamente.\n\nDetalhe: ${error.message || 'erro desconhecido'}`
          : (error.message || 'Não foi possível salvar a recomendação.'),
        'PDF não concluído',
        'error'
      );
    } finally {
      busy = false;
      if (button) button.disabled = false;
      setText('preview-save-text', pendingRecommendationId ? 'Gerar e compartilhar novamente' : 'Salvar e compartilhar PDF');
    }
  }

  function recommendationItems() {
    return DoCampoDB.list('recommendations').filter(item => item.module === MODULE || item.kind === 'via-solo');
  }

  function openHistoryModal() {
    renderHistory();
    $('history-modal')?.classList.remove('hidden');
  }

  function closeHistoryModal() {
    $('history-modal')?.classList.add('hidden');
  }

  function renderHistory() {
    const container = $('history-list');
    if (!container) return;
    const items = recommendationItems();
    if (!items.length) {
      container.innerHTML = '<div class="text-center py-12 text-slate-500 border border-dashed border-slate-300 rounded-xl">Nenhuma recomendação via solo salva.</div>';
      return;
    }
    container.innerHTML = items.map(item => {
      const pending = item.status !== 'final';
      return `
        <div class="border border-slate-200 rounded-xl p-4">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div><h4 class="font-black text-slate-900">${esc(item.snapshot?.farm || item.farm || 'Propriedade')}</h4><p class="text-xs text-slate-600 mt-1">${esc(item.documentCode || item.snapshot?.documentCode || '')} • ${esc(item.snapshot?.producer || item.producer || '')} • ${new Date(item.finalizedAt || item.createdAt).toLocaleString('pt-BR')}</p><span class="inline-block mt-2 text-[10px] font-bold rounded-full px-2 py-1 ${pending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${pending ? 'PDF pendente — dados preservados' : 'Concluído'}</span></div>
            <div class="flex flex-wrap gap-2">
              <button data-history-view="${esc(item.id)}" class="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold">${pending ? 'Tentar PDF' : 'Ver / compartilhar'}</button>
              <button data-history-copy="${esc(item.id)}" class="bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold">Usar como nova</button>
              <button data-history-delete="${esc(item.id)}" class="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold">Excluir</button>
            </div>
          </div>
        </div>`;
    }).join('');
    container.querySelectorAll('[data-history-view]').forEach(button => button.addEventListener('click', () => viewHistoryItem(button.dataset.historyView)));
    container.querySelectorAll('[data-history-copy]').forEach(button => button.addEventListener('click', () => copyHistoryItem(button.dataset.historyCopy)));
    container.querySelectorAll('[data-history-delete]').forEach(button => button.addEventListener('click', () => deleteHistoryItem(button.dataset.historyDelete)));
  }

  function viewHistoryItem(id) {
    const item = DoCampoDB.get('recommendations', id);
    if (!item?.snapshot) return showAlert('O registro não possui uma cópia técnica válida.', 'Histórico indisponível', 'error');
    closeHistoryModal();
    renderPreview(item.snapshot, item.id);
  }

  function applySnapshotToForm(snapshot) {
    const farm = registry.farms.find(item => item.id === snapshot.farmId) ||
      registry.farms.find(item => Engine.key(item.farm) === Engine.key(snapshot.farm));
    if (!farm) throw new Error('A propriedade desta recomendação não existe mais no cadastro ativo.');
    $('farm-select').value = farm.id;
    currentFarm = farm;
    selectedFields = new Set();
    fieldState = {};
    (farm.fields || []).forEach(field => {
      const saved = (snapshot.fields || []).find(item => item.id === field.id) ||
        (snapshot.fields || []).find(item => Engine.key(item.name) === Engine.key(field.name));
      fieldState[field.id] = saved ? {
        mode: 'plants',
        plantsCount: saved.plants,
        rowSpacing: 0,
        plantSpacing: 0,
        mlPerPlant: saved.mlPerPlant,
        products: (saved.products || []).map(product => ({
          productId: product.productId || '',
          category: product.category || DEFAULT_CATEGORIES[0],
          name: product.name || '',
          dose: product.dose,
          unit: product.unit || 'L/ha',
          target: product.target || '',
          active: product.active || ''
        }))
      } : defaultFieldState(field);
      if (saved) selectedFields.add(field.id);
    });
    if ($('producer-display')) $('producer-display').value = farm.producer || '';
    if ($('producer-cpf-display')) $('producer-cpf-display').value = farm.cpf || '';
    if ($('producer-address-display')) $('producer-address-display').value = farm.address || '';
    if ($('crop-name')) $('crop-name').value = snapshot.culture || 'Café';
    document.querySelectorAll('.crop-stage-cb').forEach(element => { element.checked = (snapshot.cropStages || []).includes(element.value); });
    ['spray-type-drench', 'spray-type-fertirrigation', 'spray-type-granulated'].forEach(id => {
      const element = $(id);
      if (element) element.checked = (snapshot.methods || []).includes(element.value);
    });
    if ($('tank-capacity')) $('tank-capacity').value = snapshot.tankCapacity || 200;
    const noteMap = { 'safety-notes': 'safety', 'first-aid-notes': 'firstAid', 'tech-notes': 'technical', 'precautions-notes': 'precautions', 'ipm-notes': 'ipm', 'environment-notes': 'environment' };
    Object.entries(noteMap).forEach(([id, key]) => { if ($(id)) $(id).value = snapshot.notes?.[key] || ''; });
    productStockMap = {};
    (snapshot.totals?.products || []).forEach(product => { productStockMap[stockIdentity(product)] = product.inStock || 0; });
    const agronomistIndex = AGRONOMISTS.findIndex(item => Engine.key(item.name) === Engine.key(snapshot.responsible?.name));
    selectAgronomist(agronomistIndex >= 0 ? agronomistIndex : 0);
    renderFields();
  }

  function copyHistoryItem(id) {
    const item = DoCampoDB.get('recommendations', id);
    try {
      if (!item?.snapshot) throw new Error('O registro não possui dados reaproveitáveis.');
      applySnapshotToForm(item.snapshot);
      closeHistoryModal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showAlert('Os dados foram carregados como uma nova recomendação. O documento anterior não será alterado.', 'Cópia preparada', 'success');
    } catch (error) {
      showAlert(error.message, 'Não foi possível reaproveitar', 'error');
    }
  }

  async function deleteHistoryItem(id) {
    const item = DoCampoDB.get('recommendations', id);
    if (!item || !confirm(`Mover a recomendação "${item.documentCode || item.snapshot?.documentCode || ''}" para a lixeira?`)) return;
    try {
      DoCampoDB.softDelete('recommendations', id, { removalReason: 'Exclusão manual no histórico via solo' });
      await DoCampoDB.flush();
      renderHistory();
    } catch (error) {
      showAlert(error.message || 'Não foi possível excluir.', 'Exclusão não concluída', 'error');
    }
  }

  function captureDraft() {
    if (restoring || !initialized) return null;
    captureFieldsFromDOM();
    return {
      version: 1,
      farmId: currentFarm?.id || '',
      selectedFieldIds: Array.from(selectedFields),
      fieldState: clone(fieldState),
      productStockMap: clone(productStockMap),
      selectedAgronomistIndex,
      controls: {
        cropName: $('crop-name')?.value || '',
        cropStages: stages(),
        methods: methods(),
        tankCapacity: $('tank-capacity')?.value || '',
        notes: notes()
      }
    };
  }

  function restoreDraft(draft) {
    if (!draft || draft.version !== 1) return false;
    const farm = registry.farms.find(item => item.id === draft.farmId);
    if (!farm) return false;
    restoring = true;
    try {
      $('farm-select').value = farm.id;
      currentFarm = farm;
      selectedFields = new Set(draft.selectedFieldIds || []);
      fieldState = clone(draft.fieldState || {});
      productStockMap = clone(draft.productStockMap || {});
      onFarmChange({ preserve: true });
      if ($('crop-name')) $('crop-name').value = draft.controls?.cropName || 'Café';
      document.querySelectorAll('.crop-stage-cb').forEach(element => { element.checked = (draft.controls?.cropStages || []).includes(element.value); });
      ['spray-type-drench', 'spray-type-fertirrigation', 'spray-type-granulated'].forEach(id => {
        const element = $(id);
        if (element) element.checked = (draft.controls?.methods || []).includes(element.value);
      });
      if ($('tank-capacity')) $('tank-capacity').value = draft.controls?.tankCapacity || 200;
      const noteMap = { 'safety-notes': 'safety', 'first-aid-notes': 'firstAid', 'tech-notes': 'technical', 'precautions-notes': 'precautions', 'ipm-notes': 'ipm', 'environment-notes': 'environment' };
      Object.entries(noteMap).forEach(([id, key]) => {
        if ($(id) && draft.controls?.notes?.[key] != null) $(id).value = draft.controls.notes[key];
      });
      selectAgronomist(draft.selectedAgronomistIndex);
      renderFields();
      return true;
    } finally {
      restoring = false;
    }
  }

  async function resetForm() {
    const hasWork = !!currentFarm || selectedFields.size > 0;
    if (hasWork && !confirm('Iniciar uma nova recomendação? O rascunho atual será limpo, mas nenhum cadastro ou documento será apagado.')) return;
    try {
      DoCampoDrafts.clear(MODULE);
      await DoCampoDB.flush();
      location.reload();
    } catch (error) {
      showAlert(error.message || 'Não foi possível limpar o rascunho.', 'Rascunho não limpo', 'error');
    }
  }

  async function initialize() {
    try {
      if (!Engine) throw new Error('O motor de cálculo via solo não foi carregado.');
      await DoCampoDB.ready();
      await loadRegistry();
      setText('current-date-display', new Date().toLocaleDateString('pt-BR'));
      addNewFarmFieldRow();
      const currentUser = DoCampoDB.user();
      const userIndex = AGRONOMISTS.findIndex(item => Engine.key(item.name) === Engine.key(currentUser));
      selectAgronomist(userIndex >= 0 ? userIndex : 0);
      initialized = true;
      const restored = restoreDraft(DoCampoDrafts.load(MODULE));
      if (!restored) renderFields();
      DoCampoDrafts.bind(MODULE, captureDraft);
      window.addEventListener('docampo:sync-complete', async () => {
        if (restoring || busy) return;
        const selectedFarmId = currentFarm?.id;
        await loadRegistry().catch(() => {});
        if (selectedFarmId && registry.farms.some(farm => farm.id === selectedFarmId)) {
          $('farm-select').value = selectedFarmId;
          onFarmChange({ preserve: true });
        } else if (selectedFarmId) {
          currentFarm = null;
          selectedFields = new Set();
          fieldState = {};
          $('farm-select').value = '';
          renderFields();
          showAlert('A propriedade selecionada deixou de estar ativa após a sincronização. O restante do rascunho foi preservado, mas será necessário escolher uma propriedade ativa.', 'Cadastro alterado no outro aparelho', 'warning');
        }
      });
    } catch (error) {
      showAlert(error.message || 'Não foi possível iniciar a recomendação via solo.', 'Módulo indisponível', 'error');
      if ($('btn-pdf-generate')) $('btn-pdf-generate').disabled = true;
    }
  }

  Object.assign(window, {
    toggleNewFarmPanel,
    toggleNewProductPanel,
    addNewFarmFieldRow,
    saveAndSelectNewFarm,
    saveNewProduct,
    openManageProductsModal,
    closeManageProductsModal,
    renderManageProductsList,
    deleteProductFromCatalog,
    onFarmChange,
    toggleField,
    selectAllFields,
    onFieldCalcModeChange,
    updateFieldCategory,
    updateFieldProduct,
    addProductSlotToField,
    removeProductSlotFromField,
    calculateTotals,
    onTankCapacityChange,
    updateStock,
    selectAgronomist,
    openPDFPreview,
    closePDFModal,
    finalizeAndShare,
    openHistoryModal,
    closeHistoryModal,
    resetForm,
    closeCustomAlert
  });

  document.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
