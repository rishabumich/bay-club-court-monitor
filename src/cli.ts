#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { acquireRunLock } from "./browser.js";
import { loadConfig } from "./config.js";
import { exportCloudSession, inspectWatch, setupLogin } from "./inspect.js";
import { runMonitorOnce } from "./monitor.js";
import { setupTelegram, testTelegram } from "./telegram-setup.js";

const projectDir = path.resolve(import.meta.dirname, "..");

function option(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "setup-telegram") {
    await setupTelegram(projectDir);
    return;
  }
  if (command === "test-telegram") {
    await testTelegram();
    return;
  }

  const configPath = path.resolve(option("config", path.join(projectDir, "config.json"))!);
  const config = await loadConfig(configPath);

  switch (command) {
    case "setup-login":
      await setupLogin(config);
      return;
    case "export-cloud-session":
      await exportCloudSession(config);
      return;
    case "inspect": {
      const watchId = option("watch");
      const watch = config.watches.find((candidate) => candidate.id === watchId) ?? config.watches[0];
      if (!watch) throw new Error("No watch configured.");
      await inspectWatch(config, projectDir, watch);
      return;
    }
    case "monitor-once": {
      const release = await acquireRunLock(projectDir);
      try {
        await runMonitorOnce(config, projectDir, hasFlag("dry-run"));
      } finally {
        await release();
      }
      return;
    }
    case "monitor": {
      const release = await acquireRunLock(projectDir);
      const shutdown = async () => {
        await release();
        process.exit(0);
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      try {
        while (true) {
          try {
            await runMonitorOnce(config, projectDir, hasFlag("dry-run"));
          } catch (error) {
            console.error(error);
          }
          await new Promise((resolve) => setTimeout(resolve, config.pollIntervalSeconds * 1000));
        }
      } finally {
        await release();
      }
    }
    default:
      throw new Error("Usage: npm run setup:login | cloud:export-session | monitor:once -- --dry-run | monitor");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
