(function () {
  'use strict';

  /*
   * Banco canônico do Do Campo SmartFarm.
   * A geração muda somente numa restauração de fábrica planejada. O servidor
   * também valida esse valor, impedindo aparelhos antigos de repovoar a base.
   */
  const APP_VERSION = '1.9.46';
  const DATA_GENERATION = '8d487154-0a7b-4d39-9228-7c6cc414d979';
  const SCHEMA_VERSION = 2;
  const IDB_NAME = 'docampo_core_v2';
  const IDB_STORE = 'state';
  const IDB_KEY = 'canonical-database';
  const GENERATION_KEY = 'docampo_data_generation_v2';
  const JOURNAL_KEY = 'docampo_write_journal_v2';
  const DEVICE_KEY = 'docampo_device_id_v2';
  const USER_KEY = 'docampo_current_user_v2';
  const USER_CONFIRMED_KEY = 'docampo_current_user_confirmed_v2';
  const CLEANUP_KEY = 'docampo_factory_cleanup_pending_v2';
  const TYPES = [
    'producers', 'farms', 'fields', 'products', 'visits', 'recommendations',
    'documents', 'foliarAnalyses', 'soilAnalyses', 'productionReports', 'drafts', 'settings'
  ];

  const now = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));

  function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function stableId(prefix, value) {
    const text = String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      a ^= code;
      a = Math.imul(a, 0x01000193) >>> 0;
      b ^= code + i;
      b = Math.imul(b, 0x85ebca6b) >>> 0;
    }
    return String(prefix || 'item').replace(/[^a-z0-9_-]/gi, '-').toLowerCase() + '-' +
      a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  function empty() {
    const entities = {};
    TYPES.forEach(type => { entities[type] = {}; });
    return {
      schemaVersion: SCHEMA_VERSION,
      generation: DATA_GENERATION,
      entities,
      events: [],
      queue: [],
      conflicts: [],
      trash: [],
      purgedTombstones: {},
      lastSyncAt: null,
      lastServerSequence: 0,
      createdAt: now()
    };
  }

  function normalizeDatabase(input) {
    const value = input && typeof input === 'object' ? input : empty();
    if (value.generation !== DATA_GENERATION) return empty();
    value.schemaVersion = SCHEMA_VERSION;
    value.entities = value.entities && typeof value.entities === 'object' ? value.entities : {};
    TYPES.forEach(type => {
      if (!value.entities[type] || typeof value.entities[type] !== 'object') value.entities[type] = {};
    });
    value.events = Array.isArray(value.events) ? value.events : [];
    value.queue = Array.isArray(value.queue) ? value.queue : [];
    value.conflicts = Array.isArray(value.conflicts) ? value.conflicts : [];
    value.trash = Array.isArray(value.trash) ? value.trash : [];
    value.purgedTombstones = value.purgedTombstones && typeof value.purgedTombstones === 'object' ? value.purgedTombstones : {};
    value.lastServerSequence = Number(value.lastServerSequence) || 0;
    return value;
  }

  const firstRunOfGeneration = localStorage.getItem(GENERATION_KEY) !== DATA_GENERATION;
  if (firstRunOfGeneration) {
    localStorage.clear();
    localStorage.setItem(GENERATION_KEY, DATA_GENERATION);
    localStorage.setItem(CLEANUP_KEY, '1');
  }

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'celular-' + uuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function user() {
    return localStorage.getItem(USER_KEY) || 'M.Sc. Sávio José Souza Salazar';
  }

  function setUser(name) {
    localStorage.setItem(USER_KEY, String(name || '').trim() || 'M.Sc. Sávio José Souza Salazar');
    localStorage.setItem(USER_CONFIRMED_KEY, '1');
    emit();
    return user();
  }

  function userConfirmed() {
    return localStorage.getItem(USER_CONFIRMED_KEY) === '1';
  }

  function deleteIdb(name) {
    if (!globalThis.indexedDB) return Promise.resolve();
    return new Promise(resolve => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }

  function openIdb() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco local.'));
      request.onblocked = () => reject(new Error('O banco local está bloqueado por outra tela do aplicativo.'));
    });
  }

  async function idbGet() {
    const db = await openIdb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(IDB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Falha ao ler o banco local.'));
      };
    });
  }

  async function idbPut(value) {
    const db = await openIdb();
    if (!db) throw new Error('Este aparelho não disponibilizou o banco transacional IndexedDB.');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, IDB_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Falha ao gravar o banco local.'));
      };
    });
  }

  function readJournal() {
    try {
      const entries = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
      return Array.isArray(entries) ? entries : [];
    } catch (_) {
      throw new Error('O diário de segurança local está corrompido. Não continue usando o aplicativo.');
    }
  }

  let journalSequence = readJournal().reduce((max, item) => Math.max(max, Number(item.seq) || 0), 0);

  function appendJournalBatch(rawEntries) {
    const candidates = (rawEntries || []).filter(Boolean);
    if (!candidates.length) return journalSequence;
    const entries = readJournal();
    let nextSequence = journalSequence;
    const saved = candidates.map(entry => ({ ...entry, seq: ++nextSequence, journaledAt: now() }));
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify([...entries, ...saved].slice(-250)));
    } catch (cause) {
      const error = new Error('Não foi possível criar o diário de segurança. O registro não foi alterado.');
      error.code = 'LOCAL_JOURNAL_FAILED';
      error.cause = cause;
      throw error;
    }
    journalSequence = nextSequence;
    return journalSequence;
  }

  function appendJournal(entry) {
    return appendJournalBatch([entry]);
  }

  function clearJournalThrough(sequence) {
    const remaining = readJournal().filter(item => (Number(item.seq) || 0) > sequence);
    if (remaining.length) localStorage.setItem(JOURNAL_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(JOURNAL_KEY);
  }

  function replayJournal(target, entries) {
    let result = target;
    entries.forEach(entry => {
      if (entry.kind === 'snapshot' && entry.database) {
        result = normalizeDatabase(clone(entry.database));
        return;
      }
      if (!TYPES.includes(entry.entityType) || !entry.entityId) return;
      if (entry.kind === 'hard-delete') delete result.entities[entry.entityType][entry.entityId];
      else if (entry.record) result.entities[entry.entityType][entry.entityId] = entry.record;
      if (entry.event) {
        const eventIndex = result.events.findIndex(event => event.id === entry.event.id);
        if (eventIndex >= 0) result.events[eventIndex] = entry.event;
        else result.events.push(entry.event);
        if (!result.queue.includes(entry.event.id)) result.queue.push(entry.event.id);
      }
    });
    return result;
  }

  let database = empty();
  let databaseReady = false;
  let startupError = null;
  let dirty = false;
  let persistTask = null;
  let lastPersistenceError = null;
  let transactionDepth = 0;

  const readyPromise = (async () => {
    try {
      if (firstRunOfGeneration) {
        await Promise.all([deleteIdb(IDB_NAME), deleteIdb('docampo_media_v1'), deleteIdb('docampo_media_v2')]);
      }
      const stored = normalizeDatabase(await idbGet());
      database = replayJournal(stored, readJournal());
      databaseReady = true;
      await idbPut(clone(database));
      clearJournalThrough(journalSequence);
      window.dispatchEvent(new CustomEvent('docampo:db-ready', { detail: status() }));
      emit();
      return database;
    } catch (error) {
      startupError = error;
      databaseReady = false;
      window.dispatchEvent(new CustomEvent('docampo:db-fatal', { detail: { message: error.message } }));
      throw error;
    }
  })();

  function schedulePersist() {
    dirty = true;
    if (persistTask) return persistTask;
    persistTask = (async () => {
      await readyPromise;
      while (dirty) {
        dirty = false;
        const snapshot = clone(database);
        const through = journalSequence;
        try {
          await idbPut(snapshot);
          clearJournalThrough(through);
          lastPersistenceError = null;
        } catch (error) {
          lastPersistenceError = error;
          dirty = true;
          window.dispatchEvent(new CustomEvent('docampo:persistence-error', { detail: { message: error.message } }));
          throw error;
        }
      }
    })().finally(() => { persistTask = null; });
    return persistTask;
  }

  async function ready() {
    await readyPromise;
    return true;
  }

  async function flush() {
    await readyPromise;
    if (dirty && !persistTask) schedulePersist();
    if (persistTask) await persistTask;
    return true;
  }

  function read() {
    return database;
  }

  function compact(target) {
    const queued = new Set(target.queue || []);
    const remote = (target.events || []).filter(event => event.remote).slice(-1500);
    const local = (target.events || []).filter(event => !event.remote && (queued.has(event.id) || !event.syncedAt)).slice(-1500);
    target.events = [...remote, ...local];
    target.trash = Array.from(new Map((target.trash || []).map(item => [item.type + '|' + item.id, item])).values());
    return target;
  }

  function commit(journalEntry) {
    if (startupError) throw startupError;
    if (transactionDepth) {
      compact(database);
      return database;
    }
    if (journalEntry) appendJournal(journalEntry);
    compact(database);
    emit();
    schedulePersist().catch(error => console.error('Falha persistente no banco local:', error));
    return database;
  }

  function transaction(action) {
    if (!databaseReady) throw new Error('O banco local ainda está carregando. Aguarde alguns segundos e tente novamente.');
    if (typeof action !== 'function') throw new Error('Transação inválida.');
    if (transactionDepth) return action();
    const before = clone(database);
    transactionDepth = 1;
    try {
      const result = action();
      if (result && typeof result.then === 'function') throw new Error('A transação local não aceita operações assíncronas.');
      compact(database);
      appendJournal({ kind: 'snapshot', database: clone(database) });
      transactionDepth = 0;
      emit();
      schedulePersist().catch(error => console.error('Falha persistente no banco local:', error));
      return result;
    } catch (error) {
      database = before;
      transactionDepth = 0;
      emit();
      throw error;
    }
  }

  function eventFor(type, id, operation, payload, baseRevision) {
    return {
      id: uuid(),
      entityType: type,
      entityId: id,
      operation,
      payload,
      deviceId: deviceId(),
      userName: user(),
      createdAt: now(),
      baseRevision: Number(baseRevision) || 0,
      appVersion: APP_VERSION,
      generation: DATA_GENERATION
    };
  }

  function enqueueLatest(event) {
    const queued = new Set(database.queue || []);
    const obsolete = database.events
      .filter(old => queued.has(old.id) && old.entityType === event.entityType && old.entityId === event.entityId)
      .map(old => old.id);
    if (obsolete.length) {
      const remove = new Set(obsolete);
      database.events = database.events.filter(old => !remove.has(old.id));
      database.queue = database.queue.filter(id => !remove.has(id));
    }
    database.events.push(event);
    database.queue.push(event.id);
  }

  const stable = value => JSON.stringify(value === undefined ? null : value);
  const itemKey = item => String(item?.id || item?.talhao || item?.field || '')
    .trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function stampObjectChanges(previous, incoming, timestamp) {
    const old = previous && typeof previous === 'object' ? previous : {};
    const next = incoming && typeof incoming === 'object' ? { ...incoming } : {};
    const clocks = { ...(old._fieldClock || {}), ...(next._fieldClock || {}) };
    Object.keys(next).filter(key => key !== '_fieldClock').forEach(key => {
      if (stable(next[key]) !== stable(old[key])) clocks[key] = timestamp;
    });
    next._fieldClock = clocks;
    return next;
  }

  function latestClock(value, fallback) {
    const clocks = Object.values(value?._fieldClock || {}).map(String);
    if (!clocks.length) return String(fallback || '');
    return clocks.reduce((latest, stamp) => stamp > latest ? stamp : latest, '');
  }

  function prepareVisit(previous, incoming, timestamp) {
    const next = stampObjectChanges(previous, incoming, timestamp);
    const hasChecklist = Object.prototype.hasOwnProperty.call(incoming || {}, 'checklist');
    const hasFormDraft = Object.prototype.hasOwnProperty.call(incoming || {}, 'formDraft');
    if (!hasChecklist) {
      if (previous && Object.prototype.hasOwnProperty.call(previous, 'checklist')) next.checklist = previous.checklist;
      if (previous && Object.prototype.hasOwnProperty.call(previous, 'checklistTombstones')) next.checklistTombstones = previous.checklistTombstones;
      if (!hasFormDraft && previous && Object.prototype.hasOwnProperty.call(previous, 'formDraft')) next.formDraft = previous.formDraft;
      return next;
    }
    const oldItems = new Map((previous?.checklist || []).map(item => [itemKey(item), item]));
    const incomingItems = Array.isArray(incoming.checklist) ? incoming.checklist : [];
    const incomingKeys = new Set(incomingItems.map(itemKey).filter(Boolean));
    const tombstones = { ...(previous?.checklistTombstones || {}), ...(incoming.checklistTombstones || {}) };
    oldItems.forEach((item, key) => {
      if (key && !incomingKeys.has(key)) tombstones[key] = timestamp;
    });
    next.checklist = incomingItems.map(item => {
      const key = itemKey(item) || uuid();
      return { ...stampObjectChanges(oldItems.get(key), item, timestamp), _itemKey: key };
    }).filter(item => latestClock(item, timestamp) > String(tombstones[item._itemKey] || ''));
    next.checklistTombstones = tombstones;
    if (hasFormDraft && incoming.formDraft && typeof incoming.formDraft === 'object') {
      next.formDraft = stampObjectChanges(previous?.formDraft, incoming.formDraft, timestamp);
    }
    return next;
  }

  function upsert(type, input, options = {}) {
    if (!databaseReady) throw new Error('O banco local ainda está carregando. Aguarde alguns segundos e tente novamente.');
    if (!TYPES.includes(type)) throw new Error('Tipo de registro inválido: ' + type);
    if (!input || typeof input !== 'object') throw new Error('Registro inválido.');
    const id = input.id || uuid();
    const old = database.entities[type][id];
    const timestamp = now();
    const source = type === 'visits' ? prepareVisit(old, input, timestamp) : input;
    const record = {
      ...(old || {}),
      ...source,
      id,
      type,
      revision: (Number(old?.revision) || 0) + 1,
      createdAt: old?.createdAt || timestamp,
      updatedAt: timestamp,
      updatedBy: user(),
      deviceId: deviceId(),
      generation: DATA_GENERATION,
      deletedAt: null,
      verified: input.verified !== false
    };
    if (old?.deletedAt) record.restoredAt = input.restoredAt || timestamp;
    if (type === 'products' && !old && input.verified !== true) {
      record.verified = false;
      record.localStatus = 'Cadastro local — conferir';
    }
    database.entities[type][id] = record;
    const event = options.enqueue === false ? null : eventFor(type, id, 'upsert', record, old?.revision || 0);
    if (event) enqueueLatest(event);
    commit({
      kind: 'upsert',
      entityType: type,
      entityId: id,
      record,
      event
    });
    return record;
  }

  function softDelete(type, id, metadata = {}, options = {}) {
    if (!databaseReady) throw new Error('O banco local ainda está carregando. Aguarde alguns segundos e tente novamente.');
    const old = database.entities[type]?.[id];
    if (!old) return false;
    if (old.deletedAt) return true;
    const timestamp = now();
    const record = {
      ...old,
      ...metadata,
      revision: (Number(old.revision) || 0) + 1,
      deletedAt: timestamp,
      updatedAt: timestamp,
      updatedBy: user(),
      deviceId: deviceId(),
      generation: DATA_GENERATION
    };
    database.entities[type][id] = record;
    database.trash = database.trash.filter(item => !(item.type === type && item.id === id));
    database.trash.push({ type, id, deletedAt: timestamp });
    const event = options.enqueue === false ? null : eventFor(type, id, 'delete', record, old.revision || 0);
    if (event) enqueueLatest(event);
    commit({ kind: 'delete', entityType: type, entityId: id, record, event });
    return true;
  }

  function restore(type, id) {
    const old = database.entities[type]?.[id];
    if (!old) return false;
    database.trash = database.trash.filter(item => !(item.type === type && item.id === id));
    return upsert(type, { ...old, deletedAt: null, restoredAt: now() });
  }

  function hardDelete(type, id) {
    if (!databaseReady) throw new Error('O banco local ainda está carregando. Aguarde alguns segundos e tente novamente.');
    if (!database.entities[type]?.[id]) return false;
    delete database.entities[type][id];
    database.purgedTombstones[type + '|' + id] = {
      type,
      id,
      purgedAt: now()
    };
    database.trash = database.trash.filter(item => !(item.type === type && item.id === id));
    const queued = new Set(database.queue);
    const pendingTombstones = new Set(database.events
      .filter(event => queued.has(event.id) && event.entityType === type && event.entityId === id && event.operation === 'delete')
      .map(event => event.id));
    const related = new Set(database.events
      .filter(event => event.entityType === type && event.entityId === id)
      .map(event => event.id));
    database.events = database.events.filter(event => !related.has(event.id) || pendingTombstones.has(event.id));
    database.queue = database.queue.filter(eventId => !related.has(eventId) || pendingTombstones.has(eventId));
    commit({ kind: 'snapshot', database: clone(database) });
    return true;
  }

  function list(type, { deleted = false } = {}) {
    return Object.values(database.entities[type] || {})
      .filter(item => deleted ? !!item.deletedAt : !item.deletedAt)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function get(type, id) {
    return database.entities[type]?.[id] || null;
  }

  function archiveOldDocuments(days = 7) {
    const limit = Date.now() - Math.max(1, Number(days) || 7) * 86400000;
    let total = 0;
    list('documents').forEach(doc => {
      const base = new Date(doc.restoredAt || doc.generatedAt || doc.createdAt || 0).getTime();
      if (base && base <= limit && softDelete('documents', doc.id)) total++;
    });
    return total;
  }

  function addDocument(meta) {
    return upsert('documents', { ...meta, snapshot: clone(meta.snapshot || {}), immutable: true });
  }

  function patchDocumentLocal(id, patch) {
    const doc = database.entities.documents?.[id];
    if (!doc) return null;
    const record = { ...doc, ...patch, updatedAt: doc.updatedAt };
    database.entities.documents[id] = record;
    const queued = new Set(database.queue);
    let queuedEvent = null;
    database.events = database.events.map(event => {
      if (queued.has(event.id) && event.entityType === 'documents' && event.entityId === id) {
        queuedEvent = { ...event, payload: { ...event.payload, ...patch } };
        return queuedEvent;
      }
      return event;
    });
    commit({ kind: 'upsert', entityType: 'documents', entityId: id, record, event: queuedEvent });
    return record;
  }

  function patchDocumentCloud(id, patch) {
    const doc = database.entities.documents?.[id];
    if (!doc) return null;
    const queued = new Set(database.queue);
    let hasQueued = false;
    let event = null;
    let record = { ...doc, ...patch };
    database.events = database.events.map(existingEvent => {
      if (queued.has(existingEvent.id) && existingEvent.entityType === 'documents' && existingEvent.entityId === id) {
        hasQueued = true;
        const updatedEvent = { ...existingEvent, payload: { ...existingEvent.payload, ...patch } };
        event = updatedEvent;
        return updatedEvent;
      }
      return existingEvent;
    });
    if (!hasQueued) {
      const oldRevision = Number(doc.revision) || 0;
      record = { ...record, revision: oldRevision + 1, updatedAt: now(), updatedBy: user(), deviceId: deviceId() };
      event = eventFor('documents', id, 'upsert', record, oldRevision);
      enqueueLatest(event);
    }
    database.entities.documents[id] = record;
    commit({ kind: 'upsert', entityType: 'documents', entityId: id, record, event });
    return record;
  }

  function status() {
    return {
      ready: databaseReady,
      fatalError: startupError?.message || '',
      persistenceError: lastPersistenceError?.message || '',
      online: navigator.onLine,
      pending: database.queue.length,
      conflicts: database.conflicts.filter(item => !item.resolvedAt).length,
      lastSyncAt: database.lastSyncAt,
      lastServerSequence: database.lastServerSequence,
      configured: !!window.DoCampoCloudConfig?.configured,
      deviceId: deviceId(),
      user: user(),
      generation: DATA_GENERATION,
      schemaVersion: SCHEMA_VERSION
    };
  }

  function optimize() {
    const before = JSON.stringify(database).length;
    compact(database);
    commit();
    return {
      before,
      after: JSON.stringify(database).length,
      events: database.events.length,
      pending: database.queue.length
    };
  }

  function pendingEvents() {
    const queued = new Set(database.queue);
    return database.events.filter(event => queued.has(event.id));
  }

  function markSynced(ids, serverSequence) {
    const set = new Set(ids || []);
    const stamp = now();
    database.queue = database.queue.filter(id => !set.has(id));
    database.events = database.events.map(event => set.has(event.id) ? { ...event, syncedAt: stamp } : event);
    database.lastSyncAt = stamp;
    if (Number(serverSequence) > database.lastServerSequence) database.lastServerSequence = Number(serverSequence);
    commit();
  }

  function mergeClocked(local, remote, localFallback, remoteFallback) {
    const result = {};
    const localClocks = local?._fieldClock || {};
    const remoteClocks = remote?._fieldClock || {};
    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    keys.delete('_fieldClock');
    keys.forEach(key => {
      const localTime = String(localClocks[key] || localFallback || '');
      const remoteTime = String(remoteClocks[key] || remoteFallback || '');
      result[key] = remoteTime > localTime ? remote?.[key] : local?.[key];
    });
    result._fieldClock = { ...localClocks, ...remoteClocks };
    Object.keys(result._fieldClock).forEach(key => {
      if (String(localClocks[key] || '') > String(remoteClocks[key] || '')) result._fieldClock[key] = localClocks[key];
    });
    return result;
  }

  function mergeVisits(local, remote, remoteTime) {
    const merged = mergeClocked(local, remote, local.updatedAt, remoteTime);
    const localItems = new Map((local.checklist || []).map(item => [itemKey(item), item]));
    const remoteItems = new Map((remote.checklist || []).map(item => [itemKey(item), item]));
    const keys = new Set([...localItems.keys(), ...remoteItems.keys()]);
    const tombstones = { ...(local.checklistTombstones || {}) };
    Object.entries(remote.checklistTombstones || {}).forEach(([key, stamp]) => {
      if (String(stamp || '') > String(tombstones[key] || '')) tombstones[key] = stamp;
    });
    merged.checklist = Array.from(keys).filter(Boolean).map(key => {
      const a = localItems.get(key);
      const b = remoteItems.get(key);
      if (!a) return b;
      if (!b) return a;
      return { ...mergeClocked(a, b, local.updatedAt, remoteTime), _itemKey: key };
    }).filter(item => latestClock(item, remoteTime) > String(tombstones[item._itemKey] || ''));
    merged.checklistTombstones = tombstones;
    if (local.formDraft || remote.formDraft) {
      merged.formDraft = mergeClocked(local.formDraft || {}, remote.formDraft || {}, local.updatedAt, remoteTime);
    }
    merged.id = local.id;
    merged.mergedFromDevices = true;
    return merged;
  }

  function applyRemote(event) {
    const type = event.entity_type || event.entityType;
    const id = event.entity_id || event.entityId;
    const generation = event.generation || event.payload?.generation;
    const sequence = Number(event.server_sequence || event.serverSequence) || 0;
    if (generation !== DATA_GENERATION) return 'wrong-generation';
    if (!TYPES.includes(type) || !id) return 'invalid';
    if (database.events.some(item => item.id === event.id)) {
      if (sequence > database.lastServerSequence) database.lastServerSequence = sequence;
      return 'known';
    }

    const local = database.entities[type]?.[id];
    const purged = database.purgedTombstones[type + '|' + id];
    let payload = { ...(event.payload || {}) };
    const queued = new Set(database.queue);
    const hasPending = database.events.some(item =>
      queued.has(item.id) && item.entityType === type && item.entityId === id
    );
    if (type === 'documents') {
      delete payload.localPath;
      delete payload.localAvailable;
      payload = { ...payload, localAvailable: !!local?.localAvailable, localPath: local?.localPath || '' };
    }
    const remoteDelete = event.operation === 'delete' || !!payload.deletedAt;
    const localDelete = !!local?.deletedAt;
    const remoteRestore = !!payload.restoredAt && String(payload.restoredAt) > String(local?.deletedAt || '');
    let outcome = 'applied';

    if (purged) {
      outcome = 'purged-tombstone';
    } else if (localDelete && !remoteDelete && !remoteRestore) {
      outcome = 'tombstone';
    } else if (type === 'visits' && local && hasPending && !localDelete && !remoteDelete) {
      const remoteTime = payload.updatedAt || event.server_created_at || event.created_at || '';
      const merged = mergeVisits(local, payload, remoteTime);
      return transaction(() => {
        database.events.push({ id: event.id, remote: true, serverSequence: sequence });
        if (sequence > database.lastServerSequence) database.lastServerSequence = sequence;
        upsert('visits', merged);
        return 'merged';
      });
    } else if (local && hasPending && local.deviceId !== (event.device_id || event.deviceId) && !remoteDelete) {
      if (!database.conflicts.some(item => item.remoteEventId === event.id)) {
        database.conflicts.push({
          id: uuid(),
          entityType: type,
          entityId: id,
          local,
          remote: payload,
          remoteEventId: event.id,
          createdAt: now(),
          resolvedAt: null
        });
      }
      outcome = 'conflict';
    } else if (remoteDelete) {
      const record = {
        ...payload,
        id,
        deletedAt: payload.deletedAt || event.server_created_at || event.created_at || now()
      };
      database.entities[type][id] = record;
      database.trash = database.trash.filter(item => !(item.type === type && item.id === id));
      database.trash.push({ type, id, deletedAt: record.deletedAt });
    } else {
      const remoteTime = String(payload.updatedAt || event.server_created_at || event.created_at || '');
      const localTime = String(local?.updatedAt || '');
      if (local && !hasPending && localTime && remoteTime && localTime > remoteTime) outcome = 'stale';
      else database.entities[type][id] = { ...payload, id, generation: DATA_GENERATION };
    }

    database.events.push({ id: event.id, remote: true, serverSequence: sequence });
    if (sequence > database.lastServerSequence) database.lastServerSequence = sequence;
    commit();
    return outcome;
  }

  function resolveConflict(id, choice) {
    const conflict = database.conflicts.find(item => item.id === id && !item.resolvedAt);
    if (!conflict) return false;
    if (choice !== 'local' && choice !== 'remote') throw new Error('Escolha de conflito inválida.');
    return transaction(() => {
      conflict.resolvedAt = now();
      conflict.resolution = choice;
      if (choice === 'remote') upsert(conflict.entityType, { ...conflict.remote, id: conflict.entityId });
      else upsert(conflict.entityType, { ...conflict.local, id: conflict.entityId });
      return true;
    });
  }

  async function replaceFromBackup(input) {
    await ready();
    if (!input || input.generation !== DATA_GENERATION || Number(input.schemaVersion) !== SCHEMA_VERSION) {
      throw new Error('Este backup pertence a outra geração do aplicativo e não pode ser importado.');
    }
    const restored = normalizeDatabase(clone(input));
    Object.values(restored.entities.documents || {}).forEach(doc => {
      doc.localAvailable = false;
      doc.localPath = '';
    });
    database = restored;
    appendJournal({ kind: 'snapshot', database: clone(database) });
    dirty = true;
    await schedulePersist();
    emit();
    return true;
  }

  async function factoryResetLocal() {
    try { await flush(); } catch (_) {}
    localStorage.clear();
    await Promise.all([deleteIdb(IDB_NAME), deleteIdb('docampo_media_v1'), deleteIdb('docampo_media_v2')]);
    localStorage.setItem(GENERATION_KEY, DATA_GENERATION);
    localStorage.setItem(CLEANUP_KEY, '1');
    location.reload();
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('docampo:db-status', { detail: status() }));
  }

  window.DoCampoDB = {
    ready,
    flush,
    read,
    list,
    get,
    upsert,
    softDelete,
    restore,
    hardDelete,
    archiveOldDocuments,
    addDocument,
    patchDocumentLocal,
    patchDocumentCloud,
    transaction,
    status,
    optimize,
    pendingEvents,
    markSynced,
    applyRemote,
    resolveConflict,
    setUser,
    user,
    userConfirmed,
    deviceId,
    replaceFromBackup,
    factoryResetLocal,
    stableId,
    generation: DATA_GENERATION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION
  };

  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush().catch(() => {});
  });
  window.addEventListener('pagehide', () => { flush().catch(() => {}); });
  setTimeout(emit, 0);
})();
