(function(){
  'use strict';
  const DB_KEY='docampo_unified_db_v1',DEVICE_KEY='docampo_device_id',USER_KEY='docampo_current_user';
  const TYPES=['producers','farms','fields','products','visits','recommendations','documents','foliarAnalyses'];
  const now=()=>new Date().toISOString();
  // O id do evento e UUID no Supabase. Alguns WebViews Android nao oferecem
  // crypto.randomUUID; o fallback antigo gerava "dc-..." e era recusado.
  function uuid(){
    if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);
    if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function')globalThis.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id='celular-'+uuid();localStorage.setItem(DEVICE_KEY,id)}return id}
  function user(){return localStorage.getItem(USER_KEY)||'M.Sc. Sávio José Souza Salazar'}
  function setUser(name){localStorage.setItem(USER_KEY,String(name||'').trim()||'M.Sc. Sávio José Souza Salazar');emit();return user()}
  function empty(){let entities={};TYPES.forEach(t=>entities[t]={});return{version:1,entities,events:[],queue:[],conflicts:[],trash:[],lastSyncAt:null,lastRemoteCursor:null}}
  function read(){try{let d=JSON.parse(localStorage.getItem(DB_KEY)||'null')||empty();TYPES.forEach(t=>d.entities[t]||(d.entities[t]={}));d.events||=[];d.queue||=[];d.conflicts||=[];d.trash||=[];return d}catch(_){return empty()}}
  function compact(d){
    const queued=new Set(d.queue||[]);
    // Eventos remotos servem apenas para idempotencia. Conservar uma janela
    // ampla evita crescimento infinito sem duplicar anos de payloads.
    const remote=(d.events||[]).filter(e=>e.remote).slice(-4000);
    const local=(d.events||[]).filter(e=>!e.remote&&(queued.has(e.id)||!e.syncedAt)).slice(-2000);
    d.events=[...remote,...local];
    d.trash=Array.from(new Map((d.trash||[]).map(x=>[x.type+'|'+x.id,x])).values());
    return d;
  }
  function write(d){
    try{localStorage.setItem(DB_KEY,JSON.stringify(d))}
    catch(error){
      compact(d);
      try{localStorage.setItem(DB_KEY,JSON.stringify(d))}
      catch(second){const failure=new Error('A base local do aplicativo atingiu o limite de gravação. Seus arquivos não serão apagados. Exporte um backup e use “Otimizar armazenamento”.');failure.code='LOCAL_DATABASE_QUOTA';failure.cause=second;throw failure}
    }
    emit();return d
  }
  function emit(){window.dispatchEvent(new CustomEvent('docampo:db-status',{detail:status()}))}
  function eventFor(type,id,operation,payload,baseRevision){return{id:uuid(),entityType:type,entityId:id,operation,payload,deviceId:deviceId(),userName:user(),createdAt:now(),baseRevision:baseRevision||0,appVersion:'1.9.45'}}
  function enqueueLatest(d,ev){
    const queued=new Set(d.queue||[]);
    const obsolete=(d.events||[]).filter(old=>queued.has(old.id)&&old.entityType===ev.entityType&&old.entityId===ev.entityId).map(old=>old.id);
    if(obsolete.length){const remove=new Set(obsolete);d.events=d.events.filter(old=>!remove.has(old.id));d.queue=d.queue.filter(id=>!remove.has(id))}
    d.events.push(ev);d.queue.push(ev.id);
  }
  function upsert(type,input,options={}){if(!TYPES.includes(type))throw Error('Tipo de registro inválido');let d=read(),id=input.id||uuid(),old=d.entities[type][id],revision=(old?.revision||0)+1,timestamp=now();let record={...(old||{}),...input,id,type,revision,createdAt:old?.createdAt||timestamp,updatedAt:timestamp,updatedBy:user(),deviceId:deviceId(),deletedAt:null,verified:input.verified!==false};if(old?.deletedAt)record.restoredAt=input.restoredAt||timestamp;if(type==='products'&&!old&&input.verified!==true){record.verified=false;record.localStatus='Cadastro local — conferir'}d.entities[type][id]=record;let ev=eventFor(type,id,'upsert',record,old?.revision||0);if(options.enqueue!==false)enqueueLatest(d,ev);else d.events.push(ev);write(d);return record}
  function softDelete(type,id,metadata={}){let d=read(),old=d.entities[type]?.[id];if(!old)return false;if(old.deletedAt)return true;let timestamp=now(),record={...old,...metadata,revision:(old.revision||0)+1,deletedAt:timestamp,updatedAt:timestamp,updatedBy:user(),deviceId:deviceId()};d.entities[type][id]=record;d.trash=d.trash.filter(x=>!(x.type===type&&x.id===id));d.trash.push({type,id,deletedAt:timestamp});let ev=eventFor(type,id,'delete',record,old.revision||0);enqueueLatest(d,ev);write(d);return true}
  function restore(type,id){let d=read(),old=d.entities[type]?.[id];if(!old)return false;d.trash=d.trash.filter(x=>!(x.type===type&&x.id===id));write(d);upsert(type,{...old,deletedAt:null,restoredAt:now()});return true}
  function hardDelete(type,id){let d=read();if(!d.entities[type]?.[id])return false;delete d.entities[type][id];d.trash=d.trash.filter(x=>!(x.type===type&&x.id===id));const queued=new Set(d.queue),keep=new Set(d.events.filter(e=>queued.has(e.id)&&e.entityType===type&&e.entityId===id&&e.operation==='delete').map(e=>e.id));d.queue=d.queue.filter(eventId=>!d.events.some(e=>e.id===eventId&&e.entityType===type&&e.entityId===id)||keep.has(eventId));d.events=d.events.filter(e=>e.entityType!==type||e.entityId!==id||keep.has(e.id));write(d);return true}
  function archiveOldDocuments(days=7){const limite=Date.now()-Math.max(1,Number(days)||7)*86400000;let total=0;list('documents').forEach(doc=>{const base=new Date(doc.restoredAt||doc.generatedAt||doc.createdAt||0).getTime();if(base&&base<=limite&&softDelete('documents',doc.id))total++});return total}
  function list(type,{deleted=false}={}){return Object.values(read().entities[type]||{}).filter(x=>deleted?!!x.deletedAt:!x.deletedAt).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
  function get(type,id){return read().entities[type]?.[id]||null}
  function immutableSnapshot(data){return JSON.parse(JSON.stringify(data))}
  function addDocument(meta){return upsert('documents',{...meta,snapshot:immutableSnapshot(meta.snapshot||{}),immutable:true})}
  function patchDocumentLocal(id,patch){let d=read(),doc=d.entities.documents?.[id];if(!doc)return null;d.entities.documents[id]={...doc,...patch,updatedAt:doc.updatedAt};let queued=new Set(d.queue);d.events=d.events.map(ev=>queued.has(ev.id)&&ev.entityType==='documents'&&ev.entityId===id?{...ev,payload:{...ev.payload,...patch}}:ev);write(d);return d.entities.documents[id]}
  function patchDocumentCloud(id,patch){let d=read(),doc=d.entities.documents?.[id];if(!doc)return null;let queued=new Set(d.queue),hasQueued=false,record={...doc,...patch};d.events=d.events.map(ev=>{if(queued.has(ev.id)&&ev.entityType==='documents'&&ev.entityId===id){hasQueued=true;return{...ev,payload:{...ev.payload,...patch}}}return ev});if(!hasQueued){let oldRevision=doc.revision||0;record={...record,revision:oldRevision+1,updatedAt:now(),updatedBy:user(),deviceId:deviceId()};let ev=eventFor('documents',id,'upsert',record,oldRevision);d.events.push(ev);d.queue.push(ev.id)}d.entities.documents[id]=record;write(d);return record}
  function status(){let d=read();return{online:navigator.onLine,pending:d.queue.length,conflicts:d.conflicts.length,lastSyncAt:d.lastSyncAt,configured:!!window.DoCampoCloudConfig?.configured,deviceId:deviceId(),user:user()}}
  function optimize(){let d=read(),before=JSON.stringify(d).length;compact(d);write(d);return{before,after:JSON.stringify(d).length,events:d.events.length,pending:d.queue.length}}
  function pendingEvents(){let d=read(),set=new Set(d.queue);return d.events.filter(e=>set.has(e.id))}
  function markSynced(ids,cursor){let d=read(),set=new Set(ids),stamp=now();d.queue=d.queue.filter(id=>!set.has(id));d.events=d.events.map(e=>set.has(e.id)?{...e,syncedAt:stamp}:e);d.lastSyncAt=stamp;if(cursor)d.lastRemoteCursor=cursor;compact(d);write(d)}
  function applyRemote(ev){
    let d=read(),type=ev.entity_type||ev.entityType,id=ev.entity_id||ev.entityId;
    if(!TYPES.includes(type)||!id)return'invalid';
    if(d.events.some(x=>x.id===ev.id))return'known';
    let local=d.entities[type]?.[id],payload={...(ev.payload||{})},queued=new Set(d.queue);
    const hasPending=d.events.some(x=>queued.has(x.id)&&x.entityType===type&&x.entityId===id);
    if(type==='documents'){delete payload.localPath;delete payload.localAvailable;payload={...payload,localAvailable:!!local?.localAvailable,localPath:local?.localPath||''}}
    // Exclusoes sao tombstones: uma copia antiga do outro aparelho nao pode
    // ressuscitar documento, talhao ou visita. Restauracao e um upsert novo e
    // explicito com restoredAt posterior a deletedAt.
    const remoteDelete=ev.operation==='delete'||!!payload.deletedAt;
    const localDelete=!!local?.deletedAt;
    const remoteRestore=!!payload.restoredAt&&String(payload.restoredAt)>String(local?.deletedAt||'');
    if(localDelete&&!remoteDelete&&!remoteRestore){d.events.push({id:ev.id,remote:true});write(d);return'tombstone'}
    if(remoteDelete&&!localDelete){d.entities[type][id]={...payload,id,deletedAt:payload.deletedAt||ev.created_at};d.trash=d.trash.filter(x=>!(x.type===type&&x.id===id));d.trash.push({type,id,deletedAt:d.entities[type][id].deletedAt});d.events.push({id:ev.id,remote:true});write(d);return'applied'}
    if(remoteDelete&&localDelete){const chosen=String(payload.updatedAt||ev.created_at||'')>String(local.updatedAt||'')?{...payload,id,deletedAt:payload.deletedAt||ev.created_at}:local;d.entities[type][id]=chosen;d.events.push({id:ev.id,remote:true});write(d);return'applied'}
    if(type==='visits'&&local&&hasPending&&!localDelete&&!remoteDelete){
      const newerRemote=String(payload.updatedAt||ev.created_at||'')>String(local.updatedAt||'');
      const primary=newerRemote?payload:local,secondary=newerRemote?local:payload,map=new Map();
      const itemKey=item=>String(item?.talhao||item?.field||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      (Array.isArray(secondary.checklist)?secondary.checklist:[]).forEach(item=>map.set(itemKey(item),item));
      (Array.isArray(primary.checklist)?primary.checklist:[]).forEach(item=>map.set(itemKey(item),item));
      const merged={...secondary,...primary,id,checklist:Array.from(map.values()).filter(Boolean),generalNotes:primary.generalNotes||secondary.generalNotes||'',mergedFromDevices:true};
      d.events.push({id:ev.id,remote:true});write(d);upsert('visits',merged);return'merged';
    }
    if(local&&local.deviceId!==(ev.device_id||ev.deviceId)&&hasPending){
      if(!d.conflicts.some(x=>x.remoteEventId===ev.id))d.conflicts.push({id:uuid(),entityType:type,entityId:id,local,remote:payload,remoteEventId:ev.id,createdAt:now(),resolvedAt:null});
      d.events.push({id:ev.id,remote:true});write(d);return'conflict';
    }
    const remoteTime=String(payload.updatedAt||ev.created_at||'');
    const localTime=String(local?.updatedAt||'');
    if(local&&!hasPending&&localTime&&remoteTime&&localTime>remoteTime){d.events.push({id:ev.id,remote:true});write(d);return'stale'}
    if(ev.operation==='delete')d.entities[type][id]={...payload,id,deletedAt:payload.deletedAt||ev.created_at};else d.entities[type][id]={...payload,id};
    d.events.push({id:ev.id,remote:true});write(d);return'applied';
  }
  function resolveConflict(id,choice){let d=read(),c=d.conflicts.find(x=>x.id===id&&!x.resolvedAt);if(!c)return false;c.resolvedAt=now();c.resolution=choice;write(d);if(choice==='remote')upsert(c.entityType,{...c.remote,id:c.entityId});else upsert(c.entityType,{...c.local,id:c.entityId});return true}
  function migrateLegacy(){let d=read();if(d.migratedLegacy)return;let shared={};try{shared=JSON.parse(localStorage.getItem('docampo_shared_v1')||'{}')}catch(_){};(shared.farms||[]).forEach(f=>{let farm=upsert('farms',{name:f.farm,producerName:f.producer||'',cpf:f.cpf||'',address:f.address||'',verified:true},{enqueue:false});(f.fields||[]).forEach(field=>upsert('fields',{farmId:farm.id,name:field.name,area:Number(field.area)||0,plants:Number(field.plants)||0,verified:true},{enqueue:false}))});Object.entries(shared.products||{}).forEach(([category,items])=>(items||[]).forEach(p=>upsert('products',{...p,category,verified:p.verified===true},{enqueue:false})));d=read();d.migratedLegacy=true;write(d)}
  window.DoCampoDB={read,list,get,upsert,softDelete,restore,hardDelete,archiveOldDocuments,addDocument,patchDocumentLocal,patchDocumentCloud,status,optimize,pendingEvents,markSynced,applyRemote,resolveConflict,setUser,user,deviceId,migrateLegacy};
  migrateLegacy();window.addEventListener('online',emit);window.addEventListener('offline',emit);setTimeout(emit,0);
})();
