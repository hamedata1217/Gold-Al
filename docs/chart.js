(() => {
  const el = document.getElementById("chart");
  if (!el) return;

  const height = 420;
  const intervals = { "1m": "1", "5m": "5", "15m": "15" };
  let currentTf = "1m";

  const style = document.createElement("style");
  style.textContent = `
    #chart { display:block; height:${height}px; padding:0; overflow:hidden; background:#0e1218; border:1px solid #303947; }
    #chart:before { display:none; }
    #tvGoldFrame { width:100%; height:100%; border:0; display:block; background:#0e1218; }
    #chartSourceNote { margin:8px 2px 0; color:#8e9aaa; font-size:11px; line-height:1.8; }
  `;
  document.head.appendChild(style);

  const note = document.createElement("div");
  note.id = "chartSourceNote";
  note.className = "news-note";
  note.textContent = "نمودار از TradingView با نماد OANDA:XAUUSD نمایش داده می‌شود. نرخ و اسپرد بروکر Eplanet ممکن است متفاوت باشد.";
  el.insertAdjacentElement("afterend", note);

  function render(tf) {
    currentTf = tf;
    const interval = intervals[tf] || "1";
    const params = new URLSearchParams({
      symbol: "OANDA:XAUUSD",
      interval,
      theme: "dark",
      style: "1",
      locale: "en",
      timezone: "Etc/UTC",
      hide_side_toolbar: "1",
      allow_symbol_change: "0",
      saveimage: "0",
      calendar: "0",
      hideideas: "1",
      withdateranges: "1",
      studies: "MASimple@tv-basicstudies,RSI@tv-basicstudies,MACD@tv-basicstudies"
    });
    const frame = document.createElement("iframe");
    frame.id = "tvGoldFrame";
    frame.title = "نمودار زنده طلای جهانی XAUUSD از TradingView";
    frame.loading = "lazy";
    frame.referrerPolicy = "origin";
    frame.src = "https://s.tradingview.com/widgetembed/?" + params.toString();
    el.replaceChildren(frame);
  }

  document.querySelectorAll("[data-tf]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tf]").forEach(x => x.classList.toggle("active", x === btn));
      render(btn.dataset.tf);
    });
  });

  render(currentTf);
})();
