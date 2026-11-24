(() => {
  "use strict";
  const el=document.getElementById("chart");
  if(!el||!window.LightweightCharts)return;
  const API="https://biquote.io/api/XAUUSD/ohlc";
  const intervals={"1m":"1m","5m":"5m","15m":"15m"};
  let tf="1m",chart,candles,ema20,ema50,busy=false,currentSignal=null,lastClosedTime=null,tradeLines=[],srLines=[],hasLoaded=false,fitNextLoad=true;
  const style=document.createElement("style");
  style.textContent="#chart{display:block;height:420px;padding:0;overflow:hidden;background:#0e1218;border:1px solid #303947}#chart:before{display:none}#chartSourceNote{margin:8px 2px 0;color:#8e9aaa;font-size:11px;line-height:1.8}";
  document.head.appendChild(style);
  el.replaceChildren();
  chart=LightweightCharts.createChart(el,{
    width:el.clientWidth,height:420,
    layout:{background:{color:"#0e1218"},textColor:"#aab4c2"},
    grid:{vertLines:{color:"#202833"},horzLines:{color:"#202833"}},
    rightPriceScale:{borderColor:"#303947"},
    timeScale:{borderColor:"#303947",timeVisible:true,secondsVisible:false},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal}
  });
  candles=chart.addCandlestickSeries({
    upColor:"#32c997",downColor:"#ff707b",borderUpColor:"#32c997",
    borderDownColor:"#ff707b",wickUpColor:"#32c997",wickDownColor:"#ff707b"
  });
  ema20=chart.addLineSeries({color:"#e9bd55",lineWidth:2,title:"EMA 20"});
  ema50=chart.addLineSeries({color:"#68a7ff",lineWidth:2,title:"EMA 50"});
  const note=document.createElement("div");
  note.id="chartSourceNote";note.textContent="منبع کندل: Biquote · XAUUSD · برای نمایش قیمت بروکر Eplanet، اختلاف نرخ و اسپرد را در نظر بگیر.";
  el.insertAdjacentElement("afterend",note);
  const status=document.createElement("div");
  status.style.cssText="position:absolute;top:8px;right:8px;z-index:2;background:#101820ee;color:#e9bd55;border:1px solid #303947;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:700";
  status.textContent="در حال دریافت کندل…";el.appendChild(status);
  const signalBadge=document.createElement("div");
  signalBadge.style.cssText="position:absolute;top:8px;left:8px;z-index:2;background:#101820ee;color:#aab4c2;border:1px solid #596575;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:800;direction:ltr";
  signalBadge.textContent="SIGNAL: WAIT";el.appendChild(signalBadge);
  function clearLines(lines){lines.forEach(line=>{try{candles.removePriceLine(line);}catch(_){}});lines.length=0;}
  function applySignalMarker(){
    if(!candles||!lastClosedTime)return;
    if(!currentSignal||!["BUY","SELL"].includes(currentSignal.side)){
      candles.setMarkers([]);
      clearLines(tradeLines);
      return;
    }
    const buy=currentSignal.side==="BUY";
    const markerTime=Number.isFinite(currentSignal.time)
      ? (candlesDataClosed.reduce((best,row)=>Math.abs(row.time*1000-currentSignal.time)<Math.abs(best.time*1000-currentSignal.time)?row:best,candlesDataClosed[0])||{}).time
      : lastClosedTime;
    candles.setMarkers([{
      time:markerTime||lastClosedTime,
      position:buy?"belowBar":"aboveBar",
      color:buy?"#32c997":"#ff707b",
      shape:buy?"arrowUp":"arrowDown",
      text:buy?"BUY":"SELL"
    }]);
    clearLines(tradeLines);
    const levels=[
      ["ENTRY",currentSignal.entry,"#e9bd55"],
      ["STOP LOSS",currentSignal.sl,"#ff707b"],
      ["TAKE PROFIT 1",currentSignal.tp1,"#32c997"],
      ["TAKE PROFIT 2",currentSignal.tp2,"#65d6a8"]
    ];
    levels.forEach(([title,value,color])=>{
      if(Number.isFinite(Number(value))&&Number(value)>0){
        tradeLines.push(candles.createPriceLine({price:Number(value),color,lineWidth:2,lineStyle:2,axisLabelVisible:true,title}));
      }
    });
  }
  let candlesDataClosed=[];
  window.addEventListener("gold-ai-signal",event=>{
    currentSignal=event.detail||null;
    const side=currentSignal.side;
    signalBadge.textContent=side==="BUY"?"▲ BUY":side==="SELL"?"▼ SELL":(currentSignal.reason?"DATA ERROR":"NO TRADE");
    signalBadge.style.color=side==="BUY"?"#32c997":side==="SELL"?"#ff707b":"#aab4c2";
    signalBadge.style.borderColor=side==="BUY"?"#286b58":side==="SELL"?"#713b43":"#596575";
    applySignalMarker();
  });
  function drawSupportResistance(rows){
    clearLines(srLines);
    const data=rows.filter(b=>!b.isOpen);
    if(data.length<12)return;
    const pivots=[];
    for(let i=3;i<data.length-3;i++){
      const x=data[i];
      const isHigh=data.slice(i-3,i).every(b=>x.high>=b.high)&&data.slice(i+1,i+4).every(b=>x.high>=b.high);
      const isLow=data.slice(i-3,i).every(b=>x.low<=b.low)&&data.slice(i+1,i+4).every(b=>x.low<=b.low);
      if(isHigh)pivots.push({price:x.high,type:"RESISTANCE",time:x.time});
      if(isLow)pivots.push({price:x.low,type:"SUPPORT",time:x.time});
    }
    const last=data[data.length-1],range=Math.max(last.high-last.low,last.close*0.0008);
    const supports=pivots.filter(p=>p.type==="SUPPORT"&&p.price<last.close).sort((a,b)=>Math.abs(last.close-a.price)-Math.abs(last.close-b.price)).slice(0,3);
    const resistances=pivots.filter(p=>p.type==="RESISTANCE"&&p.price>last.close).sort((a,b)=>Math.abs(a.price-last.close)-Math.abs(b.price-last.close)).slice(0,3);
    [...supports,...resistances].forEach(p=>{
      srLines.push(candles.createPriceLine({price:p.price,color:p.type==="SUPPORT"?"#32c997":"#ff9b55",lineWidth:1,lineStyle:2,axisLabelVisible:true,title:p.type==="SUPPORT"?"SUPPORT":"RESISTANCE"}));
    });
  }
  function calcEma(data,period){
    const k=2/(period+1);let v=0,out=[];
    data.forEach((x,i)=>{if(i===period-1){v=data.slice(0,period).reduce((s,b)=>s+b.close,0)/period;out.push({time:x.time,value:v});}
      else if(i>=period){v=x.close*k+v*(1-k);out.push({time:x.time,value:v});}});
    return out;
  }
  async function load(){
    if(busy)return;busy=true;
    try{
      const r=await fetch(API+"?interval="+tf+"&limit=250",{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json();
      if(!Array.isArray(data.bars))throw new Error("ساختار کندل معتبر نیست");
      const rows=data.bars.map(b=>({time:Math.floor(Date.parse(b.openTime)/1000),open:+b.open,high:+b.high,low:+b.low,close:+b.close,isOpen:!!b.isOpen}))
        .filter(b=>Number.isFinite(b.time)&&[b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
      if(rows.length<2)throw new Error("کندل کافی دریافت نشد");
      const closedRows=rows.filter(b=>!b.isOpen);
      candlesDataClosed=closedRows;
      lastClosedTime=(closedRows.length?closedRows[closedRows.length-1]:rows[rows.length-1]).time;
      const visibleRange=hasLoaded&&!fitNextLoad?chart.timeScale().getVisibleLogicalRange():null;
      candles.setData(rows.map(({isOpen,...b})=>b));
      drawSupportResistance(rows);
      applySignalMarker();
      ema20.setData(calcEma(rows,20));ema50.setData(calcEma(rows,50));
      if(fitNextLoad||!hasLoaded){chart.timeScale().fitContent();fitNextLoad=false;}
      else if(visibleRange){try{chart.timeScale().setVisibleLogicalRange(visibleRange);}catch(_){chart.timeScale().fitContent();}}
      hasLoaded=true;
      status.textContent="● کندل‌ها دریافت شد · "+tf;
      status.style.color="#32c997";
    }catch(e){
      status.textContent="خطا در دریافت چارت: "+e.message;
      status.style.color="#ff707b";
    }finally{busy=false;}
  }
  document.querySelectorAll("[data-tf]").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll("[data-tf]").forEach(x=>x.classList.toggle("active",x===btn));
    tf=intervals[btn.dataset.tf]?btn.dataset.tf:"1m";fitNextLoad=true;load();
  }));
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth})).observe(el);
  load();setInterval(load,10000);
})();