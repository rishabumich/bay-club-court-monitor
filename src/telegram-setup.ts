import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { sendTelegramMessage } from "./notify.js";

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: { id: number; type: string; first_name?: string; username?: string };
  };
}

async function telegramRequest<T>(token: string, method: string): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`);
  const payload = (await response.json()) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new Error(payload.description ?? `Telegram ${method} failed with status ${response.status}`);
  }
  return payload.result;
}

async function upsertEnv(envPath: string, values: Record<string, string>): Promise<void> {
  let lines: string[] = [];
  try {
    lines = (await fs.readFile(envPath, "utf8")).split(/\r?\n/);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    const replacement = `${key}=${value}`;
    if (index >= 0) lines[index] = replacement;
    else lines.push(replacement);
  }
  await fs.writeFile(envPath, `${lines.filter(Boolean).join("\n")}\n`, { mode: 0o600 });
  await fs.chmod(envPath, 0o600);
}

export async function setupTelegram(projectDir: string): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    console.log("\nTelegram setup");
    console.log("1. In Telegram, open @BotFather.");
    console.log("2. Send /newbot and follow its prompts.");
    console.log("3. Copy the bot token BotFather gives you.\n");
    const token = (await rl.question("Paste the bot token: ")).trim();
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error("That does not look like a Telegram bot token.");

    const bot = await telegramRequest<{ username?: string }>(token, "getMe");
    if (!bot.username) throw new Error("Telegram validated the token but did not return a bot username.");
    console.log(`\nBot verified: @${bot.username}`);
    console.log(`Open https://t.me/${bot.username} and press Start, or send it any message.`);
    await rl.question("Press Enter here after you have messaged the bot: ");

    let chat: TelegramUpdate["message"] extends infer _T ? { id: number; type: string; first_name?: string; username?: string } | undefined : never;
    const deadline = Date.now() + 90_000;
    while (!chat && Date.now() < deadline) {
      const updates = await telegramRequest<TelegramUpdate[]>(token, "getUpdates?timeout=5");
      chat = updates
        .slice()
        .reverse()
        .map((update) => update.message?.chat)
        .find((candidate) => candidate?.type === "private");
      if (!chat) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!chat) throw new Error("No private message reached the bot. Send it /start and run setup again.");

    await upsertEnv(path.join(projectDir, ".env"), {
      NOTIFICATION_CHANNEL: "telegram",
      TELEGRAM_BOT_TOKEN: token,
      TELEGRAM_CHAT_ID: String(chat.id)
    });
    process.env.NOTIFICATION_CHANNEL = "telegram";
    process.env.TELEGRAM_BOT_TOKEN = token;
    process.env.TELEGRAM_CHAT_ID = String(chat.id);
    await sendTelegramMessage("🎾 Bay Club monitor connected. Telegram alerts are working.");
    console.log(`\nSetup complete. A test alert was sent to ${chat.first_name ?? chat.username ?? "your Telegram chat"}.`);
    console.log("Your token is stored only in the local .env file, which is excluded from Git.");
  } finally {
    rl.close();
  }
}

export async function testTelegram(): Promise<void> {
  await sendTelegramMessage("🎾 Bay Club monitor test: Telegram alerts are working.");
  console.log("Test Telegram alert sent.");
}
