import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { executeActions, withBrowser } from "./browser.js";
import type { AppConfig, WatchConfig } from "./types.js";

async function saveInspection(page: Page, projectDir: string, name: string): Promise<string> {
  const artifactDir = path.join(projectDir, "artifacts", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await fs.mkdir(artifactDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(artifactDir, "page.html"), await page.content()),
    fs.writeFile(path.join(artifactDir, "page.txt"), await page.locator("body").innerText()),
    page.screenshot({ path: path.join(artifactDir, "page.png"), fullPage: true })
  ]);
  const candidates = await page.locator("button, a, [role=button], input, select, [data-testid]").evaluateAll((elements) =>
    elements.slice(0, 500).map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
      role: element.getAttribute("role"),
      ariaLabel: element.getAttribute("aria-label"),
      testId: element.getAttribute("data-testid"),
      name: element.getAttribute("name"),
      id: element.id || null,
      class: element.getAttribute("class")
    }))
  );
  await fs.writeFile(path.join(artifactDir, "candidates.json"), `${JSON.stringify(candidates, null, 2)}\n`);
  return artifactDir;
}

export async function inspectWatch(config: AppConfig, projectDir: string, watch: WatchConfig): Promise<void> {
  await withBrowser(config, true, async (_context, page) => {
    await page.goto(watch.url, { waitUntil: "domcontentloaded" });
    await executeActions(page, watch.actions, config.safety);
    const artifactDir = await saveInspection(page, projectDir, watch.id);
    console.log(`Inspection saved to ${artifactDir}`);
    console.log("The browser will remain open for 30 seconds so you can verify the filtered availability screen.");
    await page.waitForTimeout(30_000);
  });
}

export async function setupLogin(config: AppConfig): Promise<void> {
  await withBrowser(config, true, async (context, page) => {
    await page.goto(config.browser.loginUrl, { waitUntil: "domcontentloaded" });
    console.log("Log in to Bay Club Connect in the opened browser. Credentials are stored only by the local browser profile.");
    console.log("Waiting up to 10 minutes for Bay Club to confirm the login...");
    await page.waitForURL(
      (url) => url.hostname === "bayclubconnect.com" && !/\/account\/login\b/i.test(url.pathname),
      { timeout: 10 * 60_000 }
    );
    await context.storageState({ path: path.join(config.browser.profileDir, "storage-state.json") });
    await fs.writeFile(path.join(config.browser.profileDir, ".connected"), `${new Date().toISOString()}\n`, { mode: 0o600 });
    console.log(`Login detected at ${page.url()}. Session saved.`);
  });
}

export async function exportCloudSession(config: AppConfig): Promise<string> {
  return withBrowser(config, false, async (context, page) => {
    if (!config.bayClub) throw new Error("The Bay Club preset is not configured.");
    await page.goto(config.bayClub.bookingUrl, { waitUntil: "domcontentloaded" });
    const currentUrl = new URL(page.url());
    if (currentUrl.hostname !== "bayclubconnect.com" || /\/account\/login\b/i.test(currentUrl.pathname)) {
      throw new Error("The saved Bay Club login has expired. Run npm run setup:login first.");
    }
    const storageStatePath = path.join(config.browser.profileDir, "storage-state.json");
    await context.storageState({ path: storageStatePath });
    const encodedPath = path.join(config.browser.profileDir, "storage-state.base64.txt");
    const encoded = Buffer.from(await fs.readFile(storageStatePath)).toString("base64");
    await fs.writeFile(encodedPath, `${encoded}\n`, { mode: 0o600 });
    console.log(`Cloud session exported to ${encodedPath}`);
    console.log("Keep this file private. It can access your Bay Club account until the session expires.");
    return encodedPath;
  });
}
