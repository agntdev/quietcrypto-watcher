import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { coinForTicker, fetchQuotes, formatQuote, seedCoins, tickerSuggestion } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { resetFlow, userData } from "../user-data.js";

registerMainMenuItem({ label: "Add coin", data: "watchlist:add", order: 20 });

const composer = new Composer<Ctx>();

const picker = inlineKeyboard([
  seedCoins().map((coin) => inlineButton(coin.ticker, `watchlist:pick:${coin.ticker}`)),
  [inlineButton("Back to menu", "menu:main")],
]);

function addCoin(data: ReturnType<typeof userData>, ticker: string): string | undefined {
  const coin = coinForTicker(ticker);
  if (!coin) return undefined;
  if (!data.watchlist.some((item) => item.ticker === coin.ticker)) {
    data.watchlist.push({ ticker: coin.ticker, displayName: coin.name, alerts: [] });
  }
  resetFlow(data);
  return coin.ticker;
}

async function confirmAdded(ctx: Ctx, ticker: string, edit = false): Promise<void> {
  const coin = coinForTicker(ticker)!;
  let text = `${coin.name} (${coin.ticker}) is now on your watchlist.`;
  try {
    const quote = (await fetchQuotes([coin]))[coin.ticker];
    text += `\n${formatQuote(coin.ticker, quote)}`;
  } catch {
    text += "\nLive pricing is unavailable right now. Try Price again shortly.";
  }
  const extra = { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:show")], [inlineButton("Add another", "watchlist:add")]]) };
  if (edit) await ctx.editMessageText(text, extra);
  else await ctx.reply(text, extra);
}

composer.callbackQuery("watchlist:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  data.step = "awaiting_ticker";
  await ctx.editMessageText("Choose a coin, or send its ticker.", { reply_markup: picker });
});

composer.callbackQuery(/^watchlist:pick:(BTC|ETH|TON)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = addCoin(userData(ctx), ctx.match[1]);
  if (!ticker) return;
  await confirmAdded(ctx, ticker, true);
});

composer.on("message:text", async (ctx, next) => {
  const data = userData(ctx);
  if (data.step !== "awaiting_ticker") return next();
  const input = ctx.message.text.trim();
  const ticker = addCoin(data, input);
  if (!ticker) {
    const suggestion = tickerSuggestion(input);
    await ctx.reply(suggestion ? `I couldn't find ${input.toUpperCase()}. Did you mean ${suggestion}?` : "I couldn't find that ticker. Try BTC, ETH, or TON.");
    return;
  }
  await confirmAdded(ctx, ticker);
});

export default composer;
