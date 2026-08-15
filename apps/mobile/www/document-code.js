(function () {
  'use strict';

  const KEY = 'docampo_document_counters_v1';

  function tagResponsavel(nome) {
    const texto = String(nome || (window.DoCampoDB && DoCampoDB.user()) || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (texto.includes('savio')) return 'SAV';
    if (texto.includes('glaucio')) return 'GLA';
    const device = window.DoCampoDB ? DoCampoDB.deviceId() : 'LOCAL';
    return String(device).replace(/[^a-z0-9]/gi, '').slice(-3).toUpperCase() || 'LOC';
  }

  function counters() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function maiorExistente(prefixo, tag) {
    if (!window.DoCampoDB) return 0;
    const re = new RegExp('^' + prefixo + '-' + tag + '-(\\d+)$', 'i');
    const documentos = Object.values((DoCampoDB.read().entities || {}).documents || {});
    return documentos.reduce((maior, doc) => {
      const codigo = doc.documentCode || (doc.snapshot && doc.snapshot.documentCode) || '';
      const match = String(codigo).match(re);
      return match ? Math.max(maior, Number(match[1]) || 0) : maior;
    }, 0);
  }

  function reservar(prefixo, responsavel) {
    prefixo = String(prefixo || 'DOC').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const tag = tagResponsavel(responsavel);
    const chave = prefixo + '-' + tag;
    const mapa = counters();
    const proximo = Math.max(Number(mapa[chave]) || 0, maiorExistente(prefixo, tag)) + 1;
    mapa[chave] = proximo;
    localStorage.setItem(KEY, JSON.stringify(mapa));
    return chave + '-' + String(proximo).padStart(4, '0');
  }

  function previa(prefixo, responsavel) {
    return String(prefixo || 'DOC').toUpperCase() + '-' + tagResponsavel(responsavel) + '-PRÉVIA';
  }

  function arquivo(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  window.DoCampoDocumentCode = { reservar, previa, tagResponsavel, arquivo };
})();
