(function(){
  'use strict';
  const DB_KEY='docampo_unified_db_v1',DEVICE_KEY='docampo_device_id',USER_KEY='docampo_current_user';
  const TYPES=['producers','farms','fields','products','visits','recommendations','documents','foliarAnalyses'];
  const now=()=>new Date().toISOString();
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():'dc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id='celular-'+uuid();localStorage.setItem(DEVICE_KEY,id)}return id}
  function user(){return localStorage.getItem(USER_KEY)||'M.Sc. Sávio José Souza Salazar'}
  function setUser(name){localStorage.setItem(USER_KEY,String(name||'').trim()||'M.Sc. Sávio José Souza Salazar');emit();return user()}
  function empty(){let entities={};TYPES.forEach(t=>entities[t]={});return{version:1,entities,events:[],queue:[],conflicts:[],trash:[],lastSyncAt:null,lastRemoteCursor:null}}
  function read(){try{let d=JSON.parse(localStorage.getItem(DB_KEY)||'null')||empty();TYPES.forEach(t=>d.entities[t]||(d.entities[t]={}));d.events||=[];d.queue||=[];d.conflicts||=[];d.trash||=[];return d}catch(_){return empty()}}
  function write(d){localStorage.setItem(DB_KEY,JSON.stringify(d));emit();return d}
  function emit(){window.dispatchEvent(new CustomEvent('docampo:db-status',{detail:status()}))}
  function eventFor(type,id,operation,payload,baseRevision){return{id:uuid(),entityType:type,entityId:id,operation,payload,deviceId:deviceId(),userName:user(),createdAt:now(),baseRevision:baseRevision||0,appVersion:'1.9.4'}}
  function upsert(type,input,options={}){if(!TYPES.includes(type))throw Error('Tipo de registro inválido');let d=read(),id=input.id||uuid(),old=d.entities[type][id],revision=(old?.revision||0)+1,timestamp=now();let record={...(old||{}),...input,id,type,revision,createdAt:old?.createdAt||timestamp,updatedAt:timestamp,updatedBy:user(),deviceId:deviceId(),deletedAt:null,verified:input.verified!==false};if(type==='products'&&!old&&input.verified!==true){record.verified=false;record.localStatus='Cadastro local — conferir'}d.entities[type][id]=record;let ev=eventFor(type,id,'upsert',record,old?.revision||0);d.events.push(ev);if(options.enqueue!==false)d.queue.push(ev.id);write(d);return record}
  function softDelete(type,id){let d=read(),old=d.entities[type]?.[id];if(!old)return false;let timestamp=now(),record={...old,revision:(old.revision||0)+1,deletedAt:timestamp,updatedAt:timestamp,updatedBy:user(),deviceId:deviceId()};d.entities[type][id]=record;d.trash.push({type,id,deletedAt:timestamp});let ev=eventFor(type,id,'delete',record,old.revision||0);d.events.push(ev);d.queue.push(ev.id);write(d);return true}
  function restore(type,id){let d=read(),old=d.entities[type]?.[id];if(!old)return false;d.trash=d.trash.filter(x=>!(x.type===type&&x.id===id));write(d);upsert(type,{...old,deletedAt:null});return true}
  function list(type,{deleted=false}={}){return Object.values(read().entities[type]||{}).filter(x=>deleted?!!x.deletedAt:!x.deletedAt).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
  function get(type,id){return read().entities[type]?.[id]||null}
  function immutableSnapshot(data){return JSON.parse(JSON.stringify(data))}
  function addDocument(meta){return upsert('documents',{...meta,snapshot:immutableSnapshot(meta.snapshot||{}),immutable:true})}
  function status(){let d=read();return{online:navigator.onLine,pending:d.queue.length,conflicts:d.conflicts.length,lastSyncAt:d.lastSyncAt,configured:!!window.DoCampoCloudConfig?.configured,deviceId:deviceId(),user:user()}}
  function pendingEvents(){let d=read(),set=new Set(d.queue);return d.events.filter(e=>set.has(e.id))}
  function markSynced(ids,cursor){let d=read(),set=new Set(ids);d.queue=d.queue.filter(id=>!set.has(id));d.lastSyncAt=now();if(cursor)d.lastRemoteCursor=cursor;write(d)}
  function applyRemote(ev){let d=read(),type=ev.entity_type||ev.entityType,id=ev.entity_id||ev.entityId;if(d.events.some(x=>x.id===ev.id))return'known';let local=d.entities[type]?.[id];if(local&&local.deviceId!==ev.device_id&&local.revision>Number(ev.base_revision||0)&&local.updatedAt>ev.created_at){d.conflicts.push({id:uuid(),entityType:type,entityId:id,local,remote:ev.payload,remoteEventId:ev.id,createdAt:now(),resolvedAt:null});d.events.push({id:ev.id,remote:true});write(d);return'conflict'}if(ev.operation==='delete')d.entities[type][id]={...ev.payload,deletedAt:ev.payload.deletedAt||ev.created_at};else d.entities[type][id]=ev.payload;d.events.push({id:ev.id,remote:true});write(d);return'applied'}
  function resolveConflict(id,choice){let d=read(),c=d.conflicts.find(x=>x.id===id&&!x.resolvedAt);if(!c)return false;c.resolvedAt=now();c.resolution=choice;write(d);if(choice==='remote')upsert(c.entityType,{...c.remote,id:c.entityId});else upsert(c.entityType,{...c.local,id:c.entityId});return true}
  function migrateLegacy(){let d=read();if(d.migratedLegacy)return;let shared={};try{shared=JSON.parse(localStorage.getItem('docampo_shared_v1')||'{}')}catch(_){};(shared.farms||[]).forEach(f=>{let farm=upsert('farms',{name:f.farm,producerName:f.producer||'',cpf:f.cpf||'',address:f.address||'',verified:true},{enqueue:false});(f.fields||[]).forEach(field=>upsert('fields',{farmId:farm.id,name:field.name,area:Number(field.area)||0,plants:Number(field.plants)||0,verified:true},{enqueue:false}))});Object.entries(shared.products||{}).forEach(([category,items])=>(items||[]).forEach(p=>upsert('products',{...p,category,verified:p.verified===true},{enqueue:false})));d=read();d.migratedLegacy=true;write(d)}
  window.DoCampoDB={read,list,get,upsert,softDelete,restore,addDocument,status,pendingEvents,markSynced,applyRemote,resolveConflict,setUser,user,deviceId,migrateLegacy};
  migrateLegacy();window.addEventListener('online',emit);window.addEventListener('offline',emit);setTimeout(emit,0);
})();
