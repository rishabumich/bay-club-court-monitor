import assert from "node:assert/strict";
import test from "node:test";
import { buildMessage } from "../src/notify.js";
import type { Slot } from "../src/types.js";

test("groups openings into a compact hour view", () => {
  const base: Slot = {
    watchId: "santa-clara-singles",
    watchName: "Singles",
    rawText: "5:00 - 6:00 PM",
    date: "2026-10-30",
    time: "5:00 PM–6:00 PM",
    court: "Any court",
    location: "Santa Clara",
    bookingUrl: "https://bayclubconnect.com/book",
    fingerprint: "one"
  };
  const message = buildMessage([
    base,
    { ...base, time: "5:30 PM–6:30 PM", fingerprint: "two" }
  ]);
  assert.match(message, /Singles — Fri, Oct 30: 5:00 PM–6:00 PM, 5:30 PM–6:30 PM/);
  assert.match(message, /Book manually:/);
});

test("can include every slot for an explicit verification message", () => {
  const base: Slot = {
    watchId: "santa-clara-singles",
    watchName: "Singles",
    rawText: "6:00 - 7:00 AM",
    date: "2026-10-30",
    time: "6:00 AM–7:00 AM",
    court: "Any court",
    location: "Santa Clara",
    bookingUrl: "https://bayclubconnect.com/book",
    fingerprint: "slot-0"
  };
  const slots = Array.from({ length: 14 }, (_, index) => ({
    ...base,
    time: `${index + 1}:00–${index + 2}:00`,
    fingerprint: `slot-${index}`
  }));
  const message = buildMessage(slots, slots.length);
  assert.doesNotMatch(message, /more/);
  assert.match(message, /14:00–15:00/);
});
