(function(){
  'use strict';
  const cfg=()=>window.DoCampoCloudConfig||{};
  async function headers(prefer){let token=await DoCampoAuth.accessToken();return{'apikey':cfg().anonKey,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':prefer||'return=minimal'}}
  function cloudPayload(e){let payload={...(e.payload||{})};if(e.entityType==='documents'){delete payload.localPath;delete payload.localAvailable}return payload}
  function row(e){return{id:e.id,entity_type:e.entityType,entity_id:e.entityId,operation:e.operation,payload:cloudPayload(e),device_id:e.deviceId,user_name:e.userName,created_at:e.createdAt,base_revision:e.baseRevision,app_version:e.appVersion}}
  async function sendBatch(events){
    const r=await fetch(cfg().url+'/rest/v1/docampo_sync_events?on_conflict=id',{method:'POST',headers:await headers('resolution=ignore-duplicates,return=minimal'),body:JSON.stringify(events.map(row))});
    if(r.ok)return;
    let detail='';try{const data=await r.json();detail=data.message||data.details||data.hint||data.code||''}catch(_){detail=await r.text().catch(()=> '')}
    // Um 409 pode ser apenas uma repeticao ja recebida numa tentativa anterior.
    // Reenviar isoladamente identifica o registro real sem travar toda a fila.
    if(events.length>1&&(r.status===409||r.status===400)){
      for(const event of events)await sendBatch([event]);
      return;
    }
    if(r.status===409&&/duplicate|already exists|unique/i.test(detail))return;
    throw Error('Falha ao enviar registros ('+r.status+')'+(detail?': '+detail:''));
  }
  async function upload(){let events=DoCampoDB.pendingEvents();if(!events.length)return[];for(let i=0;i<events.length;i+=75){const batch=events.slice(i,i+75);await sendBatch(batch);DoCampoDB.markSynced(batch.map(e=>e.id))}return events}
  async function download(){let d=DoCampoDB.read(),url=cfg().url+'/rest/v1/docampo_sync_events?select=*&order=created_at.asc,id.asc';let r=await fetch(url,{headers:await headers()});if(!r.ok)throw Error('Falha ao receber: '+r.status);let rows=await r.json(),cursor=d.lastRemoteCursor;rows.forEach(row=>{DoCampoDB.applyRemote(row);if(!cursor||row.created_at>cursor)cursor=row.created_at});if(cursor)DoCampoDB.markSynced([],cursor);return rows}
  let syncAtiva=null;
  async function executarSync(){if(!navigator.onLine)throw Error('Sem internet. Os registros continuam salvos e aguardando.');if(!cfg().configured||!cfg().url||!cfg().anonKey)throw Error('A nuvem ainda não foi configurada.');window.dispatchEvent(new CustomEvent('docampo:sync-start'));try{let documentError=null;if(window.DoCampoPDF&&DoCampoPDF.uploadPendingDocuments){try{await DoCampoPDF.uploadPendingDocuments()}catch(e){documentError=e}}await upload();let rows=await download();if(documentError)throw Error('Os registros foram sincronizados, mas há PDF aguardando envio: '+documentError.message);window.dispatchEvent(new CustomEvent('docampo:sync-complete',{detail:{received:rows.length,status:DoCampoDB.status()}}));return DoCampoDB.status()}catch(error){window.dispatchEvent(new CustomEvent('docampo:sync-error',{detail:{message:error.message}}));throw error}}
  function sync(){if(syncAtiva)return syncAtiva;syncAtiva=executarSync().finally(()=>{syncAtiva=null});return syncAtiva}
  window.DoCampoSync={sync,upload,download};
})();
