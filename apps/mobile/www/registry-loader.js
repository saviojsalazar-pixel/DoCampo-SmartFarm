(function(){
  'use strict';
  function extract(source,label,open,close){const start=source.indexOf(label);if(start<0)return null;const first=source.indexOf(open,start);let depth=0,quote='',escape=false;for(let i=first;i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c===open)depth++;else if(c===close&&--depth===0)return source.slice(first,i+1)}return null}
  async function defaults(){try{const source=await fetch('pulverizacao.html').then(r=>r.text()),farmsText=extract(source,'const EMBEDDED_DATABASE','[',']'),productsText=extract(source,'const PRODUCT_CATALOG','{','}');return{farms:farmsText?Function('return ('+farmsText+')')():[],products:productsText?Function('return ('+productsText+')')():{}}}catch(e){console.error(e);return{farms:[],products:{}}}}
  function mergeFarm(list, farm) {
    if (!farm || !String(farm.farm || '').trim()) return;
    const name = String(farm.farm).trim();
    const i = list.findIndex(x => String(x.farm).toLowerCase() === name.toLowerCase());
    if (i >= 0) list[i] = { ...list[i], ...farm };
    else list.push(farm);
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
    (shared.farms||[]).forEach(f=>mergeFarm(farms,f));
    if(window.DoCampoDB){
      const dbFields=DoCampoDB.list('fields');
      DoCampoDB.list('farms').forEach(f=>{
        const fields=dbFields.filter(x=>x.farmId===f.id).map(x=>({name:x.name||x.talhao||'',area:Number(x.area)||0,plants:Number(x.plants)||0})).filter(x=>x.name);
        mergeFarm(farms,{farm:f.name||f.farm||'',producer:f.producerName||f.producer||f.proprietor||'',cpf:f.cpf||'',address:f.address||f.city||'',fields:fields.length?fields:(f.fieldsSnapshot||f.fields||[])});
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
    return{farms:farms.sort((a,b)=>String(a.producer||a.proprietor).localeCompare(String(b.producer||b.proprietor),'pt-BR')),products}}
  window.DoCampoRegistry={defaults,all};
})();
