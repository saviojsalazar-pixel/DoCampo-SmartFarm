(function () {
  'use strict';

  const BUCKET = 'docampo-documents';
  const DIR = 'docampo/photos';
  const deleteQueueId = () => 'media-delete-queue-' + (window.DoCampoDB?.deviceId?.() || 'local');

  const plugin = name => {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    try { return cap.registerPlugin ? cap.registerPlugin(name) : null; } catch (_) { return null; }
  };
  const native = () => !!window.Capacitor?.isNativePlatform?.();
  const newId = () => globalThis.crypto?.randomUUID?.() || ('foto-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  const split = data => String(data || '').includes(',') ? String(data).split(',')[1] : String(data || '');

  function transient(point, source) {
    try {
      Object.defineProperty(point, 'foto', { value: source, writable: true, configurable: true, enumerable: false });
    } catch (_) {
      point.foto = source;
    }
    return point;
  }

  function mediaDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('docampo_media_v2', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function webPut(key, data) {
    const db = await mediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(data, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function webGet(key) {
    const db = await mediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const request = tx.objectStore('photos').get(key);
      request.onsuccess = () => { db.close(); resolve(request.result || ''); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }

  async function webDelete(key) {
    const db = await mediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  function baseMeta(photoId) {
    return {
      photoId,
      photoLocalPath: DIR + '/' + photoId + '.jpg',
      photoRemotePath: 'photos/' + photoId + '.jpg',
      photoMime: 'image/jpeg',
      fotoRegistradaEm: new Date().toISOString(),
      photoSyncStatus: 'pending',
      photoSyncError: ''
    };
  }

  async function save(dataUri, preferredId) {
    const photoId = preferredId || newId();
    const meta = baseMeta(photoId);
    const base64 = split(dataUri);
    if (!base64) throw new Error('A imagem recebida está vazia.');
    const fs = plugin('Filesystem');
    if (native() && fs) {
      await fs.writeFile({ path: meta.photoLocalPath, data: base64, directory: 'DATA', recursive: true });
    } else {
      await webPut(photoId, 'data:image/jpeg;base64,' + base64);
    }
    return meta;
  }

  function adoptNative(result) {
    if (!result?.photoId || !result?.photoLocalPath) throw new Error('A câmera não devolveu um arquivo válido.');
    const meta = {
      photoId: result.photoId,
      photoLocalPath: result.photoLocalPath,
      photoRemotePath: result.photoRemotePath || ('photos/' + result.photoId + '.jpg'),
      photoMime: 'image/jpeg',
      photoBytes: Number(result.photoBytes) || 0,
      photoWidth: Number(result.width) || 0,
      photoHeight: Number(result.height) || 0,
      fotoRegistradaEm: new Date(Number(result.capturedAt) || Date.now()).toISOString(),
      photoSyncStatus: 'pending',
      photoSyncError: ''
    };
    if (result.photoAbsolutePath && window.Capacitor?.convertFileSrc) {
      meta.previewUrl = window.Capacitor.convertFileSrc(result.photoAbsolutePath);
    }
    return meta;
  }

  async function localPreview(point) {
    if (!point?.photoId) return '';
    if (point.previewUrl) return point.previewUrl;
    try {
      const fs = plugin('Filesystem');
      if (native() && fs) {
        const uri = await fs.getUri({ path: point.photoLocalPath || DIR + '/' + point.photoId + '.jpg', directory: 'DATA' });
        return window.Capacitor?.convertFileSrc ? window.Capacitor.convertFileSrc(uri.uri) : uri.uri;
      }
      return await webGet(point.photoId);
    } catch (_) {
      return '';
    }
  }

  async function readBase64(point) {
    if (!point?.photoId) return '';
    const fs = plugin('Filesystem');
    if (native() && fs) {
      const result = await fs.readFile({ path: point.photoLocalPath || DIR + '/' + point.photoId + '.jpg', directory: 'DATA' });
      return split(result.data);
    }
    return split(await webGet(point.photoId));
  }

  async function headers(contentType) {
    if (!window.DoCampoAuth?.status?.().authenticated) throw new Error('Entre na conta para sincronizar as fotos.');
    const token = await DoCampoAuth.accessToken();
    return {
      apikey: DoCampoCloudConfig.anonKey,
      Authorization: 'Bearer ' + token,
      ...(contentType ? { 'Content-Type': contentType } : {})
    };
  }

  function bytes(base64) {
    const raw = atob(split(base64));
    const result = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) result[i] = raw.charCodeAt(i);
    return result;
  }

  async function upload(point) {
    if (!point?.photoRemotePath) throw new Error('Foto sem caminho remoto.');
    if (point.photoSyncStatus === 'uploaded') return false;
    if (!navigator.onLine) throw new Error('Sem internet para enviar a foto.');
    const base64 = await readBase64(point);
    if (!base64) throw new Error('Arquivo local da foto não encontrado.');
    const url = DoCampoCloudConfig.url + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(point.photoRemotePath).replace(/%2F/g, '/');
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...(await headers('image/jpeg')), 'x-upsert': 'true' },
      body: bytes(base64)
    });
    if (!response.ok) throw new Error('Falha ao enviar a foto (' + response.status + ').');
    point.photoSyncStatus = 'uploaded';
    point.photoUploadedAt = new Date().toISOString();
    point.photoSyncError = '';
    return true;
  }

  async function download(point) {
    if (!navigator.onLine || !point?.photoRemotePath) return '';
    const url = DoCampoCloudConfig.url + '/storage/v1/object/authenticated/' + BUCKET + '/' + encodeURIComponent(point.photoRemotePath).replace(/%2F/g, '/');
    const response = await fetch(url, { headers: await headers() });
    if (!response.ok) throw new Error('Falha ao baixar a foto (' + response.status + ').');
    const array = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < array.length; i += 32768) binary += String.fromCharCode.apply(null, array.subarray(i, i + 32768));
    const dataUri = 'data:image/jpeg;base64,' + btoa(binary);
    const meta = await save(dataUri, point.photoId);
    Object.assign(point, meta, { photoSyncStatus: 'uploaded', photoUploadedAt: new Date().toISOString() });
    return localPreview(point);
  }

  async function hydrate(point) {
    if (!point) return point;
    if (point.foto && String(point.foto).startsWith('data:')) {
      const old = point.foto;
      const meta = await save(old, point.photoId);
      Object.assign(point, meta);
      delete point.foto;
    }
    let source = await localPreview(point);
    if (!source && point.photoSyncStatus === 'uploaded') source = await download(point).catch(() => '');
    if (source) transient(point, source);
    return point;
  }

  async function hydratePoints(points) {
    for (const point of (points || [])) await hydrate(point);
    return points || [];
  }

  async function hydrateVisits(visits) {
    for (const visit of (visits || [])) {
      for (const item of (visit.checklist || [])) await hydratePoints(item.pontosGps);
      await hydratePoints(visit.formDraft?.pontosGps);
    }
    return visits || [];
  }

  async function migrateDatabasePhotos() {
    if (!window.DoCampoDB) return 0;
    let total = 0;
    for (const visit of DoCampoDB.list('visits')) {
      const points = [...(visit.formDraft?.pontosGps || [])];
      for (const item of (visit.checklist || [])) points.push(...(item.pontosGps || []));
      if (!points.some(point => point?.foto && String(point.foto).startsWith('data:'))) continue;
      await hydrateVisits([visit]);
      DoCampoDB.upsert('visits', visit);
      total++;
    }
    return total;
  }

  async function syncVisits(visits) {
    const report = { uploaded: 0, failed: 0, errors: [] };
    for (const visit of (visits || [])) {
      let changed = false;
      const points = [...(visit.formDraft?.pontosGps || [])];
      for (const item of (visit.checklist || [])) points.push(...(item.pontosGps || []));
      for (const point of points) {
        if (!point?.photoId || point.photoSyncStatus === 'uploaded') continue;
        try {
          if (await upload(point)) report.uploaded++;
          changed = true;
        } catch (error) {
          point.photoSyncStatus = 'error';
          point.photoSyncError = error.message;
          point.photoLastAttemptAt = new Date().toISOString();
          report.failed++;
          report.errors.push({ photoId: point.photoId, message: error.message });
          changed = true;
        }
      }
      if (changed && window.DoCampoDB) DoCampoDB.upsert('visits', visit);
    }
    await processDeleteQueue();
    return report;
  }

  function deleteQueue() {
    return window.DoCampoDB?.get('settings', deleteQueueId())?.paths || [];
  }

  function saveDeleteQueue(paths) {
    if (!window.DoCampoDB) return;
    DoCampoDB.upsert('settings', {
      id: deleteQueueId(),
      settingType: 'local-media-delete-queue',
      ownerDeviceId: DoCampoDB.deviceId(),
      paths: [...new Set(paths)],
      verified: true
    }, { enqueue: false });
  }

  async function deleteRemote(path) {
    if (!path || !navigator.onLine || !window.DoCampoAuth?.status?.().authenticated) return false;
    const url = DoCampoCloudConfig.url + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(path).replace(/%2F/g, '/');
    const response = await fetch(url, { method: 'DELETE', headers: await headers() });
    return response.ok || response.status === 404;
  }

  async function processDeleteQueue() {
    const remaining = [];
    for (const path of deleteQueue()) {
      try {
        if (!await deleteRemote(path)) remaining.push(path);
      } catch (_) {
        remaining.push(path);
      }
    }
    if (remaining.length !== deleteQueue().length) saveDeleteQueue(remaining);
    return remaining.length;
  }

  async function remove(point) {
    if (!point?.photoId) return;
    const fs = plugin('Filesystem');
    try {
      if (native() && fs) await fs.deleteFile({ path: point.photoLocalPath || DIR + '/' + point.photoId + '.jpg', directory: 'DATA' });
      else await webDelete(point.photoId);
    } catch (_) {}
    if (point.photoRemotePath && !await deleteRemote(point.photoRemotePath).catch(() => false)) {
      saveDeleteQueue([...deleteQueue(), point.photoRemotePath]);
    }
  }

  async function clearAllLocal() {
    const fs = plugin('Filesystem');
    if (native() && fs) {
      try { await fs.rmdir({ path: 'docampo', directory: 'DATA', recursive: true }); } catch (_) {}
    }
    if (globalThis.indexedDB) {
      await new Promise(resolve => {
        const request = indexedDB.deleteDatabase('docampo_media_v2');
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  }

  async function stats() {
    const estimate = await navigator.storage?.estimate?.().catch?.(() => null);
    return { used: Number(estimate?.usage || 0), quota: Number(estimate?.quota || 0) };
  }

  window.DoCampoPhotos = {
    save,
    adoptNative,
    read: async point => {
      const base64 = await readBase64(point);
      return base64 ? 'data:image/jpeg;base64,' + base64 : '';
    },
    upload,
    hydrate,
    hydratePoints,
    hydrateVisits,
    migrateDatabasePhotos,
    syncVisits,
    remove,
    clearAllLocal,
    stats,
    transient
  };
})();
