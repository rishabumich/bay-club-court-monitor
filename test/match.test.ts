import assert from "node:assert/strict";
import test from "node:test";
import { matchesWatch } from "../src/match.js";
import type { Slot, WatchConfig } from "../src/types.js";

const watch: WatchConfig = {
  id: "test",
  name: "Test",
  url: "https://example.com",
  enabled: true,
  actions: [],
  extraction: { itemSelector: ".slot", fields: {} },
  match: { daysOfWeek: ["Tue"], earliestTime: "17:00", latestTime: "20:00" },
  bookingUrl: "https://example.com/book"
};

function slot(date: string, time: string): Slot {
  return {
    watchId: "test",
    watchName: "Test",
    rawText: `${date} ${time} Court 1 Available`,
    date,
    time,
    court: "Court 1",
    bookingUrl: "https://example.com/book",
    fingerprint: `${date}-${time}`
  };
}

test("matches a slot inside the configured weekday and time range", () => {
  assert.equal(matchesWatch(slot("2026-11-03", "6:00 PM"), watch), true);
});

test("rejects a slot outside the configured time range", () => {
  assert.equal(matchesWatch(slot("2026-11-03", "4:30 PM"), watch), false);
});

test("rejects a slot on the wrong weekday", () => {
  assert.equal(matchesWatch(slot("2026-11-04", "6:00 PM"), watch), false);
});
