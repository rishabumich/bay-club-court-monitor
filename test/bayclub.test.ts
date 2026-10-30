import assert from "node:assert/strict";
import test from "node:test";
import { parseBayClubHour } from "../src/bayclub.js";

test("parses a morning hour when AM appears only at the end", () => {
  assert.deepEqual(parseBayClubHour("8:00 - 9:00 am"), {
    startMinutes: 480,
    startTime: "08:00",
    display: "8:00 AM–9:00 AM"
  });
});

test("parses an evening hour when PM appears only at the end", () => {
  assert.deepEqual(parseBayClubHour("5:30 - 6:30 pm"), {
    startMinutes: 1050,
    startTime: "17:30",
    display: "5:30 PM–6:30 PM"
  });
});

test("handles Bay Club's dotted noon format", () => {
  assert.equal(parseBayClubHour("12.00 - 1:00 pm")?.startTime, "12:00");
});
