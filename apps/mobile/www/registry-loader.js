(function(){
  'use strict';
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const fieldKey=v=>norm(v).replace(/[.\-–—,:;]+\s*$/,'').trim();
  const fieldCompare=(a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'pt-BR',{numeric:true,sensitivity:'base'});
  function cleanFields(list){const map=new Map();(Array.isArray(list)?list:[]).forEach(raw=>{const f=typeof raw==='object'&&raw?{...raw}:{name:raw},name=clean(f.name||f.talhao);if(!name)return;const k=fieldKey(name),old=map.get(k)||{};map.set(k,{...old,...f,name,area:Number(f.area)||Number(old.area)||0,plants:Number(f.plants)||Number(old.plants)||0})});return Array.from(map.values()).sort(fieldCompare)}
  let seedPromise=null;
  async function defaults(){
    if(!seedPromise)seedPromise=fetch('seed-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Cadastro-base indisponível: '+r.status);return r.json()}).then(data=>({farms:Array.isArray(data.farms)?data.farms:[],products:data.products&&typeof data.products==='object'?data.products:{}})).catch(e=>{seedPromise=null;console.error(e);return{farms:[],products:{}}});
    return seedPromise;
  }
  function mergeFarm(list, farm, replaceFields) {
    if (!farm || !String(farm.farm || '').trim()) return;
    const name = String(farm.farm).trim();
    const i = list.findIndex(x => norm(x.farm) === norm(name));
    if (i < 0) { list.push({...farm,farm:name,fields:cleanFields(farm.fields)}); return; }

    // Registros antigos sincronizados podem conter apenas fazenda/produtor e
    // talhoes com area zero. Nunca deixe essa copia parcial apagar dados mais
    // completos que ja existem no cadastro-base do SmartFarm.
    const previous = list[i] || {};
    const incomingFields = Array.isArray(farm.fields) ? cleanFields(farm.fields) : null;
    let fields = previous.fields || [];
    if (incomingFields && replaceFields) {
      fields = incomingFields;
    } else if (incomingFields) {
      const mergedFields = (previous.fields || []).map(field => ({ ...field }));
      incomingFields.forEach(field => {
        const oldField = (previous.fields || []).find(x => fieldKey(x.name) === fieldKey(field.name));
        const incomingArea = Number(field.area) || 0;
        const oldArea = Number(oldField?.area) || 0;
        const incomingPlants = Number(field.plants) || 0;
        const oldPlants = Number(oldField?.plants) || 0;
        const normalized = { ...(oldField || {}), ...field, area: incomingArea > 0 ? incomingArea : oldArea, plants: incomingPlants > 0 ? incomingPlants : oldPlants };
        const index = mergedFields.findIndex(x => fieldKey(x.name) === fieldKey(field.name));
        if (index >= 0) mergedFields[index] = normalized; else mergedFields.push(normalized);
      });
      fields = cleanFields(mergedFields);
    }
    list[i] = {
      ...previous,
      ...farm,
      farm: name,
      producer: String(farm.producer || farm.proprietor || previous.producer || previous.proprietor || '').trim(),
      cpf: String(farm.cpf || previous.cpf || '').trim(),
      address: String(farm.address || previous.address || '').trim(),
      fields: fields.slice().sort(fieldCompare)
    };
  }
  function mergeProduct(products, category, product) {
    if (!category || !product || !String(product.name || '').trim()) return;
    if (!products[category]) products[category] = [];
    const name = String(product.name).trim();
    const i = products[category].findIndex(x => String(x.name).toLowerCase() === name.toLowerCase());
    if (i >= 0) products[category][i] = { ...products[category][i], ...product, name };
    else products[category].push({ ...product, name });
  }
  async function all(){
    const base=await defaults(),shared=window.DoCampoData?DoCampoData.read():{farms:[],products:{}},deletedFarms=JSON.parse(localStorage.getItem('agri_deleted_farms')||'[]').map(x=>String(x).toLowerCase()),deletedProducts=JSON.parse(localStorage.getItem('agri_deleted_products')||'{}');
    let farms=base.farms.filter(f=>!deletedFarms.includes(String(f.farm).toLowerCase()));
    // Um cadastro editado/importado substitui a lista-base daquela fazenda.
    // Isso impede que talhões antigos incorporados ao HTML reapareçam.
    (shared.farms||[]).forEach(f=>mergeFarm(farms,f,true));
    if(window.DoCampoDB){
      const dbFields=DoCampoDB.list('fields');
      DoCampoDB.list('farms').forEach(f=>{
        const fields=dbFields.filter(x=>x.farmId===f.id).map(x=>({name:x.name||x.talhao||'',area:Number(x.area)||0,plants:Number(x.plants)||0})).filter(x=>x.name);
        const authoritative=Array.isArray(f.fieldsSnapshot);
        mergeFarm(farms,{farm:f.name||f.farm||'',producer:f.producerName||f.producer||f.proprietor||'',cpf:f.cpf||'',address:f.address||f.city||'',fields:fields.length?fields:(f.fieldsSnapshot||f.fields||[])},authoritative);
      });
    }
    const products={};
    Object.entries(base.products||{}).forEach(([cat,list])=>(list||[]).filter(p=>!(deletedProducts[cat]||[]).includes(String(p.name).toLowerCase())).forEach(p=>mergeProduct(products,cat,p)));
    Object.entries(window.DoCampoHerbicideDefaults||{}).forEach(([cat,list])=>(list||[]).filter(p=>!(deletedProducts[cat]||[]).includes(String(p.name).toLowerCase())).forEach(p=>mergeProduct(products,cat,p)));
    Object.entries(shared.products||{}).forEach(([cat,list])=>(list||[]).forEach(p=>mergeProduct(products,cat,p)));
    if(window.DoCampoDB){
      DoCampoDB.list('products').forEach(p=>mergeProduct(products,p.category||'Outros',p));
    }
    Object.values(products).forEach(list=>list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')));
    farms.forEach(f=>{if(Array.isArray(f.fields))f.fields=cleanFields(f.fields)});
    return{farms:farms.sort((a,b)=>String(a.producer||a.proprietor).localeCompare(String(b.producer||b.proprietor),'pt-BR')),products}}
  window.DoCampoRegistry={defaults,all};
})();
