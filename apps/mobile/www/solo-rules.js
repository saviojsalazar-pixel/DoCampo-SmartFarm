(function(){
  const classes=['Muito baixo','Baixo','Médio','Bom','Muito bom'];
  const base={
    MO:[.70,2,4,7],
    pH:[4.49,5.4,6,7],
    Al:[.20,.50,1,2], HAl:[1,2.5,5,9],
    SB:[.60,1.8,3.6,6], t:[.80,2.3,4.6,8], T:[1.6,4.3,8.6,15],
    V:[20,40,60,80], m:[15,30,50,75],
    K:[60,120,200,300], Ca:[.40,1.20,2.40,4], Mg:[.15,.45,.90,1.50],
    S:[5,10,15,25], B:[.5,1,1.5,2], Cu:[.5,1,2,3],
    Fe:[10,30,50,80], Mn:[5,15,25,35], Zn:[1.5,3,4.5,6]
  };
  const inversos=new Set(['Al','HAl','m']);
  const pPrem=[
    {max:4,l:[2.3,3.2,4.5,6.8]}, {max:10,l:[3,4.5,6.2,9.4]},
    {max:19,l:[4.5,6.2,8.5,13.1]}, {max:30,l:[6,8.5,11.9,18]},
    {max:44,l:[8.3,11.9,16.4,24.8]}, {max:60,l:[11.3,16.4,22.5,33.8]}
  ];
  const pArgila=[
    {max:15,l:[7.5,15,22.5,33.8]}, {max:35,l:[5,9,15,22.5]},
    {max:60,l:[3,6,9,13.5]}, {max:100,l:[1.9,4,6,9]}
  ];
  const pProcafe=[10,30,60,90];
  function numero(v){v=Number(v);return Number.isFinite(v)?v:null}
  function porLimites(v,l){v=numero(v);if(v===null)return'Não informado';if(v<=l[0])return classes[0];if(v<=l[1])return classes[1];if(v<=l[2])return classes[2];if(v<=l[3])return classes[3];return classes[4]}
  function classificarP(v,r={}){
    const prem=numero(r.Prem ?? r.P_rem ?? r.Premanescente),argila=numero(r.Argila ?? r.argila ?? r.Clay);
    if(prem!==null){const faixa=pPrem.find(x=>prem<=x.max)||pPrem[pPrem.length-1];return{classe:porLimites(v,faixa.l),criterio:`P-rem ${String(prem).replace('.',',')} mg/L`,fonte:'5ª Aproximação'}}
    if(argila!==null){const faixa=pArgila.find(x=>argila<=x.max)||pArgila[pArgila.length-1];return{classe:porLimites(v,faixa.l),criterio:`Argila ${String(argila).replace('.',',')}%`,fonte:'5ª Aproximação'}}
    const pv=numero(v),pc=pv===null?'Não informado':pv<10?'Baixo':pv<=30?'Médio':pv<=60?'Bom':pv<=90?'Alto':'Muito alto';
    return{classe:pc,criterio:'Faixa geral para cafeicultura',fonte:'Procafé'};
  }
  function classificar(k,v,r={}){if(k==='P')return classificarP(v,r).classe;const l=base[k];if(!l)return'Não calculado';let c=porLimites(v,l);if(inversos.has(k)&&c!=='Não informado')c=classes[4-classes.indexOf(c)];return c}
  function nivel(k,v,r={}){const c=classificar(k,v,r),map={'Muito baixo':2,'Baixo':4,'Médio':6.5,'Bom':9,'Muito bom':10};return map[c]||0}
  function posicao(c){if(/Muito baixo|Baixo/.test(c))return'abaixo da faixa';if(/Muito bom/.test(c))return'acima da faixa';return'na faixa de interpretação'}
  window.DoCampoSoloRules={classes,base,classificar,classificarP,nivel,posicao,fonte:'5ª Aproximação; Procafé (complementar para cafeicultura)'};
})();
