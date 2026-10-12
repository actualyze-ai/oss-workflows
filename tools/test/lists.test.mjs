import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseList } from "../lists.mjs";

describe("parseList", () => {
  it("ignores comments and blank lines and trims entries", () => {
    const text = "# header\nMIT\n\n  ISC  # trailing comment\r\n#MPL-2.0\n";
    assert.deepEqual(parseList(text), ["MIT", "ISC"]);
  });

  it("splits comma-separated entries so workflow inputs parse like files", () => {
    assert.deepEqual(parseList("MPL-2.0, EPL-2.0,\nZlib"), ["MPL-2.0", "EPL-2.0", "Zlib"]);
  });

  it("returns nothing for an empty input", () => {
    assert.deepEqual(parseList(""), []);
  });
});
