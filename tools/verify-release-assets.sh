#!/usr/bin/env bash
# Usage: verify-release-assets.sh <draft|published>
#
# Checks that exactly one GitHub Release exists for $TAG, that it is in
# the given state, and that it has no assets. npm is the only distribution
# channel for these packages, so a Release that holds a file was changed
# outside the release workflow. Prints the release ID. Needs GH_TOKEN with
# contents: write, because draft releases are listed only to tokens that
# can push, and GH_REPO (owner/name) and TAG in the environment.
set -euo pipefail

state="${1:-}"

fail() {
  echo "::error::$*" >&2
  exit 1
}

case "$state" in
  draft) want_draft=true ;;
  published) want_draft=false ;;
  *) fail "state must be draft or published, not ${state:-empty}" ;;
esac

releases="$(gh api --paginate "repos/$GH_REPO/releases?per_page=100" \
  --jq '.[] | select(.tag_name == env.TAG) | {id, draft, assets: [.assets[].name]}' | jq -s .)"

count="$(jq length <<<"$releases")"
[[ "$count" -eq 1 ]] || fail "Expected one GitHub Release for $TAG, found $count"

draft="$(jq -r '.[0].draft' <<<"$releases")"
[[ "$draft" == "$want_draft" ]] || fail "The GitHub Release for $TAG is not $state"

asset_count="$(jq '.[0].assets | length' <<<"$releases")"
[[ "$asset_count" -eq 0 ]] ||
  fail "The GitHub Release for $TAG must have no assets; it has: $(jq -r '.[0].assets | join(", ")' <<<"$releases")"

jq -r '.[0].id' <<<"$releases"
