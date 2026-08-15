(function () {
  'use strict';

  const MODEL = 'assets/Modelo_Importacao_SmartFarm.xlsx';
  const HISTORY_KEY = 'docampo_import_history_v1';
  const textDecoder = new TextDecoder('utf-8');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const filled = value => value !== null && value !== undefined && String(value).trim() !== '';
  const number = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    let raw = String(value ?? '').trim().replace(/\s/g, '');
    if (!raw) return NaN;
    if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    else raw = raw.replace(',', '.');
    return Number(raw);
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fieldCompare = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
  const mergeNonBlank = (base, patch) => Object.fromEntries(Object.entries({ ...base, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => filled(v))) }));

  function u16(view, offset) { return view.getUint16(offset, true); }
  function u32(view, offset) { return view.getUint32(offset, true); }

  async function unzipXlsx(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (u32(view, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('O arquivo não possui uma estrutura XLSX válida.');
    const count = u16(view, eocd + 10), centralOffset = u32(view, eocd + 16), entries = new Map();
    let cursor = centralOffset;
    for (let i = 0; i < count; i++) {
      if (u32(view, cursor) !== 0x02014b50) throw new Error('Não foi possível ler a planilha XLSX.');
      const method = u16(view, cursor + 10), compressedSize = u32(view, cursor + 20);
      const nameLength = u16(view, cursor + 28), extraLength = u16(view, cursor + 30), commentLength = u16(view, cursor + 32), localOffset = u32(view, cursor + 42);
      const name = textDecoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      entries.set(name, { method, compressedSize, localOffset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    async function file(name) {
      const entry = entries.get(name);
      if (!entry) return '';
      const p = entry.localOffset;
      if (u32(view, p) !== 0x04034b50) throw new Error('Entrada XLSX inválida.');
      const nameLength = u16(view, p + 26), extraLength = u16(view, p + 28), start = p + 30 + nameLength + extraLength;
      const compressed = bytes.slice(start, start + entry.compressedSize);
      if (entry.method === 0) return textDecoder.decode(compressed);
      if (entry.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('Este aparelho não conseguiu descompactar o XLSX. Atualize o aplicativo ou use o modelo em um aparelho mais recente.');
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return textDecoder.decode(await new Response(stream).arrayBuffer());
    }
    return { file };
  }

  function xml(source) {
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('A planilha contém XML inválido.');
    return doc;
  }
  const nodes = (root, localName) => [...root.getElementsByTagNameNS('*', localName)];

  function pathJoin(base, target) {
    if (target.startsWith('/')) return target.replace(/^\//, '');
    const parts = `${base}/${target}`.split('/'), out = [];
    parts.forEach(part => { if (!part || part === '.') return; if (part === '..') out.pop(); else out.push(part); });
    return out.join('/');
  }

  function colIndex(ref) {
    const letters = String(ref || '').match(/[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let result = 0;
    for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
    return result - 1;
  }

  async function readWorkbook(file) {
    const zip = await unzipXlsx(await file.arrayBuffer());
    const sharedXml = await zip.file('xl/sharedStrings.xml');
    const shared = sharedXml ? nodes(xml(sharedXml), 'si').map(si => nodes(si, 't').map(t => t.textContent || '').join('')) : [];
    const workbookDoc = xml(await zip.file('xl/workbook.xml'));
    const relDoc = xml(await zip.file('xl/_rels/workbook.xml.rels'));
    const rels = new Map(nodes(relDoc, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const result = {};
    for (const sheet of nodes(workbookDoc, 'sheet')) {
      const name = sheet.getAttribute('name') || '';
      const id = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const target = rels.get(id);
      if (!target) continue;
      const sheetDoc = xml(await zip.file(pathJoin('xl', target)));
      const rows = [];
      for (const row of nodes(sheetDoc, 'row')) {
        const values = [];
        for (const cell of nodes(row, 'c')) {
          const index = colIndex(cell.getAttribute('r'));
          const type = cell.getAttribute('t');
          const v = nodes(cell, 'v')[0]?.textContent ?? '';
          let value = v;
          if (type === 's') value = shared[Number(v)] ?? '';
          else if (type === 'inlineStr') value = nodes(cell, 't').map(t => t.textContent || '').join('');
          else if (type === 'b') value = v === '1';
          else if (!type || type === 'n') value = v === '' ? '' : Number(v);
          values[index] = value;
        }
        rows.push(values);
      }
      result[name] = rows;
    }
    return result;
  }

  const aliases = {
    producer: ['produtor', 'nome do produtor'], cpf: ['cpf cnpj', 'cpf', 'cnpj'], farm: ['propriedade', 'fazenda', 'fazenda propriedade'],
    city: ['municipio', 'cidade'], address: ['endereco localizacao', 'endereco', 'localizacao'], notes: ['observacoes', 'observacao'],
    field: ['talhao', 'nome do talhao'], area: ['area ha', 'area'], plants: ['n de plantas', 'numero de plantas', 'plantas'],
    rowSpacing: ['espacamento entre linhas m', 'espacamento entre linhas'], plantSpacing: ['espacamento entre plantas m', 'espacamento entre plantas'], culture: ['cultura'],
    name: ['nome comercial', 'produto', 'nome do produto'], manufacturer: ['fabricante', 'empresa'], category: ['categoria'], formulation: ['formulacao'],
    active: ['ingrediente ativo garantia', 'ingrediente ativo', 'garantia'], dose: ['dose padrao', 'dose padrao ha', 'dose ha'], unit: ['unidade'], target: ['alvo'],
    grace: ['carencia', 'carencia ire'], toxicology: ['classe toxicologica', 'toxicologica'], mixOrder: ['ordem de mistura', 'formulacao ordem'],
  };

  function tableFromSheet(rows, requiredGroups) {
    let headerIndex = -1, columns = {};
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const normalized = (rows[i] || []).map(norm), candidate = {};
      Object.entries(aliases).forEach(([key, names]) => {
        const idx = normalized.findIndex(h => names.includes(h));
        if (idx >= 0) candidate[key] = idx;
      });
      if (requiredGroups.every(group => group.some(key => Number.isInteger(candidate[key])))) { headerIndex = i; columns = candidate; break; }
    }
    if (headerIndex < 0) return { error: 'Cabeçalhos obrigatórios não encontrados.', rows: [] };
    const data = rows.slice(headerIndex + 1).map((row, offset) => {
      const item = { _line: headerIndex + offset + 2 };
      Object.entries(columns).forEach(([key, index]) => item[key] = row[index] ?? '');
      return item;
    }).filter(item => Object.keys(item).some(key => key !== '_line' && filled(item[key])));
    return { rows: data, columns };
  }

  function isExample(item) {
    return /exemplo|linha de exemplo/i.test(`${item.producer || ''} ${item.farm || ''} ${item.name || ''} ${item.notes || ''}`);
  }

  async function prepareClients(book) {
    const registry = await DoCampoRegistry.all(), current = registry.farms || [], byFarm = new Map(current.map(f => [norm(f.farm), f]));
    const propertySheet = Object.entries(book).find(([name]) => norm(name) === 'propriedades')?.[1] || [];
    const fieldSheet = Object.entries(book).find(([name]) => norm(name) === 'talhoes')?.[1] || [];
    const props = tableFromSheet(propertySheet, [['producer'], ['farm']]);
    const fields = tableFromSheet(fieldSheet, [['producer'], ['farm'], ['field']]);
    const errors = [], records = new Map(), details = [];
    if (props.error) errors.push({ status: 'error', label: `Aba Propriedades: ${props.error}` });
    if (fields.error) errors.push({ status: 'error', label: `Aba Talhoes: ${fields.error}` });

    props.rows.filter(x => !isExample(x)).forEach(row => {
      const producer = String(row.producer || '').trim(), farm = String(row.farm || '').trim();
      if (!producer || !farm) { errors.push({ status: 'error', label: `Propriedades • linha ${row._line}: produtor e propriedade são obrigatórios.` }); return; }
      const key = norm(farm), old = byFarm.get(key), previous = records.get(key)?.data || old || {};
      if (old && old.producer && norm(old.producer) !== norm(producer)) { errors.push({ status: 'error', label: `${farm}: já existe para ${old.producer}; produtor informado na planilha: ${producer}.` }); return; }
      const addressParts = [row.address, row.city].filter(filled).map(String);
      const data = mergeNonBlank({ producer: old?.producer || '', farm, cpf: old?.cpf || '', address: old?.address || '', fields: (old?.fields || []).map(x => ({ ...x })) }, {
        producer, farm, cpf: String(row.cpf || '').trim(), address: addressParts.join(' • '), notes: String(row.notes || '').trim(),
      });
      records.set(key, { data, old });
    });

    fields.rows.filter(x => !isExample(x)).forEach(row => {
      const producer = String(row.producer || '').trim(), farm = String(row.farm || '').trim(), field = String(row.field || '').trim();
      if (!producer || !farm || !field) { errors.push({ status: 'error', label: `Talhoes • linha ${row._line}: produtor, propriedade e talhão são obrigatórios.` }); return; }
      const key = norm(farm), old = byFarm.get(key), holder = records.get(key);
      if (!holder && !old) { errors.push({ status: 'error', label: `Talhoes • linha ${row._line}: propriedade “${farm}” não encontrada na aba Propriedades nem no aplicativo.` }); return; }
      const record = holder || { old, data: { ...old, farm: old.farm, producer: old.producer || producer, fields: (old.fields || []).map(x => ({ ...x })) } };
      if (record.data.producer && norm(record.data.producer) !== norm(producer)) { errors.push({ status: 'error', label: `Talhoes • linha ${row._line}: o produtor não corresponde à propriedade “${farm}”.` }); return; }
      const fieldKey = norm(field), existingIndex = record.data.fields.findIndex(x => norm(x.name) === fieldKey), existing = existingIndex >= 0 ? record.data.fields[existingIndex] : {};
      const area = number(row.area), plants = number(row.plants), rowSpacing = number(row.rowSpacing), plantSpacing = number(row.plantSpacing);
      if (filled(row.area) && (!Number.isFinite(area) || area < 0)) { errors.push({ status: 'error', label: `Talhoes • linha ${row._line}: área inválida.` }); return; }
      const fieldData = mergeNonBlank(existing, {
        name: field,
        area: Number.isFinite(area) ? area : '',
        plants: Number.isFinite(plants) ? plants : '',
        rowSpacing: Number.isFinite(rowSpacing) ? rowSpacing : '',
        plantSpacing: Number.isFinite(plantSpacing) ? plantSpacing : '',
        culture: String(row.culture || '').trim(), notes: String(row.notes || '').trim(),
      });
      if (existingIndex >= 0) record.data.fields[existingIndex] = fieldData; else record.data.fields.push(fieldData);
      record.data.fields.sort(fieldCompare); records.set(key, record);
      details.push({ status: existingIndex >= 0 ? (same(existing, fieldData) ? 'same' : 'update') : 'new', label: `${farm} • Talhão ${field}` });
    });

    const operations = [];
    records.forEach(record => {
      record.data.fields = (record.data.fields || []).sort(fieldCompare);
      const before = record.old ? { producer: record.old.producer || record.old.proprietor || '', farm: record.old.farm, cpf: record.old.cpf || '', address: record.old.address || '', fields: (record.old.fields || []).sort(fieldCompare) } : null;
      const after = { producer: record.data.producer || '', farm: record.data.farm, cpf: record.data.cpf || '', address: record.data.address || '', fields: record.data.fields || [] };
      const status = !before ? 'new' : same(before, after) ? 'same' : 'update';
      operations.push({ status, label: `${after.producer} • ${after.farm}`, data: after });
    });
    return { operations, items: [...operations.map(x => ({ status: x.status, label: `Propriedade • ${x.label}` })), ...details, ...errors], errors };
  }

  async function prepareProducts(book) {
    const sheet = Object.entries(book).find(([name]) => norm(name) === 'produtos')?.[1] || [];
    const table = tableFromSheet(sheet, [['name'], ['category'], ['dose'], ['unit']]);
    if (table.error) return { operations: [], items: [{ status: 'error', label: `Aba Produtos: ${table.error}` }], errors: [{}] };
    const registry = await DoCampoRegistry.all(), current = Object.entries(registry.products || {}).flatMap(([category, list]) => (list || []).map(p => ({ ...p, category })));
    const byName = new Map(current.map(p => [norm(p.name), p])), operations = [], items = [], errors = [];
    table.rows.filter(x => !isExample(x)).forEach(row => {
      const name = String(row.name || '').trim(), category = String(row.category || '').trim(), unit = String(row.unit || '').trim(), dose = number(row.dose);
      if (!name || !category || !unit || !Number.isFinite(dose) || dose <= 0) { const error = { status: 'error', label: `Produtos • linha ${row._line}: nome, categoria, dose maior que zero e unidade são obrigatórios.` }; errors.push(error); items.push(error); return; }
      const old = byName.get(norm(name));
      if (old && filled(old.manufacturer) && filled(row.manufacturer) && norm(old.manufacturer) !== norm(row.manufacturer)) { const error = { status: 'error', label: `${name}: já existe com fabricante “${old.manufacturer}”; a planilha informou “${row.manufacturer}”.` }; errors.push(error); items.push(error); return; }
      const data = mergeNonBlank(old || {}, {
        name, category, dose, unit,
        manufacturer: String(row.manufacturer || '').trim(), formulation: String(row.formulation || '').trim(), active: String(row.active || '').trim(),
        target: String(row.target || '').trim(), grace: String(row.grace || '').trim(), toxicology: String(row.toxicology || '').trim(),
        mixOrder: String(row.mixOrder || '').trim(), notes: String(row.notes || '').trim(), verified: false, localStatus: 'Cadastro importado — conferir', importSource: 'XLSX',
      });
      const comparable = value => { const x = { ...value }; delete x.id; delete x.type; delete x.revision; delete x.createdAt; delete x.updatedAt; delete x.updatedBy; delete x.deviceId; delete x.deletedAt; return x; };
      const status = !old ? 'new' : same(comparable(old), comparable(data)) ? 'same' : 'update';
      operations.push({ status, label: `${name} • ${category}`, data }); items.push({ status, label: `${name} • ${category}` });
    });
    return { operations, items, errors };
  }

  function ensureModal() {
    if (document.getElementById('bulkImportModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="bulkImportModal" class="modal hidden"><div class="modalbox import-modal"><div class="modalhead"><div><h2>Importar planilha</h2><p id="bulkFileName" class="meta"></p></div><button id="bulkClose" class="close">×</button></div><div id="bulkSummary" class="import-summary"></div><div class="notice">A importação não exclui cadastros e células vazias não apagam informações existentes. Confira as atualizações antes de confirmar.</div><div id="bulkPreview" class="import-preview"></div><div class="actions import-actions"><button id="bulkCancel" class="secondary">Cancelar</button><button id="bulkConfirm" class="primary">Confirmar importação</button></div></div></div>`);
  }

  function statusLabel(status) { return ({ new: 'Novo', update: 'Atualizar', same: 'Sem alteração', error: 'Erro' })[status] || status; }
  function renderPreview(prepared) {
    const counts = prepared.items.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    document.getElementById('bulkSummary').innerHTML = ['new', 'update', 'same', 'error'].map(status => `<div class="import-count ${status}"><b>${counts[status] || 0}</b><span>${statusLabel(status)}</span></div>`).join('');
    document.getElementById('bulkPreview').innerHTML = prepared.items.length ? prepared.items.map(x => `<div class="import-line"><span class="import-badge ${x.status}">${statusLabel(x.status)}</span><span>${esc(x.label)}</span></div>`).join('') : '<div class="empty">Nenhum registro preenchido foi encontrado.</div>';
    const actionable = prepared.operations.filter(x => x.status === 'new' || x.status === 'update').length;
    const confirm = document.getElementById('bulkConfirm'); confirm.disabled = !actionable; confirm.textContent = actionable ? `Importar ${actionable} registro(s)` : 'Nada para importar';
  }

  function saveHistory(kind, fileName, prepared) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) {}
    const counts = prepared.items.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    history.unshift({ id: `imp-${Date.now()}`, kind, fileName, counts, importedAt: new Date().toISOString(), user: window.DoCampoDB?.user?.() || '' });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  }

  function init(options) {
    ensureModal();
    const kind = options.kind, button = document.getElementById(options.buttonId), input = document.getElementById(options.inputId);
    if (!button || !input) return;
    let prepared = null, fileName = '';
    button.onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files?.[0]; input.value = ''; if (!file) return;
      fileName = file.name;
      if (!/\.xlsx$/i.test(file.name)) return alert('Selecione o modelo no formato XLSX.');
      button.disabled = true; button.textContent = 'Lendo planilha...';
      try {
        const book = await readWorkbook(file);
        prepared = kind === 'clients' ? await prepareClients(book) : await prepareProducts(book);
        document.getElementById('bulkFileName').textContent = file.name; renderPreview(prepared);
        document.getElementById('bulkImportModal').classList.remove('hidden');
      } catch (error) { console.error(error); alert(`Não foi possível ler a planilha: ${error.message}`); }
      finally { button.disabled = false; button.textContent = '↑ Importar planilha'; }
    };
    const close = () => document.getElementById('bulkImportModal').classList.add('hidden');
    document.getElementById('bulkClose').onclick = document.getElementById('bulkCancel').onclick = close;
    document.getElementById('bulkConfirm').onclick = async () => {
      if (!prepared) return;
      const actionable = prepared.operations.filter(x => x.status === 'new' || x.status === 'update');
      if (!actionable.length) return;
      const confirm = document.getElementById('bulkConfirm'); confirm.disabled = true; confirm.textContent = 'Importando...';
      try {
        if (kind === 'clients') actionable.forEach(op => DoCampoData.mergeFarm(op.data));
        else actionable.forEach(op => DoCampoData.mergeProduct(op.data.category, op.data));
        saveHistory(kind, fileName, prepared); close(); await options.onComplete?.();
        alert(`${actionable.length} registro(s) importado(s). Os dados já estão disponíveis offline e aguardam a sincronização normal.`);
      } catch (error) { console.error(error); alert(`Falha durante a importação: ${error.message}`); }
      finally { confirm.disabled = false; }
    };
  }

  window.DoCampoBulkImport = { init, modelUrl: MODEL, readWorkbook };
  window.addEventListener('DOMContentLoaded', () => {
    const importBar = document.querySelector('.importbar'), toolbar = document.querySelector('.toolbar');
    if (importBar && toolbar) toolbar.insertAdjacentElement('afterend', importBar);
    const page = location.pathname.split('/').pop();
    if (page === 'clientes.html') init({ kind: 'clients', buttonId: 'importBulk', inputId: 'importFile', onComplete: () => location.reload() });
    if (page === 'produtos.html') init({ kind: 'products', buttonId: 'importBulk', inputId: 'importFile', onComplete: () => location.reload() });
  });
})();
