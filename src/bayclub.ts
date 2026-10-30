import type { Page } from "playwright";
import type { AppConfig, BayClubConfig, Slot, TimeWindow } from "./types.js";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface ParsedHour {
  startMinutes: number;
  startTime: string;
  display: string;
}

export interface ScanResult {
  id: "santa-clara-singles" | "santa-clara-ball-machine";
  name: string;
  slots: Slot[];
}

export interface BayClubScanOptions {
  dateOffsets?: number[];
  playerTypes?: Array<"Singles" | "Ball machine">;
  includeAllHours?: boolean;
}

function timeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time ${JSON.stringify(value)}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function twelveHour(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const minutesPart = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 || 12;
  return `${hours}:${String(minutesPart).padStart(2, "0")} ${suffix}`;
}

export function parseBayClubHour(text: string, durationMinutes = 60): ParsedHour | undefined {
  const normalized = text.replace(/\s+/g, " ").replace(/\./g, ":").trim().toUpperCase();
  const parts = normalized.split(/\s+-\s+/);
  if (parts.length !== 2) return undefined;
  const start = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/.exec(parts[0]!);
  const end = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/.exec(parts[1]!);
  if (!start || !end) return undefined;
  const meridiem = start[3] ?? end[3];
  if (!meridiem) return undefined;
  let hour = Number(start[1]);
  const minute = Number(start[2]);
  if (hour < 1 || hour > 12 || minute > 59) return undefined;
  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;
  const startMinutes = hour * 60 + minute;
  return {
    startMinutes,
    startTime: minutesToTime(startMinutes),
    display: `${twelveHour(startMinutes)}–${twelveHour(startMinutes + durationMinutes)}`
  };
}

function todayParts(timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateAtOffset(timeZone: string, offset: number): { iso: string; dayName: typeof dayNames[number] } {
  const today = todayParts(timeZone);
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
  return { iso: date.toISOString().slice(0, 10), dayName: dayNames[date.getUTCDay()]! };
}

function inWindows(minutes: number, windows: TimeWindow[]): boolean {
  return windows.some((window) => {
    const earliest = timeToMinutes(window.earliestTime);
    const latest = window.latestTime ? timeToMinutes(window.latestTime) : 24 * 60 - 1;
    return minutes >= earliest && minutes <= latest;
  });
}

async function openHourView(
  page: Page,
  config: AppConfig,
  playerType: "Singles" | "Ball machine"
): Promise<void> {
  const preset = config.bayClub!;
  await page.goto(preset.bookingUrl, { waitUntil: "domcontentloaded" });
  const currentUrl = new URL(page.url());
  if (currentUrl.hostname !== "bayclubconnect.com" || /\/account\/login\b/i.test(currentUrl.pathname)) {
    throw new Error("Bay Club session expired. Double-click Connect Bay Club.command to refresh it.");
  }

  await page.getByText("Tennis", { exact: true }).click();
  const buttonGroups = page.locator("app-button-select");
  await buttonGroups.nth(0).locator(".btn").filter({ hasText: playerType }).click();
  await buttonGroups.nth(1).locator(".btn").filter({ hasText: "60 minutes" }).click();
  await page.getByText("NEXT", { exact: true }).click();
  await page.locator(".slider-item").first().waitFor({ state: "visible" });
  await page.getByText("HOUR VIEW", { exact: true }).filter({ visible: true }).first().click();
  await page.getByText(/Court:\s*Any/i).filter({ visible: true }).first().waitFor({ state: "visible" });
}

async function scanPlayerType(
  page: Page,
  config: AppConfig,
  playerType: "Singles" | "Ball machine",
  options: BayClubScanOptions = {}
): Promise<ScanResult> {
  const preset = config.bayClub!;
  const isMachine = playerType === "Ball machine";
  const search = isMachine ? preset.ballMachine : preset.singles;
  const id = isMachine ? "santa-clara-ball-machine" : "santa-clara-singles";
  const name = isMachine ? "Ball machine" : "Singles";
  if (!search.enabled) return { id, name, slots: [] };

  await openHourView(page, config, playerType);
  const dateItems = page.locator(".slider-item");
  const dateCount = await dateItems.count();
  const slots: Slot[] = [];

  for (let index = 0; index < dateCount; index += 1) {
    const date = dateAtOffset(preset.timeZone, index);
    if (options.dateOffsets) {
      if (!options.dateOffsets.includes(index)) continue;
    } else if (!preset.daysOfWeek.includes(date.dayName)) {
      continue;
    }
    // Bay Club renders Today as selected with `disabled no-events`. Other date
    // tiles can also sit behind the slider's overlay, so invoke their own click
    // handler and verify Angular marked the intended day selected before reading.
    if (index > 0) {
      const dateItem = dateItems.nth(index);
      const initialClasses = (await dateItem.getAttribute("class")) ?? "";
      if (/\b(disabled|no-events)\b/.test(initialClasses)) continue;
      await dateItem.evaluate((element) => (element as HTMLElement).click());
      let selected = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if ((await dateItem.getAttribute("class"))?.includes("day-selected")) {
          selected = true;
          break;
        }
        await page.waitForTimeout(50);
      }
      if (!selected) {
        console.log(`  Reached the end of this membership's selectable booking window.`);
        break;
      }
    }
    await page.waitForTimeout(200);
    const hourItems = await page.locator("app-court-time-slot-item").evaluateAll((elements) =>
      elements.map((element) => ({
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
        locked: Boolean(element.querySelector(".i-lock-blue, .time-slot-disabled"))
      }))
    );
    const uniqueHours = [...new Set(
      hourItems.filter((item) => item.text && !item.locked).map((item) => item.text)
    )];
    for (const rawHour of uniqueHours) {
      const parsed = parseBayClubHour(rawHour, preset.durationMinutes);
      if (!parsed || (!options.includeAllHours && !inWindows(parsed.startMinutes, search.windows))) continue;
      slots.push({
        watchId: id,
        watchName: name,
        rawText: rawHour,
        date: date.iso,
        time: parsed.display,
        court: isMachine ? "Ball-machine court" : "Any court",
        location: preset.clubName,
        bookingUrl: preset.bookingUrl,
        fingerprint: `${id}|${date.iso}|${parsed.startTime}`
      });
    }
  }
  return { id, name, slots };
}

export async function scanBayClub(
  page: Page,
  config: AppConfig,
  options: BayClubScanOptions = {}
): Promise<ScanResult[]> {
  const playerTypes = options.playerTypes ?? ["Singles", "Ball machine"];
  const results: ScanResult[] = [];
  for (const playerType of playerTypes) {
    results.push(await scanPlayerType(page, config, playerType, options));
  }
  return results;
}
