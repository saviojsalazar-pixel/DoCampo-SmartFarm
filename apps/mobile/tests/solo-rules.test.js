const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../www/solo-rules.js','utf8'),context);
const R=context.window.DoCampoSoloRules;
function close(a,b,e=.02){assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`)}
assert.equal(R.source,'Página2 corrigida');
assert.equal(R.number(''),null);assert.equal(R.number(null),null);assert.equal(R.number('5,3'),5.3);
assert.equal(R.classificar('pH',5.29,{}),'Médio');assert.equal(R.classificar('pH',5.3,{}),'Bom');assert.equal(R.classificar('pH',6.3,{}),'Bom');assert.equal(R.classificar('pH',6.31,{}),'Alto');
assert.deepEqual(Array.from(R.classificarP(8,{Prem:19}).limites),[4.5,6.2,8.5,13.1]);
assert.deepEqual(Array.from(R.classificarP(8,{Argila:50}).limites),[3,6,9,13.5]);
assert.equal(R.classificar('B',.25,{MetodoB:'HCl 0,05 mol/L'}),'Baixo');assert.equal(R.classificar('B',.25,{MetodoB:'Mehlich-1'}),'Médio');
const s=R.calcularAmostra({pH:5.3,MO:3,P:12,Prem:19,K:142,Ca:2.8,Mg:.6,Al:.1,HAl:4.2,S:10,B:.3,Cu:.8,Fe:30,Mn:10,Zn:3});
close(s.K_cmolc,142/391);close(s.SB,2.8+.6+142/391);close(s.t,s.SB+.1);close(s.T,s.SB+4.2);close(s.V,s.SB/s.T*100);close(s.m,.1/s.t*100);
close(s.ctc.actual.K+s.ctc.actual.Ca+s.ctc.actual.Mg+s.ctc.actual.Al+s.ctc.actual.H,100);
assert.equal(s.interpretations.Ca.criterion,2.8/s.T*100);assert.equal(s.interpretations.Ca.displayValue,2.8);
assert.equal(s.interpretations.CaK.classe,R.classificar('CaK',s.CaK,s));
assert.equal(R.ctcStatus('K',3).classe,'Adequado');assert.equal(R.ctcStatus('H',55).classe,'Muito elevado');
for(const k of R.radarKeys)assert.ok(Number.isFinite(s.interpretations[k].radarScore));
// Cada consumidor deve receber exatamente a mesma interpretação consolidada.
for(const k of Object.keys(s.interpretations)){
  const central=R.avaliar(k,s[k],s),stored=s.interpretations[k];
  assert.equal(stored.classe,central.classe,`${k}: classe divergente`);
  close(stored.position,central.position,1e-12);
  assert.equal(stored.palette,central.palette,`${k}: paleta divergente`);
}
// Ca, Mg e K exibem o valor do laboratório, porém classificam pela ocupação da CTC.
for(const k of ['Ca','Mg','K']){
  assert.equal(s.interpretations[k].displayValue,s[k]);
  assert.equal(s.interpretations[k].criterionLabel,'% da CTC');
  close(s.interpretations[k].criterion,s.ctc.actual[k],1e-10);
}
// As cinco classes e suas transições permanecem auditáveis na fonte oficial.
assert.deepEqual(Array.from(R.limitsFor('V',s)),[20,40,60,80]);
assert.deepEqual(Array.from(R.limitsFor('m',s)),[15,30,50,75]);
assert.deepEqual(Array.from(R.limitsFor('CaK',s)),[2.25,4.5,9,13.5]);
assert.equal(R.classificar('CaK',7.71,s),'Abaixo do equilíbrio');
assert.equal(R.classificar('CaK',9,s),'Equilíbrio');
assert.equal(R.classificar('CaK',13.5,s),'Equilíbrio');
assert.equal(R.classificar('CaK',13.51,s),'Acima do equilíbrio');
assert.equal(R.classificar('CaMg',4.67,s),'Acima do equilíbrio');
// Limites expressos com “até/≤” na Página2 corrigida permanecem na classe inferior.
assert.equal(R.classificar('P',2.3,{Prem:4}),'Muito baixo');
assert.equal(R.classificar('P',2.31,{Prem:4}),'Baixo');
assert.equal(R.classificar('S',1.7,{Prem:4}),'Muito baixo');
assert.equal(R.classificar('S',1.71,{Prem:4}),'Baixo');
assert.equal(R.classificar('SB',.6,{}),'Muito baixo');
assert.equal(R.classificar('SB',.61,{}),'Baixo');
console.log('solo-rules: all assertions passed');
