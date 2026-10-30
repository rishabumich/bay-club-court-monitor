import crypto from "node:crypto";
import type { Locator } from "playwright";
import type { FieldExtraction, Slot, WatchConfig } from "./types.js";

function clean(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

async function extractField(item: Locator, field: FieldExtraction | undefined, rawText: string): Promise<string | undefined> {
  if (!field) return undefined;
  let source = rawText;
  if (field.selector) {
    const child = item.locator(field.selector).first();
    source = field.attribute ? (await child.getAttribute(field.attribute)) ?? "" : await child.innerText();
  }
  if (field.regex) {
    const match = new RegExp(field.regex, "i").exec(source);
    return clean(match?.[field.group ?? 1]);
  }
  return clean(source);
}

function fingerprint(watchId: string, values: Array<string | undefined>): string {
  const normalized = values.map((value) => value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "").join("|");
  return crypto.createHash("sha256").update(`${watchId}|${normalized}`).digest("hex").slice(0, 24);
}

export async function extractSlots(pageLocator: Locator, watch: WatchConfig): Promise<Slot[]> {
  const items = pageLocator.locator(watch.extraction.itemSelector);
  const count = await items.count();
  const slots: Slot[] = [];
  const available = watch.extraction.availableTextRegex
    ? new RegExp(watch.extraction.availableTextRegex, "i")
    : undefined;
  const unavailable = watch.extraction.unavailableTextRegex
    ? new RegExp(watch.extraction.unavailableTextRegex, "i")
    : undefined;

  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    const rawText = clean(await item.innerText()) ?? "";
    if (!rawText || (available && !available.test(rawText)) || (unavailable && unavailable.test(rawText))) continue;

    const date = await extractField(item, watch.extraction.fields.date, rawText);
    const time = await extractField(item, watch.extraction.fields.time, rawText);
    const court = await extractField(item, watch.extraction.fields.court, rawText);
    const location = await extractField(item, watch.extraction.fields.location, rawText);
    slots.push({
      watchId: watch.id,
      watchName: watch.name,
      rawText,
      ...(date ? { date } : {}),
      ...(time ? { time } : {}),
      ...(court ? { court } : {}),
      ...(location ? { location } : {}),
      bookingUrl: watch.bookingUrl,
      fingerprint: fingerprint(watch.id, [date, time, court, location, rawText])
    });
  }
  return slots;
}
