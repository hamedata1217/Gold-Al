import pandas as pd


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()
    close = x["close"]
    high = x["high"]
    low = x["low"]

    x["ema20"] = close.ewm(span=20, adjust=False).mean()
    x["ema50"] = close.ewm(span=50, adjust=False).mean()

    fast = close.ewm(span=12, adjust=False).mean()
    slow = close.ewm(span=26, adjust=False).mean()
    x["macd"] = fast - slow
    x["macd_signal"] = x["macd"].ewm(span=9, adjust=False).mean()

    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    avg_loss = loss.ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-12)
    x["rsi"] = 100 - (100 / (1 + rs))

    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/14, adjust=False, min_periods=14).mean()

    up_move = high.diff()
    down_move = -low.diff()
    plus_dm = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0.0)
    plus_di = 100 * plus_dm.ewm(alpha=1/14, adjust=False).mean() / atr.replace(0, 1e-12)
    minus_di = 100 * minus_dm.ewm(alpha=1/14, adjust=False).mean() / atr.replace(0, 1e-12)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, 1e-12)
    x["plus_di"] = plus_di
    x["minus_di"] = minus_di
    x["adx"] = dx.ewm(alpha=1/14, adjust=False).mean()
    return x
