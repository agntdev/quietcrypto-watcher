import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { coinForTicker, fetchQuotes, formatQuote } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { userData } from "../user-data.js";

registerMainMenuItem({ label: "Watchlist", data: "watchlist:show", order: 10 });
const composer = new Composer<Ctx>();

function controls(data: ReturnType<typeof userData>) {
  return inlineKeyboard([
    ...data.watchlist.map((item) => [inlineButton(`Remove ${item.ticker}`, `watchlist:remove:${item.ticker}`)]),
    [inlineButton("Add coin", "watchlist:add")],
    [inlineButton("Back to menu", "menu:main")],
  ]);
}

async function view(ctx: Ctx, edit: boolean): Promise<void> {
  const data = userData(ctx);
  if (data.watchlist.length === 0) {
    const extra = { reply_markup: inlineKeyboard([[inlineButton("Add coin", "watchlist:add")], [inlineButton("Back to menu", "menu:main")]]) };
    if (edit) await ctx.editMessageText("No coins yet — tap Add coin to start your watchlist.", extra);
    else await ctx.reply("No coins yet — tap Add coin to start your watchlist.", extra);
    return;
  }
  const coins = data.watchlist.map((item) => coinForTicker(item.ticker)!);
  let text: string;
  try {
    const quotes = await fetchQuotes(coins);
    text = `Your watchlist\n\n${coins.map((coin) => formatQuote(coin.ticker, quotes[coin.ticker])).join("\n")}`;
  } catch {
    text = `Your watchlist\n\n${data.watchlist.map((item) => item.ticker).join(" · ")}\n\nLive pricing is unavailable right now. Try again shortly.`;
  }
  if (edit) await ctx.editMessageText(text, { reply_markup: controls(data) });
  else await ctx.reply(text, { reply_markup: controls(data) });
}

composer.callbackQuery("watchlist:show", async (ctx) => { await ctx.answerCallbackQuery(); await view(ctx, true); });
composer.callbackQuery(/^watchlist:remove:(BTC|ETH|TON)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  data.watchlist = data.watchlist.filter((item) => item.ticker !== ctx.match[1]);
  await ctx.editMessageText(`${ctx.match[1]} was removed from your watchlist.`, { reply_markup: inlineKeyboard([[inlineButton("View watchlist", "watchlist:show")], [inlineButton("Add coin", "watchlist:add")]]) });
});
export default composer;
