const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map();
const records = { farms: [], fields: [], products: [] };
const context = {
  console,
  localStorage: { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,String(v)) },
  CustomEvent: function(){}, setTimeout: fn=>fn(),
  window: { dispatchEvent(){}, addEventListener(){} }
};
context.window.window=context.window;
context.window.DoCampoDB={
  list:type=>records[type].filter(x=>!x.deletedAt),
  upsert(type,value){const id=value.id||type+'-'+(records[type].length+1),i=records[type].findIndex(x=>x.id===id),row={...(i>=0?records[type][i]:{}),...value,id,deletedAt:null};if(i>=0)records[type][i]=row;else records[type].push(row);return row},
  softDelete(type,id){const row=records[type].find(x=>x.id===id);if(row)row.deletedAt=new Date().toISOString()}
};
context.DoCampoDB=context.window.DoCampoDB;
vm.createContext(context);
vm.runInContext(fs.readFileSync('www/shared-data.js','utf8'),context);
context.DoCampoData=context.window.DoCampoData;

context.DoCampoData.mergeFarm({farm:'Fazenda Teste',producer:'Produtor',fields:[{name:'1.',area:2,plants:8000},{name:'1',area:0,plants:0},{name:'2.',area:3,plants:9000}]});
let farm=context.DoCampoData.read().farms[0];
assert.deepStrictEqual(Array.from(farm.fields,x=>x.name),['1','2.']);
assert.strictEqual(farm.fields[0].area,2);
assert.strictEqual(records.fields.filter(x=>!x.deletedAt).length,2);

context.DoCampoData.mergeFarm({farm:'Fazenda Teste',producer:'Produtor',fields:[{name:'1',area:2.5,plants:8200}]});
farm=context.DoCampoData.read().farms[0];
assert.deepStrictEqual(Array.from(farm.fields,x=>x.name),['1']);
assert.strictEqual(records.fields.filter(x=>!x.deletedAt).length,1);
assert.strictEqual(records.fields.find(x=>x.name==='2.').deletedAt != null,true);
console.log('data-reconciliation: ok');
