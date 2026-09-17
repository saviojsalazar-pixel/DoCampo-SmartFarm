(function () {
    'use strict';
    const KEY = 'docampo_shared_v1';
    const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
    const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // "1" e "1." representam o mesmo talhão. A pontuação interna de nomes
    // como "1.1 Lavoura" continua preservada.
    const fieldKey = value => key(value).replace(/[.\-–—,:;]+\s*$/, '').trim();
    const fieldCompare = (a, b) => clean(a && a.name || '').localeCompare(clean(b && b.name || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
    function normalizeField(field) {
        const source = typeof field === 'object' && field ? field : { name: field };
        return { ...source, name: clean(source.name || source.talhao), area: Number(source.area) || 0, plants: Number(source.plants) || 0, rowSpacing: Number(source.rowSpacing) || 0, plantSpacing: Number(source.plantSpacing) || 0, culture: clean(source.culture), notes: clean(source.notes) };
    }
    function mergeFieldValues(previous, incoming) {
        return { ...(previous || {}), ...incoming, name: clean(incoming.name || previous?.name), area: Number(incoming.area) || Number(previous?.area) || 0, plants: Number(incoming.plants) || Number(previous?.plants) || 0, rowSpacing: Number(incoming.rowSpacing) || Number(previous?.rowSpacing) || 0, plantSpacing: Number(incoming.plantSpacing) || Number(previous?.plantSpacing) || 0 };
    }
    function normalizeFields(fields) {
        const result = new Map();
        (Array.isArray(fields) ? fields : []).map(normalizeField).filter(field => field.name).forEach(field => {
            const id = fieldKey(field.name);
            result.set(id, mergeFieldValues(result.get(id), field));
        });
        return Array.from(result.values()).sort(fieldCompare);
    }
    function read() {
        try {
            const value = JSON.parse(localStorage.getItem(KEY) || '{}');
            return { farms: Array.isArray(value.farms) ? value.farms : [], products: value.products && typeof value.products === 'object' ? value.products : {}, updatedAt: value.updatedAt || null };
        } catch (_) { return { farms: [], products: {}, updatedAt: null }; }
    }
    function write(data) {
        data.updatedAt = new Date().toISOString();
        localStorage.setItem(KEY, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('docampo:data-updated', { detail: data }));
        return data;
    }
    function mergeFarm(farm) {
        if (!farm || !String(farm.farm || '').trim()) return read();
        const data = read(), name = clean(farm.farm);
        const normalized = { farm: name, producer: clean(farm.producer || farm.proprietor), cpf: clean(farm.cpf), address: clean(farm.address), notes: clean(farm.notes), fields: normalizeFields(farm.fields), importBatchId: clean(farm.importBatchId), importSource: clean(farm.importSource) };
        const idx = data.farms.findIndex(item => key(item.farm) === key(name));
        if (idx >= 0) data.farms[idx] = Object.assign({}, data.farms[idx], normalized); else data.farms.unshift(normalized);
        try {
            const custom = JSON.parse(localStorage.getItem('agri_custom_farms') || '[]');
            const ci = custom.findIndex(item => key(item.farm) === key(name));
            if (ci >= 0) custom[ci] = normalized; else custom.unshift(normalized);
            localStorage.setItem('agri_custom_farms', JSON.stringify(custom));
            const deleted = JSON.parse(localStorage.getItem('agri_deleted_farms') || '[]').filter(item => String(item).toLowerCase() !== name.toLowerCase());
            localStorage.setItem('agri_deleted_farms', JSON.stringify(deleted));
        } catch (_) {}
        const result = write(data);
        if (window.DoCampoDB) {
            const existing = window.DoCampoDB.list('farms').find(f => key(f.name) === key(normalized.farm));
            const farmRecord = window.DoCampoDB.upsert('farms', { id: existing && existing.id, name: normalized.farm, producerName: normalized.producer, cpf: normalized.cpf, address: normalized.address, notes: normalized.notes, fieldsSnapshot: normalized.fields, verified: true });
            const incoming = new Set(normalized.fields.map(field => fieldKey(field.name)));
            // A edição/importação é uma substituição autoritativa: o que não
            // veio na lista nova deve permanecer excluído e não pode reaparecer.
            window.DoCampoDB.list('fields').filter(item => item.farmId === farmRecord.id).forEach(item => {
                if (!incoming.has(fieldKey(item.name))) window.DoCampoDB.softDelete('fields', item.id, { importBatchId: normalized.importBatchId, importSource: normalized.importSource });
            });
            normalized.fields.forEach(field => {
                const matches = window.DoCampoDB.list('fields').filter(item => item.farmId === farmRecord.id && fieldKey(item.name) === fieldKey(field.name));
                const oldField = matches[0];
                window.DoCampoDB.upsert('fields', { ...field, id: oldField && oldField.id, farmId: farmRecord.id, verified: true, importBatchId: normalized.importBatchId, importSource: normalized.importSource });
                matches.slice(1).forEach(item => window.DoCampoDB.softDelete('fields', item.id));
            });
        }
        return result;
    }
    function removeFarm(name) { const data = read(); data.farms = data.farms.filter(item => key(item.farm) !== key(name)); try{const deleted=JSON.parse(localStorage.getItem('agri_deleted_farms')||'[]');if(!deleted.some(x=>key(x)===key(name)))deleted.push(name);localStorage.setItem('agri_deleted_farms',JSON.stringify(deleted))}catch(_){} const result=write(data); if(window.DoCampoDB){const item=window.DoCampoDB.list('farms').find(f=>key(f.name)===key(name));if(item){window.DoCampoDB.list('fields').filter(field=>field.farmId===item.id).forEach(field=>window.DoCampoDB.softDelete('fields',field.id));window.DoCampoDB.softDelete('farms',item.id)}} return result; }
    function mergeProduct(category, product) {
        if (!category || !product || !product.name) return read();
        const data = read(); if (!Array.isArray(data.products[category])) data.products[category] = [];
        const idx = data.products[category].findIndex(item => key(item.name) === key(product.name));
        if (idx >= 0) data.products[category][idx] = product; else data.products[category].push(product);
        try{const custom=JSON.parse(localStorage.getItem('agri_custom_products')||'{}');custom[category]||(custom[category]=[]);const ci=custom[category].findIndex(x=>String(x.name).toLowerCase()===String(product.name).toLowerCase());if(ci>=0)custom[category][ci]=product;else custom[category].push(product);localStorage.setItem('agri_custom_products',JSON.stringify(custom));const deleted=JSON.parse(localStorage.getItem('agri_deleted_products')||'{}');if(deleted[category])deleted[category]=deleted[category].filter(x=>String(x).toLowerCase()!==String(product.name).toLowerCase());localStorage.setItem('agri_deleted_products',JSON.stringify(deleted))}catch(_){}
        const result = write(data);
        if (window.DoCampoDB) {
            const matches = window.DoCampoDB.list('products').filter(p => key(p.name) === key(product.name) && key(p.category) === key(category));
            const existing = matches[0];
            window.DoCampoDB.upsert('products', Object.assign({}, product, { id: existing && existing.id, category, verified: product.verified === true }));
            matches.slice(1).forEach(item => window.DoCampoDB.softDelete('products', item.id));
        }
        return result;
    }
    function removeProduct(category,name){const data=read();if(Array.isArray(data.products[category]))data.products[category]=data.products[category].filter(p=>key(p.name)!==key(name));try{const deleted=JSON.parse(localStorage.getItem('agri_deleted_products')||'{}');deleted[category]||(deleted[category]=[]);if(!deleted[category].some(x=>key(x)===key(name)))deleted[category].push(key(name));localStorage.setItem('agri_deleted_products',JSON.stringify(deleted))}catch(_){}const result=write(data);if(window.DoCampoDB)window.DoCampoDB.list('products').filter(p=>key(p.name)===key(name)&&key(p.category)===key(category)).forEach(item=>window.DoCampoDB.softDelete('products',item.id));return result}
    function restoreFarm(id){if(!window.DoCampoDB)return false;const item=window.DoCampoDB.get('farms',id);if(!item)return false;window.DoCampoDB.restore('farms',id);mergeFarm({farm:item.name,producer:item.producerName,cpf:item.cpf,address:item.address,fields:item.fieldsSnapshot||[]});return true}
    function restoreProduct(id){if(!window.DoCampoDB)return false;const item=window.DoCampoDB.get('products',id);if(!item)return false;window.DoCampoDB.restore('products',id);mergeProduct(item.category,item);return true}
    function repairDuplicates(force) {
        const migrationKey = 'docampo_data_repair_v2';
        if (!force && localStorage.getItem(migrationKey) === 'done') return { repaired: false };
        const data = read(), farmMap = new Map();
        data.farms.forEach(farm => {
            if (!farm || !clean(farm.farm)) return;
            const k = key(farm.farm), old = farmMap.get(k);
            if (!old) farmMap.set(k, { ...farm, farm: clean(farm.farm), fields: normalizeFields(farm.fields) });
            else farmMap.set(k, { ...old, ...farm, farm: clean(farm.farm), producer: clean(farm.producer || old.producer), cpf: clean(farm.cpf || old.cpf), address: clean(farm.address || old.address), fields: normalizeFields([...(old.fields || []), ...(farm.fields || [])]) });
        });
        data.farms = Array.from(farmMap.values());
        write(data);
        if (window.DoCampoDB) {
            window.DoCampoDB.list('farms').forEach(farm => {
                const fields = window.DoCampoDB.list('fields').filter(field => field.farmId === farm.id);
                const groups = new Map();
                fields.forEach(field => { const k = fieldKey(field.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(field); });
                groups.forEach(matches => {
                    if (matches.length < 2) return;
                    const keep = matches.slice().sort((a,b)=>(Number(b.area)||0)-(Number(a.area)||0)||(Number(b.plants)||0)-(Number(a.plants)||0)||String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
                    const merged = matches.reduce((acc,item)=>mergeFieldValues(acc,item),keep);
                    window.DoCampoDB.upsert('fields',{...merged,id:keep.id,farmId:farm.id,verified:true});
                    matches.filter(item=>item.id!==keep.id).forEach(item=>window.DoCampoDB.softDelete('fields',item.id));
                });
            });
        }
        localStorage.setItem(migrationKey, 'done');
        return { repaired: true };
    }
    window.DoCampoData = { read, mergeFarm, removeFarm, mergeProduct, removeProduct, restoreFarm, restoreProduct, normalizeFields, fieldKey, key, repairDuplicates };
    repairDuplicates();
    if(window.addEventListener)window.addEventListener('docampo:sync-complete',()=>repairDuplicates(true));
})();
