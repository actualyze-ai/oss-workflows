import assert from "node:assert/strict";
import { it } from "node:test";
import { supports } from "./index.js";

it("matches a version inside the range", () => {
  assert.equal(supports(">=22", "24.18.0"), true);
});

it("rejects a version outside the range", () => {
  assert.equal(supports(">=22", "20.19.0"), false);
});
