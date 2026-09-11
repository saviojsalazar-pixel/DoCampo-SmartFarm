(function(){
  'use strict';
  if(window.Chart)return;
  function SimpleChart(canvas,config){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=config.data||{labels:[],datasets:[]};this.options=config.options||{};this.plugins=config.plugins||[];this.scales={};this.update()}
  SimpleChart.prototype.update=function(){
    const canvas=this.canvas,ctx=this.ctx,ratio=window.devicePixelRatio||1,width=Math.max(320,canvas.parentElement?.clientWidth||640),height=Math.max(240,canvas.parentElement?.clientHeight||320);
    canvas.width=width*ratio;canvas.height=height*ratio;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const labels=this.data.labels||[],dataset=this.data.datasets?.[0]||{data:[]},values=dataset.data||[],left=48,right=width-16,top=24,bottom=height-42,max=Math.max(1,...values)*1.15;
    ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1;ctx.fillStyle='#64748b';ctx.font='10px Arial';ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4,v=max*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(v.toLocaleString('pt-BR',{maximumFractionDigits:1}),left-6,y)}
    const slot=(right-left)/Math.max(1,labels.length),bar=Math.min(54,slot*.62);
    values.forEach((value,i)=>{const h=(bottom-top)*(Number(value)||0)/max,x=left+slot*i+(slot-bar)/2,y=bottom-h;ctx.fillStyle=dataset.backgroundColor||'#22c55e';ctx.fillRect(x,y,bar,h);ctx.strokeStyle=dataset.borderColor||'#15803d';ctx.strokeRect(x,y,bar,h);ctx.fillStyle='#0f172a';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2}),x+bar/2,y-3);ctx.textBaseline='top';ctx.fillText(String(labels[i]??i+1),x+bar/2,bottom+8)});
    this.scales={y:{getPixelForValue:v=>bottom-(bottom-top)*(Number(v)||0)/max},x:{left,right}};
    this.plugins.forEach(plugin=>{try{plugin.afterDraw?.(this)}catch(e){console.warn(e)}});
  };
  SimpleChart.prototype.toBase64Image=function(){return this.canvas.toDataURL('image/png')};
  window.Chart=SimpleChart;
})();
