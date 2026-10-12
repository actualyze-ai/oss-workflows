// Usage: node check-provenance.mjs <package-name> <baseline-file>
//
// Fails when any published version of <package-name> has no provenance
// attestation (dist.attestations in the registry metadata) and is not
// listed in <baseline-file>. Each baseline line is a version followed by
// the reason it has no provenance; `#` starts a comment.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REGISTRY = "https://registry.npmjs.org";

/** Parses baseline text into a map of version to reason. */
export function parseBaseline(text) {
  const baseline = new Map();
  const errors = [];
  text.split(/\r?\n/u).forEach((raw, index) => {
    const line = raw.replace(/#.*$/u, "").trim();
    if (line === "") return;
    const [version, ...reason] = line.split(/\s+/u);
    if (reason.length === 0) {
      errors.push(`line ${index + 1}: "${version}" needs a reason after the version`);
      return;
    }
    baseline.set(version, reason.join(" "));
  });
  return { baseline, errors };
}

/** Lists published versions without attestations that the baseline does not exempt. */
export function findMissingProvenance(packument, baseline) {
  return Object.entries(packument.versions ?? {})
    .filter(([version, manifest]) => !manifest?.dist?.attestations && !baseline.has(version))
    .map(([version]) => version);
}

async function fetchPackument(name) {
  const url = `${REGISTRY}/${encodeURIComponent(name).replace(/^%40/u, "@")}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GET ${url} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const [name, baselinePath] = process.argv.slice(2);
  if (!name || !baselinePath) {
    console.error("usage: node check-provenance.mjs <package-name> <baseline-file>");
    process.exit(2);
  }
  let baselineText = "";
  try {
    baselineText = readFileSync(baselinePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const { baseline, errors } = parseBaseline(baselineText);
  for (const error of errors) console.log(`::error title=Invalid provenance baseline::${baselinePath} ${error}`);
  if (errors.length > 0) process.exit(1);

  const packument = await fetchPackument(name);
  if (!packument) {
    console.log(`${name} is not published; nothing to check.`);
    return;
  }
  const missing = findMissingProvenance(packument, baseline);
  const published = Object.keys(packument.versions ?? {}).length;
  console.log(`Checked ${published} published versions of ${name}; ${baseline.size} listed in the baseline.`);
  for (const version of missing) {
    console.log(`::error title=Missing provenance::${name}@${version} has no provenance attestation`);
  }
  if (missing.length > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
