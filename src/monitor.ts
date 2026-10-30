import path from "node:path";
import { scanBayClub } from "./bayclub.js";
import { executeActions, withBrowser } from "./browser.js";
import { extractSlots } from "./extract.js";
import { matchesWatch } from "./match.js";
import { sendNotification } from "./notify.js";
import { loadState, markNotified, pruneState, reconcileSlots, saveState } from "./store.js";
import type { AppConfig, Slot } from "./types.js";

export async function runMonitorOnce(config: AppConfig, projectDir: string, dryRun: boolean): Promise<void> {
  const statePath = path.join(projectDir, "data", "state.json");
  const state = await loadState(statePath);
  const now = new Date();
  const notifications: Slot[] = [];

  await withBrowser(config, false, async (_context, page) => {
    if (config.bayClub) {
      for (const result of await scanBayClub(page, config)) {
        console.log(`[${new Date().toISOString()}] Checked ${config.bayClub.clubName} ${result.name}: ${result.slots.length} matching hour(s).`);
        const reconciled = reconcileSlots(state, result.id, result.slots, now, config.notificationCooldownMinutes);
        notifications.push(...reconciled.notify);
        state.lastRuns[result.id] = { at: now.toISOString(), status: "ok", detail: `${result.slots.length} matching hours` };
      }
    }
    for (const watch of config.watches.filter((candidate) => candidate.enabled)) {
      try {
        console.log(`[${new Date().toISOString()}] Checking ${watch.name}`);
        await page.goto(watch.url, { waitUntil: "domcontentloaded" });
        if (/\/account\/login\b/i.test(page.url())) {
          throw new Error("Bay Club session expired. Run npm run setup:login again.");
        }
        await executeActions(page, watch.actions, config.safety);
        const extracted = await extractSlots(page.locator("body"), watch);
        const matching = extracted.filter((slot) => matchesWatch(slot, watch));
        console.log(`  Found ${extracted.length} available-looking slots; ${matching.length} matched preferences.`);
        const result = reconcileSlots(state, watch.id, matching, now, config.notificationCooldownMinutes);
        notifications.push(...result.notify);
        state.lastRuns[watch.id] = { at: now.toISOString(), status: "ok", detail: `${matching.length} matching slots` };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        state.lastRuns[watch.id] = { at: now.toISOString(), status: "error", detail };
        console.error(`  ${detail}`);
      }
    }
  });

  if (notifications.length) {
    await sendNotification(notifications, dryRun);
    if (!dryRun) markNotified(state, notifications, now);
  } else {
    console.log("No new matching availability to notify.");
  }
  pruneState(state, now);
  await saveState(statePath, state);
}
