(function () {
  const CLASSES = ['Muito baixo', 'Baixo', 'Médio', 'Bom', 'Muito bom'];
  const PALETAS = { crescente: 'growth', inversa: 'inverse', equilibrio: 'balance' };
  const numero = v => { v = Number(v); return Number.isFinite(v) ? v : null; };
  const limitar = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const pPrem = [[4,[2.3,3.2,4.5,6.8]],[10,[3,4.5,6.2,9.4]],[19,[4.5,6.2,8.5,13.1]],[30,[6,8.5,11.9,18]],[44,[8.4,11.9,16.4,24.8]],[60,[11.3,16.4,22.5,33.8]]];
  const pArgila = [[15,[7.5,15,22.5,33.8]],[35,[5,9,15,22.5]],[60,[3,6,9,13.5]],[100,[1.9,4,6,9]]];
  const sPrem = [[4,[1.7,2.5,3.6,5.4]],[10,[2.4,3.6,5,7.5]],[19,[3.3,5,6.9,10.3]],[30,[4.6,6.9,9.4,14.2]],[44,[6.4,9.4,13,19.6]],[60,[8.9,13,18,27]]];
  const limitesBase = {MO:[1,1.5,3,4],SB:[.6,1.8,3.6,6],t:[.8,2.3,4.6,8],T:[1.6,4.3,8.6,15],V:[20,40,60,80],Fe:[10,20,30,40]};
  const micros = {B:{hcl:[.15,.3,.7,1],mehlich:[.1,.2,.51,1.6]},Cu:{mehlich:[.25,.5,1,1.5],dtpa:[.15,.3,.65,1]},Mn:{mehlich:[2.5,5,10,15],dtpa:[.5,1,2.5,5]},Zn:{mehlich:[1,2,4,6],dtpa:[.3,.6,1.1,1.5]},Fe:{mehlich:[10,20,30,40],dtpa:[10,20,30,40]}};
  const caPct=[20,35,50,65],mgPct=[2,4,8,15],kPct=[.5,1,2,5];
  function linhaPor(valor,tabela){return(tabela.find(x=>valor<=x[0])||tabela[tabela.length-1])[1]}
  function indice(v,l){if(v===null)return-1;if(v<l[0])return 0;if(v<l[1])return 1;if(v<l[2])return 2;if(v<=l[3])return 3;return 4}
  function indiceFechado(v,l){if(v===null)return-1;if(v<=l[0])return 0;if(v<=l[1])return 1;if(v<=l[2])return 2;if(v<=l[3])return 3;return 4}
  function posicaoSegmentada(v,l,fechado=false){if(v===null)return 0;const i=(fechado?indiceFechado:indice)(v,l);if(i<0)return 0;const e=[Math.max(0,l[0]-(l[1]-l[0])),...l,l[3]+Math.max(l[3]-l[2],Math.abs(l[3])*.35||1)],a=e[i],b=e[i+1],f=b>a?limitar((v-a)/(b-a)):.5;return limitar((i+f)/5)}
  function metodo(k,r={}){const raw=String(r[`Metodo${k}`]||r[`metodo${k}`]||r.Metodo||r.metodo||r.Extrator||r.extrator||'').toLowerCase();if(raw.includes('dtpa'))return'dtpa';if(raw.includes('hcl'))return'hcl';if(raw.includes('mehlich')||raw.includes('água')||raw.includes('agua'))return'mehlich';return k==='B'?'hcl':'mehlich'}
  function regraP(r={}){const prem=numero(r.Prem??r.P_rem??r.Premanescente),argila=numero(r.Argila??r.argila??r.Clay);if(prem!==null)return{limites:linhaPor(prem,pPrem),criterio:'P-rem'};if(argila!==null)return{limites:linhaPor(argila,pArgila),criterio:'Argila'};return{limites:[10,20,40,60],criterio:'Cafeicultura'}}
  function limites(k,r={}){if(k==='P')return regraP(r).limites;if(k==='S'){const prem=numero(r.Prem??r.P_rem??r.Premanescente);return prem===null?[5,10,15,20]:linhaPor(prem,sPrem)}if(k==='Ca')return caPct;if(k==='Mg')return mgPct;if(k==='K')return kPct;if(micros[k])return micros[k][metodo(k,r)]||limitesBase[k];return limitesBase[k]}
  function valorCriterio(k,v,r={}){const T=numero(r.T),n=numero(v);if(n===null)return null;if(k==='Ca')return T>0?n/T*100:null;if(k==='Mg')return T>0?n/T*100:null;if(k==='K'){const kc=numero(r.K_cmolc)??n/391;return T>0?kc/T*100:null}return n}
  function avaliar(k,v,r={}){const exibido=numero(v);let criterio=valorCriterio(k,v,r),ls,i,classe,paleta=PALETAS.crescente,fechado=false;
    if(criterio===null)return{classe:'Não informado',position:0,palette:paleta,criterion:null,limits:null,displayValue:exibido};
    if(k==='pH'){ls=[3,4.5,5.3,6.3];i=indice(criterio,ls);classe=['Muito baixo','Baixo','Médio','Bom','Alto'][i];paleta=PALETAS.equilibrio}
    else if(k==='Al'){ls=[.2,.5,1,1.5];i=indice(criterio,ls);classe=['Bom','Bom','Médio','Alto','Muito alto'][i];paleta=PALETAS.inversa}
    else if(k==='HAl'){ls=[1,2.5,5,9];i=indice(criterio,ls);classe=['Bom','Bom','Médio','Alto','Muito alto'][i];paleta=PALETAS.inversa}
    else if(k==='m'){ls=[15,30,50,75];i=indice(criterio,ls);classe=['Bom','Bom','Médio','Alto','Muito alto'][i];paleta=PALETAS.inversa}
    else if(k==='CaK'||k==='MgK'||k==='CaMg'){ls=k==='CaK'?[2.25,4.5,9,13.5]:[.75,1.5,3,4.5];i=indice(criterio,ls);classe=i<3?'Abaixo do equilíbrio':i===3?'Equilíbrio':'Acima do equilíbrio';paleta=PALETAS.equilibrio}
    else{ls=limites(k,r);fechado=!['MO','V'].includes(k);i=ls?(fechado?indiceFechado:indice)(criterio,ls):-1;classe=i<0?'Não informado':CLASSES[i];if(k==='Ca'||k==='Mg'||k==='K'||k==='S')paleta=PALETAS.equilibrio}
    return{classe,position:ls?posicaoSegmentada(criterio,ls,fechado):0,palette:paleta,criterion:criterio,limits:ls,displayValue:exibido}}
  function classificar(k,v,r){return avaliar(k,v,r).classe}
  function classificarP(v,r={}){const q=regraP(r);return{classe:avaliar('P',v,r).classe,criterio:q.criterio,fonte:'Página2 corrigida',limites:q.limites}}
  function nivel(k,v,r={}){const c=classificar(k,v,r);if(c==='Equilíbrio'||c==='Bom')return 10;if(c==='Médio')return 7;if(c==='Muito bom')return 8;if(/Abaixo|Acima|Baixo|Alto/.test(c))return 4;return 2}
  function posicao(c){return/Abaixo|Baixo/.test(c)?'abaixo da faixa':/Acima|Alto/.test(c)?'acima da faixa':'na faixa de interpretação'}
  window.DoCampoSoloRules={classes:CLASSES,base:limitesBase,palettes:PALETAS,avaliar,classificar,classificarP,nivel,posicao,fonte:'Página2 corrigida'};
})();
