import type { Ctx } from "./bot.js";
import { now } from "./clock.js";
import { coinForTicker, fetchQuotes, formatQuote } from "./crypto.js";
import { addEvent, isQuiet, type AlertRule, userData } from "./user-data.js";

const HOUR = 60 * 60 * 1000;

function canNotify(rule: AlertRule): boolean {
  if (!rule.lastNotifiedAt) return true;
  return now().getTime() - new Date(rule.lastNotifiedAt).getTime() >= HOUR;
}

/** Evaluate the current user's indexed alerts. Called by the check button and cron adapter. */
export async function checkAlerts(ctx: Ctx): Promise<string[]> {
  const data = userData(ctx);
  const watched = data.watchlist.filter((item) => item.alerts.some((alert) => alert.active));
  if (watched.length === 0 || isQuiet(data)) return [];
  const quotes = await fetchQuotes(watched.map((item) => coinForTicker(item.ticker)!));
  const notifications: string[] = [];
  for (const item of watched) {
    const quote = quotes[item.ticker];
    for (const rule of item.alerts) {
      let triggered = false;
      if (rule.kind === "percent_move") {
        if (rule.baselinePrice === undefined || rule.baselineAt === undefined || now().getTime() - new Date(rule.baselineAt).getTime() >= HOUR) {
          rule.baselinePrice = quote.price;
          rule.baselineAt = now().toISOString();
          continue;
        }
        const move = ((quote.price - rule.baselinePrice) / rule.baselinePrice) * 100;
        triggered = Math.abs(move) >= rule.value;
        if (triggered) rule.baselinePrice = quote.price;
      } else {
        const side = rule.kind === "threshold_above" ? quote.price >= rule.value : quote.price <= rule.value;
        if (!side) { rule.lastSide = undefined; continue; }
        triggered = rule.lastSide !== (rule.kind === "threshold_above" ? "above" : "below");
        rule.lastSide = rule.kind === "threshold_above" ? "above" : "below";
      }
      if (!triggered || !canNotify(rule)) continue;
      rule.lastNotifiedAt = now().toISOString();
      item.lastNotifiedPrice = quote.price;
      addEvent(data, item.ticker, quote.change24h, rule.kind);
      const description = rule.kind === "percent_move" ? `${rule.value}% 1-hour move` : `${rule.kind === "threshold_above" ? "above" : "below"} ${rule.value} USD`;
      notifications.push(`${item.ticker} reached your ${description} alert.\n${formatQuote(item.ticker, quote)}`);
    }
  }
  return notifications;
}
