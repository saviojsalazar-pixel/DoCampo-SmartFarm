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

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.format !== 'DoCampoSmartFarmBackup' || !backup.data) throw new Error('Formato inválido');
        Object.entries(backup.data).forEach(([key, value]) => localStorage.setItem(key, String(value)));
        alert('Backup importado. O aplicativo será atualizado agora.'); location.reload();
      } catch (_) { alert('Este arquivo não é um backup válido do Do Campo SmartFarm.'); }
    };
    reader.readAsText(file);
  }

  window.DoCampoCentral = { summary, exportBackup, importBackup };
})();
