#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/docker-login.sh
#   COMMIT_SHA=<sha> bash ./scripts/security-scan-pull-images.sh
#   bash ./scripts/security-scan-report.sh
#   OUTPUT_FILE=/tmp/report.md bash ./scripts/security-scan-report.sh
#
# Scans the local blog/diagram-maker/fui-components images (pulled by
# security-scan-pull-images.sh) with Trivy and writes one combined
# human-readable Markdown report. Exits non-zero if any image has a
# CRITICAL or HIGH severity vulnerability with a fix available —
# vulnerabilities without a fix yet are listed but don't fail the build.
# Targets not present in $SCANNED_TARGETS_FILE (unchanged in this PR, so
# nothing new was published to scan) are noted as skipped in the report.

set -euo pipefail
cd "$(dirname "$0")/.."

TAG_PREFIX="${TAG_PREFIX:-security-scan}"
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:0.72.0}"
OUTPUT_FILE="${OUTPUT_FILE:-security-scan-report.md}"
SEVERITY="${SEVERITY:-CRITICAL,HIGH}"
SCANNED_TARGETS_FILE="${SCANNED_TARGETS_FILE:-/tmp/security-scan-targets.txt}"

ALL_TARGETS=(blog diagram-maker fui-components)
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

failed=0

{
  echo "# Trivy Security Scan Report"
  echo
  echo "Severities: ${SEVERITY} (vulnerabilities without an available fix are listed but do not fail the build)."
  echo "Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) for commit \`$(git rev-parse HEAD)\`."
  echo
} >"$OUTPUT_FILE"

for target in "${ALL_TARGETS[@]}"; do
  if [ ! -f "$SCANNED_TARGETS_FILE" ] || ! grep -qx "$target" "$SCANNED_TARGETS_FILE"; then
    {
      echo "## ${target}"
      echo
      echo "_Skipped — unchanged in this PR, so nothing new was published to scan. Last scanned in the PR that last touched this app._"
      echo
    } >>"$OUTPUT_FILE"
    continue
  fi

  image="${TAG_PREFIX}/${target}:local"
  out="${WORKDIR}/${target}.txt"

  echo "Scanning ${image}..."
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

  {
    echo "## ${target}"
    echo
    echo '```'
    cat "$out"
    echo '```'
    echo
  } >>"$OUTPUT_FILE"
done

echo "Report written to ${OUTPUT_FILE}"

if [ "$failed" -ne 0 ]; then
  echo "CRITICAL/HIGH vulnerabilities with an available fix were found. See ${OUTPUT_FILE}." >&2
  exit 1
fi
