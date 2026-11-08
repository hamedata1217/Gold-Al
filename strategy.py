from indicators import add_indicators


def _score(df):
    x = add_indicators(df).dropna()
    if len(x) < 3:
        raise RuntimeError("کندل کافی برای تحلیل وجود ندارد.")
    # آخرین کندل بسته‌شده را مبنا می‌گیریم تا کندل در حال تشکیل وارد تحلیل نشود.
    row = x.iloc[-2] if len(x) > 2 else x.iloc[-1]
    score = 0
    reasons = []

    checks = [
        (row["close"] > row["ema20"], "قیمت بالای EMA20"),
        (row["ema20"] > row["ema50"], "EMA20 بالای EMA50"),
        (row["macd"] > row["macd_signal"], "MACD صعودی"),
        (row["rsi"] >= 55, "RSI بالاتر از 55"),
        (row["plus_di"] > row["minus_di"] and row["adx"] >= 18, "قدرت روند صعودی"),
    ]
    for condition, label in checks:
        if bool(condition):
            score += 1
            reasons.append(label)

    if score >= 4:
        label = "تمایل به خرید"
    elif score <= 1:
        label = "تمایل به فروش"
    else:
        label = "خنثی / انتظار"

    return {
        "score": score,
        "label": label,
        "close": float(row["close"]),
        "reasons": reasons,
    }


def analyze(fetch):
    frames = {tf: _score(fetch(tf)) for tf in ("1m", "5m", "15m")}
    total = sum(v["score"] for v in frames.values())
    if total >= 11:
        summary = "تمایل کلی صعودی؛ فقط پس از تأیید قیمت بروکر بررسی شود."
    elif total <= 4:
        summary = "تمایل کلی نزولی؛ فقط پس از تأیید قیمت بروکر بررسی شود."
    else:
        summary = "بازار ترکیبی است؛ بهتر است منتظر تأیید بمانی."
    return {"timeframes": frames, "total": total, "summary": summary}
