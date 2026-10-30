import fs from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page
} from "playwright";
import { assertSafeAction } from "./safety.js";
import type { AppConfig, LocatorSpec, PageAction } from "./types.js";

function toLocator(page: Page, spec: LocatorSpec): Locator {
  switch (spec.by) {
    case "css":
      return page.locator(spec.value);
    case "role":
      return page.getByRole(spec.role as never, { name: spec.name, ...(spec.exact === undefined ? {} : { exact: spec.exact }) });
    case "text":
      return page.getByText(spec.value, spec.exact === undefined ? {} : { exact: spec.exact });
    case "label":
      return page.getByLabel(spec.value, spec.exact === undefined ? {} : { exact: spec.exact });
    case "placeholder":
      return page.getByPlaceholder(spec.value, spec.exact === undefined ? {} : { exact: spec.exact });
    case "testId":
      return page.getByTestId(spec.value);
  }
}

export async function executeActions(page: Page, actions: PageAction[], safety: AppConfig["safety"]): Promise<void> {
  for (const action of actions) {
    assertSafeAction(action, safety);
    if (action.type === "wait") {
      await page.waitForTimeout(action.milliseconds);
      continue;
    }
    const locator = toLocator(page, action.target).first();
    switch (action.type) {
      case "click":
        await locator.click();
        break;
      case "fill":
        await locator.fill(action.value);
        break;
      case "select":
        await locator.selectOption(action.value);
        break;
      case "press":
        await locator.press(action.key);
        break;
      case "waitFor":
        await locator.waitFor({
          state: action.state ?? "visible",
          ...(action.timeoutMs === undefined ? {} : { timeout: action.timeoutMs })
        });
        break;
    }
  }
}

export async function withBrowser<T>(
  config: AppConfig,
  headed: boolean,
  callback: (context: BrowserContext, page: Page) => Promise<T>
): Promise<T> {
  const encodedCloudState = process.env.BAYCLUB_STORAGE_STATE_B64;
  if (encodedCloudState && !headed) {
    let storageState: Exclude<BrowserContextOptions["storageState"], string | undefined>;
    try {
      storageState = JSON.parse(Buffer.from(encodedCloudState, "base64").toString("utf8")) as typeof storageState;
    } catch {
      throw new Error("BAYCLUB_STORAGE_STATE_B64 is not a valid base64-encoded Playwright session.");
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState,
      viewport: { width: 1440, height: 1000 }
    });
    context.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);
    context.setDefaultTimeout(config.browser.navigationTimeoutMs);
    const page = await context.newPage();
    try {
      return await callback(context, page);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  await fs.mkdir(config.browser.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.browser.profileDir, {
    headless: headed ? false : config.browser.headless,
    viewport: { width: 1440, height: 1000 }
  });
  context.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);
  context.setDefaultTimeout(config.browser.navigationTimeoutMs);
  const pages = context.pages();
  const page = pages[0] ?? (await context.newPage());
  try {
    return await callback(context, page);
  } finally {
    await context.close();
  }
}

export async function acquireRunLock(projectDir: string): Promise<() => Promise<void>> {
  const dataDir = path.join(projectDir, "data");
  const lockPath = path.join(dataDir, "monitor.lock");
  await fs.mkdir(dataDir, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
      await handle.close();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existingPid = Number((await fs.readFile(lockPath, "utf8")).split(/\s+/)[0]);
      let processIsAlive = Number.isInteger(existingPid) && existingPid > 0;
      if (processIsAlive) {
        try {
          process.kill(existingPid, 0);
        } catch (processError) {
          processIsAlive = (processError as NodeJS.ErrnoException).code !== "ESRCH";
        }
      }
      if (processIsAlive) {
        throw new Error(`Another monitor process appears to be running (${lockPath}).`);
      }
      await fs.rm(lockPath, { force: true });
      if (attempt === 1) throw new Error(`Could not replace stale monitor lock ${lockPath}.`);
    }
  }
  return async () => {
    await fs.rm(lockPath, { force: true });
  };
}
