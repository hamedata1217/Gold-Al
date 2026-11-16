(() => {
  "use strict";
  const el=document.getElementById("chart");
  if(!el||!window.LightweightCharts)return;
  const API="https://biquote.io/api/XAUUSD/ohlc";
  const intervals={"1m":"1m","5m":"5m","15m":"15m"};
  let tf="1m",chart,candles,ema20,ema50,busy=false,currentSignal=null,lastClosedTime=null;
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
  status.style.cssText="position:absolute;top:8px;right:8px;z-index:2;background:#101820dd;color:#e9bd55;border:1px solid #303947;border-radius:8px;padding:5px 8px;font-size:10px";
  status.textContent="در حال دریافت کندل…";el.appendChild(status);
  function applySignalMarker(){
    if(!candles||!lastClosedTime)return;
    if(!currentSignal||!["BUY","SELL"].includes(currentSignal.side)){
      candles.setMarkers([]);
      return;
    }
    const buy=currentSignal.side==="BUY";
    candles.setMarkers([{
      time:lastClosedTime,
      position:buy?"belowBar":"aboveBar",
      color:buy?"#32c997":"#ff707b",
      shape:buy?"arrowUp":"arrowDown",
      text:buy?"BUY":"SELL"
    }]);
  }
  window.addEventListener("gold-ai-signal",event=>{
    currentSignal=event.detail||null;
    applySignalMarker();
  });
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
      lastClosedTime=(closedRows.length?closedRows[closedRows.length-1]:rows[rows.length-1]).time;
      candles.setData(rows.map(({isOpen,...b})=>b));
      applySignalMarker();
      ema20.setData(calcEma(rows,20));ema50.setData(calcEma(rows,50));
      chart.timeScale().fitContent();
      status.textContent="● کندل‌ها دریافت شد · "+tf;
      status.style.color="#32c997";
    }catch(e){
      status.textContent="خطا در دریافت چارت: "+e.message;
      status.style.color="#ff707b";
    }finally{busy=false;}
  }
  document.querySelectorAll("[data-tf]").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll("[data-tf]").forEach(x=>x.classList.toggle("active",x===btn));
    tf=intervals[btn.dataset.tf]?btn.dataset.tf:"1m";load();
  }));
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth})).observe(el);
  load();setInterval(load,30000);
})();