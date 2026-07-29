# Crypto Watchlist Alerts — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot for tracking cryptocurrency prices with customizable one-time threshold alerts and ongoing percentage-move alerts. Users manage watchlists via buttons or text commands, receive on-demand price checks, and optional daily summaries. The owner gets aggregate usage stats and top alert reports.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto investors
- price-sensitive traders

## Success criteria

- users can add/remove coins to watchlists
- alerts trigger reliably per user settings
- owner receives daily usage reports with top alerts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with watchlist management options
- **/price** (command, actor: user, command: /price) — Check current prices for watchlist or specific ticker
  - inputs: ticker symbol
  - outputs: price data with 24h change
- **Add Coin** (button, actor: user, callback: watchlist:add) — Add new coin to watchlist with validation
- **Manage Alerts** (button, actor: user, callback: alerts:manage) — Configure threshold/percent alerts

## Flows

### Add Coin
_Trigger:_ watchlist:add

1. show seed coin buttons
2. validate user-entered ticker
3. confirm addition with price data

_Data touched:_ User profile, Watchlist item

### Create Alert
_Trigger:_ alerts:create

1. select alert type
2. set threshold/percent parameters
3. confirm alert activation

_Data touched:_ Watchlist item, Alert event log

### Morning Summary
_Trigger:_ cron:daily

1. check user's quiet hours/cooldowns
2. compile price data
3. send formatted summary

_Data touched:_ User profile, Watchlist item

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: chat_id, timezone, quiet_hours, summary_time, cooldown_rules
- **Watchlist item** _(retention: persistent)_ — Tracked cryptocurrency with alert rules
  - fields: ticker, display_name, last_notified_price, alert_types, threshold_values
- **Alert event log** _(retention: persistent)_ — Record of triggered alerts
  - fields: timestamp, user_id, ticker, price_change, alert_type

## Integrations

- **Telegram** (required) — Bot API messaging and user interactions
- **Crypto Price API** (required) — Fetch current price data
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- daily usage report with top alerts
- aggregate user statistics
- error logs for price API failures

## Notifications

- price threshold alerts
- percentage move alerts
- daily summary reports
- error notifications for API failures

## Permissions & privacy

- All user data is private and isolated
- Owner only sees aggregate statistics
- No third-party data sharing

## Edge cases

- invalid ticker symbols with typo suggestions
- quiet hours overlapping alert windows
- price API rate limiting/retries

## Required tests

- Add coin flow with invalid ticker handling
- Alert triggering during/after quiet hours
- Daily summary formatting with multiple coins

## Assumptions

- Default 1-hour window for percent alerts
- Cooldown reset on price threshold crossing
- Seed coins include BTC/ETH/TON
