const assert=require('assert'),fs=require('fs'),vm=require('vm');
const store=new Map();const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
localStorage.setItem('docampo_shared_v1',JSON.stringify({farms:[{farm:'Fazenda A',producer:'Produtor',fields:[{name:'1.1',area:1,plants:4000}]}],products:{}}));
const document={addEventListener(){},createElement(){return{click(){},remove(){}}},body:{appendChild(){}}};
const context={console,localStorage,document,navigator:{onLine:false},location:{pathname:'index.html'},history:{},window:{addEventListener(){},dispatchEvent(){}},setTimeout(){},Blob:function(){},FileReader:function(){}};context.window.window=context.window;context.window.document=document;context.window.navigator=context.navigator;vm.createContext(context);vm.runInContext(fs.readFileSync('www/app-shell.js','utf8'),context);
const old={agri_custom_farms:JSON.stringify([{farm:'Fazenda A',producer:'Produtor',fields:[{name:'2.1',area:2,plants:7000}]},{farm:'Fazenda B',producer:'Outro',fields:[{name:'1',area:3,plants:9000}]}])};
const merged=context.window.DoCampoCentral.mergeBackupData(old),shared=JSON.parse(merged.docampo_shared_v1);
const farmA=shared.farms.find(f=>f.farm==='Fazenda A');assert.deepStrictEqual(Array.from(farmA.fields,x=>x.name),['1.1','2.1']);assert.strictEqual(shared.farms.some(f=>f.farm==='Fazenda B'),true);
console.log('backup-compatibility: ok');
