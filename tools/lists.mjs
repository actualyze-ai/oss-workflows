import { readFileSync } from "node:fs";

/**
 * Parses a line-oriented policy file: one entry per line, `#` starts a
 * comment, blank lines are ignored. Commas also separate entries, so a
 * workflow input such as "MPL-2.0, EPL-2.0" parses the same way.
 */
export function parseList(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.replace(/#.*$/u, ""))
    .flatMap((line) => line.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function readList(path) {
  return parseList(readFileSync(path, "utf8"));
}
