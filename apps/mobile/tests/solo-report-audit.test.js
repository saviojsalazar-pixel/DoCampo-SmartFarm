const fs=require('fs'),assert=require('assert');
const file=fs.readFileSync(__dirname+'/../www/solo-report.js','utf8');
assert.ok(file.includes('DoCampoSoloRules.avaliar(k,v,r)'),'barras não consomem o motor central');
assert.ok(file.includes('r.interpretations?.[k]||DoCampoSoloRules.avaliar'),'radar não consome o motor central');
assert.ok(file.includes('r.ctc||DoCampoSoloRules.calcularAmostra(r).ctc'),'CTC não consome o cálculo central');
assert.ok(file.includes("DoCampoSoloRules.classificar(nome.replace('/',''),v,{})"),'triângulo não consome o motor central');
assert.ok(!file.includes("MO:{min:0,max:8,c:v=>"),'faixas históricas ainda estão embutidas no laudo');
console.log('solo-report: central-engine audit passed');
