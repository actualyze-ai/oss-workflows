import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../verify-release-assets.sh", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "verify-release-assets-"));

// Stands in for `gh api --paginate ... --jq <filter>` by applying the
// filter to the releases in FAKE_RELEASES, as gh does for a single page.
writeFileSync(
  join(dir, "gh"),
  `#!/usr/bin/env bash
filter=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--jq" ]]; then
    filter="$2"
    shift
  fi
  shift
done
jq -c "$filter" <<<"$FAKE_RELEASES"
`,
);
chmodSync(join(dir, "gh"), 0o755);

function release(id, tag, draft, assets = []) {
  return { id, tag_name: tag, draft, assets: assets.map((name, index) => ({ id: id * 100 + index, name })) };
}

function run(state, releases) {
  return spawnSync("bash", [script, state], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}${delimiter}${process.env.PATH}`,
      FAKE_RELEASES: JSON.stringify(releases),
      GH_REPO: "actualyze-ai/example",
      TAG: "v1.2.3",
    },
  });
}

after(() => rmSync(dir, { recursive: true, force: true }));

describe("verify-release-assets.sh", () => {
  it("prints the ID of a draft Release that has no assets", () => {
    const result = run("draft", [release(7, "v1.2.2", false, ["old.tgz"]), release(42, "v1.2.3", true)]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "42\n");
  });

  it("prints the ID of a published Release that has no assets", () => {
    const result = run("published", [release(42, "v1.2.3", false)]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "42\n");
  });

  it("rejects a Release that has an asset and names it", () => {
    const result = run("draft", [release(42, "v1.2.3", true, ["example-1.2.3.tgz"])]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must have no assets; it has: example-1\.2\.3\.tgz/u);
    assert.equal(result.stdout, "");
  });

  it("rejects a Release in the other state", () => {
    const result = run("published", [release(42, "v1.2.3", true)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not published/u);
  });

  it("rejects a tag with no Release", () => {
    const result = run("draft", [release(7, "v1.2.2", true)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected one GitHub Release for v1\.2\.3, found 0/u);
  });

  it("rejects a tag with more than one Release", () => {
    const result = run("draft", [release(41, "v1.2.3", true), release(42, "v1.2.3", true)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /found 2/u);
  });

  it("rejects an unknown state", () => {
    const result = run("final", [release(42, "v1.2.3", true)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /state must be draft or published, not final/u);
  });
});
