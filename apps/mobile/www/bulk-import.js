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

  async function zipEntries(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(view, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('O modelo XLSX está inválido.');
    const count = u16(view, eocd + 10), centralOffset = u32(view, eocd + 16), result = new Map(); let cursor = centralOffset;
    for (let i = 0; i < count; i++) {
      const method = u16(view, cursor + 10), compressedSize = u32(view, cursor + 20), nameLength = u16(view, cursor + 28), extraLength = u16(view, cursor + 30), commentLength = u16(view, cursor + 32), localOffset = u32(view, cursor + 42);
      const name = textDecoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)), localNameLength = u16(view, localOffset + 26), localExtraLength = u16(view, localOffset + 28), start = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.slice(start, start + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8 && typeof DecompressionStream !== 'undefined') data = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw new Error('Este aparelho não conseguiu preparar a planilha preenchida.');
      result.set(name, data); cursor += 46 + nameLength + extraLength + commentLength;
    }
    return result;
  }

  let crcTable;
  function crc32(bytes) {
    if (!crcTable) crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    let crc = 0xffffffff; bytes.forEach(byte => { crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); }); return (crc ^ 0xffffffff) >>> 0;
  }
  function joinBytes(parts) { const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let offset = 0; parts.forEach(part => { out.set(part, offset); offset += part.length; }); return out; }
  function makeZip(entries) {
    const encoder = new TextEncoder(), local = [], central = []; let offset = 0;
    const put16 = (view, at, value) => view.setUint16(at, value, true), put32 = (view, at, value) => view.setUint32(at, value >>> 0, true);
    entries.forEach((data, name) => {
      const nameBytes = encoder.encode(name), crc = crc32(data), header = new Uint8Array(30), hv = new DataView(header.buffer);
      put32(hv, 0, 0x04034b50); put16(hv, 4, 20); put16(hv, 6, 0x0800); put32(hv, 14, crc); put32(hv, 18, data.length); put32(hv, 22, data.length); put16(hv, 26, nameBytes.length);
      local.push(header, nameBytes, data);
      const ch = new Uint8Array(46), cv = new DataView(ch.buffer);
      put32(cv, 0, 0x02014b50); put16(cv, 4, 20); put16(cv, 6, 20); put16(cv, 8, 0x0800); put32(cv, 16, crc); put32(cv, 20, data.length); put32(cv, 24, data.length); put16(cv, 28, nameBytes.length); put32(cv, 42, offset);
      central.push(ch, nameBytes); offset += header.length + nameBytes.length + data.length;
    });
    const centralBytes = joinBytes(central), end = new Uint8Array(22), ev = new DataView(end.buffer);
    put32(ev, 0, 0x06054b50); put16(ev, 8, entries.size); put16(ev, 10, entries.size); put32(ev, 12, centralBytes.length); put32(ev, 16, offset);
    return new Blob([...local, centralBytes, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  const xmlEsc = value => String(value ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function populatedRow(rowNumber, values, styles) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cells = values.map((value, index) => { const ref = letters[index] + rowNumber, style = styles[index] || styles[0] || 31; return typeof value === 'number' && Number.isFinite(value) ? `<x:c r="${ref}" s="${style}" t="n"><x:v>${value}</x:v></x:c>` : `<x:c r="${ref}" s="${style}" t="inlineStr"><x:is><x:t>${xmlEsc(value)}</x:t></x:is></x:c>`; }).join('');
    return `<x:row r="${rowNumber}" ht="22" customHeight="1">${cells}</x:row>`;
  }
  function fillRows(source, rows, styles, maximum) {
    if (rows.length > maximum) throw new Error(`A planilha comporta até ${maximum} registros nesta aba.`);
    const fixed = [...source.matchAll(/<x:row\b[\s\S]*?<\/x:row>/g)].filter(match => Number(match[0].match(/\br="(\d+)"/)?.[1]) <= 4).map(match => match[0]).join('');
    const safeRows = rows.length ? rows : [Array(styles.length).fill('')], count = safeRows.length;
    const dataRows = safeRows.map((row, index) => populatedRow(index + 5, row, styles)).join(''), blankRows = Array.from({ length: Math.max(0, maximum - count) }, (_, index) => populatedRow(index + 5 + count, Array(styles.length).fill(''), styles)).join('');
    return source.replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/, `<x:sheetData>${fixed}${dataRows}${blankRows}</x:sheetData>`);
  }
  async function populatedModel(templateBuffer, farms, products) {
    const entries = await zipEntries(templateBuffer), encoder = new TextEncoder();
    const ordered = (farms || []).slice().sort((a, b) => `${a.producer || a.proprietor || ''}\u0000${a.farm || ''}`.localeCompare(`${b.producer || b.proprietor || ''}\u0000${b.farm || ''}`, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    const properties = ordered.map(farm => [farm.producer || farm.proprietor || '', farm.cpf || '', farm.farm || '', '', farm.address || '', farm.notes || '']);
    const fields = ordered.flatMap(farm => (farm.fields || []).slice().sort(fieldCompare).map(field => [farm.producer || farm.proprietor || '', farm.farm || '', field.name || '', Number(field.area) || 0, Number(field.plants) || 0, Number(field.rowSpacing) || 0, Number(field.plantSpacing) || 0, field.culture || 'Café', field.notes || '']));
    const productRows = Object.entries(products || {}).flatMap(([category, list]) => (list || []).map(product => ({ ...product, category: product.category || category }))).sort((a, b) => `${a.category}\u0000${a.name || ''}`.localeCompare(`${b.category}\u0000${b.name || ''}`, 'pt-BR', { numeric: true, sensitivity: 'base' })).map(product => [product.name || '', product.manufacturer || '', product.category || '', product.formulation || '', product.active || '', Number(product.dose) || 0, product.unit || '', product.target || '', product.grace || '', product.toxicology || '', product.mixOrder || product.formulation || '', product.notes || '']);
    const propertyPath = 'xl/worksheets/sheet2.xml', fieldPath = 'xl/worksheets/sheet3.xml', productPath = 'xl/worksheets/sheet4.xml';
    entries.set(propertyPath, encoder.encode(fillRows(textDecoder.decode(entries.get(propertyPath)), properties, [31, 34, 31, 31, 31, 31], 200)));
    entries.set(fieldPath, encoder.encode(fillRows(textDecoder.decode(entries.get(fieldPath)), fields, [30, 30, 30, 37, 40, 37, 37, 30, 30], 400)));
    entries.set(productPath, encoder.encode(fillRows(textDecoder.decode(entries.get(productPath)), productRows, [30, 30, 30, 30, 30, 43, 30, 30, 30, 30, 30, 30], 500)));
    return makeZip(entries);
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
    field: ['talhao', 'nome do talhao'], area: ['area ha', 'area'], plants: ['quantidade de pes de cafe', 'pes de cafe', 'n de plantas', 'numero de plantas', 'plantas'],
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

  function bestFields(items) {
    return (items || []).reduce((out, item) => {
      const next = { ...out, ...item };
      ['area','plants','rowSpacing','plantSpacing'].forEach(k => next[k] = Number(item?.[k]) > 0 ? Number(item[k]) : Number(out?.[k]) || 0);
      next.name = String(item?.name || out?.name || '').trim(); return next;
    }, {});
  }

  async function prepareClients(book) {
    const registry=await DoCampoRegistry.all(),current=registry.farms||[],byFarm=new Map(current.map(f=>[norm(f.farm),f]));
    const props=tableFromSheet(Object.entries(book).find(([n])=>norm(n)==='propriedades')?.[1]||[],[['producer'],['farm']]);
    const fields=tableFromSheet(Object.entries(book).find(([n])=>norm(n)==='talhoes')?.[1]||[],[['producer'],['farm'],['field']]);
    const errors=[],records=new Map(),decisions=[],details=[];
    if(props.error)errors.push({status:'error',label:`Aba Propriedades: ${props.error}`});
    if(fields.error)errors.push({status:'error',label:`Aba Talhoes: ${fields.error}`});
    props.rows.filter(x=>!isExample(x)).forEach(row=>{
      const producer=String(row.producer||'').trim(),farm=String(row.farm||'').trim(),k=norm(farm),old=byFarm.get(k);
      if(!producer||!farm){errors.push({status:'error',label:`Propriedades • linha ${row._line}: produtor e propriedade são obrigatórios.`});return}
      if(old?.producer&&norm(old.producer)!==norm(producer)){errors.push({status:'error',label:`${farm}: produtor atual “${old.producer}” difere de “${producer}”.`});return}
      records.set(k,{old,rows:[],data:mergeNonBlank({producer:old?.producer||'',farm,cpf:old?.cpf||'',address:old?.address||'',fields:[]},{producer,farm,cpf:String(row.cpf||'').trim(),address:[row.address,row.city].filter(filled).join(' • '),notes:String(row.notes||'').trim()})});
    });
    fields.rows.filter(x=>!isExample(x)).forEach(row=>{
      const producer=String(row.producer||'').trim(),farm=String(row.farm||'').trim(),name=String(row.field||'').trim(),fk=norm(farm),record=records.get(fk);
      if(!producer||!farm||!name){errors.push({status:'error',label:`Talhoes • linha ${row._line}: produtor, propriedade e talhão são obrigatórios.`});return}
      if(!record){errors.push({status:'error',label:`Talhoes • linha ${row._line}: “${farm}” precisa constar na aba Propriedades.`});return}
      if(norm(record.data.producer)!==norm(producer)){errors.push({status:'error',label:`Talhoes • linha ${row._line}: produtor não corresponde a “${farm}”.`});return}
      const area=number(row.area);if(filled(row.area)&&(!Number.isFinite(area)||area<0)){errors.push({status:'error',label:`Talhoes • linha ${row._line}: área inválida.`});return}
      const current=(record.old?.fields||[]).find(x=>norm(x.name)===norm(name))||{};
      record.rows.push({line:row._line,key:norm(name),data:mergeNonBlank(current,{name,area:Number.isFinite(area)?area:'',plants:Number.isFinite(number(row.plants))?number(row.plants):'',rowSpacing:Number.isFinite(number(row.rowSpacing))?number(row.rowSpacing):'',plantSpacing:Number.isFinite(number(row.plantSpacing))?number(row.plantSpacing):'',culture:String(row.culture||'').trim(),notes:String(row.notes||'').trim()})});
    });
    const operations=[];
    records.forEach((record,farmKey)=>{
      const groups=new Map();record.rows.forEach(r=>{if(!groups.has(r.key))groups.set(r.key,[]);groups.get(r.key).push(r)});
      const accepted=[];
      groups.forEach((group,fieldKey)=>{
        const old=(record.old?.fields||[]).filter(x=>norm(x.name)===fieldKey);
        if(group.length>1){decisions.push({id:`d${decisions.length}`,farmKey,type:'duplicate',label:`${record.data.farm} • duplicidade: ${group.map(x=>`${x.data.name} (${Number(x.data.area)||0} ha)`).join(' / ')}`,group,old,options:[{value:'merge',label:'Unificar e manter os dados mais completos'},...group.map((x,i)=>({value:`row${i}`,label:`Usar linha ${x.line}: ${x.data.name} — ${Number(x.data.area)||0} ha`})),...(old.length?[{value:'current',label:'Manter o cadastro atual'}]:[]),{value:'exclude',label:'Não importar este talhão'}]});return}
        if(old.length>1){decisions.push({id:`d${decisions.length}`,farmKey,type:'currentDuplicate',label:`${record.data.farm} • duplicidade no cadastro atual: ${old.map(x=>`${x.name} (${Number(x.area)||0} ha)`).join(' / ')} • planilha: ${group[0].data.name} (${Number(group[0].data.area)||0} ha)`,group,old,options:[{value:'sheet',label:'Usar somente o talhão da planilha'},{value:'merge',label:'Unificar e manter os dados mais completos'},{value:'current',label:'Manter somente o cadastro atual mais completo'}]});return}
        if(Number(group[0].data.area)===0){decisions.push({id:`d${decisions.length}`,farmKey,type:'zero',label:`${record.data.farm} • ${group[0].data.name} possui área 0 ha`,group,old,options:[{value:'zero',label:'Manter área zero'},...(old.some(x=>Number(x.area)>0)?[{value:'current',label:`Usar área atual: ${Number(old.find(x=>Number(x.area)>0).area)} ha`}]:[]),{value:'exclude',label:'Não manter este talhão'}]});return}
        accepted.push(group[0].data);details.push({status:old.length?'update':'new',label:`${record.data.farm} • Talhão ${group[0].data.name}`});
      });
      const incoming=new Set(groups.keys()),oldGroups=new Map();(record.old?.fields||[]).forEach(x=>{const k=norm(x.name);if(!oldGroups.has(k))oldGroups.set(k,[]);oldGroups.get(k).push(x)});
      oldGroups.forEach((old,fieldKey)=>{if(!incoming.has(fieldKey))decisions.push({id:`d${decisions.length}`,farmKey,type:'missing',label:`${record.data.farm} • ${bestFields(old).name} — ${Number(bestFields(old).area)||0} ha não consta na planilha`,group:[],old,options:[{value:'delete',label:'Enviar para a lixeira'},{value:'keep',label:'Manter no cadastro'}]})});
      record.accepted=accepted;record.data.fields=accepted.slice().sort(fieldCompare);
      operations.push({status:record.old?'update':'new',label:`${record.data.producer} • ${record.data.farm}`,data:record.data,farmKey,record});
    });
    return{kind:'clients',operations,decisions,items:[...operations.map(x=>({status:x.status,label:`Propriedade • ${x.label}`})),...details,...decisions.map(decision=>({status:'decision',label:decision.label,decision})),...errors],errors};
  }

  function applyClientDecisions(prepared){
    const choices=new Map();document.querySelectorAll('[data-import-decision]').forEach(x=>choices.set(x.dataset.importDecision,x.value));prepared.resolutions=[];
    prepared.operations.forEach(op=>{const fields=(op.record.accepted||[]).map(x=>({...x}));prepared.decisions.filter(d=>d.farmKey===op.farmKey).forEach(d=>{const c=choices.get(d.id);prepared.resolutions.push({type:d.type,label:d.label,choice:c});let value=null;if(d.type==='missing'){if(c==='keep')value=bestFields(d.old)}else if(d.type==='zero'){if(c==='zero')value={...d.group[0].data,area:0};if(c==='current')value=bestFields(d.old)}else if(d.type==='duplicate'){if(c==='merge')value=bestFields([...d.old,...d.group.map(x=>x.data)]);if(c==='current')value=bestFields(d.old);if(/^row\d+$/.test(c))value=d.group[Number(c.slice(3))].data}else if(d.type==='currentDuplicate'){if(c==='sheet')value=d.group[0].data;if(c==='merge')value=bestFields([...d.old,d.group[0].data]);if(c==='current')value=bestFields(d.old)}if(value)fields.push(value)});op.data={...op.data,fields:fields.sort(fieldCompare)};op.status=op.record.old?'update':'new'});return prepared.operations.filter(x=>x.status==='new'||x.status==='update')}

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
    document.body.insertAdjacentHTML('beforeend', `<div id="bulkImportModal" class="modal hidden"><div class="modalbox import-modal"><div class="modalhead"><div><h2>Revisar importação oficial</h2><p id="bulkFileName" class="meta"></p></div><button id="bulkClose" class="close">×</button></div><div id="bulkSummary" class="import-summary"></div><div class="notice">A planilha será a fonte oficial somente das propriedades presentes nela. Resolva todas as decisões antes de confirmar. Talhões removidos irão para a lixeira.</div><div id="bulkPreview" class="import-preview"></div><div class="actions import-actions"><button id="bulkCancel" class="secondary">Cancelar</button><button id="bulkConfirm" class="primary">Confirmar alterações revisadas</button></div></div></div>`);
  }

  function statusLabel(status) { return ({ new: 'Novo', update: 'Atualizar', same: 'Sem alteração', error: 'Erro', decision: 'Decidir' })[status] || status; }
  function renderPreview(prepared) {
    const counts = prepared.items.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    document.getElementById('bulkSummary').innerHTML = ['new', 'update', 'same', 'decision', 'error'].map(status => `<div class="import-count ${status}"><b>${counts[status] || 0}</b><span>${statusLabel(status)}</span></div>`).join('');
    document.getElementById('bulkPreview').innerHTML = prepared.items.length ? prepared.items.map(x => x.decision ? `<div class="import-line decision-line"><span class="import-badge decision">Decidir</span><div class="decision-body"><b>${esc(x.label)}</b><select data-import-decision="${esc(x.decision.id)}"><option value="">Escolha o que fazer</option>${x.decision.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div></div>` : `<div class="import-line"><span class="import-badge ${x.status}">${statusLabel(x.status)}</span><span>${esc(x.label)}</span></div>`).join('') : '<div class="empty">Nenhum registro preenchido foi encontrado.</div>';
    const actionable = prepared.operations.filter(x => x.status === 'new' || x.status === 'update').length;
    const confirm = document.getElementById('bulkConfirm');
    const refresh=()=>{const pending=[...document.querySelectorAll('[data-import-decision]')].filter(x=>!x.value).length;confirm.disabled=!!prepared.errors.length||!!pending||(!actionable&&!prepared.decisions?.length);confirm.textContent=pending?`Faltam ${pending} decisão(ões)`:'Confirmar alterações revisadas'};
    document.querySelectorAll('[data-import-decision]').forEach(x=>x.onchange=refresh);refresh();
  }

  function saveHistory(kind, fileName, prepared) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) {}
    const counts = prepared.items.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    history.unshift({ id: prepared.importBatchId || `imp-${Date.now()}`, kind, fileName, counts, resolutions: prepared.resolutions || [], importedAt: new Date().toISOString(), user: window.DoCampoDB?.user?.() || '' });
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
      const actionable = kind === 'clients' ? applyClientDecisions(prepared) : prepared.operations.filter(x => x.status === 'new' || x.status === 'update');
      if (!actionable.length) return;
      const confirm = document.getElementById('bulkConfirm'); confirm.disabled = true; confirm.textContent = 'Importando...';
      try {
        prepared.importBatchId=`imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        if (kind === 'clients') actionable.forEach(op => DoCampoData.mergeFarm({...op.data,importBatchId:prepared.importBatchId,importSource:fileName}));
        else actionable.forEach(op => DoCampoData.mergeProduct(op.data.category, op.data));
        saveHistory(kind, fileName, prepared); close(); await options.onComplete?.();
        alert(`${actionable.length} registro(s) importado(s). Os dados já estão disponíveis offline e aguardam a sincronização normal.`);
      } catch (error) { console.error(error); alert(`Falha durante a importação: ${error.message}`); }
      finally { confirm.disabled = false; }
    };
  }

  async function downloadModel() {
    const button = document.getElementById('downloadModel');
    if (button) { button.disabled = true; button.textContent = 'Preparando modelo...'; }
    try {
      const response = await fetch(MODEL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`arquivo indisponível (${response.status})`);
      const registry = await DoCampoRegistry.all();
      const blob = await populatedModel(await response.arrayBuffer(), registry.farms || [], registry.products || {});
      const filename = `Cadastros_DoCampo_SmartFarm_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const plugins = window.Capacitor?.Plugins;
      if (plugins?.Filesystem && plugins?.Share) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const saved = await plugins.Filesystem.writeFile({ path: filename, data: btoa(binary), directory: 'CACHE', recursive: true });
        await plugins.Share.share({ title: 'Cadastros Do Campo SmartFarm', text: 'Planilha preenchida para atualizar produtores, propriedades e talhões.', url: saved.uri, dialogTitle: 'Salvar ou enviar planilha de atualização' });
      } else {
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (error) {
      console.error(error); alert(`Não foi possível baixar a planilha modelo: ${error.message}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = '↓ Baixar cadastros XLSX'; }
    }
  }

  window.DoCampoBulkImport = { init, modelUrl: MODEL, readWorkbook, populatedModel, prepareClients, applyClientDecisions };
  window.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadModel');
    if (downloadButton) { downloadButton.textContent = '↓ Baixar cadastros XLSX'; downloadButton.onclick = downloadModel; }
    const importFile = document.getElementById('importFile');
    if (importFile) importFile.setAttribute('accept', '*/*');
    const importBar = document.querySelector('.importbar'), toolbar = document.querySelector('.toolbar');
    if (importBar && toolbar) toolbar.insertAdjacentElement('afterend', importBar);
    const page = location.pathname.split('/').pop();
    if (page === 'clientes.html') init({ kind: 'clients', buttonId: 'importBulk', inputId: 'importFile', onComplete: () => location.reload() });
    if (page === 'produtos.html') init({ kind: 'products', buttonId: 'importBulk', inputId: 'importFile', onComplete: () => location.reload() });
  });
})();
