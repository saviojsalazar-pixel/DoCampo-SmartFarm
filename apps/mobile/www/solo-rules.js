(function(){
  const classes=['Muito baixo','Baixo','Médio','Bom','Muito bom'];
  const palettes={growth:'growth',inverse:'inverse',balance:'balance'};
  const base={MO:[1,1.5,3,5],Al:[.2,.5,1,2],HAl:[1,2.5,5,9],SB:[.6,1.8,3.6,6],t:[.8,2.3,4.6,8],T:[1.6,4.3,8.6,15],V:[20,40,60,80],m:[15,30,50,75],S:[5,10,15,25],B:[.15,.3,.7,1],Cu:[.25,.5,1,1.5],Fe:[10,20,30,40],Mn:[2.5,5,10,15],Zn:[1,2,4,6]};
  const pPrem=[{max:4,l:[2.3,3.2,4.5,6.8]},{max:10,l:[3,4.5,6.2,9.4]},{max:19,l:[4.5,6.2,8.5,13.1]},{max:30,l:[6,8.5,11.9,18]},{max:44,l:[8.4,11.9,16.4,24.8]},{max:60,l:[11.3,16.4,22.5,33.8]}];
  const pArgila=[{max:15,l:[7.5,15,22.5,33.8]},{max:35,l:[5,9,15,22.5]},{max:60,l:[3,6,9,13.5]},{max:100,l:[1.9,4,6,9]}];
  const sPrem=[{max:4,l:[1.7,2.5,3.6,5.4]},{max:10,l:[2.4,3.6,5,7.5]},{max:19,l:[3.3,5,6.9,10.3]},{max:30,l:[4.6,6.9,9.4,14.2]},{max:44,l:[6.4,9.4,13,19.6]},{max:60,l:[8.9,13,18,27]}];
  const micros={B:{hcl:[.15,.3,.7,1],mehlich:[.1,.2,.5,1.6]},Cu:{mehlich:[.25,.5,1,1.5],dtpa:[.15,.3,.65,1]},Mn:{mehlich:[2.5,5,10,15],dtpa:[.5,1,2.5,5]},Zn:{mehlich:[1,2,4,6],dtpa:[.3,.6,1.1,1.5]},Fe:{mehlich:[10,20,30,40],dtpa:[10,20,30,40]}};
  const number=v=>{v=Number(v);return Number.isFinite(v)?v:null};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function byLimits(v,l,labels=classes){v=number(v);if(v===null)return'Não informado';if(v<l[0])return labels[0];if(v<l[1])return labels[1];if(v<l[2])return labels[2];if(v<l[3])return labels[3];return labels[4]}
  function scalePosition(v,l){v=number(v);if(v===null)return 0;const span=Math.max(l[3]-l[0],Math.abs(l[0])||1),lo=l[0]-span*.30,hi=l[3]+span*.45;return clamp((v-lo)/(hi-lo),0,1)}
  function methodOf(k,r={}){const raw=String(r[`Metodo${k}`]||r[`metodo${k}`]||r.Metodo||r.metodo||r.Extrator||r.extrator||'').toLowerCase();if(raw.includes('dtpa'))return'dtpa';if(raw.includes('hcl'))return'hcl';if(raw.includes('mehlich'))return'mehlich';return'mehlich'}
  function pRule(v,r={}){const prem=number(r.Prem??r.P_rem??r.Premanescente),argila=number(r.Argila??r.argila??r.Clay);if(prem!==null){const row=pPrem.find(x=>prem<=x.max)||pPrem[pPrem.length-1];return{limits:row.l,criterio:`P-rem ${String(prem).replace('.',',')} mg/L`,fonte:'5ª Aproximação'}}if(argila!==null){const row=pArgila.find(x=>argila<=x.max)||pArgila[pArgila.length-1];return{limits:row.l,criterio:`Argila ${String(argila).replace('.',',')}%`,fonte:'5ª Aproximação'}}return{limits:[10,30,60,90],criterio:'Faixa geral para cafeicultura',fonte:'Procafé'}}
  function classificarP(v,r={}){const q=pRule(v,r);return{classe:byLimits(v,q.limits),criterio:q.criterio,fonte:q.fonte,limites:q.limits}}
  function limitsFor(k,r={}){if(k==='P')return pRule(r.P,r).limits;if(k==='S'){const prem=number(r.Prem??r.P_rem??r.Premanescente);if(prem!==null)return(sPrem.find(x=>prem<=x.max)||sPrem[sPrem.length-1]).l;return[5,10,15,25]}if(micros[k])return micros[k][methodOf(k,r)]||base[k];return base[k]}
  function criterionValue(k,v,r={}){const T=number(r.T);if(k==='Ca')return T&&T>0?number(v)/T*100:null;if(k==='Mg')return T&&T>0?number(v)/T*100:null;if(k==='K')return T&&T>0?number(r.K_cmolc??(number(v)!==null?number(v)/391:null))/T*100:null;return number(v)}
  function balanceClass(v,min,max){v=number(v);if(v===null)return'Não calculado';return v<min?'Baixo':v>max?'Alto':'Bom'}
  function avaliar(k,v,r={}){
    let criterion=criterionValue(k,v,r),limits,palette=palettes.growth,classe,position;
    if(k==='pH'){classe=criterion===null?'Não informado':criterion<5.3?'Baixo':criterion<=6.3?'Bom':'Alto';palette=palettes.balance;position=clamp((criterion-4)/(8.5-4),0,1);limits=[4,5.3,6.3,8.5]}
    else if(k==='Ca'||k==='Mg'||k==='K'){const band=k==='Ca'?[55,65]:k==='Mg'?[8,15]:[2,5];classe=balanceClass(criterion,band[0],band[1]);palette=palettes.balance;position=criterion===null?0:clamp(criterion/(band[1]*1.55),0,1);limits=[0,band[0],band[1],band[1]*1.55]}
    else if(k==='CaK'||k==='MgK'||k==='CaMg'){const band=k==='CaK'?[4.5,13.5]:[1.5,4.5];classe=balanceClass(criterion,band[0],band[1]);palette=palettes.balance;position=criterion===null?0:clamp(criterion/(band[1]*1.45),0,1);limits=[0,band[0],band[1],band[1]*1.45]}
    else{limits=limitsFor(k,{...r,[k]:v});classe=limits?byLimits(criterion,limits):'Não calculado';if(['Al','HAl','m'].includes(k))palette=palettes.inverse;position=limits?scalePosition(criterion,limits):0;if(k==='Al')classe=criterion===null?'Não informado':criterion<.2?'Muito baixo':criterion<.5?'Baixo':criterion<=1?'Médio':criterion<=2?'Alto':'Muito alto';if(k==='HAl')classe=criterion===null?'Não informado':criterion<=1?'Muito baixo':criterion<=2.5?'Baixo':criterion<=5?'Médio':criterion<=9?'Alto':'Muito alto';if(k==='m')classe=criterion===null?'Não informado':criterion<=15?'Muito baixo':criterion<=30?'Baixo':criterion<=50?'Médio':criterion<=75?'Alto':'Muito alto';if(k==='MO')classe=criterion===null?'Não informado':criterion<1?'Muito baixo':criterion<1.5?'Baixo':criterion<=3?'Médio':'Bom'}
    return{classe,position:clamp(position||0,0,1),palette,criterion,limits,displayValue:number(v)};
  }
  function classificar(k,v,r={}){return avaliar(k,v,r).classe}
  function nivel(k,v,r={}){const a=avaliar(k,v,r),map={'Muito baixo':2,'Baixo':4,'Médio':6.5,'Bom':9,'Muito bom':10,'Alto':5,'Muito alto':2};if(a.palette===palettes.balance)return a.classe==='Bom'?10:a.classe==='Baixo'?4:5;if(a.palette===palettes.inverse)return{'Muito baixo':10,'Baixo':8.5,'Médio':6,'Alto':4,'Muito alto':2}[a.classe]||0;return map[a.classe]||0}
  function posicao(c){if(/Muito baixo|Baixo/.test(c))return'abaixo da faixa';if(/Muito bom|Alto|Muito alto/.test(c))return'acima da faixa';return'na faixa de interpretação'}
  window.DoCampoSoloRules={classes,base,palettes,avaliar,classificar,classificarP,nivel,posicao,fonte:'5ª Aproximação; Procafé (complementar para cafeicultura)'};
})();
