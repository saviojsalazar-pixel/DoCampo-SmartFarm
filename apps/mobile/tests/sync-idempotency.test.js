const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let request = null, synced = null;
const event = { id:'11111111-1111-4111-8111-111111111111', entityType:'fields', entityId:'field-1', operation:'upsert', payload:{name:'1'}, deviceId:'phone-1', userName:'Sávio', createdAt:'2026-09-16T10:00:00.000Z', baseRevision:0, appVersion:'1.9.41' };
const context = {
  console,
  navigator:{online:true},
  CustomEvent:function(){},
  fetch:async(url,options)=>{request={url,options};return{ok:true,status:201,json:async()=>[],text:async()=>''}},
  window:{DoCampoCloudConfig:{configured:true,url:'https://example.supabase.co',anonKey:'public'},dispatchEvent(){}},
  DoCampoAuth:{accessToken:async()=> 'token'},
  DoCampoDB:{pendingEvents:()=>[event],markSynced:ids=>{synced=ids},read:()=>({lastRemoteCursor:null}),status:()=>({pending:0})}
};
context.window.window=context.window;context.window.DoCampoAuth=context.DoCampoAuth;context.window.DoCampoDB=context.DoCampoDB;
vm.createContext(context);vm.runInContext(fs.readFileSync('www/sync-engine.js','utf8'),context);
context.window.DoCampoSync.upload().then(()=>{
  assert(request.url.endsWith('/docampo_sync_events?on_conflict=id'));
  assert.strictEqual(request.options.headers.Prefer,'resolution=ignore-duplicates,return=minimal');
  assert.deepStrictEqual(synced,[event.id]);
  console.log('sync-idempotency: ok');
}).catch(error=>{console.error(error);process.exitCode=1});
