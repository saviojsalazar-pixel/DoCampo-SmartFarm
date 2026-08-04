(function () {
    'use strict';
    const KEY = 'docampo_shared_v1';
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
        const normalized = { farm: name, producer: String(farm.producer || farm.proprietor || '').trim(), cpf: String(farm.cpf || '').trim(), address: String(farm.address || '').trim(), fields: Array.isArray(farm.fields) ? farm.fields.map(field => ({ name: String(field.name || field.talhao || field).trim(), area: Number(field.area) || 0 })).filter(field => field.name) : [] };
        const idx = data.farms.findIndex(item => String(item.farm).toLowerCase() === name.toLowerCase());
        if (idx >= 0) data.farms[idx] = Object.assign({}, data.farms[idx], normalized); else data.farms.unshift(normalized);
        return write(data);
    }
    function removeFarm(name) { const data = read(); data.farms = data.farms.filter(item => String(item.farm).toLowerCase() !== String(name).toLowerCase()); return write(data); }
    function mergeProduct(category, product) {
        if (!category || !product || !product.name) return read();
        const data = read(); if (!Array.isArray(data.products[category])) data.products[category] = [];
        const idx = data.products[category].findIndex(item => item.name.toLowerCase() === product.name.toLowerCase());
        if (idx >= 0) data.products[category][idx] = product; else data.products[category].push(product);
        return write(data);
    }
    window.DoCampoData = { read, mergeFarm, removeFarm, mergeProduct };
})();
