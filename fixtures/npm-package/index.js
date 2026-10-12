import semver from "semver";

/** Returns whether `version` satisfies the semver `range`. */
export function supports(range, version) {
  return semver.satisfies(version, range);
}
