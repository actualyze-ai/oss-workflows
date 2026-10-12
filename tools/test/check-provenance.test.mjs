import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMissingProvenance, parseBaseline } from "../check-provenance.mjs";

const attested = { dist: { attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } } } };
const unattested = { dist: {} };

describe("parseBaseline", () => {
  it("maps each version to its reason and skips comments", () => {
    const { baseline, errors } = parseBaseline("# header\n1.0.0 Published before trusted publishing\n\n");
    assert.deepEqual(errors, []);
    assert.deepEqual([...baseline], [["1.0.0", "Published before trusted publishing"]]);
  });

  it("rejects a version listed without a reason", () => {
    const { baseline, errors } = parseBaseline("1.0.0\n");
    assert.equal(baseline.size, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /line 1/u);
  });
});

describe("findMissingProvenance", () => {
  it("reports versions without attestations that the baseline does not list", () => {
    const packument = { versions: { "1.0.0": unattested, "1.1.0": attested, "1.2.0": unattested } };
    const baseline = new Map([["1.0.0", "Published before trusted publishing"]]);
    assert.deepEqual(findMissingProvenance(packument, baseline), ["1.2.0"]);
  });

  it("passes when every unattested version is in the baseline", () => {
    const packument = { versions: { "1.0.0": unattested, "1.1.0": attested } };
    assert.deepEqual(findMissingProvenance(packument, new Map([["1.0.0", "reason"]])), []);
  });

  it("passes for a package with no published versions", () => {
    assert.deepEqual(findMissingProvenance({}, new Map()), []);
  });
});
