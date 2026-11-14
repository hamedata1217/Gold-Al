import os
import logging
from io import BytesIO
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle
from datetime import datetime, timezone

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from market_data import get_candles, get_gold_price
from strategy import analyze

load_dotenv()
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ALLOWED = {
    x.strip() for x in os.getenv("ALLOWED_USER_IDS", "").split(",") if x.strip()
}

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("gold-ai")


def allowed(update: Update) -> bool:
    if not ALLOWED:
        return True
    user = update.effective_user
    return bool(user and str(user.id) in ALLOWED)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not allowed(update):
        await update.message.reply_text("دسترسی شما مجاز نیست.")
        return
    await update.message.reply_text(
        "سلام! 🥇 به Gold AI خوش آمدی.\n\n"
        "/price — قیمت لحظه‌ایِ منبع عمومی\n"
        "/signal — تحلیل تکنیکال XAUUSD\n"
        "/chart — نمایش چارت ۱۵ دقیقه\n"
        "/chart 1m یا /chart 5m یا /chart 15m — انتخاب تایم‌فریم\n"
        "/help — راهنما\n\n"
        "توجه: داده‌ها از Yahoo Finance دریافت می‌شوند و الزاماً با قیمت بروکر Eplanet یکسان نیستند."
    )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not allowed(update):
        await update.message.reply_text("دسترسی شما مجاز نیست.")
        return
    await update.message.reply_text(
        "دستورها:\n"
        "/start شروع\n"
        "/price نمایش آخرین قیمت دریافتی\n"
        "/signal تحلیل تایم‌فریم‌های 1m، 5m و 15m\n"
        "/chart یا /chart 15m نمایش چارت\n"
        "/chart 1m یا /chart 5m انتخاب تایم‌فریم\n\n"
        "این ربات ابزار کمکی تحلیل است، نه توصیه مالی."
    )


async def price_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not allowed(update):
        await update.message.reply_text("دسترسی شما مجاز نیست.")
        return
    try:
        price, stamp = get_gold_price()
        await update.message.reply_text(
            f"🥇 XAUUSD\nقیمت آخرین داده: {price:.3f} USD\n"
            f"زمان داده: {stamp}\n"
            "منبع: Yahoo Finance (نماد XAUUSD=X)\n"
            "ممکن است با نرخ Eplanet اختلاف داشته باشد."
        )
    except Exception as exc:
        log.exception("price command failed")
        await update.message.reply_text(f"دریافت قیمت ناموفق بود:\n{exc}")



async def chart_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not allowed(update):
        await update.message.reply_text("دسترسی شما مجاز نیست.")
        return

    tf = context.args[0].lower() if context.args else "15m"
    if tf not in ("1m", "5m", "15m"):
        await update.message.reply_text("تایم‌فریم نامعتبر است. از /chart 1m یا /chart 5m یا /chart 15m استفاده کن.")
        return

    status = await update.message.reply_text(f"در حال آماده‌سازی چارت طلا ({tf})…")
    try:
        candles = get_candles(tf).tail(100).copy()
        if candles.empty:
            raise RuntimeError("کندلی برای رسم چارت دریافت نشد.")
        candles["ema20"] = candles["close"].ewm(span=20, adjust=False).mean()
        last_time = candles.index[-1]
        if last_time.tzinfo is None:
            last_time = last_time.tz_localize(timezone.utc)
        age_minutes = max(0, (datetime.now(timezone.utc) - last_time).total_seconds() / 60)

        fig, ax = plt.subplots(figsize=(11, 6), dpi=150)
        fig.patch.set_facecolor("#101820")
        ax.set_facecolor("#101820")
        xs = mdates.date2num(candles.index.to_pydatetime())
        width = {"1m": 1, "5m": 5, "15m": 15}[tf] / (24 * 60) * 0.68
        for x, (_, row) in zip(xs, candles.iterrows()):
            color = "#20c997" if row["close"] >= row["open"] else "#ff6b6b"
            ax.vlines(x, row["low"], row["high"], color=color, linewidth=1)
            low = min(row["open"], row["close"])
            height = max(abs(row["close"] - row["open"]), 0.001)
            ax.add_patch(Rectangle((x - width / 2, low), width, height,
                                   facecolor=color, edgecolor=color, linewidth=0.7))
        ax.plot(xs, candles["ema20"], color="#f5c542", linewidth=1.3, label="EMA 20")
        ax.set_title(f"XAUUSD | {tf} | Yahoo Finance", color="white", fontsize=15)
        ax.set_ylabel("Price (USD)", color="#d7dde5")
        ax.tick_params(colors="#d7dde5", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#52606d")
        ax.grid(True, color="#52606d", alpha=0.25, linewidth=0.6)
        ax.xaxis_date()
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M", tz=timezone.utc))
        legend = ax.legend(facecolor="#101820", edgecolor="#52606d")
        for label in legend.get_texts():
            label.set_color("white")
        fig.autofmt_xdate()
        fig.tight_layout()

        photo = BytesIO()
        fig.savefig(photo, format="png", facecolor=fig.get_facecolor(), bbox_inches="tight")
        plt.close(fig)
        photo.seek(0)

        freshness = f"آخرین کندل: {last_time.strftime('%Y-%m-%d %H:%M UTC')} | حدود {age_minutes:.0f} دقیقه قبل"
        warning = "⚠️ داده تازه نیست؛ بازار ممکن است بسته باشد.\n" if age_minutes > 20 else ""
        caption = (f"🥇 چارت XAUUSD — {tf}\n{warning}{freshness}\n"
                   "منبع: Yahoo Finance؛ ممکن است با قیمت Eplanet اختلاف داشته باشد.")
        await update.message.reply_photo(photo=photo, caption=caption)
        await status.delete()
    except Exception as exc:
        log.exception("chart command failed")
        await status.edit_text(f"ساخت چارت ناموفق بود:\n{exc}")


async def signal_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not allowed(update):
        await update.message.reply_text("دسترسی شما مجاز نیست.")
        return
    await update.message.reply_text("در حال دریافت کندل‌ها و محاسبه تحلیل…")
    try:
        result = analyze(get_candles)
        lines = ["🥇 تحلیل تکنیکال XAUUSD", "منبع داده: Yahoo Finance — نه قیمت مستقیم Eplanet", ""]
        for tf in ("1m", "5m", "15m"):
            item = result["timeframes"][tf]
            lines.append(
                f"⏱ {tf}: {item['label']} | امتیاز {item['score']}/5\n"
                f"قیمت بسته‌شدن: {item['close']:.3f}\n"
                f"دلایل: {', '.join(item['reasons']) if item['reasons'] else 'شرط قوی هم‌جهت دیده نشد'}"
            )
            lines.append("")
        lines.append(f"جمع‌بندی: {result['summary']}")
        lines.append("⚠️ سیگنال قطعی نیست؛ پیش از معامله قیمت و اسپرد بروکر را بررسی کن.")
        await update.message.reply_text("\n".join(lines))
    except Exception as exc:
        log.exception("signal command failed")
        await update.message.reply_text(
            "تحلیل انجام نشد.\n"
            f"جزئیات خطا: {exc}\n\n"
            "ممکن است منبع داده موقتاً در دسترس نباشد یا کندل کافی نداشته باشد."
        )


def main():
    if not TOKEN:
        raise RuntimeError("متغیر TELEGRAM_BOT_TOKEN در Environment تنظیم نشده است.")
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("price", price_cmd))
    app.add_handler(CommandHandler("chart", chart_cmd))
    app.add_handler(CommandHandler("signal", signal_cmd))
    log.info("Gold AI bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
