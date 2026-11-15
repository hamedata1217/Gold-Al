(() => {
  const API = "https://biquote.io/api";
  const el = document.getElementById("chart");
  if (!el) return;
  el.innerHTML = '<div id="goldChart" role="img" aria-label="نمودار کندلی XAUUSD"></div><div id="chartOverlay">در حال دریافت کندل‌های واقعی طلا…</div>';
  const style = document.createElement("style");
  style.textContent = '#chart{display:block;height:370px;padding:0;position:relative;overflow:hidden;background:#0e1218}#chart:before{display:none}#goldChart{width:100%;height:100%;direction:ltr}#chartOverlay{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:#aeb8c5;background:#0e1218cc;font-size:12px;line-height:1.9;pointer-events:none}#chartOverlay[hidden]{display:none}#chartDetails{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}#chartDetails .metric{min-width:0}#fibLevels{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}#fibLevels span{font-size:10px;color:#e9bd55;background:#2a2111;border:1px solid #594923;padding:5px 7px;border-radius:8px}';
  document.head.appendChild(style);
  const details=document.createElement("div");
  details.id="chartDetails";
  details.innerHTML='<div class="metric"><small>RSI (14)</small><strong id="rsiValue">—</strong></div><div class="metric"><small>MACD (12,26,9)</small><strong id="macdValue">—</strong></div><div class="metric" style="grid-column:1/-1"><small>فیبوناچی بازه اخیر</small><div id="fibLevels">پس از دریافت داده</div></div>';
  el.insertAdjacentElement("afterend",details);
  const overlay=document.getElementById("chartOverlay");
  const status=document.getElementById("connectionStatus");
  let chart=null,candleSeries=null,ema20Series=null,ema50Series=null,currentTf="1m",fibLines=[],lastBars=[];
  const tfNames={"1m":"۱ دقیقه","5m":"۵ دقیقه","15m":"۱۵ دقیقه"};
  const setOverlay=(msg,show=true)=>{overlay.textContent=msg;overlay.hidden=!show;};
  function makeChart(){
    if(!window.LightweightCharts){setOverlay("کتابخانه نمودار بارگذاری نشد. اتصال اینترنت را بررسی کنید.");return false;}
    if(chart)return true;
    chart=LightweightCharts.createChart(document.getElementById("goldChart"),{
      width:document.getElementById("goldChart").clientWidth,height:370,
      layout:{background:{type:"solid",color:"#0e1218"},textColor:"#aeb8c5",fontFamily:"Tahoma, sans-serif"},
      grid:{vertLines:{color:"#ffffff0a"},horzLines:{color:"#ffffff0a"}},
      rightPriceScale:{borderColor:"#303947"},timeScale:{borderColor:"#303947",timeVisible:true,secondsVisible:false},
      crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
      localization:{locale:"fa-IR",priceFormatter:p=>Number(p).toFixed(2)}
    });
    candleSeries=chart.addCandlestickSeries({upColor:"#32c997",downColor:"#ff707b",borderUpColor:"#32c997",borderDownColor:"#ff707b",wickUpColor:"#32c997",wickDownColor:"#ff707b",priceLineVisible:true});
    ema20Series=chart.addLineSeries({color:"#e9bd55",lineWidth:2,priceLineVisible:false,lastValueVisible:false});
    ema50Series=chart.addLineSeries({color:"#61a8ff",lineWidth:2,priceLineVisible:false,lastValueVisible:false});
    new ResizeObserver(()=>chart.applyOptions({width:document.getElementById("goldChart").clientWidth})).observe(document.getElementById("goldChart"));
    return true;
  }
  function ema(values,period){const k=2/(period+1),out=[];let prev=null;values.forEach((v,i)=>{prev=prev===null?v:v*k+prev*(1-k);out.push(prev);});return out;}
  function rsi(values,period=14){if(values.length<=period)return null;let gains=0,losses=0;for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>0)gains+=d;else losses-=d;}let avgG=gains/period,avgL=losses/period;for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgG=(avgG*(period-1)+Math.max(d,0))/period;avgL=(avgL*(period-1)+Math.max(-d,0))/period;}return avgL===0?100:100-(100/(1+avgG/avgL));}
  function drawFib(bars){
    fibLines.forEach(line=>{try{candleSeries.removePriceLine(line)}catch(_){}});fibLines=[];
    const recent=bars.slice(-120);if(recent.length<10)return;
    let hi=-Infinity,lo=Infinity,hiI=0,loI=0;
    recent.forEach((b,i)=>{if(b.high>hi){hi=b.high;hiI=i;}if(b.low<lo){lo=b.low;loI=i;}});
    if(!(hi>lo))return;
    const up=loI<hiI,range=hi-lo,levels=[0,.236,.382,.5,.618,.786,1];
    const labels=["۰٪","۲۳٫۶٪","۳۸٫۲٪","۵۰٪","۶۱٫۸٪","۷۸٫۶٪","۱۰۰٪"];
    levels.forEach((lv,i)=>{
      const price=up?hi-range*lv:lo+range*lv;
      const line=candleSeries.createPriceLine({price,color:lv===.618?"#e9bd55":"#9a814d99",lineWidth:lv===.618?2:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true,title:"Fib "+labels[i]});
      fibLines.push(line);
    });
    document.getElementById("fibLevels").innerHTML=levels.slice(1,-1).map(lv=>{const p=up?hi-range*lv:lo+range*lv;return '<span>'+({"0.236":"23.6","0.382":"38.2","0.5":"50","0.618":"61.8","0.786":"78.6"}[String(lv)])+'٪ · '+p.toFixed(2)+'</span>';}).join("");
  }
  function calcRsi(v,p=14){const out=Array(v.length).fill(null);if(v.length<=p)return out;let g=0,l=0;for(let i=1;i<=p;i++){const d=v[i]-v[i-1];if(d>0)g+=d;else l-=d;}let ag=g/p,al=l/p;out[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<v.length;i++){const d=v[i]-v[i-1];ag=(ag*(p-1)+Math.max(d,0))/p;al=(al*(p-1)+Math.max(-d,0))/p;out[i]=al===0?100:100-100/(1+ag/al);}return out;}
  function updateSignals(bars,closes,fast,slow){const e12=ema(closes,12),e26=ema(closes,26),m=e12.map((v,i)=>v-e26[i]),ms=ema(m,9),h=m.map((v,i)=>v-ms[i]),rv=calcRsi(closes),markers=[];let prev='';for(let i=50;i<bars.length-1;i++){const buy=fast[i]>slow[i]&&closes[i]>fast[i]&&rv[i]>=52&&rv[i]<=70&&h[i]>0,sell=fast[i]<slow[i]&&closes[i]<fast[i]&&rv[i]<=48&&rv[i]>=30&&h[i]<0,side=buy?'BUY':sell?'SELL':'';if(side&&side!==prev)markers.push({time:bars[i].time,position:buy?'belowBar':'aboveBar',color:buy?'#32c997':'#ff707b',shape:buy?'arrowUp':'arrowDown',text:side,size:2});prev=side;}candleSeries.setMarkers(markers);const i=bars.length-2,buy=i>=50&&fast[i]>slow[i]&&closes[i]>fast[i]&&rv[i]>=52&&rv[i]<=70&&h[i]>0,sell=i>=50&&fast[i]<slow[i]&&closes[i]<fast[i]&&rv[i]<=48&&rv[i]>=30&&h[i]<0,title=document.querySelector('.signal b'),desc=document.querySelector('.signal p'),ico=document.querySelector('.signal-icon');if(title)title.textContent=buy?'BUY SIGNAL':sell?'SELL SIGNAL':'NO CONFIRMED SIGNAL';if(desc)desc.textContent=buy||sell?'Confirmed on the last closed candle using EMA20/50, RSI and MACD.':'EMA, RSI and MACD are not aligned yet.';if(ico){ico.textContent=buy?'BUY':sell?'SELL':'...';ico.style.color=buy?'#32c997':sell?'#ff707b':'#e9bd55';}}
  function render(bars){
    if(!makeChart())return;
    const closes=bars.map(b=>b.close),times=bars.map(b=>b.time);
    candleSeries.setData(bars);
    const fast=ema(closes,20),slow=ema(closes,50);
    ema20Series.setData(fast.map((v,i)=>({time:times[i],value:v})));
    ema50Series.setData(slow.map((v,i)=>({time:times[i],value:v})));
    drawFib(bars);
    updateSignals(bars,closes,fast,slow);
    const rv=rsi(closes);document.getElementById("rsiValue").textContent=rv===null?"داده ناکافی":rv.toFixed(1);
    const e12=ema(closes,12),e26=ema(closes,26),macd=e12.map((v,i)=>v-e26[i]),sig=ema(macd,9);
    document.getElementById("macdValue").textContent=macd.length?((macd.at(-1)-sig.at(-1))>=0?"مثبت ":"منفی ")+(macd.at(-1)-sig.at(-1)).toFixed(3):"—";
    chart.timeScale().fitContent();
  }
  async function load(tf=currentTf){
    currentTf=tf;setOverlay("در حال دریافت کندل‌های واقعی XAU/USD · "+tfNames[tf]+"…");
    try{
      const url=API+"/XAUUSD/ohlc?interval="+encodeURIComponent(tf)+"&limit=300";
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error("سرویس کندل پاسخ "+response.status+" داد");
      const data=await response.json();
      if(!Array.isArray(data.bars)||data.bars.length<30)throw new Error("کندل کافی برای رسم و محاسبه اندیکاتورها دریافت نشد.");
      const bars=data.bars.map(b=>({time:Math.floor(new Date(b.openTime).getTime()/1000),open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close),isOpen:!!b.isOpen})).filter(b=>Number.isFinite(b.time)&&[b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
      const unique=bars.filter((b,i)=>i===0||b.time!==bars[i-1].time);
      if(unique.length<30)throw new Error("داده کندل معتبر کافی نیست.");
      lastBars=unique;render(unique);
      const last=unique[unique.length-1],age=Math.max(0,Date.now()/1000-last.time),limit=tf==="1m"?180:tf==="5m"?480:1080;
      const fresh=last.isOpen&&age<limit;
      setOverlay("",false);
      status.textContent=fresh?"● کندل زنده متصل است":"● داده کندل دریافت شد · زنده‌بودن تأیید نشد";
      status.style.color=fresh?"#32c997":"#e9bd55";
      status.style.borderColor=fresh?"#286b58":"#644f24";
      status.style.background=fresh?"#10251f":"#2a2111";
      const old=document.getElementById("chartSourceNote");
      if(old)old.remove();
      const note=document.createElement("div");note.id="chartSourceNote";note.className="news-note";
      note.textContent="منبع: Biquote · نماد XAUUSD · آخرین کندل: "+new Date(last.time*1000).toLocaleString("fa-IR")+(fresh?" · کندل جاری":" · داده تاریخی/تأخیر احتمالی")+" . قیمت بروکر Eplanet ممکن است متفاوت باشد.";
      details.appendChild(note);
    }catch(err){
      console.error("Gold AI chart:",err);
      setOverlay("اتصال کندل XAU/USD برقرار نشد. هیچ کندل ساختگی نمایش داده نمی‌شود. علت: "+err.message);
      status.textContent="● چارت متصل نیست";status.style.color="#ff707b";status.style.borderColor="#713b43";status.style.background="#2a1519";
    }
  }
  document.querySelectorAll("[data-tf]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-tf]").forEach(x=>x.classList.toggle("active",x===btn));load(btn.dataset.tf);}));
  load("1m");
  setInterval(()=>load(currentTf),60000);
})();