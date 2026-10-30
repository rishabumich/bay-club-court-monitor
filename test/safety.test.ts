import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeAction } from "../src/safety.js";

const safety = {
  blockedActionTextRegex: "\\b(reserve|book now|confirm booking|pay|cancel reservation)\\b",
  allowedActionTextRegexes: ["^button Book a Court$"]
};

test("blocks final reservation-like controls", () => {
  assert.throws(() =>
    assertSafeAction({ type: "click", target: { by: "role", role: "button", name: "Reserve" } }, safety)
  );
});

test("permits an explicitly allowlisted navigation control", () => {
  assert.doesNotThrow(() =>
    assertSafeAction({ type: "click", target: { by: "role", role: "button", name: "Book a Court" } }, safety)
  );
});
