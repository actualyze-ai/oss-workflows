#!/usr/bin/env bash
# Usage: report-failure.sh <label> <title> <body>
#
# Opens an issue with <label> and <title>, or comments <body> on the
# oldest open issue that already carries <label>, so repeated scheduled
# failures collect on one issue. Needs GH_TOKEN with issues: write and
# GH_REPO set to owner/name.
set -euo pipefail

label="$1"
title="$2"
body="$3"

gh label create "$label" --color D93F0B --description "Raised by a scheduled workflow" 2>/dev/null || true

existing="$(gh issue list --label "$label" --state open --limit 100 --json number --jq 'map(.number) | min // empty')"
if [[ -n "$existing" ]]; then
  gh issue comment "$existing" --body "$body"
  echo "Commented on issue #$existing"
else
  gh issue create --label "$label" --title "$title" --body "$body"
fi
