// Usage: node check-licenses.mjs <package-dir> <allowed-licenses-file> [extra-licenses]
//
// Reads the installed production dependency tree of <package-dir>, the
// package itself included unless it is private, and fails when a
// package's license is not permitted. license-checker-rseidelsohn's own
// --onlyAllow does a substring match, which accepts
// "MIT AND GPL-3.0-only", so the SPDX expression is evaluated here.
import { pathToFileURL } from "node:url";
import { init } from "license-checker-rseidelsohn";
import satisfies from "spdx-satisfies";
import { parseList, readList } from "./lists.mjs";

/**
 * Returns why `license` is not permitted, or undefined when it is.
 * license-checker-rseidelsohn marks a license it inferred from a license
 * file, rather than read from package.json, with a trailing `*`; the
 * inferred identifier is evaluated like a declared one.
 */
export function licenseProblem(license, allowed) {
  if (typeof license !== "string" || license.trim() === "") {
    return "no license declared";
  }
  const expression = license.trim().replace(/\*$/u, "");
  if (expression === "UNKNOWN" || expression === "UNLICENSED") {
    return `license is ${expression}`;
  }
  try {
    return satisfies(expression, allowed) ? undefined : `"${expression}" is not permitted`;
  } catch {
    return `"${expression}" is not a valid SPDX expression`;
  }
}

/**
 * Checks a license-checker-rseidelsohn result map. A package whose
 * `licenses` field is a list (the legacy package.json `licenses` array)
 * must have every entry permitted.
 */
export function findViolations(packages, allowed) {
  const violations = [];
  for (const [id, info] of Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))) {
    const licenses = Array.isArray(info.licenses) ? info.licenses : [info.licenses];
    const problems =
      licenses.length === 0
        ? ["no license declared"]
        : licenses.map((license) => licenseProblem(license, allowed)).filter(Boolean);
    if (problems.length > 0) violations.push({ id, problems });
  }
  return violations;
}

function scan(start) {
  return new Promise((resolve, reject) => {
    init({ start, production: true, excludePrivatePackages: true }, (error, packages) => {
      if (error) reject(error);
      else resolve(packages);
    });
  });
}

async function main() {
  const [start, allowedPath, extra = ""] = process.argv.slice(2);
  if (!start || !allowedPath) {
    console.error("usage: node check-licenses.mjs <package-dir> <allowed-licenses-file> [extra-licenses]");
    process.exit(2);
  }
  const allowed = [...readList(allowedPath), ...parseList(extra)];
  const packages = await scan(start);
  const violations = findViolations(packages, allowed);
  console.log(`Checked ${Object.keys(packages).length} packages against ${allowed.length} permitted licenses.`);
  for (const { id, problems } of violations) {
    console.log(`::error title=License not permitted::${id}: ${problems.join("; ")}`);
  }
  if (violations.length > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
