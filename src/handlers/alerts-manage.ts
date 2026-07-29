import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { resetFlow, type AlertKind, userData } from "../user-data.js";
import { checkAlerts } from "../alerts.js";

registerMainMenuItem({ label: "Alerts", data: "alerts:manage", order: 30 });
const composer = new Composer<Ctx>();

const back = [inlineButton("Back to menu", "menu:main")];

function coinButtons(data: ReturnType<typeof userData>, prefix: string) {
  return inlineKeyboard([
    ...data.watchlist.map((item) => [inlineButton(item.ticker, `${prefix}:${item.ticker}`)]),
    back,
  ]);
}

composer.callbackQuery("alerts:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  if (data.watchlist.length === 0) {
    await ctx.editMessageText("Add a coin before creating an alert.", { reply_markup: inlineKeyboard([[inlineButton("Add coin", "watchlist:add")], back]) });
    return;
  }
  const active = data.watchlist.reduce((sum, item) => sum + item.alerts.filter((alert) => alert.active).length, 0);
  await ctx.editMessageText(active ? `You have ${active} active alert${active === 1 ? "" : "s"}. Choose an action.` : "No alerts yet — create one for a coin you track.", {
    reply_markup: inlineKeyboard([[inlineButton("Create alert", "alerts:create")], [inlineButton("Check alerts", "alerts:check")], [inlineButton("Clear alerts", "alerts:clear")], back]),
  });
});

composer.callbackQuery("alerts:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  await ctx.editMessageText("Choose the coin for this alert.", { reply_markup: coinButtons(data, "alerts:coin") });
});
composer.callbackQuery(/^alerts:coin:(BTC|ETH|TON)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  if (!data.watchlist.some((item) => item.ticker === ctx.match[1])) { await ctx.editMessageText("That coin is no longer on your watchlist."); return; }
  data.selectedTicker = ctx.match[1] as "BTC" | "ETH" | "TON";
  await ctx.editMessageText(`Choose the alert for ${ctx.match[1]}.`, { reply_markup: inlineKeyboard([
    [inlineButton("Price rises above", "alerts:type:threshold_above")],
    [inlineButton("Price falls below", "alerts:type:threshold_below")],
    [inlineButton("1-hour move", "alerts:type:percent_move")], back,
  ]) });
});
composer.callbackQuery(/^alerts:type:(threshold_above|threshold_below|percent_move)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  if (!data.selectedTicker) { await ctx.editMessageText("Choose a coin first."); return; }
  const kind = ctx.match[1] as AlertKind;
  data.step = kind === "percent_move" ? "awaiting_percent" : "awaiting_threshold";
  await ctx.editMessageText(kind === "percent_move" ? "Send the percentage move for the next hour, such as 5." : "Send the USD price for this alert, such as 65000.", { reply_markup: inlineKeyboard([back]) });
  // Retain selected kind only for this ephemeral conversational step.
  (ctx.session as { alertKind?: AlertKind }).alertKind = kind;
});
composer.on("message:text", async (ctx, next) => {
  const data = userData(ctx);
  if (data.step !== "awaiting_threshold" && data.step !== "awaiting_percent") return next();
  const amount = Number(ctx.message.text.trim().replace(/[$,%\s,]/g, ""));
  const kind = (ctx.session as { alertKind?: AlertKind }).alertKind;
  if (!kind || !data.selectedTicker || !Number.isFinite(amount) || amount <= 0) { await ctx.reply("Send a positive number to set this alert."); return; }
  const item = data.watchlist.find((entry) => entry.ticker === data.selectedTicker);
  if (!item) { resetFlow(data); await ctx.reply("That coin is no longer on your watchlist."); return; }
  item.alerts.push({ kind, value: amount, active: true });
  const label = kind === "percent_move" ? `${amount}% move in 1 hour` : `${kind === "threshold_above" ? "above" : "below"} $${amount}`;
  const ticker = data.selectedTicker;
  resetFlow(data);
  delete (ctx.session as { alertKind?: AlertKind }).alertKind;
  await ctx.reply(`${ticker} alert is active: ${label}.`, { reply_markup: inlineKeyboard([[inlineButton("Manage alerts", "alerts:manage")], back]) });
});
composer.callbackQuery("alerts:clear", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = userData(ctx);
  for (const item of data.watchlist) item.alerts = [];
  await ctx.editMessageText("Your alerts were cleared.", { reply_markup: inlineKeyboard([[inlineButton("Create alert", "alerts:create")], back]) });
});
composer.callbackQuery("alerts:check", async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const notifications = await checkAlerts(ctx);
    await ctx.editMessageText(notifications.length ? notifications.join("\n\n") : "No alerts have triggered right now.", { reply_markup: inlineKeyboard([[inlineButton("Manage alerts", "alerts:manage")], back]) });
  } catch {
    await ctx.editMessageText("Couldn't check alerts right now. Try again shortly.", { reply_markup: inlineKeyboard([[inlineButton("Try again", "alerts:check")], back]) });
  }
});

export default composer;
