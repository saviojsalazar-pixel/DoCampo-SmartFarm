(function () {
    'use strict';
    const KEY = 'docampo_shared_v1';
    const fieldCompare = (a, b) => String(a && a.name || '').localeCompare(String(b && b.name || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
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
        const data = read(), name = String(farm.farm).trim();
        const normalized = { farm: name, producer: String(farm.producer || farm.proprietor || '').trim(), cpf: String(farm.cpf || '').trim(), address: String(farm.address || '').trim(), fields: Array.isArray(farm.fields) ? farm.fields.map(field => ({ name: String(field.name || field.talhao || field).trim(), area: Number(field.area) || 0 })).filter(field => field.name).sort(fieldCompare) : [] };
        const idx = data.farms.findIndex(item => String(item.farm).toLowerCase() === name.toLowerCase());
        if (idx >= 0) data.farms[idx] = Object.assign({}, data.farms[idx], normalized); else data.farms.unshift(normalized);
        try {
            const custom = JSON.parse(localStorage.getItem('agri_custom_farms') || '[]');
            const ci = custom.findIndex(item => String(item.farm).toLowerCase() === name.toLowerCase());
            if (ci >= 0) custom[ci] = normalized; else custom.unshift(normalized);
            localStorage.setItem('agri_custom_farms', JSON.stringify(custom));
            const deleted = JSON.parse(localStorage.getItem('agri_deleted_farms') || '[]').filter(item => String(item).toLowerCase() !== name.toLowerCase());
            localStorage.setItem('agri_deleted_farms', JSON.stringify(deleted));
        } catch (_) {}
        const result = write(data);
        if (window.DoCampoDB) {
            const existing = window.DoCampoDB.list('farms').find(f => String(f.name).toLowerCase() === normalized.farm.toLowerCase());
            window.DoCampoDB.upsert('farms', { id: existing && existing.id, name: normalized.farm, producerName: normalized.producer, cpf: normalized.cpf, address: normalized.address, fieldsSnapshot: normalized.fields, verified: true });
        }
        return result;
    }
    function removeFarm(name) { const data = read(); data.farms = data.farms.filter(item => String(item.farm).toLowerCase() !== String(name).toLowerCase()); try{const deleted=JSON.parse(localStorage.getItem('agri_deleted_farms')||'[]');if(!deleted.some(x=>String(x).toLowerCase()===String(name).toLowerCase()))deleted.push(name);localStorage.setItem('agri_deleted_farms',JSON.stringify(deleted))}catch(_){} const result=write(data); if(window.DoCampoDB){const item=window.DoCampoDB.list('farms').find(f=>String(f.name).toLowerCase()===String(name).toLowerCase());if(item)window.DoCampoDB.softDelete('farms',item.id)} return result; }
    function mergeProduct(category, product) {
        if (!category || !product || !product.name) return read();
        const data = read(); if (!Array.isArray(data.products[category])) data.products[category] = [];
        const idx = data.products[category].findIndex(item => item.name.toLowerCase() === product.name.toLowerCase());
        if (idx >= 0) data.products[category][idx] = product; else data.products[category].push(product);
        try{const custom=JSON.parse(localStorage.getItem('agri_custom_products')||'{}');custom[category]||(custom[category]=[]);const ci=custom[category].findIndex(x=>String(x.name).toLowerCase()===String(product.name).toLowerCase());if(ci>=0)custom[category][ci]=product;else custom[category].push(product);localStorage.setItem('agri_custom_products',JSON.stringify(custom));const deleted=JSON.parse(localStorage.getItem('agri_deleted_products')||'{}');if(deleted[category])deleted[category]=deleted[category].filter(x=>String(x).toLowerCase()!==String(product.name).toLowerCase());localStorage.setItem('agri_deleted_products',JSON.stringify(deleted))}catch(_){}
        const result = write(data);
        if (window.DoCampoDB) {
            const existing = window.DoCampoDB.list('products').find(p => String(p.name).toLowerCase() === String(product.name).toLowerCase());
            window.DoCampoDB.upsert('products', Object.assign({}, product, { id: existing && existing.id, category, verified: product.verified === true }));
        }
        return result;
    }
    function removeProduct(category,name){const data=read();if(Array.isArray(data.products[category]))data.products[category]=data.products[category].filter(p=>String(p.name).toLowerCase()!==String(name).toLowerCase());try{const deleted=JSON.parse(localStorage.getItem('agri_deleted_products')||'{}');deleted[category]||(deleted[category]=[]);if(!deleted[category].some(x=>String(x).toLowerCase()===String(name).toLowerCase()))deleted[category].push(String(name).toLowerCase());localStorage.setItem('agri_deleted_products',JSON.stringify(deleted))}catch(_){}const result=write(data);if(window.DoCampoDB){const item=window.DoCampoDB.list('products').find(p=>String(p.name).toLowerCase()===String(name).toLowerCase()&&String(p.category)===String(category));if(item)window.DoCampoDB.softDelete('products',item.id)}return result}
    function restoreFarm(id){if(!window.DoCampoDB)return false;const item=window.DoCampoDB.get('farms',id);if(!item)return false;window.DoCampoDB.restore('farms',id);mergeFarm({farm:item.name,producer:item.producerName,cpf:item.cpf,address:item.address,fields:item.fieldsSnapshot||[]});return true}
    function restoreProduct(id){if(!window.DoCampoDB)return false;const item=window.DoCampoDB.get('products',id);if(!item)return false;window.DoCampoDB.restore('products',id);mergeProduct(item.category,item);return true}
    window.DoCampoData = { read, mergeFarm, removeFarm, mergeProduct, removeProduct, restoreFarm, restoreProduct };
})();
