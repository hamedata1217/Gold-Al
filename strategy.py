from indicators import add_indicators


def _score(df):
    x = add_indicators(df).dropna()
    if len(x) < 3:
        raise RuntimeError("کندل کافی برای تحلیل وجود ندارد.")

    # فقط کندل بسته‌شده مبنای تحلیل است.
    row = x.iloc[-2] if len(x) > 2 else x.iloc[-1]

    bullish = [
        (row["close"] > row["ema20"], "قیمت بالای EMA20"),
        (row["ema20"] > row["ema50"], "EMA20 بالای EMA50"),
        (row["macd"] > row["macd_signal"], "MACD صعودی"),
        (row["rsi"] >= 55, "RSI بالاتر از 55"),
        (row["plus_di"] > row["minus_di"] and row["adx"] >= 18, "قدرت روند صعودی"),
    ]
    bearish = [
        (row["close"] < row["ema20"], "قیمت پایین EMA20"),
        (row["ema20"] < row["ema50"], "EMA20 پایین EMA50"),
        (row["macd"] < row["macd_signal"], "MACD نزولی"),
        (row["rsi"] <= 45, "RSI پایین‌تر از 45"),
        (row["minus_di"] > row["plus_di"] and row["adx"] >= 18, "قدرت روند نزولی"),
    ]

    buy_score = sum(bool(condition) for condition, _ in bullish)
    sell_score = sum(bool(condition) for condition, _ in bearish)
    buy_reasons = [label for condition, label in bullish if bool(condition)]
    sell_reasons = [label for condition, label in bearish if bool(condition)]

    if buy_score >= 4 and sell_score <= 1:
        label = "تمایل به خرید"
        score = buy_score
        reasons = buy_reasons
    elif sell_score >= 4 and buy_score <= 1:
        label = "تمایل به فروش"
        score = sell_score
        reasons = sell_reasons
    else:
        label = "خنثی / انتظار"
        score = max(buy_score, sell_score)
        reasons = []

    return {
        "score": score,
        "buy_score": buy_score,
        "sell_score": sell_score,
        "label": label,
        "close": float(row["close"]),
        "reasons": reasons,
    }


def analyze(fetch):
    frames = {tf: _score(fetch(tf)) for tf in ("1m", "5m", "15m")}
    buy_total = sum(v["buy_score"] for v in frames.values())
    sell_total = sum(v["sell_score"] for v in frames.values())

    if buy_total >= 10 and sell_total <= 4:
        summary = "تمایل چندتایم‌فریمی صعودی؛ قیمت بروکر را پیش از معامله بررسی کن."
    elif sell_total >= 10 and buy_total <= 4:
        summary = "تمایل چندتایم‌فریمی نزولی؛ قیمت بروکر را پیش از معامله بررسی کن."
    else:
        summary = "بازار ترکیبی یا بدون تأیید کافی است؛ فعلاً صبر بهتر است."

    return {
        "timeframes": frames,
        "total": max(buy_total, sell_total),
        "buy_total": buy_total,
        "sell_total": sell_total,
        "summary": summary,
    }
