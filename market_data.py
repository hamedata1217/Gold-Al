import time
import requests
import pandas as pd

SYMBOL = "XAUUSD=X"
BASE_URLS = [
    f"https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}",
    f"https://query2.finance.yahoo.com/v8/finance/chart/{SYMBOL}",
]
HEADERS = {"User-Agent": "Mozilla/5.0"}
_CACHE = {"at": 0.0, "data": None}
CACHE_SECONDS = 20


def _download():
    now = time.time()
    if _CACHE["data"] is not None and now - _CACHE["at"] < CACHE_SECONDS:
        return _CACHE["data"].copy()

    params = {"range": "5d", "interval": "1m", "events": "history"}
    last_error = None
    for url in BASE_URLS:
        try:
            response = requests.get(url, params=params, headers=HEADERS, timeout=20)
            response.raise_for_status()
            payload = response.json()
            result = payload.get("chart", {}).get("result")
            if not result:
                error = payload.get("chart", {}).get("error")
                raise RuntimeError(f"Yahoo Finance داده‌ای برنگرداند: {error}")
            item = result[0]
            quote = item["indicators"]["quote"][0]
            frame = pd.DataFrame({
                "open": quote.get("open"),
                "high": quote.get("high"),
                "low": quote.get("low"),
                "close": quote.get("close"),
                "volume": quote.get("volume"),
            }, index=pd.to_datetime(item.get("timestamp", []), unit="s", utc=True))
            frame = frame.dropna(subset=["open", "high", "low", "close"])
            if frame.empty:
                raise RuntimeError("داده کندل خالی است.")
            frame = frame[~frame.index.duplicated(keep="last")].sort_index()
            _CACHE["at"] = now
            _CACHE["data"] = frame
            return frame.copy()
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"خطا در دریافت داده از Yahoo Finance: {last_error}")


def get_candles(tf: str) -> pd.DataFrame:
    """Return OHLCV candles for 1m, 5m or 15m."""
    if tf not in ("1m", "5m", "15m"):
        raise ValueError("تایم‌فریم پشتیبانی‌نشده است؛ فقط 1m، 5m و 15m.")
    data = _download()
    if tf == "1m":
        out = data.copy()
    else:
        minutes = int(tf[:-1])
        out = data.resample(f"{minutes}min", label="right", closed="right").agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }).dropna(subset=["open", "high", "low", "close"])
    if len(out) < 80:
        raise RuntimeError(f"کندل کافی برای {tf} وجود ندارد؛ تعداد فعلی: {len(out)}")
    return out


def get_gold_price():
    data = _download()
    last = data.iloc[-1]
    stamp = data.index[-1].strftime("%Y-%m-%d %H:%M UTC")
    return float(last["close"]), stamp
