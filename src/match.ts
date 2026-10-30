import type { Slot, WatchConfig } from "./types.js";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function timeToMinutes(value: string): number | undefined {
  const normalized = value.trim();
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(normalized);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    if (hours < 1 || hours > 12 || minutes > 59) return undefined;
    if (hours === 12) hours = 0;
    if (twelveHour[3]?.toLowerCase() === "pm") hours += 12;
    return hours * 60 + minutes;
  }
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!twentyFourHour) return undefined;
  const hours = Number(twentyFourHour[1]);
  const minutes = Number(twentyFourHour[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : undefined;
}

function parseDate(value: string): Date | undefined {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const parts = iso ? [iso[1], iso[2], iso[3]] : us ? [us[3], us[1], us[2]] : undefined;
  if (!parts) return undefined;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function matchesWatch(slot: Slot, watch: WatchConfig): boolean {
  const rules = watch.match;
  if (rules.includeTextRegex && !new RegExp(rules.includeTextRegex, "i").test(slot.rawText)) return false;
  if (rules.excludeTextRegex && new RegExp(rules.excludeTextRegex, "i").test(slot.rawText)) return false;

  if (rules.daysOfWeek?.length && slot.date) {
    const date = parseDate(slot.date);
    if (date && !rules.daysOfWeek.includes(dayNames[date.getDay()]!)) return false;
  }

  if ((rules.earliestTime || rules.latestTime) && slot.time) {
    const slotMinutes = timeToMinutes(slot.time);
    const earliest = rules.earliestTime ? timeToMinutes(rules.earliestTime) : undefined;
    const latest = rules.latestTime ? timeToMinutes(rules.latestTime) : undefined;
    if (slotMinutes !== undefined && earliest !== undefined && slotMinutes < earliest) return false;
    if (slotMinutes !== undefined && latest !== undefined && slotMinutes > latest) return false;
  }
  return true;
}

export function describeSlot(slot: Slot): string {
  const structured = [slot.location, slot.date, slot.time, slot.court].filter(Boolean).join(", ");
  return structured || slot.rawText.slice(0, 180);
}
