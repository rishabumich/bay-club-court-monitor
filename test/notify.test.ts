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
