(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const API = "https://biquote.io";
  const TIMEFRAMES = [
    { key:"1m", label:"۱ دقیقه", maxAge:180 },
    { key:"5m", label:"۵ دقیقه", maxAge:600 },
    { key:"15m", label:"۱۵ دقیقه", maxAge:1800 }
  ];
  let busy = false;
  const fmt = n => Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const set = (id, value) => { const el=$(id); if(el) el.textContent=value; };
  function ema(values, period) {
    if(values.length < period) return null;
    const k=2/(period+1);
    let v=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
    for(let i=period;i<values.length;i++) v=values[i]*k+v*(1-k);
    return v;
  }
  function rsi(values, period=14) {
    if(values.length<=period) return null;
    let gains=0, losses=0;
    for(let i=1;i<=period;i++){const d=values[i]-values[i-1]; if(d>0)gains+=d;else losses-=d;}
    let ag=gains/period, al=losses/period;
    for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];ag=(ag*(period-1)+Math.max(d,0))/period;al=(al*(period-1)+Math.max(-d,0))/period;}
    if(al===0)return 100;
    return 100-(100/(1+ag/al));
  }
  function atr(bars, period=14) {
    if(bars.length<=period)return null;
    const tr=[];
    for(let i=1;i<bars.length;i++){
      const b=bars[i],p=bars[i-1];
      tr.push(Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)));
    }
    return tr.slice(-period).reduce((a,b)=>a+b,0)/period;
  }
  function analyze(bars) {
    const close=bars.map(b=>b.close);
    const last=bars[bars.length-1];
    const e20=ema(close,20),e50=ema(close,50);
    const r=rsi(close), a=atr(bars);
    const macdLine=ema(close,12)-ema(close,26);
    const macdSignalSeries=[];
    for(let i=25;i<close.length;i++) macdSignalSeries.push(ema(close.slice(0,i+1),12)-ema(close.slice(0,i+1),26));
    const mSignal=ema(macdSignalSeries,9);
    if([e20,e50,r,a,macdLine,mSignal].some(v=>v===null||!Number.isFinite(v))) throw new Error("تعداد کندل برای محاسبه اندیکاتورها کافی نیست");
    let score=0;
    if(last.close>e20)score++;
    if(e20>e50)score++;
    if(macdLine>mSignal)score++;
    if(r>=55)score++;
    if(last.close<e20)score--;
    if(e20<e50)score--;
    if(macdLine<mSignal)score--;
    if(r<=45)score--;
    return {score,rsi:r,atr:a,ema20:e20,ema50:e50,macd:macdLine,macdSignal:mSignal,close:last.close};
  }
  async function json(url) {
    const c=new AbortController(), timer=setTimeout(()=>c.abort(),12000);
    try {
      const r=await fetch(url,{cache:"no-store",signal:c.signal});
      if(!r.ok)throw new Error("HTTP "+r.status);
      return await r.json();
    } finally {clearTimeout(timer);}
  }
  function clearPlan(message) {
    ["buyEntry","buyTp","buySl","sellEntry","sellTp","sellSl","manageEntry","manageSl","manageTp1","manageTp2"].forEach(id=>set(id,"—"));
    set("buyPlanState",message);set("sellPlanState",message);
  }
  async function run() {
    if(busy)return;busy=true;
    try {
      // Use the same OHLC feed as the chart. The latest completed 1m candle
      // supplies the reference price; no separate quote endpoint is assumed.
      const results=await Promise.all(TIMEFRAMES.map(async tf=>{
        const d=await json(API+"/api/XAUUSD/ohlc?interval="+tf.key+"&limit=180");
        if(!Array.isArray(d.bars))throw new Error("ساختار کندل "+tf.key+" معتبر نیست");
        const bars=d.bars.filter(b=>!b.isOpen).map(b=>({
          time:Date.parse(b.openTime),open:Number(b.open),high:Number(b.high),low:Number(b.low),close:Number(b.close)
        })).filter(b=>Number.isFinite(b.time)&&[b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
        if(bars.length<60)throw new Error("کندل کافی برای "+tf.key+" دریافت نشد");
        const last=bars[bars.length-1], intervalMs=Number(tf.key.slice(0,-1))*60000;
        const candleAge=(Date.now()-last.time-intervalMs)/1000;
        if(candleAge>tf.maxAge||candleAge< -intervalMs/2)throw new Error("کندل "+tf.key+" قدیمی یا زمان آن نامعتبر است");
        return {tf,bars,ind:analyze(bars)};
      }));
      const map=Object.fromEntries(results.map(x=>[x.tf.key,x]));
      const oneMinuteBars=map["1m"].bars;
      const lastOneMinute=oneMinuteBars[oneMinuteBars.length-1];
      const price=lastOneMinute.close;
      const quoteTime=lastOneMinute.time+60000;
      const quoteAge=(Date.now()-quoteTime)/1000;
      if(!Number.isFinite(price)||price<=0||!Number.isFinite(quoteAge)||quoteAge>180||quoteAge< -30) {
        throw new Error("آخرین کندل یک‌دقیقه‌ای تازه نیست؛ سیگنال زنده صادر نمی‌شود.");
      }
      const a=map["1m"].ind,b=map["5m"].ind,c=map["15m"].ind;
      const buy=a.score>=3&&b.score>=3&&c.score>=2;
      const sell=a.score<=-3&&b.score<=-3&&c.score<=-2;
      const side=buy?"BUY":sell?"SELL":"NONE";
      const alignment=Math.abs(a.score)+Math.abs(b.score)+Math.abs(c.score);
      set("tf1State",(a.score>0?"صعودی":a.score<0?"نزولی":"خنثی")+" · RSI "+a.rsi.toFixed(0));
      set("tf5State",(b.score>0?"صعودی":b.score<0?"نزولی":"خنثی")+" · RSI "+b.rsi.toFixed(0));
      set("tf15State",(c.score>0?"صعودی":c.score<0?"نزولی":"خنثی")+" · RSI "+c.rsi.toFixed(0));
      set("signalStrength",alignment+" از ۱۲");
      if(side==="NONE"){
        set("signalTitle","NO TRADE · فعلاً ورود نکن");
        set("signalText","تایم‌فریم‌ها هم‌جهت نیستند یا قدرت تأیید کافی وجود ندارد. قیمت مرجع داده: "+fmt(price));
        clearPlan("شرایط ورود کامل نیست؛ منتظر تأیید بعدی بمان.");
      } else {
        const baseAtr=a.atr;
        const entry=price, sl=side==="BUY"?entry-1.5*baseAtr:entry+1.5*baseAtr;
        const tp1=side==="BUY"?entry+1.5*baseAtr:entry-1.5*baseAtr;
        const tp2=side==="BUY"?entry+2.5*baseAtr:entry-2.5*baseAtr;
        set("signalTitle",side==="BUY"?"▲ سیگنال BUY":"▼ سیگنال SELL");
        set("signalText","تأیید هم‌جهت در هر سه تایم‌فریم · هم‌جهتی شاخص‌ها "+alignment+" از ۱۲ · قیمت مرجع Biquote: "+fmt(price));
        clearPlan("سناریوی "+side+" فعال است؛ قیمت‌ها مرجع‌اند و با Eplanet تطبیق داده نشده‌اند.");
        if(side==="BUY"){set("buyEntry",fmt(entry));set("buySl",fmt(sl));set("buyTp",fmt(tp2));}
        else{set("sellEntry",fmt(entry));set("sellSl",fmt(sl));set("sellTp",fmt(tp2));}
        set("manageEntry",fmt(entry));set("manageSl",fmt(sl));set("manageTp1",fmt(tp1));set("manageTp2",fmt(tp2));
      }
      window.dispatchEvent(new CustomEvent("gold-ai-signal",{detail:{side,price,time:quoteTime}}));
      const stamp=new Date(quoteTime).toLocaleTimeString("fa-IR");
      set("signalText",($("signalText")?.textContent||"")+" · زمان آخرین کندل بسته‌شده: "+stamp);
    } catch(err) {
      ["tf1State","tf5State","tf15State","signalStrength"].forEach(id=>set(id,"داده معتبر نیست"));
      set("signalTitle","NO TRADE · داده تأیید نشد");
      set("signalText",err.message+" هیچ سیگنالی تا دریافت داده تازه صادر نمی‌شود.");
      clearPlan("به‌دلیل نبود داده زنده و معتبر، ورود و خروج محاسبه نمی‌شود.");
    } finally {busy=false;}
  }
  run();
  setInterval(run,10000);
})();