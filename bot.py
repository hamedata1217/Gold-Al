import os
import logging
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
        "/signal تحلیل تایم‌فریم‌های 1m، 5m و 15m\n\n"
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
    app.add_handler(CommandHandler("signal", signal_cmd))
    log.info("Gold AI bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
