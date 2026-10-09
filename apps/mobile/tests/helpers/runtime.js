const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
    dump() { return Object.fromEntries(values); }
  };
}

function createIndexedDB() {
  const databases = new Map();

  function requestTask(action) {
    const request = {};
    queueMicrotask(() => {
      try {
        request.result = action();
        request.onsuccess?.({ target: request });
      } catch (error) {
        request.error = error;
        request.onerror?.({ target: request });
      }
    });
    return request;
  }

  function open(name, version) {
    const request = {};
    queueMicrotask(() => {
      try {
        let state = databases.get(name);
        const upgrade = !state || Number(version || 1) > state.version;
        if (!state) state = { version: Number(version || 1), stores: new Map() };
        if (upgrade) state.version = Number(version || 1);
        databases.set(name, state);
        const connection = {
          objectStoreNames: { contains: store => state.stores.has(store) },
          createObjectStore(store) {
            if (!state.stores.has(store)) state.stores.set(store, new Map());
            return {};
          },
          transaction(store) {
            if (!state.stores.has(store)) throw new Error('Object store not found: ' + store);
            const values = state.stores.get(store);
            let pending = 0, completed = false;
            const tx = {
              error: null,
              objectStore() {
                const operation = action => {
                  pending++;
                  const result = requestTask(action);
                  queueMicrotask(() => queueMicrotask(() => {
                    pending--;
                    if (!pending && !completed) {
                      completed = true;
                      tx.oncomplete?.();
                    }
                  }));
                  return result;
                };
                return {
                  get(key) { return operation(() => clone(values.get(key))); },
                  put(value, key) { return operation(() => { values.set(key, clone(value)); return key; }); },
                  delete(key) { return operation(() => values.delete(key)); }
                };
              }
            };
            return tx;
          },
          close() {}
        };
        request.result = connection;
        if (upgrade) request.onupgradeneeded?.({ target: request });
        request.onsuccess?.({ target: request });
      } catch (error) {
        request.error = error;
        request.onerror?.({ target: request });
      }
    });
    return request;
  }

  function deleteDatabase(name) {
    return requestTask(() => databases.delete(name));
  }

  return { open, deleteDatabase, _databases: databases };
}

class MiniEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) || []) handler.call(this, event);
    return true;
  }
}

class TestCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

function createRuntime(options = {}) {
  const eventTarget = new MiniEventTarget();
  const documentTarget = new MiniEventTarget();
  documentTarget.visibilityState = 'visible';
  documentTarget.addEventListener = documentTarget.addEventListener.bind(documentTarget);
  const context = {
    console,
    structuredClone: clone,
    crypto: webcrypto,
    indexedDB: options.indexedDB || createIndexedDB(),
    localStorage: options.localStorage || createStorage(options.storage),
    navigator: { onLine: options.online !== false, storage: { estimate: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 }) } },
    document: documentTarget,
    location: { pathname: '/index.html', href: 'https://app.local/index.html', reload() {} },
    history: { replaceState() {}, pushState() {} },
    CustomEvent: TestCustomEvent,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Blob,
    Response,
    atob,
    btoa
  };
  Object.assign(context, eventTarget);
  context.addEventListener = eventTarget.addEventListener.bind(eventTarget);
  context.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
  context.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function runFile(context, file) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context;
}

async function loadDatabase(options = {}) {
  const context = createRuntime(options);
  runFile(context, 'www/unified-db.js');
  await context.DoCampoDB.ready();
  return context;
}

module.exports = { createStorage, createIndexedDB, createRuntime, runFile, loadDatabase };
