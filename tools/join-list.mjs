// Usage: node join-list.mjs <policy-file> [extra-entries]
// Prints the policy file's entries, followed by any comma- or
// newline-separated extra entries, as one comma-separated line.
import { parseList, readList } from "./lists.mjs";

const [path, extra = ""] = process.argv.slice(2);
if (!path) {
  console.error("usage: node join-list.mjs <policy-file> [extra-entries]");
  process.exit(2);
}
process.stdout.write([...readList(path), ...parseList(extra)].join(","));
