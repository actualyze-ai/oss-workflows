import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { allowedEntryProblem, findViolations, licenseProblem } from "../check-licenses.mjs";

const allowed = ["MIT", "ISC", "Apache-2.0"];
const script = fileURLToPath(new URL("../check-licenses.mjs", import.meta.url));

describe("allowedEntryProblem", () => {
  it("accepts single identifiers, with or without + and an exception", () => {
    for (const entry of ["MIT", "GPL-2.0+", "Apache-2.0 WITH LLVM-exception", "LicenseRef-Internal"]) {
      assert.equal(allowedEntryProblem(entry), undefined, entry);
    }
  });

  it("rejects an OR or AND expression", () => {
    assert.match(allowedEntryProblem("MIT OR ISC"), /"MIT OR ISC" is not a single SPDX license identifier/u);
    assert.match(allowedEntryProblem("MIT AND ISC"), /not a single SPDX license identifier/u);
  });

  it("rejects text that is not an SPDX identifier", () => {
    assert.match(allowedEntryProblem("Apache 2.0"), /"Apache 2.0" is not a single SPDX license identifier/u);
  });
});

describe("check-licenses.mjs with an invalid permitted license", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-licenses-"));
  after(() => rmSync(dir, { recursive: true, force: true }));

  // The package directory does not exist, so reaching the dependency scan
  // would fail differently: the list is rejected before anything is read.
  function run(allowedText, extra) {
    const allowedPath = join(dir, "allowed.txt");
    writeFileSync(allowedPath, allowedText);
    return spawnSync(process.execPath, [script, join(dir, "missing-package"), allowedPath, extra], {
      encoding: "utf8",
    });
  }

  it("names the bad entry and the file it came from", () => {
    const result = run("MIT\nApache 2.0\n", "");
    assert.equal(result.status, 2);
    assert.match(result.stdout, /allowed\.txt: "Apache 2\.0" is not a single SPDX license identifier/u);
    assert.doesNotMatch(result.stdout, /"MIT"/u);
  });

  it("names a bad additional license", () => {
    const result = run("MIT\n", "ISC, MIT OR ISC");
    assert.equal(result.status, 2);
    assert.match(result.stdout, /additional licenses: "MIT OR ISC" is not a single SPDX license identifier/u);
  });
});

describe("licenseProblem", () => {
  it("accepts a permitted identifier", () => {
    assert.equal(licenseProblem("MIT", allowed), undefined);
  });

  it("rejects an identifier outside the list", () => {
    assert.match(licenseProblem("MPL-2.0", allowed), /not permitted/u);
  });

  it("accepts an OR expression when any branch is permitted", () => {
    assert.equal(licenseProblem("(GPL-3.0-only OR MIT)", allowed), undefined);
  });

  it("rejects an AND expression with a term outside the list", () => {
    assert.match(licenseProblem("MIT AND GPL-3.0-only", allowed), /not permitted/u);
  });

  it("accepts an AND expression whose terms are all permitted", () => {
    assert.equal(licenseProblem("MIT AND ISC", allowed), undefined);
  });

  it("evaluates a license inferred from a license file like a declared one", () => {
    assert.equal(licenseProblem("MIT*", allowed), undefined);
    assert.match(licenseProblem("GPL-2.0-only*", allowed), /not permitted/u);
  });

  it("rejects unknown and unlicensed packages", () => {
    assert.match(licenseProblem("UNKNOWN", allowed), /UNKNOWN/u);
    assert.match(licenseProblem("UNLICENSED", allowed), /UNLICENSED/u);
  });

  it("rejects text that is not an SPDX expression", () => {
    assert.match(licenseProblem("Apache 2.0", allowed), /not a valid SPDX expression/u);
    assert.match(licenseProblem("Custom: https://example.com/LICENSE", allowed), /not a valid SPDX expression/u);
  });

  it("rejects a missing license", () => {
    assert.match(licenseProblem(undefined, allowed), /no license/u);
    assert.match(licenseProblem("  ", allowed), /no license/u);
  });
});

describe("findViolations", () => {
  it("reports only the packages with a problem", () => {
    const violations = findViolations(
      {
        "left-pad@1.3.0": { licenses: "WTFPL" },
        "semver@7.8.5": { licenses: "ISC" },
      },
      allowed,
    );
    assert.deepEqual(violations, [{ id: "left-pad@1.3.0", problems: ['"WTFPL" is not permitted'] }]);
  });

  it("requires every entry of a license list to be permitted", () => {
    const violations = findViolations({ "dual@1.0.0": { licenses: ["MIT", "GPL-2.0-only"] } }, allowed);
    assert.equal(violations.length, 1);
    assert.deepEqual(violations[0].problems, ['"GPL-2.0-only" is not permitted']);
  });

  it("treats an empty license list as no license", () => {
    assert.deepEqual(findViolations({ "empty@1.0.0": { licenses: [] } }, allowed), [
      { id: "empty@1.0.0", problems: ["no license declared"] },
    ]);
  });
});
