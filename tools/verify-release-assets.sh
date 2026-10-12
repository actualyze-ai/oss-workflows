#!/usr/bin/env bash
# Usage: verify-release-assets.sh <draft|published> <tarball> <sha256> <integrity>
#
# Checks that exactly one GitHub Release exists for $TAG, that it is in
# the given state, that its only asset is named <tarball>, and that the
# asset's SHA-256 is <sha256> and its SHA-512 subresource integrity is
# <integrity>. Prints the release ID. Needs GH_TOKEN with contents: write,
# because draft releases are listed only to tokens that can push, and
# GH_REPO (owner/name) and TAG in the environment.
set -euo pipefail

state="$1"
tarball="$2"
sha256="$3"
integrity="$4"

fail() {
  echo "::error::$*" >&2
  exit 1
}

case "$state" in
  draft) want_draft=true ;;
  published) want_draft=false ;;
  *) fail "state must be draft or published, not $state" ;;
esac

releases="$(gh api --paginate "repos/$GH_REPO/releases?per_page=100" \
  --jq '.[] | select(.tag_name == env.TAG) | {id, draft, assets: [.assets[] | {id, name}]}' | jq -s .)"

count="$(jq length <<<"$releases")"
[[ "$count" -eq 1 ]] || fail "Expected one GitHub Release for $TAG, found $count"

draft="$(jq -r '.[0].draft' <<<"$releases")"
[[ "$draft" == "$want_draft" ]] || fail "The GitHub Release for $TAG is not $state"

names="$(jq -c '[.[0].assets[].name] | sort' <<<"$releases")"
expected_names="$(jq -cn --arg name "$tarball" '[$name]')"
[[ "$names" == "$expected_names" ]] || fail "The GitHub Release for $TAG has assets $names; expected $expected_names"

asset_id="$(jq -r '.[0].assets[0].id' <<<"$releases")"
asset="$(mktemp)"
trap 'rm -f "$asset"' EXIT
gh api -H "Accept: application/octet-stream" "repos/$GH_REPO/releases/assets/$asset_id" >"$asset"

actual_sha256="$(sha256sum "$asset" | cut -d' ' -f1)"
[[ "$actual_sha256" == "$sha256" ]] || fail "Asset $tarball has SHA-256 $actual_sha256; the build recorded $sha256"

actual_integrity="sha512-$(openssl dgst -sha512 -binary "$asset" | base64 -w0)"
[[ "$actual_integrity" == "$integrity" ]] || fail "Asset $tarball has integrity $actual_integrity; the registry has $integrity"

jq -r '.[0].id' <<<"$releases"
