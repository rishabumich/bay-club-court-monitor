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

- `.github/workflows/monitor.yml` checks every five minutes and also supports **Run workflow** from GitHub's Actions page.
- It restores and saves `data/state.json` through the Actions cache so continuously available hours do not repeatedly alert.
- Bay Club session data exists only in an encrypted secret and an ephemeral job environment. It is never cached or committed.
- The workflow uses `config.example.json`, which contains only non-secret Santa Clara search preferences.

## When the Bay Club session expires

Run these locally:

```bash
npm run setup:login
npm run cloud:export-session
```

Then replace the `BAYCLUB_STORAGE_STATE_B64` repository secret with the newly exported value.

## Free-tier caveats

GitHub may delay scheduled workflows during heavy load. Public-repository schedules are disabled after 60 days with no repository activity, so visit the Actions page and re-enable the workflow if GitHub emails about inactivity.
