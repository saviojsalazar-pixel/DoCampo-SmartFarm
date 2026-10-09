(function () {
  'use strict';

  const PAGE_SIZE = 500;
  const cfg = () => window.DoCampoCloudConfig || {};

  async function headers(prefer) {
    if (!window.DoCampoAuth) throw new Error('O módulo de autenticação não foi carregado nesta tela.');
    const token = await DoCampoAuth.accessToken();
    return {
      apikey: cfg().anonKey,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    };
  }

  async function responseError(response, prefix) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data.message || data.details || data.hint || data.code || '';
    } catch (_) {
      detail = await response.text().catch(() => '');
    }
    return new Error(prefix + ' (' + response.status + ')' + (detail ? ': ' + detail : ''));
  }

  async function verifyGeneration() {
    const url = cfg().url + '/rest/v1/docampo_app_state?id=eq.primary&select=generation';
    const response = await fetch(url, { headers: await headers() });
    if (!response.ok) {
      throw await responseError(response, 'A estrutura nova do Supabase ainda não foi instalada');
    }
    const rows = await response.json();
    const serverGeneration = rows[0]?.generation || '';
    if (!serverGeneration) throw new Error('O Supabase não possui uma geração ativa do banco.');
    if (serverGeneration !== DoCampoDB.generation) {
      throw new Error('Este aplicativo pertence a outra geração do banco. Atualize os dois celulares antes de sincronizar.');
    }
    return serverGeneration;
  }

  function cloudPayload(event) {
    const payload = { ...(event.payload || {}) };
    if (event.entityType === 'documents') {
      delete payload.localPath;
      delete payload.localAvailable;
    }
    return payload;
  }

  function row(event) {
    return {
      id: event.id,
      generation: DoCampoDB.generation,
      entity_type: event.entityType,
      entity_id: event.entityId,
      operation: event.operation,
      payload: cloudPayload(event),
      device_id: event.deviceId,
      user_name: event.userName,
      client_created_at: event.createdAt,
      base_revision: Number(event.baseRevision) || 0,
      app_version: event.appVersion || DoCampoDB.appVersion
    };
  }

  async function sendBatch(events) {
    const response = await fetch(cfg().url + '/rest/v1/docampo_sync_events_v2?on_conflict=id', {
      method: 'POST',
      headers: await headers('resolution=ignore-duplicates,return=minimal'),
      body: JSON.stringify(events.map(row))
    });
    if (response.ok) return;
    const error = await responseError(response, 'Falha ao enviar registros');
    if (events.length > 1 && (response.status === 409 || response.status === 400)) {
      for (const event of events) await sendBatch([event]);
      return;
    }
    if (response.status === 409 && /duplicate|already exists|unique/i.test(error.message)) return;
    throw error;
  }

  function blockedByConflict(event) {
    const conflicts = DoCampoDB.read()?.conflicts || [];
    return conflicts.some(conflict =>
      !conflict.resolvedAt &&
      conflict.entityType === event.entityType &&
      conflict.entityId === event.entityId
    );
  }

  async function sendPending(deferAcknowledgement) {
    const events = DoCampoDB.pendingEvents().filter(event => !blockedByConflict(event));
    if (!events.length) return { count: 0, ids: [] };
    let sent = 0;
    const ids = [];
    for (let index = 0; index < events.length; index += 75) {
      const batch = events.slice(index, index + 75);
      await sendBatch(batch);
      const batchIds = batch.map(event => event.id);
      ids.push(...batchIds);
      if (!deferAcknowledgement) {
        DoCampoDB.markSynced(batchIds);
        await DoCampoDB.flush();
      }
      sent += batch.length;
    }
    return { count: sent, ids };
  }

  async function upload() {
    const result = await sendPending(false);
    return result.count;
  }

  async function download() {
    let cursor = Number(DoCampoDB.status().lastServerSequence) || 0;
    let received = 0;
    while (true) {
      const params = new URLSearchParams({
        select: 'id,generation,entity_type,entity_id,operation,payload,device_id,user_name,client_created_at,server_created_at,server_sequence,base_revision,app_version',
        generation: 'eq.' + DoCampoDB.generation,
        server_sequence: 'gt.' + cursor,
        order: 'server_sequence.asc',
        limit: String(PAGE_SIZE)
      });
      const response = await fetch(cfg().url + '/rest/v1/docampo_sync_events_v2?' + params.toString(), {
        headers: await headers()
      });
      if (!response.ok) throw await responseError(response, 'Falha ao receber registros');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('O servidor devolveu uma resposta inválida durante a sincronização.');
      for (const item of rows) {
        DoCampoDB.applyRemote(item);
        cursor = Math.max(cursor, Number(item.server_sequence) || 0);
      }
      if (rows.length) {
        DoCampoDB.markSynced([], cursor);
        await DoCampoDB.flush();
      }
      received += rows.length;
      if (rows.length < PAGE_SIZE) break;
    }
    return received;
  }

  let activeSync = null;

  async function executeSync() {
    if (!navigator.onLine) throw new Error('Sem internet. Os registros permanecem salvos neste aparelho e aguardam sincronização.');
    if (!cfg().configured || !cfg().url || !cfg().anonKey) throw new Error('A nuvem ainda não foi configurada.');
    await DoCampoDB.ready();
    await DoCampoDB.flush();
    await verifyGeneration();
    window.dispatchEvent(new CustomEvent('docampo:sync-start'));
    const warnings = [];
    try {
      // Primeiro incorpora o que o outro aparelho já confirmou. Isso permite
      // mesclar visitas e detectar conflitos antes de publicar mudanças locais.
      const receivedBefore = await download();
      if (window.DoCampoPhotos?.syncVisits) {
        const photoReport = await DoCampoPhotos.syncVisits(DoCampoDB.list('visits'));
        if (photoReport?.failed) warnings.push(photoReport.failed + ' foto(s) aguardando nova tentativa');
      }
      if (window.DoCampoPDF?.uploadPendingDocuments) {
        try {
          await DoCampoPDF.uploadPendingDocuments();
        } catch (error) {
          warnings.push('PDF pendente: ' + error.message);
        }
      }
      // O servidor pode aceitar o lote e a conexão cair logo depois. Mantemos
      // a fila até reler a sequência oficial; reenvios são idempotentes pelo id.
      const outgoing = await sendPending(true);
      const receivedAfter = await download();
      if (outgoing.ids.length) DoCampoDB.markSynced(outgoing.ids);
      await DoCampoDB.flush();
      const sent = outgoing.count;
      const received = receivedBefore + receivedAfter;
      const result = { sent, received, warnings, status: DoCampoDB.status() };
      window.dispatchEvent(new CustomEvent('docampo:sync-complete', { detail: result }));
      if (warnings.length) {
        const error = new Error('Os dados foram sincronizados, mas há arquivos pendentes: ' + warnings.join('; ') + '.');
        error.partialSuccess = true;
        error.result = result;
        throw error;
      }
      return result;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('docampo:sync-error', { detail: { message: error.message } }));
      throw error;
    }
  }

  function sync() {
    if (!activeSync) activeSync = executeSync().finally(() => { activeSync = null; });
    return activeSync;
  }

  window.DoCampoSync = { sync, upload, download, verifyGeneration };
})();
