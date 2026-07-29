import type { Ctx } from "./bot.js";
import { now } from "./clock.js";

export type FlowStep = "idle" | "awaiting_ticker" | "awaiting_threshold" | "awaiting_percent" | "awaiting_quiet_hours" | "awaiting_summary_time";
export type AlertKind = "threshold_above" | "threshold_below" | "percent_move";

export interface AlertRule {
  kind: AlertKind;
  value: number;
  active: boolean;
  lastSide?: "above" | "below";
  lastNotifiedAt?: string;
  baselinePrice?: number;
  baselineAt?: string;
}

export interface WatchlistItem {
  ticker: "BTC" | "ETH" | "TON";
  displayName: string;
  lastNotifiedPrice?: number;
  alerts: AlertRule[];
}

export interface AlertEvent {
  timestamp: string;
  ticker: string;
  priceChange: number;
  alertType: AlertKind;
}

export interface UserData {
  profile: { chatId: number; timezone: string; quietHours?: { start: number; end: number }; summaryTime?: number; cooldownRules: { minutes: number } };
  watchlist: WatchlistItem[];
  alertEvents: AlertEvent[];
  step: FlowStep;
  selectedTicker?: "BTC" | "ETH" | "TON";
}

type SessionWithData = { cryptoWatch?: UserData };

/**
 * The toolkit's session adapter is Redis-backed when REDIS_URL is configured
 * and Durable-Object-backed in Workers. Keeping one indexed user document per
 * chat avoids scans and keeps all records private to that chat.
 */
export function userData(ctx: Ctx): UserData {
  const session = ctx.session as SessionWithData;
  if (!session.cryptoWatch) {
    session.cryptoWatch = {
      profile: { chatId: ctx.chat?.id ?? ctx.from?.id ?? 0, timezone: "UTC", cooldownRules: { minutes: 60 } },
      watchlist: [], alertEvents: [], step: "idle",
    };
  }
  return session.cryptoWatch;
}

export function resetFlow(data: UserData): void {
  data.step = "idle";
  data.selectedTicker = undefined;
}

export function isQuiet(data: UserData): boolean {
  const hours = data.profile.quietHours;
  if (!hours || hours.start === hours.end) return false;
  const hour = now().getUTCHours();
  return hours.start < hours.end ? hour >= hours.start && hour < hours.end : hour >= hours.start || hour < hours.end;
}

export function addEvent(data: UserData, ticker: string, priceChange: number, alertType: AlertKind): void {
  data.alertEvents.push({ timestamp: now().toISOString(), ticker, priceChange, alertType });
  // Bounded per-user event log; no unbounded growth or global scan.
  if (data.alertEvents.length > 200) data.alertEvents.splice(0, data.alertEvents.length - 200);
}
