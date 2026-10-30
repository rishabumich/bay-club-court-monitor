#!/usr/bin/env node

const kind = process.argv[2];
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
}

const repository = process.env.GITHUB_REPOSITORY ?? "Bay Club court monitor";
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;

let message;
if (kind === "heartbeat") {
  message = [
    "✅ Bay Club monitor is healthy.",
    "Today's hosted scan completed successfully and monitoring is active.",
    ...(runUrl ? [`Run details: ${runUrl}`] : [])
  ].join("\n");
} else if (kind === "failure") {
  message = [
    "⚠️ Bay Club monitor failed.",
    "Availability may not be checked until the next successful run. The Bay Club session may need refreshing, or the website/workflow may have changed.",
    `Repository: ${repository}`,
    ...(runUrl ? [`Failed run: ${runUrl}`] : [])
  ].join("\n");
} else {
  throw new Error("Usage: node .github/scripts/telegram-status.mjs heartbeat|failure");
}

const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text: message,
    disable_web_page_preview: true
  })
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 1000);
  throw new Error(`Telegram rejected the status message (${response.status}): ${detail}`);
}

console.log(`Sent Telegram ${kind} message.`);
