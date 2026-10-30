# Bay Club Santa Clara tennis monitor

A read-only monitor that checks Bay Club Connect and sends a free Telegram alert when a matching 60-minute tennis opening appears. It never books, holds, changes, or cancels a reservation.

## Your saved preferences

- Club: Bay Club Santa Clara
- Days: Monday through Friday
- Singles: 60 minutes, starting at 5:00 PM or later
- Ball machine: 60 minutes, either 8:00–9:00 AM or starting at 5:00 PM or later
- Alert channel: Telegram
- Hosted check interval: randomized between 5 and 15 minutes, from 7:00 AM to 11:00 PM Pacific
- Search view: Bay Club's Hour View

The scanner ignores every hour that has Bay Club's blue lock icon or disabled styling. That prevents alerts for dates or times outside your membership's three-day booking window.

## The simple way to use it

Double-click `Start Monitor.command`. On the first run only, it opens a browser for you to sign in to Bay Club, saves that private session, and then starts checking every five minutes. Keep its Terminal window open.

Two optional shortcuts are also included:

- `Check Now.command` performs one immediate check.
- `Connect Bay Club.command` refreshes an expired Bay Club login.

Telegram is connected separately with `Setup Telegram.command`. Once configured, you do not repeat that step.

Bay Club login is normally a one-time setup, but the website can expire its session. If an alert check says the session expired, double-click `Connect Bay Club.command` again. You do not need to log in every five minutes.

## Important Mac limitation

When this runs locally, monitoring pauses when the Mac sleeps, shuts down, loses its network connection, or the monitor's Terminal window is closed. A free hosted deployment can avoid that; it needs the same authenticated Bay Club session and persistent private storage.

For the prepared free GitHub Actions deployment, see `CLOUD-DEPLOYMENT.md`. The randomized daytime monitor, monthly repository keepalive, and encrypted-session export command are included in this project.

## What an alert looks like

Alerts use a compact hour view:

```text
Bay Club Santa Clara — 60-minute openings:
• Singles — Fri, Oct 30: 5:00 PM–6:00 PM, 5:30 PM–6:30 PM
• Ball machine — Mon, Nov 2: 8:00 AM–9:00 AM
Book manually: https://bayclubconnect.com/...
```

The monitor deduplicates alerts. A continuously available hour triggers one alert; it can alert again after disappearing and later reappearing after the cooldown.

## Developer commands

Requires Node.js 20 or newer.

```bash
npm install
npx playwright install chromium
npm run setup:login
npm run monitor:once -- --dry-run
npm run monitor:once
npm run monitor
npm run typecheck
npm test
```

`--dry-run` prints the Telegram message without sending it. Private files are Git-ignored: `.env`, `config.json`, `data/`, and browser artifacts.

## Safety boundaries

- Only navigation, search filters, date tabs, and Hour View are used.
- The scanner never clicks an available hour, court, Next button after availability, or any booking/confirmation control.
- Booking, payment, confirmation, and cancellation-like controls are blocked by a safety rule.
- Locked and disabled hours are excluded before matching your time preferences.
- Telegram credentials and the authenticated Bay Club browser profile stay local and are ignored by Git.
