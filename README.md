# actualyze-ai/workflows

Reusable GitHub Actions workflows that run CI, security scanning, and npm
releases for Actualyze's open-source repositories.

Each repository keeps thin caller workflows that point here by full commit
SHA. A change in this repository reaches a caller only when the caller
moves its pin, which Dependabot proposes as a pull request.

## Workflows

| Workflow                                                           | Runs                                                                                             | Caller triggers                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`node-ci.yml`](.github/workflows/node-ci.yml)                     | `npm ci`, the check script, `npm audit signatures`, actionlint, zizmor                           | `pull_request`, `merge_group`, `push` to `main`             |
| [`codeql.yml`](.github/workflows/codeql.yml)                       | CodeQL advanced setup with `build-mode: none`                                                    | `pull_request`, `merge_group`, `push`, weekly schedule      |
| [`dependency-review.yml`](.github/workflows/dependency-review.yml) | Blocks new vulnerable, denied, or disallowed-license dependencies                                | `pull_request`, `merge_group`                               |
| [`vuln-scan.yml`](.github/workflows/vuln-scan.yml)                 | Full-tree `npm audit`, `npm audit signatures`, and a provenance check of every published version | daily schedule, `workflow_dispatch`                         |
| [`release-npm.yml`](.github/workflows/release-npm.yml)             | Builds and checks the package, then stages the npm publish and drafts the GitHub Release         | `push` of a `v*` tag                                        |
| [`finalize-release.yml`](.github/workflows/finalize-release.yml)   | Checks the approved npm version against the build record and publishes the draft Release         | `workflow_dispatch`                                         |
| [`compat-node.yml`](.github/workflows/compat-node.yml)             | Tests against the pinned, `latest`, and `next` host releases                                     | daily schedule, `workflow_dispatch`                         |
| [`contract-tests.yml`](.github/workflows/contract-tests.yml)       | Runs the caller's contract tests against a live Actualyze endpoint                               | schedule, `workflow_dispatch`                               |
| [`scorecard.yml`](.github/workflows/scorecard.yml)                 | OpenSSF Scorecard, with results published and uploaded to code scanning                          | weekly schedule, `push` to `main`, `branch_protection_rule` |

Every workflow sets `permissions: {}` at the top and grants permissions per
job, checks out with `persist-credentials: false`, pins every action by
full commit SHA, and runs `step-security/harden-runner` in audit mode as
its first step.

### Caller permissions

A reusable workflow's jobs get at most the permissions of the calling job,
so each calling job must grant these:

| Workflow                | Permissions on the calling job                                                 |
| ----------------------- | ------------------------------------------------------------------------------ |
| `node-ci.yml`           | `actions: read`, `contents: read`, `security-events: write`                    |
| `codeql.yml`            | `actions: read`, `contents: read`, `packages: read`, `security-events: write`  |
| `dependency-review.yml` | `contents: read`                                                               |
| `vuln-scan.yml`         | `contents: read`                                                               |
| `release-npm.yml`       | `contents: write`, `id-token: write`                                           |
| `finalize-release.yml`  | `actions: read`, `contents: write`                                             |
| `compat-node.yml`       | `actions: read`, `contents: read`, `issues: write`                             |
| `contract-tests.yml`    | `contents: read`, `issues: write`                                              |
| `scorecard.yml`         | `actions: read`, `contents: read`, `id-token: write`, `security-events: write` |

Do not pass `secrets: inherit`. None of these workflows takes a secret from
the caller; the ones that need a credential read it from an environment.

### Inputs

| Workflow                | Input                         | Default                                  | Description                                                                         |
| ----------------------- | ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `node-ci.yml`           | `node-versions`               | `'["24"]'`                               | JSON array of Node.js versions; the check job runs once per version                 |
|                         | `working-directory`           | `.`                                      | Directory holding `package.json` and `package-lock.json`                            |
|                         | `check-script`                | `check`                                  | npm script that builds, typechecks, lints, and tests                                |
| `codeql.yml`            | `languages`                   | `'["actions", "javascript-typescript"]'` | JSON array of CodeQL languages that analyze without a build                         |
|                         | `queries`                     | `security-extended`                      | Query suite run in addition to the defaults                                         |
| `dependency-review.yml` | `additional-licenses`         | empty                                    | Comma-separated SPDX identifiers permitted on top of `allowed-licenses.txt`         |
|                         | `allow-dependencies-licenses` | empty                                    | Comma-separated package URLs, such as `pkg:npm/name`, exempt from the license check |
| `vuln-scan.yml`         | `node-version`                | `24`                                     | Node.js version                                                                     |
|                         | `working-directory`           | `.`                                      | Directory holding `package.json` and `package-lock.json`                            |
|                         | `provenance-baseline`         | `.github/provenance-baseline.txt`        | Published versions without provenance, one `<version> <reason>` per line            |
| `release-npm.yml`       | `node-version`                | `24`                                     | Node.js version for the build job                                                   |
|                         | `additional-licenses`         | empty                                    | Comma-separated SPDX identifiers permitted on top of `allowed-licenses.txt`         |
| `finalize-release.yml`  | `tag`                         | required                                 | Release tag, such as `v1.2.3`                                                       |
|                         | `release-workflow`            | `release.yml`                            | File name of the caller's workflow that calls `release-npm.yml`                     |
| `compat-node.yml`       | `host-packages`               | required                                 | Space-separated npm names of the host packages                                      |
|                         | `node-version`                | `24`                                     | Node.js version                                                                     |
|                         | `working-directory`           | `.`                                      | Directory holding `package.json` and `package-lock.json`                            |
|                         | `test-script`                 | `check`                                  | npm script run against each host channel                                            |
| `contract-tests.yml`    | `node-version`                | `24`                                     | Node.js version                                                                     |
|                         | `working-directory`           | `.`                                      | Directory holding `package.json` and `package-lock.json`                            |
|                         | `test-script`                 | `test:contract`                          | npm script that runs the contract tests                                             |

A repository that needs a license outside `allowed-licenses.txt` passes it
in `additional-licenses` to both `dependency-review.yml` and
`release-npm.yml`, and records why next to the caller.

A development-only dependency whose license is outside the list, such as a
build tool that is never shipped, can instead be exempted by package URL in
`allow-dependencies-licenses` to `dependency-review.yml`. The exemption
matches the package name at any version and skips only the license check;
vulnerability and denied-package checks still apply. List every package
URL the dependency adds, including platform-specific packages published
under their own names, and record the reason next to the caller.
`release-npm.yml` checks only the shipped tree, so it needs no matching
exemption.

## Calling a workflow

Pin the full commit SHA of this repository. A minimal CI caller:

```yaml
name: CI

on:
  pull_request:
  merge_group:
  push:
    branches: [main]

permissions: {}

jobs:
  ci:
    uses: actualyze-ai/workflows/.github/workflows/node-ci.yml@<commit-sha>
    permissions:
      actions: read
      contents: read
      security-events: write
    with:
      node-versions: '["22", "24"]'
```

The release pair:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ["v*"]

permissions: {}

jobs:
  release:
    uses: actualyze-ai/workflows/.github/workflows/release-npm.yml@<commit-sha>
    permissions:
      contents: write
      id-token: write
```

```yaml
# .github/workflows/finalize-release.yml
name: Finalize release

on:
  workflow_dispatch:
    inputs:
      tag:
        description: Release tag, such as v1.2.3
        required: true
        type: string

permissions: {}

jobs:
  finalize:
    uses: actualyze-ai/workflows/.github/workflows/finalize-release.yml@<commit-sha>
    permissions:
      actions: read
      contents: write
    with:
      tag: ${{ inputs.tag }}
```

### What a calling repository needs

| Setting                           | Needed by            | Configuration                                                                                                             |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Environment `release`             | `release-npm.yml`    | Required reviewers from `oss-release-approvers`, self-review prevented, no admin bypass, deployments limited to `v*` tags |
| npm trusted publisher             | `release-npm.yml`    | The repository, workflow `release.yml`, environment `release`, allowed to stage publishes only                            |
| Environment `contract-tests`      | `contract-tests.yml` | Limited to the default branch; variable `ACTUALYZE_BASE_URL` and secret `ACTUALYZE_API_KEY`                               |
| `.github/provenance-baseline.txt` | `vuln-scan.yml`      | Every published version that has no provenance, with the reason                                                           |

## How a release runs

1. A release approver pushes tag `vX.Y.Z`; it must equal the `version` in
   `package.json`.
2. The **build** job, which has no `id-token` permission and no package
   cache, runs `npm ci`, `npm run check`, `npm audit --audit-level=moderate`,
   `npm audit signatures`, and the license check of the production tree. It
   packs the tarball and uploads it with its SHA-256 as the `npm-package`
   artifact.
3. The **publish** job waits for approval in environment `release`. It
   fails if a GitHub Release already exists for the tag. It downloads the
   tarball, checks its SHA-256 against the build job's output, and runs
   `npm stage publish <tarball> --ignore-scripts --provenance` on Node 24
   with npm 11.16 or later. It installs no packages and checks out no code.
   Versions with a pre-release suffix use the `next` dist-tag. It then
   creates a draft GitHub Release holding the tarball.
4. A maintainer runs `npm stage approve <stage-id>`, which needs 2FA.
5. A release approver runs the caller's `finalize-release.yml` with the
   tag. It finds the successful release run for the tag commit, downloads
   that run's build record, and checks that:
   - the npm version is public, has a provenance attestation, and its
     `dist.integrity` matches the recorded tarball;
   - exactly one GitHub Release exists for the tag, and it is a draft;
   - the draft holds exactly one asset, the tarball, whose SHA-256 matches
     the build record and whose SHA-512 matches `dist.integrity`.

   It then publishes the draft and repeats the asset check on the
   published Release.

## Policy files

| File                                           | Used by                                    | Format                                           |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| [`allowed-licenses.txt`](allowed-licenses.txt) | `dependency-review.yml`, `release-npm.yml` | One SPDX identifier per line                     |
| [`denied-packages.txt`](denied-packages.txt)   | `dependency-review.yml`                    | One package URL per line, such as `pkg:npm/name` |

The workflows read both files from this repository at the commit the caller
pinned, so a caller cannot edit them and a change reaches a caller with its
next pin update.

The license check in `release-npm.yml` evaluates each package's SPDX
expression: an `OR` expression passes when any branch is allowed, and an
`AND` expression only when every term is. Packages with no license, an
`UNKNOWN` license, or text that is not an SPDX expression fail.

## Verifying a release

For an npm package released through these workflows, in a project that
installs it:

```bash
npm audit signatures
```

To inspect one version's provenance directly:

```bash
npm view <package>@<version> dist.attestations --json
```

## Development

The CI workflow ([`ci.yml`](.github/workflows/ci.yml)) calls `node-ci.yml`
against the fixture package in [`fixtures/npm-package`](fixtures/npm-package),
so its workflow-lint job runs actionlint and zizmor over every workflow in
this repository. It also calls `dependency-review.yml` on pull requests and
runs the unit tests in [`tools/`](tools).

Run the same checks locally:

```bash
actionlint
zizmor .
(cd tools && npm ci --ignore-scripts && npm test)
(cd fixtures/npm-package && npm ci && npm run check && npm audit signatures)
```

[`.github/actionlint.yaml`](.github/actionlint.yaml) silences two actionlint
errors for GitHub features newer than actionlint 1.7.12: the
`job.workflow_repository` and `job.workflow_sha` contexts, and the
`$/` self-repository syntax.

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
