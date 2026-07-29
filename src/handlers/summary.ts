import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { coinForTicker, fetchQuotes, formatQuote } from "../crypto.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { isQuiet, userData } from "../user-data.js";

const composer = new Composer<Ctx>();

/** Builds the same concise message used by the daily scheduler and preview button. */
export async function dailySummary(ctx: Ctx): Promise<string | undefined> {
  const data = userData(ctx);
  if (isQuiet(data) || data.watchlist.length === 0) return undefined;
  const coins = data.watchlist.map((item) => coinForTicker(item.ticker)!);
  try {
    const quotes = await fetchQuotes(coins);
    return `Daily summary\n\n${coins.map((coin) => formatQuote(coin.ticker, quotes[coin.ticker])).join("\n")}`;
  } catch {
    return "Daily summary\n\nLive prices are unavailable right now. Your watchlist is unchanged.";
  }
}

composer.callbackQuery("summary:preview", async (ctx) => {
  await ctx.answerCallbackQuery();
  const text = await dailySummary(ctx);
  await ctx.editMessageText(text ?? "No summary is due right now. Add coins or check your quiet hours.", { reply_markup: inlineKeyboard([[inlineButton("Settings", "settings:show")], [inlineButton("Back to menu", "menu:main")]]) });
});

// The deployment scheduler can deliver this internal callback for a consenting
// chat. It never messages a cold user; it replies only in an existing chat.
composer.callbackQuery("cron:daily", async (ctx) => {
  await ctx.answerCallbackQuery();
  const text = await dailySummary(ctx);
  if (text) await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Stop summaries", "settings:summary")]]) });
});
export default composer;
