#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/docker-login.sh
#   COMMIT_SHA=<sha> bash ./scripts/security-scan-pull-images.sh
#   bash ./scripts/security-scan-report.sh
#   OUTPUT_FILE=/tmp/report.md bash ./scripts/security-scan-report.sh
#
# Scans the local blog/diagram-maker/fui-components images (pulled by
# security-scan-pull-images.sh) with Trivy and writes:
#   - one combined human-readable Markdown report ($OUTPUT_FILE), for
#     copying back into the repo to act on locally
#   - one JUnit XML file per target under $RESULTS_DIR, for dorny/test-reporter
#     to publish as a GitHub Check (same mechanism used for Jest results) so
#     findings show up in the PR Checks tab instead of requiring a download
# Exits non-zero if any image has a CRITICAL or HIGH severity vulnerability
# with a fix available — vulnerabilities without a fix yet are listed but
# don't fail the build. Every target is scanned; the report notes whether it
# was the image built for this commit or the most recently published one
# (see security-scan-pull-images.sh). A target is only skipped if Harbor has
# no published image for it at all.

set -euo pipefail
cd "$(dirname "$0")/.."

TAG_PREFIX="${TAG_PREFIX:-security-scan}"
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.72.0}"
OUTPUT_FILE="${OUTPUT_FILE:-security-scan-report.md}"
RESULTS_DIR="${RESULTS_DIR:-security-scan-results}"
SEVERITY="${SEVERITY:-CRITICAL,HIGH}"
SCANNED_TARGETS_FILE="${SCANNED_TARGETS_FILE:-/tmp/security-scan-targets.txt}"

ALL_TARGETS=(blog diagram-maker fui-components)
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

failed=0

{
  echo "# Trivy Security Scan Report"
  echo
  echo "Severities: ${SEVERITY} (vulnerabilities without an available fix are listed but do not fail the build)."
  echo "Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) for commit \`$(git rev-parse HEAD)\`."
  echo
} >"$OUTPUT_FILE"

for target in "${ALL_TARGETS[@]}"; do
  line=""
  if [ -f "$SCANNED_TARGETS_FILE" ]; then
    line=$(grep "^${target} " "$SCANNED_TARGETS_FILE" || true)
  fi

  if [ -z "$line" ]; then
    {
      echo "## ${target}"
      echo
      echo "_Skipped — no published image found in Harbor to scan._"
      echo
    } >>"$OUTPUT_FILE"
    continue
  fi

  tag=$(echo "$line" | awk '{print $2}')
  source=$(echo "$line" | awk '{print $3}')
  image="${TAG_PREFIX}/${target}:local"
  out="${WORKDIR}/${target}.txt"

  echo "Scanning ${image} (tag: ${tag})..."
  set +e
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v trivy-cache:/root/.cache/ \
    "$TRIVY_IMAGE" image \
    --scanners vuln \
    --severity "$SEVERITY" \
    --ignore-unfixed \
    --exit-code 1 \
    --format table \
    --table-mode detailed \
    "$image" >"$out"
  status=$?
  set -e

  if [ "$status" -ne 0 ]; then
    failed=1
  fi

  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v trivy-cache:/root/.cache/ \
    "$TRIVY_IMAGE" image \
    --scanners vuln \
    --severity "$SEVERITY" \
    --ignore-unfixed \
    --format template \
    --template "@/contrib/junit.tpl" \
    "$image" >"${RESULTS_DIR}/${target}.xml"

  {
    echo "## ${target}"
    echo
    if [ "$source" = "latest" ]; then
      echo "_Unchanged in this PR — scanned the most recently published image (\`${tag}\`)._"
    else
      echo "_Scanned the image published for this commit (\`${tag}\`)._"
    fi
    echo
    echo '```'
    cat "$out"
    echo '```'
    echo
  } >>"$OUTPUT_FILE"
done

echo "Report written to ${OUTPUT_FILE}; JUnit results written to ${RESULTS_DIR}/"

if [ "$failed" -ne 0 ]; then
  echo "CRITICAL/HIGH vulnerabilities with an available fix were found. See ${OUTPUT_FILE}." >&2
  exit 1
fi
