(function () {
  'use strict';

  function norm(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function normField(value) {
    return norm(value).replace(/[.\s]+$/g, '');
  }

  function sameFarm(a, b) { return norm(a) === norm(b); }
  function hasAction(item, kind) {
    const text = norm(item && item.indicacoes);
    return kind === 'herbicida' ? text.includes('herbicida') : text.includes('pulverizacao');
  }

  function currentVisitFor(farm) {
    if (!window.DoCampoDB) return null;
    // DoCampoDB.list ja retorna do mais recentemente atualizado para o mais
    // antigo. Assim o filtro acompanha a ultima visita disponivel, inclusive
    // quando ela veio do outro celular pela sincronizacao.
    return (window.DoCampoDB.list('visits') || []).find(v => sameFarm(v.farmName, farm) && Array.isArray(v.checklist)) || null;
  }

  function localChecklistFor(farm) {
    try {
      const list = JSON.parse(localStorage.getItem('docampo_listaAvaliacoes') || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(item => sameFarm(item.fazenda, farm));
    } catch (_) { return []; }
  }

  function get(farm, kind) {
    const visit = currentVisitFor(farm);
    let checklist = visit && Array.isArray(visit.checklist) ? visit.checklist : [];
    let source = visit ? 'visita' : '';
    const local = localChecklistFor(farm);
    if (!checklist.length && local.length) { checklist = local; source = 'local'; }
    const fields = checklist.filter(item => hasAction(item, kind)).map(item => item.talhao).filter(Boolean);
    return { fields, keys: new Set(fields.map(normField)), checklist, visit, source };
  }

  function matches(fieldName, result) { return !!result && result.keys.has(normField(fieldName)); }

  window.DoCampoChecklistFilter = { get, matches, normField };
})();
