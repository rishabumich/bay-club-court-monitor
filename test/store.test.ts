import assert from "node:assert/strict";
import test from "node:test";
import { emptyState, markNotified, reconcileSlots } from "../src/store.js";
import type { Slot } from "../src/types.js";

const sample: Slot = {
  watchId: "watch",
  watchName: "Evening",
  rawText: "11/03/2026 6:00 PM Court 1 Available",
  date: "11/03/2026",
  time: "6:00 PM",
  court: "Court 1",
  bookingUrl: "https://example.com/book",
  fingerprint: "abc"
};

test("notifies once while a slot remains continuously active", () => {
  const state = emptyState();
  const first = reconcileSlots(state, "watch", [sample], new Date("2026-10-29T20:00:00Z"), 60);
  assert.deepEqual(first.notify, [sample]);
  markNotified(state, first.notify, new Date("2026-10-29T20:00:00Z"));
  const second = reconcileSlots(state, "watch", [sample], new Date("2026-10-29T20:05:00Z"), 60);
  assert.deepEqual(second.notify, []);
});

test("notifies again after a slot disappears, reappears, and cooldown elapses", () => {
  const state = emptyState();
  const first = reconcileSlots(state, "watch", [sample], new Date("2026-10-29T20:00:00Z"), 60);
  markNotified(state, first.notify, new Date("2026-10-29T20:00:00Z"));
  reconcileSlots(state, "watch", [], new Date("2026-10-29T20:10:00Z"), 60);
  const reappeared = reconcileSlots(state, "watch", [sample], new Date("2026-10-29T21:01:00Z"), 60);
  assert.deepEqual(reappeared.notify, [sample]);
});
