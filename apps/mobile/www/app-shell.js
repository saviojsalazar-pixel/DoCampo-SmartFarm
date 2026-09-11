(function () {
  'use strict';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHome = page === '' || page === 'index.html';

  function goHome() { location.replace('index.html'); }

  let ultimaSincronizacaoAutomatica = 0;
  async function sincronizarAoAbrir() {
    if (Date.now() - ultimaSincronizacaoAutomatica < 30000) return;
    if (!navigator.onLine || !window.DoCampoSync || !window.DoCampoDB || !window.DoCampoAuth) return;
    const statusBanco = DoCampoDB.status();
    const statusConta = DoCampoAuth.status();
    if (!statusBanco.configured || !statusConta.authenticated) return;
    ultimaSincronizacaoAutomatica = Date.now();
    try { await DoCampoSync.sync(); }
    catch (erro) { console.warn('Sincronização automática aguardando nova tentativa:', erro.message || erro); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(sincronizarAoAbrir, 700);
    setTimeout(async function(){
      try {
        if (window.DoCampoDB?.archiveOldDocuments) DoCampoDB.archiveOldDocuments(7);
        if (window.DoCampoPDF?.purgeExpiredDocuments) await DoCampoPDF.purgeExpiredDocuments(30);
      } catch (erro) { console.warn('Manutenção automática de documentos pendente:', erro.message || erro); }
    }, 900);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') setTimeout(sincronizarAoAbrir, 500);
  });

  if (!isHome) {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('[data-docampo-back], .back')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Voltar ao menu principal');
      button.textContent = '‹  Menu';
      button.style.cssText = 'position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:99999;border:0;border-radius:999px;padding:11px 16px;background:#06452f;color:white;font:700 14px system-ui;box-shadow:0 5px 18px #0005';
      button.addEventListener('click', goHome);
      document.body.appendChild(button);
    });

    history.replaceState({ doCampoModule: true }, document.title, location.href);
    history.pushState({ doCampoGuard: true }, document.title, location.href);
    window.addEventListener('popstate', goHome, { once: true });
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
  }

  function snapshot() {
    const keys = [
      'docampo_shared_v1','docampo_talhoesPorFazenda','docampo_produtoresPorFazenda',
      'docampo_pragasCustomizadas','docampo_doencasCustomizadas','docampo_matoCustomizados',
      'docampo_acoesCustomizadas','docampo_listaAvaliacoes','agri_custom_farms',
      'agri_custom_products','agri_deleted_farms','agri_deleted_products',
      'agri_recommendations_history','agri_rec_seq_counter','docampo_unified_db_v1','docampo_current_user'
    ];
    const data = {};
    keys.forEach(key => { const value = localStorage.getItem(key); if (value !== null) data[key] = value; });
    return { format: 'DoCampoSmartFarmBackup', version: 1, exportedAt: new Date().toISOString(), data };
  }

  function summary() {
    const shared = readJson('docampo_shared_v1', { farms: [], products: {} });
    const checklistFarms = readJson('docampo_talhoesPorFazenda', {});
    const farms = new Set([...(shared.farms || []).map(f => f.farm), ...Object.keys(checklistFarms)]);
    const products = Object.values(shared.products || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
    return {
      farms: farms.size,
      products,
      visits: readJson('docampo_listaAvaliacoes', []).length,
      recommendations: readJson('agri_recommendations_history', []).length,
      updatedAt: shared.updatedAt || null
    };
  }

  async function exportBackup() {
    const content = JSON.stringify(snapshot(), null, 2);
    const filename = 'Backup_DoCampo_SmartFarm_' + new Date().toISOString().slice(0,10) + '.json';
    try {
      const plugins = window.Capacitor && window.Capacitor.Plugins;
      if (plugins && plugins.Filesystem && plugins.Share) {
        const base64 = btoa(unescape(encodeURIComponent(content)));
        const result = await plugins.Filesystem.writeFile({ path: filename, data: base64, directory: 'CACHE' });
        await plugins.Share.share({ title: 'Backup Do Campo SmartFarm', text: 'Arquivo para transferir os dados entre os celulares.', url: result.uri, dialogTitle: 'Salvar ou enviar backup' });
        return;
      }
    } catch (error) { console.warn(error); }
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function mergeNamedList(current, incoming, keyName) {
    const result = Array.isArray(current) ? current.map(x => ({...x})) : [];
    (Array.isArray(incoming) ? incoming : []).forEach(item => {
      const key = String(item?.[keyName] || '').trim().toLowerCase();
      const index = result.findIndex(x => String(x?.[keyName] || '').trim().toLowerCase() === key);
      if (index >= 0) result[index] = {...result[index],...item}; else result.push(item);
    });
    return result;
  }

  function mergeBackupData(incoming) {
    const decoded=value=>{if(value&&typeof value==='object')return value;try{return JSON.parse(value||'null')}catch(_){return null}};
    const merged = {...incoming};
    const currentShared = readJson('docampo_shared_v1',{farms:[],products:{}});
    const incomingShared=decoded(incoming.docampo_shared_v1)||{farms:[],products:{}};
    const legacyFarms=decoded(incoming.agri_custom_farms)||[];
    const incomingFarms=mergeNamedList(incomingShared.farms,legacyFarms,'farm');
    const farms = mergeNamedList(currentShared.farms,incomingFarms,'farm').map(farm=>{
      const old=(currentShared.farms||[]).find(x=>String(x.farm).toLowerCase()===String(farm.farm).toLowerCase())||{};
      return {...old,...farm,fields:mergeNamedList(old.fields,farm.fields,'name')};
    });
    const products={...currentShared.products};
    Object.entries(incomingShared.products||{}).forEach(([category,list])=>{products[category]=mergeNamedList(products[category],list,'name')});
    merged.docampo_shared_v1=JSON.stringify({farms,products,updatedAt:new Date().toISOString()});

    const currentFields=readJson('docampo_talhoesPorFazenda',{}),incomingFields=decoded(incoming.docampo_talhoesPorFazenda)||{};
    Object.entries(incomingFields).forEach(([farm,fields])=>{currentFields[farm]=[...new Set([...(currentFields[farm]||[]),...(fields||[])])]});
    const legacyProducers=decoded(incoming.docampo_produtoresPorFazenda)||{};
    Object.entries(incomingFields).forEach(([farm,fields])=>{let item=farms.find(x=>String(x.farm).toLowerCase()===String(farm).toLowerCase());if(!item){item={farm,producer:legacyProducers[farm]||'',fields:[]};farms.push(item)}item.fields=mergeNamedList(item.fields,(fields||[]).map(name=>({name,area:0,plants:0})),'name')});
    merged.docampo_shared_v1=JSON.stringify({farms,products,updatedAt:new Date().toISOString()});
    merged.docampo_talhoesPorFazenda=JSON.stringify(currentFields);

    let currentDb=readJson('docampo_unified_db_v1',null),incomingDb=decoded(incoming.docampo_unified_db_v1);
    if(currentDb&&incomingDb){Object.entries(incomingDb.entities||{}).forEach(([type,items])=>{currentDb.entities[type]={...(currentDb.entities[type]||{}),...(items||{})}});currentDb.events=mergeNamedList(currentDb.events,incomingDb.events,'id');currentDb.queue=[...new Set([...(currentDb.queue||[]),...(incomingDb.queue||[])])];currentDb.trash=mergeNamedList(currentDb.trash,incomingDb.trash,'id');merged.docampo_unified_db_v1=JSON.stringify(currentDb)}
    return merged;
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.format !== 'DoCampoSmartFarmBackup' || !backup.data) throw new Error('Formato inválido');
        localStorage.setItem('docampo_pre_import_backup_v1',JSON.stringify(snapshot()));
        const merged=mergeBackupData(backup.data);
        Object.entries(merged).forEach(([key, value]) => localStorage.setItem(key, typeof value==='string'?value:JSON.stringify(value)));
        alert('Backup importado e combinado com os dados deste aparelho. O aplicativo será atualizado agora.'); location.reload();
      } catch (_) { alert('Este arquivo não é um backup válido do Do Campo SmartFarm.'); }
    };
    reader.readAsText(file);
  }

  window.DoCampoCentral = { summary, exportBackup, importBackup, mergeBackupData };
})();
