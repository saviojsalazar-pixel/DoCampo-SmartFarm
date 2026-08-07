(function () {
  'use strict';

  const BUCKET = 'docampo-documents';

  function limparNome(nome) {
    return String(nome || 'Relatorio_Do_Campo.pdf')
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/_+/g, '_');
  }

  function baixarNoNavegador(dataUri, nome) {
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function idDocumento() {
    return 'doc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function plugins() {
    const cap = window.Capacitor;
    return {
      native: !!(cap && cap.isNativePlatform && cap.isNativePlatform()),
      filesystem: cap && cap.Plugins && cap.Plugins.Filesystem,
      share: cap && cap.Plugins && cap.Plugins.Share
    };
  }

  function commonMeta(titulo, meta) {
    meta = meta || {};
    const user = window.DoCampoDB ? DoCampoDB.user() : '';
    return {
      typeLabel: meta.typeLabel || titulo || 'Documento técnico',
      producer: meta.producer || 'Produtor não informado',
      farm: meta.farm || '',
      fields: Array.isArray(meta.fields) ? meta.fields : (meta.field ? [meta.field] : []),
      responsible: meta.responsible || user || 'Responsável não informado'
    };
  }

  function base64ToBytes(base64) {
    const raw = atob(String(base64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  async function authHeaders(contentType) {
    if (!window.DoCampoAuth || !window.DoCampoCloudConfig) throw new Error('Sincronização não configurada.');
    const token = await DoCampoAuth.accessToken();
    return {
      apikey: DoCampoCloudConfig.anonKey,
      Authorization: 'Bearer ' + token,
      ...(contentType ? { 'Content-Type': contentType } : {})
    };
  }

  async function readPersistentBase64(doc) {
    const p = plugins();
    if (!p.native || !p.filesystem || !doc.localPath) throw new Error('O PDF não está armazenado neste aparelho.');
    const result = await p.filesystem.readFile({ path: doc.localPath, directory: 'DATA' });
    return result.data;
  }

  async function uploadOne(doc) {
    if (!doc || doc.deletedAt || doc.remoteUploaded || !doc.localAvailable || !doc.localPath) return false;
    const base64 = await readPersistentBase64(doc);
    const url = DoCampoCloudConfig.url + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(doc.remotePath).replace(/%2F/g, '/');
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...(await authHeaders('application/pdf')), 'x-upsert': 'true' },
      body: base64ToBytes(base64)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || ('Falha ao enviar PDF: ' + response.status));
    }
    if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, { remoteUploaded: true });
    return true;
  }

  async function uploadPendingDocuments() {
    if (!navigator.onLine || !window.DoCampoDB) return 0;
    const docs = DoCampoDB.list('documents').filter(d => d.localAvailable && !d.remoteUploaded && d.remotePath);
    let count = 0;
    for (const doc of docs) { if (await uploadOne(doc)) count++; }
    return count;
  }

  async function downloadOne(doc) {
    if (!doc || !doc.remotePath) throw new Error('Este documento ainda não possui cópia sincronizada.');
    const p = plugins();
    if (!p.native || !p.filesystem) throw new Error('Download local disponível no aplicativo instalado.');
    const url = DoCampoCloudConfig.url + '/storage/v1/object/authenticated/' + BUCKET + '/' + encodeURIComponent(doc.remotePath).replace(/%2F/g, '/');
    const response = await fetch(url, { headers: await authHeaders() });
    if (!response.ok) throw new Error('Não foi possível baixar o PDF sincronizado.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    const base64 = btoa(binary);
    const localPath = 'documents/' + doc.id + '.pdf';
    await p.filesystem.writeFile({ path: localPath, data: base64, directory: 'DATA', recursive: true });
    if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, { localAvailable: true, localPath: localPath, remoteUploaded: true });
    return DoCampoDB.get('documents', doc.id);
  }

  async function ensureLocal(doc) {
    if (doc.localAvailable && doc.localPath) {
      try { await readPersistentBase64(doc); return doc; } catch (_) {}
    }
    if (doc.name) {
      const p = plugins();
      if (p.native && p.filesystem) {
        try {
          const legacy = await p.filesystem.readFile({ path: doc.name, directory: 'CACHE' });
          const localPath = 'documents/' + doc.id + '.pdf';
          await p.filesystem.writeFile({ path: localPath, data: legacy.data, directory: 'DATA', recursive: true });
          if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) {
            DoCampoDB.patchDocumentLocal(doc.id, { localAvailable: true, localPath: localPath });
            return DoCampoDB.get('documents', doc.id);
          }
        } catch (_) {}
      }
    }
    if (!navigator.onLine) throw new Error('Este PDF ainda não foi baixado neste aparelho. Conecte à internet uma vez para baixá-lo.');
    return downloadOne(doc);
  }

  async function shareDocument(doc, dialogTitle) {
    doc = await ensureLocal(doc);
    const p = plugins();
    const base64 = await readPersistentBase64(doc);
    if (!p.native || !p.filesystem || !p.share) {
      baixarNoNavegador('data:application/pdf;base64,' + base64, doc.name);
      return;
    }
    const temp = await p.filesystem.writeFile({ path: 'share-' + doc.id + '.pdf', data: base64, directory: 'CACHE', recursive: true });
    await p.share.share({
      title: doc.displayName || doc.typeLabel || 'Documento Do Campo',
      text: doc.displayName || 'Documento gerado pelo Do Campo SmartFarm',
      url: temp.uri,
      dialogTitle: dialogTitle || 'Abrir ou compartilhar PDF'
    });
  }

  async function salvarECompartilhar(dataUri, nome, titulo, meta) {
    nome = limparNome(nome);
    const base64 = String(dataUri).includes(',') ? String(dataUri).split(',')[1] : String(dataUri);
    const p = plugins();
    const id = idDocumento();
    const localPath = 'documents/' + id + '.pdf';
    const remotePath = 'documents/' + id + '.pdf';
    const info = commonMeta(titulo, meta);
    let localAvailable = false;

    if (p.native && p.filesystem) {
      await p.filesystem.writeFile({ path: localPath, data: base64, directory: 'DATA', recursive: true });
      localAvailable = true;
    }

    const displayName = [info.producer, info.typeLabel, info.responsible].filter(Boolean).join(' — ');
    let record = null;
    if (window.DoCampoDB) {
      record = DoCampoDB.addDocument({
        id, name: nome, displayName,
        ...info,
        generatedBy: window.DoCampoDB ? DoCampoDB.user() : info.responsible,
        generatedAt: new Date().toISOString(),
        localAvailable, localPath: localAvailable ? localPath : '',
        remotePath, remoteUploaded: false,
        snapshot: { displayName, name: nome, ...info }
      });
    }

    if (!p.native || !p.filesystem || !p.share) {
      baixarNoNavegador('data:application/pdf;base64,' + base64, nome);
      return { navegador: true, document: record };
    }

    const temp = await p.filesystem.writeFile({ path: 'share-' + id + '.pdf', data: base64, directory: 'CACHE', recursive: true });
    await p.share.share({ title: titulo || 'Relatório Do Campo', text: displayName, url: temp.uri, dialogTitle: 'Salvar ou compartilhar PDF' });
    return { uri: temp.uri, document: record };
  }

  window.DoCampoPDF = {
    salvarECompartilhar,
    uploadPendingDocuments,
    downloadOne,
    ensureLocal,
    shareDocument
  };
})();
