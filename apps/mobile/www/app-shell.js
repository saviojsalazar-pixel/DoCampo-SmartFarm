(function () {
  'use strict';

  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHome = page === '' || page === 'index.html';
  const CLEANUP_KEY = 'docampo_factory_cleanup_pending_v2';
  let lastAutomaticSync = 0;

  function installResponsiveLayout() {
    if (document.getElementById('docampo-responsive-layout')) return;
    const style = document.createElement('style');
    style.id = 'docampo-responsive-layout';
    style.textContent = `
      :root{--docampo-visible-height:100dvh;--docampo-preview-scale:1}
      #pdf-content-wrapper,#checklistPdfPreviewModal,.modal,#manage-products-modal,#history-modal,#manage-farms-modal{height:var(--docampo-visible-height,100dvh);max-height:var(--docampo-visible-height,100dvh)}
      @media(max-width:900px){
        #pdf-content-wrapper,#checklistPdfPreviewModal{padding:0!important;align-items:stretch!important;overflow:hidden!important}
        #pdf-content-wrapper>div,#checklistPdfPreviewModal>div{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;margin:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding-bottom:env(safe-area-inset-bottom)!important}
        #pdf-content-wrapper>div>.no-print:first-child,#pdf-content-wrapper .docampo-preview-toolbar,#checklistPdfPreviewModal>div>div:first-child{position:relative!important;z-index:4!important;flex:0 0 auto!important;background:#fff!important;padding:12px!important;margin:0!important}
        #pdf-content-wrapper>div>.overflow-x-auto,#pdf-content-wrapper .docampo-preview-scroll,#checklistPdfPreviewPages{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}
        #pdf-content-wrapper>div>.overflow-x-auto{display:block!important;padding:10px!important}
        #pdf-content-wrapper .overflow-x-auto>#pdf-content{width:794px!important;min-width:794px!important;max-width:794px!important;zoom:var(--docampo-preview-scale,1)!important;margin:0 auto!important}
        #pdf-content-wrapper .overflow-x-auto>#pdf-content>.pdf-page{box-sizing:border-box!important;width:794px!important;max-width:794px!important;min-width:794px!important;margin:0 auto 12px!important;overflow:visible!important}
        #pdf-content-wrapper .docampo-preview-panel{padding:0!important;gap:0!important}
        #pdf-content-wrapper .docampo-preview-scroll{border-radius:0!important;border-left:0!important;border-right:0!important;padding:14px!important}
        #manage-products-modal,#history-modal,#manage-farms-modal{padding:0!important;align-items:stretch!important}
        #manage-products-modal>div,#history-modal>div,#manage-farms-modal>div{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;padding:16px!important;padding-bottom:calc(16px + env(safe-area-inset-bottom))!important}
      }
    `;
    document.head.appendChild(style);

    const updateVisibleHeight = () => {
      const height = Math.max(280, Math.round(window.visualViewport?.height || window.innerHeight || 0));
      const width = Math.max(280, Math.round(window.visualViewport?.width || window.innerWidth || 0));
      const previewScale = Math.min(1, Math.max(0.3, (width - 20) / 794));
      document.documentElement.style.setProperty('--docampo-visible-height', `${height}px`);
      document.documentElement.style.setProperty('--docampo-preview-scale', String(previewScale));
    };
    updateVisibleHeight();
    window.addEventListener('resize', updateVisibleHeight, { passive: true });
    window.addEventListener('orientationchange', updateVisibleHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', updateVisibleHeight, { passive: true });
    window.visualViewport?.addEventListener('scroll', updateVisibleHeight, { passive: true });

    document.addEventListener('focusin', event => {
      const target = event.target;
      if (window.innerWidth > 900 || !target?.matches?.('input,select,textarea')) return;
      if (!target.closest('.modal,#manage-products-modal,#history-modal,#manage-farms-modal')) return;
      setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 180);
    });
  }

  installResponsiveLayout();

  function registeredPlugin(name) {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    try { return cap.registerPlugin ? cap.registerPlugin(name) : null; } catch (_) { return null; }
  }

  async function cleanupFactoryFiles() {
    if (localStorage.getItem(CLEANUP_KEY) !== '1') return;
    try {
      if (window.DoCampoPhotos?.clearAllLocal) await DoCampoPhotos.clearAllLocal();
      const filesystem = registeredPlugin('Filesystem');
      if (filesystem) {
        try { await filesystem.rmdir({ path: 'documents', directory: 'DATA', recursive: true }); } catch (_) {}
        try { await filesystem.rmdir({ path: 'docampo-share', directory: 'CACHE', recursive: true }); } catch (_) {}
      }
      localStorage.removeItem(CLEANUP_KEY);
    } catch (error) {
      console.error('A limpeza de arquivos será repetida na próxima abertura:', error);
    }
  }

  async function cleanupTemporaryFiles() {
    const filesystem = registeredPlugin('Filesystem');
    if (!filesystem) return;
    try {
      const result = await filesystem.readdir({ path: 'docampo-share', directory: 'CACHE' });
      const limit = Date.now() - 7 * 86400000;
      for (const file of (result.files || [])) {
        const modified = Number(file.mtime || file.ctime || 0);
        if (modified && modified < limit && file.name) {
          try { await filesystem.deleteFile({ path: 'docampo-share/' + file.name, directory: 'CACHE' }); } catch (_) {}
        }
      }
    } catch (_) {
      // A pasta ainda não existe ou o Android já limpou o cache.
    }
  }

  async function automaticSync() {
    if (Date.now() - lastAutomaticSync < 30000) return;
    if (!navigator.onLine || !window.DoCampoSync || !window.DoCampoDB || !window.DoCampoAuth) return;
    await DoCampoDB.ready().catch(() => {});
    const database = DoCampoDB.status();
    const account = DoCampoAuth.status();
    if (!database.ready || !database.configured || !account.authenticated) return;
    lastAutomaticSync = Date.now();
    try {
      await DoCampoSync.sync();
    } catch (error) {
      console.warn('Sincronização automática pendente:', error.message || error);
    }
  }

  function showFatal(message) {
    if (document.getElementById('docampo-fatal-database')) return;
    const overlay = document.createElement('div');
    overlay.id = 'docampo-fatal-database';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f8fafc;padding:28px;display:flex;align-items:center;justify-content:center;font-family:system-ui';
    overlay.innerHTML = '<div style="max-width:560px;background:white;border:1px solid #fecaca;border-radius:20px;padding:24px;box-shadow:0 18px 50px #0002"><h1 style="margin:0 0 12px;color:#991b1b;font-size:22px">Banco local indisponível</h1><p style="color:#374151;line-height:1.5">O aplicativo bloqueou novas alterações para não correr risco de perda.</p><p style="color:#7f1d1d;font-weight:700">' + String(message || 'Erro desconhecido').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</p><p style="color:#374151">Feche e abra o aplicativo. Se continuar, não desinstale antes de solicitar suporte.</p></div>';
    document.body.appendChild(overlay);
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      await DoCampoDB.ready();
      await cleanupFactoryFiles();
      await cleanupTemporaryFiles();
    } catch (error) {
      showFatal(error.message);
      return;
    }
    setTimeout(automaticSync, 700);
    setTimeout(async function () {
      try {
        if (window.DoCampoDB?.archiveOldDocuments) DoCampoDB.archiveOldDocuments(7);
        if (window.DoCampoPDF?.purgeExpiredDocuments) await DoCampoPDF.purgeExpiredDocuments(30);
      } catch (error) {
        console.warn('Manutenção de documentos pendente:', error.message || error);
      }
    }, 900);
  });

  window.addEventListener('docampo:db-fatal', event => showFatal(event.detail?.message));
  window.addEventListener('docampo:persistence-error', event => showFatal(event.detail?.message));
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') setTimeout(automaticSync, 500);
  });

  if (!isHome) {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('[data-docampo-back], .back')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Voltar ao menu principal');
      button.textContent = '‹  Menu';
      button.style.cssText = 'position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:99999;border:0;border-radius:999px;padding:11px 16px;background:#06452f;color:white;font:700 14px system-ui;box-shadow:0 5px 18px #0005';
      button.addEventListener('click', () => location.replace('index.html'));
      document.body.appendChild(button);
    });
    history.replaceState({ doCampoModule: true }, document.title, location.href);
    history.pushState({ doCampoGuard: true }, document.title, location.href);
    window.addEventListener('popstate', () => location.replace('index.html'), { once: true });
  }

  function summary() {
    if (!window.DoCampoDB) return { farms: 0, products: 0, visits: 0, recommendations: 0 };
    return {
      farms: DoCampoDB.list('farms').length,
      products: DoCampoDB.list('products').length,
      visits: DoCampoDB.list('visits').length,
      recommendations: DoCampoDB.list('recommendations').length,
      updatedAt: DoCampoDB.status().lastSyncAt
    };
  }

  async function exportBackup() {
    await DoCampoDB.ready();
    await DoCampoDB.flush();
    const backup = {
      format: 'DoCampoSmartFarmBackup',
      version: 3,
      generation: DoCampoDB.generation,
      schemaVersion: DoCampoDB.schemaVersion,
      appVersion: DoCampoDB.appVersion,
      exportedAt: new Date().toISOString(),
      database: JSON.parse(JSON.stringify(DoCampoDB.read())),
      note: 'Fotos e PDFs sincronizados permanecem no armazenamento privado do Supabase e serão baixados pelo aparelho de destino.'
    };
    const content = JSON.stringify(backup);
    const filename = 'Backup_DoCampo_SmartFarm_' + new Date().toISOString().slice(0, 10) + '.json';
    const filesystem = registeredPlugin('Filesystem');
    const share = registeredPlugin('Share');
    if (filesystem && share) {
      const bytes = new TextEncoder().encode(content);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 32768) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 32768));
      }
      const result = await filesystem.writeFile({
        path: 'docampo-share/' + filename,
        data: btoa(binary),
        directory: 'CACHE',
        recursive: true
      });
      await share.share({
        title: 'Backup Do Campo SmartFarm',
        text: 'Backup do banco central do aplicativo.',
        url: result.uri,
        dialogTitle: 'Salvar ou enviar backup'
      });
      return;
    }
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.format !== 'DoCampoSmartFarmBackup' || backup.version !== 3 || !backup.database) {
          throw new Error('Formato de backup incompatível.');
        }
        if (backup.generation !== DoCampoDB.generation || Number(backup.schemaVersion) !== DoCampoDB.schemaVersion) {
          throw new Error('Este backup pertence à arquitetura antiga e foi bloqueado para não reintroduzir conflitos.');
        }
        if (!confirm('Substituir integralmente o banco deste aparelho pelo backup selecionado?')) return;
        await DoCampoDB.replaceFromBackup(backup.database);
        alert('Backup validado e restaurado. O aplicativo será reaberto.');
        location.reload();
      } catch (error) {
        alert(error.message || 'Este arquivo não é um backup válido do Do Campo SmartFarm.');
      }
    };
    reader.readAsText(file);
  }

  window.DoCampoCentral = { summary, exportBackup, importBackup };
})();
