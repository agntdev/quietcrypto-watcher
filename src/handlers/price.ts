import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { coinForTicker, fetchQuotes, formatQuote, tickerSuggestion } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { userData } from "../user-data.js";

registerMainMenuItem({ label: "Price", data: "price:show", order: 40 });
const composer = new Composer<Ctx>();

async function showPrice(ctx: Ctx, requested?: string, edit = false): Promise<void> {
  const data = userData(ctx);
  const coin = requested ? coinForTicker(requested) : undefined;
  const coins = coin ? [coin] : data.watchlist.map((item) => coinForTicker(item.ticker)!);
  if (requested && !coin) {
    const suggestion = tickerSuggestion(requested);
    const text = suggestion ? `I couldn't find ${requested.toUpperCase()}. Did you mean ${suggestion}?` : "I couldn't find that ticker. Try BTC, ETH, or TON.";
    if (edit) await ctx.editMessageText(text); else await ctx.reply(text);
    return;
  }
  if (coins.length === 0) {
    const extra = { reply_markup: inlineKeyboard([[inlineButton("Add coin", "watchlist:add")], [inlineButton("Back to menu", "menu:main")]]) };
    if (edit) await ctx.editMessageText("No coins yet — tap Add coin before checking prices.", extra); else await ctx.reply("No coins yet — tap Add coin before checking prices.", extra);
    return;
  }
  try {
    const quotes = await fetchQuotes(coins);
    const text = coins.map((item) => formatQuote(item.ticker, quotes[item.ticker])).join("\n");
    if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Refresh", `price:one:${requested ?? "watchlist"}`)], [inlineButton("Back to menu", "menu:main")]]) });
    else await ctx.reply(text);
  } catch {
    const text = "Live prices are unavailable right now. Try again shortly.";
    if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton("Try again", `price:one:${requested ?? "watchlist"}`)], [inlineButton("Back to menu", "menu:main")]]) });
    else await ctx.reply(text);
  }
}

composer.command("price", async (ctx) => {
  const requested = ctx.match?.trim();
  await showPrice(ctx, requested || undefined);
});

composer.callbackQuery("price:show", async (ctx) => { await ctx.answerCallbackQuery(); await showPrice(ctx, undefined, true); });
composer.callbackQuery(/^price:one:(BTC|ETH|TON|watchlist)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPrice(ctx, ctx.match[1] === "watchlist" ? undefined : ctx.match[1], true);
});

export default composer;
