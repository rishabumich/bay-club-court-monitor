# Free GitHub Actions deployment

This deployment runs the read-only monitor without requiring the Mac to remain awake. The repository code may be public, but all account data stays in encrypted GitHub Actions secrets.

## Secrets required

Create these repository Actions secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `BAYCLUB_STORAGE_STATE_B64`

The first two values are already in the local `.env`. Generate the third locally with:

```bash
npm run cloud:export-session
```

It writes the value to `data/browser-profile/storage-state.base64.txt`. That entire `data` directory is Git-ignored. Treat the file like a password: anyone with it may be able to access the Bay Club account until the web session expires.

## Workflow behavior

- `.github/workflows/monitor.yml` starts a scheduled job every 10 minutes from 7:00 AM through 10:50 PM Pacific. Each job waits a random 0-5 minutes immediately before scanning, so consecutive Bay Club checks are intended to land 5-15 minutes apart and always before 11:00 PM. Manual **Run workflow** checks start immediately.
- `.github/workflows/keepalive.yml` makes one timestamp-only bot commit each month so GitHub's 60-day public-repository inactivity rule does not disable scheduled checks.
- It restores and saves `data/state.json` through the Actions cache so continuously available hours do not repeatedly alert.
- Bay Club session data exists only in an encrypted secret and an ephemeral job environment. It is never cached or committed.
- The workflow uses `config.example.json`, which contains only non-secret Santa Clara search preferences.
- A separate 7:05 AM Pacific scheduled scan sends one Telegram health heartbeat after the scan succeeds.
- If any workflow step fails, a final fallback step attempts to send a Telegram warning with a link to the failed run. If Telegram itself is unavailable or its credentials are invalid, rely on GitHub Actions failure notifications instead.

## When the Bay Club session expires

Run these locally:

```bash
npm run setup:login
npm run cloud:export-session
```

Then replace the `BAYCLUB_STORAGE_STATE_B64` repository secret with the newly exported value.

## Free-tier caveats

GitHub may delay scheduled workflows during heavy load. The monthly keepalive commit is included to prevent the normal 60-day inactivity shutdown; if GitHub ever disables Actions for another reason, it still requires manual re-enabling from the Actions page.
