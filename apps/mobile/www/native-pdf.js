(function () {
  'use strict';

  const BUCKET = 'docampo-documents';
  let generationJob = null;

  async function esperarLayout(elemento) {
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2500))]);
    const imagens=Array.from(elemento?.querySelectorAll?.('img')||[]);
    await Promise.all(imagens.map(img=>img.complete&&img.naturalWidth?Promise.resolve():new Promise(resolve=>{
      const done=()=>resolve();img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(done,3500);
    })));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function comPrazo(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo excedido ao montar o documento.')),ms))])}

  async function gerarDataUri(elemento, opcoes) {
    if (generationJob) throw new Error('Já existe um PDF sendo gerado. Aguarde a conclusão antes de tentar novamente.');
    generationJob = (async () => {
      if (!window.html2pdf) throw new Error('O gerador de PDF não foi carregado. Feche e abra o aplicativo e tente novamente.');
      if (!elemento || !elemento.isConnected) throw new Error('O conteúdo do documento não está pronto para gerar o PDF.');
      await esperarLayout(elemento);
      const native = plugins().native;
      const escalas = native ? [1.25, 1, 0.85] : [Number(opcoes?.html2canvas?.scale)||1.8, 1.35, 1.05];
      let ultimoErro;
      for (const scale of escalas) {
        try {
          const config={...(opcoes||{}),html2canvas:{...((opcoes&&opcoes.html2canvas)||{}),scale,useCORS:true,logging:false}};
          const tarefa = html2pdf().set(config).from(elemento).outputPdf('datauristring');
          // No Android, abandonar uma Promise por tempo excedido não cancela o
          // html2canvas. Uma nova tentativa concorrente duplicava o pico de RAM
          // e explicava falhas intermitentes, principalmente com fotos.
          const dataUri = native ? await tarefa : await comPrazo(tarefa, 60000);
          validarPdf(String(dataUri).split(',')[1]||'');
          return dataUri;
        } catch (error) { ultimoErro=error; await new Promise(resolve=>setTimeout(resolve,200)); }
      }
      const detail = String(ultimoErro?.message || ultimoErro || 'erro desconhecido');
      throw new Error('Não foi possível montar o PDF. A geração foi interrompida antes do salvamento. Detalhe técnico: ' + detail);
    })();
    try{return await generationJob}finally{generationJob=null}
  }

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
    const registered = name => {
      if (!cap) return null;
      if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
      try { return cap.registerPlugin ? cap.registerPlugin(name) : null; } catch (_) { return null; }
    };
    return {
      native: !!(cap && cap.isNativePlatform && cap.isNativePlatform()),
      filesystem: registered('Filesystem'),
      share: registered('Share')
    };
  }

  function validarPdf(base64) {
    const value = String(base64 || '').replace(/\s/g, '');
    if (value.length < 100 || !value.startsWith('JVBER')) throw new Error('O conteúdo gerado não é um PDF válido.');
    return value;
  }

  function erroDeArmazenamento(error) {
    const technical = String(error?.message || error?.code || error || 'falha desconhecida').replace(/\s+/g, ' ').slice(0, 180);
    const fingerprint = (String(error?.code || '') + ' ' + technical).toLowerCase();
    let message = 'O PDF foi criado, mas o Android não permitiu gravá-lo no armazenamento interno do aplicativo.';
    if (/enospc|no space|insufficient storage|quota|disk full/.test(fingerprint)) {
      message = 'O PDF foi criado, mas não há espaço livre suficiente para gravá-lo neste aparelho.';
    } else if (/permission|denied|unauthorized|security/.test(fingerprint)) {
      message = 'O PDF foi criado, mas o Android recusou a permissão de gravação do aplicativo.';
    } else if (/not found|enoent|directory/.test(fingerprint)) {
      message = 'O PDF foi criado, mas a pasta interna de documentos não pôde ser preparada.';
    }
    const detail = new Error(message + ' Detalhe técnico: ' + technical);
    detail.stage = 'storage';
    detail.code = error?.code || 'PDF_STORAGE_FAILED';
    detail.cause = error;
    return detail;
  }

  function commonMeta(titulo, meta) {
    meta = meta || {};
    const user = window.DoCampoDB ? DoCampoDB.user() : '';
    return {
      typeLabel: meta.typeLabel || titulo || 'Documento técnico',
      producer: meta.producer || 'Produtor não informado',
      farm: meta.farm || '',
      fields: Array.isArray(meta.fields) ? meta.fields : (meta.field ? [meta.field] : []),
      responsible: meta.responsible || user || 'Responsável não informado',
      documentCode: meta.documentCode || ''
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
    let base64;
    try {
      base64 = await readPersistentBase64(doc);
    } catch (error) {
      const patch = {
        localAvailable: false,
        localPath: '',
        fileMissing: !doc.remoteUploaded,
        fileMissingAt: new Date().toISOString()
      };
      if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, patch);
      if (window.DoCampoDB && DoCampoDB.patchDocumentCloud) DoCampoDB.patchDocumentCloud(doc.id, { fileMissing: !doc.remoteUploaded, fileMissingAt: patch.fileMissingAt });
      return false;
    }
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
    if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, { remoteUploaded: true, fileMissing: false, fileMissingAt: '' });
    if (window.DoCampoDB && DoCampoDB.patchDocumentCloud) DoCampoDB.patchDocumentCloud(doc.id, { remoteUploaded: true, fileMissing: false, fileMissingAt: '' });
    return true;
  }

  async function uploadPendingDocuments() {
    if (!navigator.onLine || !window.DoCampoDB) return 0;
    const docs = DoCampoDB.list('documents').filter(d => d.localAvailable && !d.remoteUploaded && d.remotePath);
    let count = 0;
    const failures = [];
    for (const doc of docs) {
      try {
        if (await uploadOne(doc)) count++;
      } catch (error) {
        failures.push({ id: doc.id, name: doc.name, message: String(error?.message || error) });
      }
    }
    if (failures.length) {
      const error = new Error(`${failures.length} PDF(s) permaneceram pendentes; ${count} foram enviados nesta tentativa. Primeiro erro: ${failures[0].message}`);
      error.uploadedCount = count;
      error.failures = failures;
      throw error;
    }
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
    if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, { localAvailable: true, localPath: localPath, remoteUploaded: true, fileMissing: false, fileMissingAt: '' });
    return DoCampoDB.get('documents', doc.id);
  }

  async function ensureLocal(doc) {
    if (doc.localAvailable && doc.localPath) {
      try { await readPersistentBase64(doc); return doc; } catch (_) {
        if (window.DoCampoDB && DoCampoDB.patchDocumentLocal) DoCampoDB.patchDocumentLocal(doc.id, { localAvailable: false, localPath: '' });
        doc = DoCampoDB.get('documents', doc.id) || doc;
      }
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
    if (!doc.remoteUploaded) throw new Error('O arquivo deste PDF não foi encontrado. Gere o documento novamente ou exclua este registro do histórico.');
    if (!navigator.onLine) throw new Error('Este PDF ainda não foi baixado neste aparelho. Conecte à internet uma vez para baixá-lo.');
    return downloadOne(doc);
  }

  async function shareDocument(doc, dialogTitle) {
    doc = await ensureLocal(doc);
    const p = plugins();
    if (!p.native || !p.filesystem || !p.share) {
      const base64 = await readPersistentBase64(doc);
      baixarNoNavegador('data:application/pdf;base64,' + base64, doc.name);
      return;
    }
    const persistent = await p.filesystem.getUri({ path: doc.localPath, directory: 'DATA' });
    await p.share.share({
      title: doc.displayName || doc.typeLabel || 'Documento Do Campo',
      text: doc.displayName || 'Documento gerado pelo Do Campo SmartFarm',
      url: persistent.uri,
      dialogTitle: dialogTitle || 'Abrir ou compartilhar PDF'
    });
  }

  async function apagarArquivoLocal(doc) {
    const p = plugins();
    if (!p.native || !p.filesystem || !doc.localPath) return;
    try { await p.filesystem.deleteFile({ path: doc.localPath, directory: 'DATA' }); }
    catch (_) {}
  }

  async function apagarArquivoRemoto(doc) {
    if (!doc.remotePath || !doc.remoteUploaded) return true;
    if (!navigator.onLine) return false;
    const url = DoCampoCloudConfig.url + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(doc.remotePath).replace(/%2F/g, '/');
    const response = await fetch(url, { method: 'DELETE', headers: await authHeaders() });
    if (response.ok || response.status === 404) return true;
    return false;
  }

  async function purgeExpiredDocuments(days, force) {
    if (!window.DoCampoDB) return 0;
    const prazo = force ? 0 : Math.max(1, Number(days) || 30) * 86400000;
    const limite = Date.now() - prazo;
    const docs = DoCampoDB.list('documents', { deleted: true })
      .filter(d => d.deletedAt && !d.purgedAt && (force || new Date(d.deletedAt).getTime() <= limite));
    let total = 0;
    for (const doc of docs) {
      const remotoOk = await apagarArquivoRemoto(doc).catch(() => false);
      if (doc.remoteUploaded && doc.remotePath && !remotoOk) continue;
      await apagarArquivoLocal(doc);
      if (DoCampoDB.hardDelete) DoCampoDB.hardDelete('documents', doc.id);
      total++;
    }
    return total;
  }

  async function salvarECompartilhar(dataUri, nome, titulo, meta) {
    nome = limparNome(nome);
    const base64 = validarPdf(String(dataUri).includes(',') ? String(dataUri).split(',')[1] : String(dataUri));
    const p = plugins();
    const id = idDocumento();
    const localPath = 'documents/' + id + '.pdf';
    const remotePath = 'documents/' + id + '.pdf';
    const info = commonMeta(titulo, meta);
    let localAvailable = false;

    if (p.native && p.filesystem) {
      try {
        await p.filesystem.writeFile({ path: localPath, data: base64, directory: 'DATA', recursive: true });
        const check = await p.filesystem.stat({ path: localPath, directory: 'DATA' });
        if (!check || Number(check.size) < 100) throw new Error('Arquivo gravado sem conteúdo.');
      } catch (error) {
        throw erroDeArmazenamento(error);
      }
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
        remotePath, remoteUploaded: false, fileMissing: false, fileMissingAt: '',
        snapshot: { displayName, name: nome, ...info, ...((meta && meta.snapshot && typeof meta.snapshot === 'object') ? meta.snapshot : {}) }
      });
      // O Android pode suspender o WebView ao abrir o compartilhamento. O
      // registro precisa estar confirmado no IndexedDB antes dessa troca.
      await DoCampoDB.flush();
    }

    if (!p.native || !p.filesystem || !p.share) {
      baixarNoNavegador('data:application/pdf;base64,' + base64, nome);
      return { navegador: true, document: record };
    }

    try {
      const persistent = await p.filesystem.getUri({ path: localPath, directory: 'DATA' });
      await p.share.share({ title: titulo || 'Relatório Do Campo', text: displayName, url: persistent.uri, dialogTitle: 'Salvar ou compartilhar PDF' });
      return { uri: persistent.uri, document: record, saved: true, shared: true };
    } catch (error) {
      // O documento persistente e o registro do histórico já existem. Uma
      // falha/cancelamento do compartilhamento não pode apagar nem mascarar isso.
      console.error('Falha ao abrir compartilhamento do PDF:', error);
      alert('O PDF foi salvo em Documentos, mas o compartilhamento não abriu. Você pode compartilhá-lo novamente pelo histórico de documentos.');
      return { document: record, saved: true, shared: false, shareError: String(error?.message || error) };
    }
  }

  window.DoCampoPDF = {
    gerarDataUri,
    salvarECompartilhar,
    uploadPendingDocuments,
    downloadOne,
    ensureLocal,
    shareDocument,
    purgeExpiredDocuments
  };
})();
