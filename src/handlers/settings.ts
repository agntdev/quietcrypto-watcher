import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { userData } from "../user-data.js";

registerMainMenuItem({ label: "Settings", data: "settings:show", order: 50 });
const composer = new Composer<Ctx>();
const back = [inlineButton("Back to menu", "menu:main")];

function settingsKeyboard() {
  return inlineKeyboard([[inlineButton("Set quiet hours", "settings:quiet")], [inlineButton("Set summary time", "settings:summary")], [inlineButton("Preview summary", "summary:preview")], back]);
}
composer.callbackQuery("settings:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = userData(ctx).profile;
  const quiet = profile.quietHours ? `${profile.quietHours.start}:00–${profile.quietHours.end}:00 UTC` : "off";
  const summary = profile.summaryTime === undefined ? "off" : `${profile.summaryTime}:00 UTC`;
  await ctx.editMessageText(`Quiet hours: ${quiet}\nDaily summary: ${summary}`, { reply_markup: settingsKeyboard() });
});
composer.callbackQuery("settings:quiet", async (ctx) => {
  await ctx.answerCallbackQuery();
  userData(ctx).step = "awaiting_quiet_hours";
  await ctx.editMessageText("Send quiet hours as 22-7 for 10 PM to 7 AM UTC. Send off to disable them.", { reply_markup: inlineKeyboard([back]) });
});
composer.callbackQuery("settings:summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  userData(ctx).step = "awaiting_summary_time";
  await ctx.editMessageText("Send a UTC hour from 0 to 23 for your daily summary. Send off to disable it.", { reply_markup: inlineKeyboard([back]) });
});
composer.on("message:text", async (ctx, next) => {
  const data = userData(ctx);
  const text = ctx.message.text.trim().toLowerCase();
  if (data.step === "awaiting_quiet_hours") {
    if (text === "off") { data.profile.quietHours = undefined; data.step = "idle"; await ctx.reply("Quiet hours are off."); return; }
    const match = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(text);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 23) { await ctx.reply("Send two UTC hours, such as 22-7."); return; }
    data.profile.quietHours = { start: Number(match[1]), end: Number(match[2]) }; data.step = "idle";
    await ctx.reply(`Quiet hours are set for ${match[1]}:00–${match[2]}:00 UTC.`); return;
  }
  if (data.step === "awaiting_summary_time") {
    if (text === "off") { data.profile.summaryTime = undefined; data.step = "idle"; await ctx.reply("Daily summaries are off."); return; }
    const hour = Number(text);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) { await ctx.reply("Send a UTC hour from 0 to 23."); return; }
    data.profile.summaryTime = hour; data.step = "idle";
    await ctx.reply(`Your daily summary is set for ${hour}:00 UTC.`); return;
  }
  return next();
});
export default composer;
