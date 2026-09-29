(function(){
  'use strict';
  const BUCKET='docampo-documents',DIR='checklist-photos';
  const transient=(point,data)=>{try{Object.defineProperty(point,'foto',{value:data,writable:true,configurable:true,enumerable:false})}catch(_){point.foto=data}return point};
  const plugin=name=>{const c=window.Capacitor;if(!c)return null;if(c.Plugins&&c.Plugins[name])return c.Plugins[name];try{return c.registerPlugin?c.registerPlugin(name):null}catch(_){return null}};
  const native=()=>!!(window.Capacitor?.isNativePlatform?.());
  const id=()=>globalThis.crypto?.randomUUID?.()||('foto-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const split=data=>String(data||'').includes(',')?String(data).split(',')[1]:String(data||'');
  function db(){return new Promise((ok,fail)=>{const req=indexedDB.open('docampo_media_v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error)})}
  async function webPut(key,data){const d=await db();return new Promise((ok,fail)=>{const tx=d.transaction('photos','readwrite');tx.objectStore('photos').put(data,key);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{d.close();fail(tx.error)}})}
  async function webGet(key){const d=await db();return new Promise((ok,fail)=>{const tx=d.transaction('photos');const req=tx.objectStore('photos').get(key);req.onsuccess=()=>{d.close();ok(req.result||'')};req.onerror=()=>{d.close();fail(req.error)}})}
  async function webDelete(key){const d=await db();return new Promise((ok,fail)=>{const tx=d.transaction('photos','readwrite');tx.objectStore('photos').delete(key);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{d.close();fail(tx.error)}})}
  async function save(dataUri,preferredId){
    const photoId=preferredId||id(),localPath=DIR+'/'+photoId+'.jpg',base64=split(dataUri),fs=plugin('Filesystem');
    if(native()&&fs)await fs.writeFile({path:localPath,data:base64,directory:'DATA',recursive:true});else await webPut(photoId,'data:image/jpeg;base64,'+base64);
    return{photoId,photoLocalPath:localPath,photoRemotePath:DIR+'/'+photoId+'.jpg',photoMime:'image/jpeg',fotoRegistradaEm:new Date().toISOString()};
  }
  async function read(point){
    if(point?.foto&&String(point.foto).startsWith('data:'))return point.foto;
    if(!point?.photoId)return'';
    try{
      const fs=plugin('Filesystem');
      if(native()&&fs){const result=await fs.readFile({path:point.photoLocalPath||DIR+'/'+point.photoId+'.jpg',directory:'DATA'});return'data:image/jpeg;base64,'+result.data}
      return await webGet(point.photoId);
    }catch(_){return''}
  }
  async function headers(contentType){const token=await window.DoCampoAuth.accessToken();return{apikey:DoCampoCloudConfig.anonKey,Authorization:'Bearer '+token,...(contentType?{'Content-Type':contentType}:{})}}
  function bytes(base64){const raw=atob(split(base64)),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
  async function upload(point){
    if(!navigator.onLine||!point?.photoRemotePath||!window.DoCampoAuth?.status?.().authenticated)return false;
    const data=await read(point);if(!data)return false;
    const url=DoCampoCloudConfig.url+'/storage/v1/object/'+BUCKET+'/'+encodeURIComponent(point.photoRemotePath).replace(/%2F/g,'/');
    const response=await fetch(url,{method:'POST',headers:{...(await headers('image/jpeg')),'x-upsert':'true'},body:bytes(data)});
    if(!response.ok)throw new Error('Falha ao sincronizar foto: '+response.status);return true;
  }
  async function download(point){
    if(!navigator.onLine||!point?.photoRemotePath||!window.DoCampoAuth?.status?.().authenticated)return'';
    const url=DoCampoCloudConfig.url+'/storage/v1/object/authenticated/'+BUCKET+'/'+encodeURIComponent(point.photoRemotePath).replace(/%2F/g,'/');
    const response=await fetch(url,{headers:await headers()});if(!response.ok)return'';
    const array=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<array.length;i+=32768)binary+=String.fromCharCode.apply(null,array.subarray(i,i+32768));
    const data='data:image/jpeg;base64,'+btoa(binary),meta=await save(data,point.photoId);Object.assign(point,meta);return data;
  }
  async function hydrate(point){
    if(!point)return point;
    if(point.foto&&String(point.foto).startsWith('data:')){const old=point.foto,meta=await save(old,point.photoId);Object.assign(point,meta);delete point.foto;transient(point,old);upload(point).catch(()=>{});return point}
    let data=await read(point);if(!data)data=await download(point).catch(()=>'');if(data)transient(point,data);return point;
  }
  async function hydratePoints(points){for(const point of(points||[]))await hydrate(point);return points||[]}
  async function hydrateVisits(visits){for(const visit of(visits||[])){for(const item of(visit.checklist||[]))await hydratePoints(item.pontosGps);await hydratePoints(visit.formDraft?.pontosGps)}return visits||[]}
  async function migrateDatabasePhotos(){
    if(!window.DoCampoDB)return 0;let total=0;
    for(const visit of DoCampoDB.list('visits')){
      const points=[...(visit.formDraft?.pontosGps||[])];for(const item of visit.checklist||[])points.push(...(item.pontosGps||[]));
      if(!points.some(point=>point&&Object.prototype.propertyIsEnumerable.call(point,'foto')&&String(point.foto||'').startsWith('data:')))continue;
      await hydrateVisits([visit]);DoCampoDB.upsert('visits',visit);total++;
    }
    return total;
  }
  async function syncVisits(visits){let total=0;for(const visit of(visits||[])){for(const item of(visit.checklist||[]))for(const point of(item.pontosGps||[]))try{if(await upload(point))total++}catch(_){}for(const point of(visit.formDraft?.pontosGps||[]))try{if(await upload(point))total++}catch(_){}}return total}
  async function remove(point){if(!point?.photoId)return;const fs=plugin('Filesystem');try{if(native()&&fs)await fs.deleteFile({path:point.photoLocalPath||DIR+'/'+point.photoId+'.jpg',directory:'DATA'});else await webDelete(point.photoId)}catch(_){} }
  async function stats(){const estimate=await navigator.storage?.estimate?.().catch?.(()=>null);return{used:Number(estimate?.usage||0),quota:Number(estimate?.quota||0)}}
  window.DoCampoPhotos={save,read,upload,hydrate,hydratePoints,hydrateVisits,migrateDatabasePhotos,syncVisits,remove,stats,transient};
})();
