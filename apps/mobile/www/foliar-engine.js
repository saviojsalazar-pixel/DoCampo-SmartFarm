(function(){
'use strict';
const nutrients=['N','P','K','Ca','Mg','S','B','Zn','Fe','Mn','Cu'];
const modelVersion='DRIS-Cafe-DoCampo-1.0';
const units={N:'dag/kg',P:'dag/kg',K:'dag/kg',Ca:'dag/kg',Mg:'dag/kg',S:'dag/kg',B:'mg/kg',Zn:'mg/kg',Fe:'mg/kg',Mn:'mg/kg',Cu:'mg/kg'};
const limits={N:[2.3,3.2,3.5,3.8],P:[.05,.16,.2,.3],K:[1.2,2.2,2.6,2.7],Ca:[.5,1,1.5,2.5],Mg:[.2,.4,.45,.5],S:[.02,.15,.2,.25],B:[30,59,80,100],Zn:[7,15,17,30],Fe:[45,100,155,200],Mn:[22,120,191,210],Cu:[4,16,32,50]};
const raw=[
['N/P',21.472,2.3341],['N/K',1.458,.1636],['N/Ca',2.765,.5302],['N/Mg',8.423,1.4818],['N/S',20.409,2.9007],['N/Zn',.233,.1067],['N/B',.052,.01],['N/Cu',.237,.0831],['N/Mn',.03,.0193],['N/Fe',.048,.0105],
['P/N',.046,.0053],['P/K',.067,.0069],['P/Ca',.126,.0215],['P/Mg',.386,.0699],['P/S',.936,.1327],['P/Zn',.011,.0048],['P/B',.002,.0005],['P/Cu',.011,.0036],['P/Mn',.001,.0009],['P/Fe',.002,.0005],
['K/N',.694,.0758],['K/P',15.143,1.6019],['K/Ca',1.909,.367],['K/Mg',5.848,1.1719],['K/S',14.124,2.2119],['K/Zn',.158,.0679],['K/B',.036,.007],['K/Cu',.164,.0637],['K/Mn',.021,.0132],['K/Fe',.033,.0068],
['Ca/N',.374,.0659],['Ca/P',8.125,1.2558],['Ca/K',.542,.0985],['Ca/Mg',3.079,.4274],['Ca/S',7.525,1.1725],['Ca/Zn',.085,.0356],['Ca/B',.019,.0033],['Ca/Cu',.087,.0317],['Ca/Mn',.011,.0061],['Ca/Fe',.017,.0039],
['Mg/N',.123,.0245],['Mg/P',2.682,.5529],['Mg/K',.179,.0448],['Mg/Ca',.332,.0539],['Mg/S',2.491,.5515],['Mg/Zn',.029,.0133],['Mg/B',.006,.0014],['Mg/Cu',.029,.01],['Mg/Mn',.003,.0019],['Mg/Fe',.006,.0016],
['S/N',.05,.0068],['S/P',1.091,.1719],['S/K',.073,.0118],['S/Ca',.136,.0223],['S/Mg',.418,.0812],['S/Zn',.011,.0047],['S/B',.003,.0005],['S/Cu',.012,.0033],['S/Mn',.001,.0009],['S/Fe',.002,.0005],
['Zn/N',5.826,4.1592],['Zn/P',128.939,98.5217],['Zn/K',8.197,5.2925],['Zn/Ca',15.76,11.3169],['Zn/Mg',49.952,39.9306],['Zn/S',116.947,85.9128],['Zn/B',.287,.1904],['Zn/Cu',1.449,1.5451],['Zn/Mn',.191,.2174],['Zn/Fe',.256,.1489],
['B/N',19.887,3.7647],['B/P',435.09,87.2003],['B/K',28.862,5.8246],['B/Ca',53.927,9.3061],['B/Mg',165.371,33.9312],['B/S',401.646,73.1893],['B/Zn',4.405,1.7287],['B/Cu',4.667,1.8493],['B/Mn',.572,.3405],['B/Fe',.922,.1631],
['Cu/N',4.636,1.3627],['Cu/P',101.216,30.6672],['Cu/K',6.729,1.936],['Cu/Ca',12.662,3.9078],['Cu/Mg',38.643,12.1039],['Cu/S',92.415,22.5782],['Cu/Zn',1.06,.5066],['Cu/B',.238,.0735],['Cu/Mn',.131,.0877],['Cu/Fe',.216,.0641],
['Mn/N',55.269,51.4815],['Mn/P',1190.256,1045.024],['Mn/K',80.681,76.0633],['Mn/Ca',140.114,105.6213],['Mn/Mg',438.759,370.5637],['Mn/S',1092.198,969.9969],['Mn/Zn',13.177,14.3341],['Mn/B',2.738,2.3391],['Mn/Cu',11.846,9.7695],['Mn/Fe',2.474,1.9766],
['Fe/N',22.128,5.3966],['Fe/P',483.342,119.4718],['Fe/K',31.914,7.0801],['Fe/Ca',60.096,14.0659],['Fe/Mg',185.068,50.4695],['Fe/S',446.55,103.6425],['Fe/Zn',4.815,1.801],['Fe/B',1.121,.2181],['Fe/Cu',5.121,1.8802],['Fe/Mn',.64,.3953]
];
const norms=raw.map(([pair,mean,sd])=>{const [a,b]=pair.replace(/Fé/g,'Fe').split('/');return{a,b,mean,sd}});
function classify(n,v){const [d,l,o,e]=limits[n];return v<d?'Deficiente':v<l?'Baixo':v<o?'Ótimo':v<e?'Elevado':'Excesso'}
function calculate(values){
 nutrients.forEach(n=>{if(!Number.isFinite(values[n])||values[n]<=0)throw Error('Valor inválido para '+n)});
 const conventional={};nutrients.forEach(n=>conventional[n]=classify(n,values[n]));
 const z=norms.map(r=>({...r,ratio:values[r.a]/values[r.b],z:((values[r.a]/values[r.b])-r.mean)/r.sd*10}));
 const indices={};nutrients.forEach(n=>{const plus=z.filter(r=>r.a===n).reduce((s,r)=>s+r.z,0),minus=z.filter(r=>r.b===n).reduce((s,r)=>s+r.z,0);indices[n]=(plus-minus)/(2*(nutrients.length-1))});
 const ibn=nutrients.reduce((s,n)=>s+Math.abs(indices[n]),0),order=[...nutrients].sort((a,b)=>indices[a]-indices[b]);
 return{conventional,indices,ibn,order,z};
}
window.DoCampoFoliarEngine={modelVersion,nutrients,units,limits,norms,classify,calculate};
})();
