# Security policy

## Reporting a vulnerability

Report vulnerabilities through GitHub's private vulnerability reporting:
open the [Security tab](https://github.com/actualyze-ai/oss-workflows/security)
of this repository and choose **Report a vulnerability**. Do not open a
public issue, pull request, or discussion for a suspected vulnerability.

Include the affected workflow, the commit you pinned, and the steps that
show the problem. A finding in a workflow here affects the CI and releases
of every repository that calls it, so say if you have seen it exploited.

## Response targets

After we confirm a report, we aim to release a fix within these times,
counted from the report and set by severity:

| Severity | Fix target |
| -------- | ---------- |
| Critical | 3 days     |
| High     | 30 days    |
| Medium   | 60 days    |
| Low      | 90 days    |

## Supported versions

Callers pin these workflows by commit SHA. Fixes land on `main`; a caller
gets a fix by moving its pin to a commit that includes it, which
Dependabot proposes. Only the latest commit on `main` is supported.
