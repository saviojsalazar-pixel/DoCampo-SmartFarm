(function () {
  'use strict';

  const timers = new Map();

  function id(moduleName) {
    const device = window.DoCampoDB ? DoCampoDB.deviceId() : 'aparelho';
    return 'draft-' + String(moduleName || 'form') + '-' + device;
  }

  function load(moduleName) {
    if (!window.DoCampoDB) return null;
    const record = DoCampoDB.get('drafts', id(moduleName));
    return record && !record.deletedAt ? record.formDraft || null : null;
  }

  function save(moduleName, formDraft) {
    if (!window.DoCampoDB || !formDraft) return null;
    return DoCampoDB.upsert('drafts', {
      id: id(moduleName),
      module: moduleName,
      ownerDeviceId: DoCampoDB.deviceId(),
      formDraft,
      savedAt: new Date().toISOString()
    }, { enqueue: false });
  }

  function schedule(moduleName, capture, delay = 450) {
    clearTimeout(timers.get(moduleName));
    timers.set(moduleName, setTimeout(() => {
      try {
        const value = capture();
        if (value) save(moduleName, value);
      } catch (error) {
        window.dispatchEvent(new CustomEvent('docampo:draft-error', { detail: { moduleName, message: error.message } }));
      }
    }, delay));
  }

  function bind(moduleName, capture) {
    const handler = () => schedule(moduleName, capture);
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    document.addEventListener('click', handler, false);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(timers.get(moduleName));
        try { const value = capture(); if (value) save(moduleName, value); } catch (_) {}
      }
    });
    return handler;
  }

  function clear(moduleName) {
    clearTimeout(timers.get(moduleName));
    timers.delete(moduleName);
    if (!window.DoCampoDB) return false;
    const record = DoCampoDB.get('drafts', id(moduleName));
    return record && !record.deletedAt
      ? DoCampoDB.softDelete('drafts', record.id, { removalReason: 'Formulário concluído ou limpo' }, { enqueue: false })
      : false;
  }

  function captureControls(root, exclude) {
    const container = typeof root === 'string' ? document.querySelector(root) : (root || document);
    const ignored = exclude instanceof RegExp ? exclude : /$a/;
    const controls = {};
    container?.querySelectorAll?.('input[id],select[id],textarea[id]')?.forEach(element => {
      if (ignored.test(element.id) || element.type === 'file') return;
      controls[element.id] = /checkbox|radio/.test(element.type)
        ? { checked: element.checked }
        : { value: element.value };
    });
    return controls;
  }

  function restoreControls(controls) {
    Object.entries(controls || {}).forEach(([controlId, saved]) => {
      const element = document.getElementById(controlId);
      if (!element || !saved) return;
      if ('checked' in saved) element.checked = !!saved.checked;
      else if ('value' in saved) element.value = saved.value == null ? '' : saved.value;
    });
  }

  window.DoCampoDrafts = { id, load, save, schedule, bind, clear, captureControls, restoreControls };
})();
