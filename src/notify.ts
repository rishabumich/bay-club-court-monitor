import type { Slot } from "./types.js";
import { describeSlot } from "./match.js";

interface TwilioEnv {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
}

interface TelegramEnv {
  botToken: string;
  chatId: string;
}

function loadTwilioEnv(): TwilioEnv {
  const values = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
    to: process.env.ALERT_TO_NUMBER
  };
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing Twilio settings: ${missing.join(", ")}`);
  return values as TwilioEnv;
}

export function buildMessage(slots: Slot[], maxSlots = 12): string {
  const first = slots[0];
  if (!first) throw new Error("Cannot build a notification with no slots.");
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = `${slot.watchName}|${slot.date ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const lines: string[] = [];
  let shown = 0;
  for (const group of groups.values()) {
    if (shown >= maxSlots) break;
    const representative = group[0]!;
    const date = representative.date ? formatDate(representative.date) : "Available";
    const times = group.slice(0, Math.max(1, maxSlots - shown)).map((slot) => slot.time ?? describeSlot(slot));
    lines.push(`• ${representative.watchName} — ${date}: ${times.join(", ")}`);
    shown += times.length;
  }
  const remaining = slots.length - shown;
  return [
    `Bay Club ${first.location ?? "court"} — 60-minute openings:`,
    ...lines,
    ...(remaining > 0 ? [`+ ${remaining} more`] : []),
    `Book manually: ${first.bookingUrl}`
  ].join("\n");
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function loadTelegramEnv(): TelegramEnv {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw new Error("Missing Telegram settings. Run npm run setup:telegram.");
  }
  return { botToken, chatId };
}

export async function sendTelegramMessage(body: string): Promise<void> {
  const env = loadTelegramEnv();
  const response = await fetch(`https://api.telegram.org/bot${env.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.chatId,
      text: body,
      disable_web_page_preview: false
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Telegram rejected the message (${response.status}): ${detail}`);
  }
}

async function sendTwilioSms(body: string): Promise<void> {
  const env = loadTwilioEnv();
  const form = new URLSearchParams({ To: env.to, From: env.from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Twilio rejected the message (${response.status}): ${detail}`);
  }
}

export async function sendNotification(slots: Slot[], dryRun: boolean, maxSlots = 12): Promise<void> {
  const body = buildMessage(slots, maxSlots);
  if (dryRun) {
    console.log("\n[DRY RUN NOTIFICATION]\n" + body + "\n");
    return;
  }
  const channel = (process.env.NOTIFICATION_CHANNEL ?? "telegram").toLowerCase();
  if (channel === "telegram") return sendTelegramMessage(body);
  if (channel === "twilio") return sendTwilioSms(body);
  throw new Error(`Unsupported NOTIFICATION_CHANNEL ${JSON.stringify(channel)}. Use telegram or twilio.`);
}
