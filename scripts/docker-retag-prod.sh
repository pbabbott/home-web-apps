#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=<merge-commit-sha> RUN_NUMBER=42 bash ./scripts/docker-retag-prod.sh
#   APPS="blog diagram-maker" COMMIT_SHA=<sha> RUN_NUMBER=42 bash ./scripts/docker-retag-prod.sh
#
# Roll back / re-release an older build as a NEW release (gets a newer RUN_NUMBER,
# so Flux selects it): skip the "changed app has an image" check and name the
# source build and PR explicitly.
#   COMMIT_SHA=<main-head> RUN_NUMBER=95 SOURCE_SHA=<old-pr-head-sha> PR_NUMBER=240 \
#     APPS="blog" bash ./scripts/docker-retag-prod.sh
#
# Retags each app's already-published sha-<sha7> image (built by CI for the PR)
# with the production tag, without rebuilding:
#
#   YYYYMMDD-<RUN:5>-<PR:5>-<sha7>      e.g. 20261110-00091-00248-e2ba7c3
#
# - YYYYMMDD is the UTC commit date of COMMIT_SHA, NOT today's date, so re-running
#   an old workflow run reproduces the same tag instead of a newer-sorting one
#   that would roll prod back.
# - RUN:5 is this workflow's run number (monotonic, the real recency key within a
#   day; fields are zero-padded so Flux's alphabetical sort is correct).
# - PR:5 is the merged PR (from the merge commit subject, the squash "(#N)"
#   suffix, or the GitHub API); 00000 for a direct push. Informational only.
# - sha7 is the PR head commit (second parent of the merge commit).
#
# Only apps rebuilt in the PR have a sha-<sha7> image and get a new tag; the
# rest keep their current one (retagging all would restart every workload).
# The script fails if an app whose directory changed has no sha image, so a merge
# that raced ahead of CI cannot silently deploy nothing.
#
# Inputs (env):
#   COMMIT_SHA   required. The commit the workflow ran on (github.sha).
#   RUN_NUMBER   required. github.run_number of the docker-publish workflow.
#   SOURCE_SHA   optional. Override the PR head to retag (re-release); skips the
#                changed-app check.
#   PR_NUMBER    optional. Override the PR number.
#   APPS         optional. Space-separated apps to consider.
#   REGISTRY     optional. Default harbor.local.abbottland.io/library.
#   GH_TOKEN, GITHUB_REPOSITORY  optional. Used only for the API PR lookup fallback.

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"
SOURCE_SHA="${SOURCE_SHA:-}"
PR_NUMBER="${PR_NUMBER:-}"
REGISTRY="${REGISTRY:-harbor.local.abbottland.io/library}"
# The images Flux deploys (one ImagePolicy each in home-kubernetes). Deliberately
# not every published package: node-22-*, playwright-runner and the *-base repos
# are not deployed and use other tag schemes. Keep in sync with home-kubernetes.
APPS="${APPS:-blog diagram-maker fui-components gluetun-sync harbor-cleanup home-hud homelab-api video-api video-worker backup-worker}"

if ! [[ "$RUN_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "RUN_NUMBER must be numeric, got: ${RUN_NUMBER}" >&2
  exit 1
fi
if ! [[ "$COMMIT_SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "COMMIT_SHA must be a hex sha, got: ${COMMIT_SHA}" >&2
  exit 1
fi
if [[ -n "$SOURCE_SHA" && ! "$SOURCE_SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "SOURCE_SHA must be a hex sha, got: ${SOURCE_SHA}" >&2
  exit 1
fi
if [[ -n "$PR_NUMBER" && ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "PR_NUMBER must be numeric, got: ${PR_NUMBER}" >&2
  exit 1
fi
for APP in $APPS; do
  if ! [[ "$APP" =~ ^[a-z0-9-]+$ ]]; then
    echo "Invalid app name: ${APP}" >&2
    exit 1
  fi
done

# ── Source image (PR head) ───────────────────────────────────────────────────
CHECK_CHANGED=true
if [ -n "$SOURCE_SHA" ]; then
  CHECK_CHANGED=false
  echo "Re-release: using SOURCE_SHA ${SOURCE_SHA::7}"
else
  PARENTS=$(git log --pretty=%P -1 "$COMMIT_SHA")
  if [ "$(echo "$PARENTS" | wc -w)" -ge 2 ]; then
    SOURCE_SHA=$(echo "$PARENTS" | awk '{print $2}')
    echo "Merge commit detected; using PR branch head: ${SOURCE_SHA::7}"
  else
    SOURCE_SHA="$COMMIT_SHA"
    echo "No merge parent found; using commit directly: ${SOURCE_SHA::7}"
  fi
fi
SHORT_SHA="${SOURCE_SHA::7}"

# ── PR number ────────────────────────────────────────────────────────────────
if [ -z "$PR_NUMBER" ]; then
  SUBJECT=$(git log -1 --format=%s "$COMMIT_SHA")
  if [[ "$SUBJECT" =~ ^Merge\ pull\ request\ \#([0-9]+) ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
  elif [[ "$SUBJECT" =~ \(\#([0-9]+)\)$ ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
  elif command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    PR_NUMBER=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${COMMIT_SHA}/pulls" --jq '.[0].number // empty' 2>/dev/null || true)
  fi
fi
if [ -z "$PR_NUMBER" ]; then
  echo "No PR found for ${COMMIT_SHA::7}; treating as a direct push (PR 00000)"
  PR_NUMBER=0
fi

# ── Tag ──────────────────────────────────────────────────────────────────────
DATE=$(TZ=UTC git show -s --format=%cd --date=format-local:%Y%m%d "$COMMIT_SHA")
PROD_TAG="${DATE}-$(printf '%05d' "$RUN_NUMBER")-$(printf '%05d' "$PR_NUMBER")-${SHORT_SHA}"
if ! [[ "$PROD_TAG" =~ ^[0-9]{8}-[0-9]{5}-[0-9]{5}-[0-9a-f]{7}$ ]]; then
  echo "Computed tag does not match the production tag shape: ${PROD_TAG}" >&2
  echo "(RUN_NUMBER or PR_NUMBER exceeds 5 digits?)" >&2
  exit 1
fi
echo "Production tag: ${PROD_TAG}"

# ── Changed apps (for the loud-failure check) ────────────────────────────────
CHANGED_FILES=""
if [ "$CHECK_CHANGED" = true ] && git rev-parse -q --verify "${COMMIT_SHA}^1" >/dev/null; then
  CHANGED_FILES=$(git diff --name-only "${COMMIT_SHA}^1" "$COMMIT_SHA")
fi

app_changed() {
  # An app/package whose own directory changed in this merge.
  echo "$CHANGED_FILES" | grep -qE "^(apps|packages)/$1/"
}

RETAGGED=0
MISSING=()
for APP in $APPS; do
  IMAGE_REPO="${REGISTRY}/${APP}"
  if ! docker buildx imagetools inspect "${IMAGE_REPO}:sha-${SHORT_SHA}" > /dev/null 2>&1; then
    if [ "$CHECK_CHANGED" = true ] && app_changed "$APP"; then
      MISSING+=("$APP")
    else
      echo "Skipping ${APP}: no ${IMAGE_REPO}:sha-${SHORT_SHA} image (not rebuilt this PR)"
    fi
    continue
  fi
  echo "Retagging ${IMAGE_REPO}:sha-${SHORT_SHA} → ${IMAGE_REPO}:${PROD_TAG}"
  docker buildx imagetools create \
    --tag "${IMAGE_REPO}:${PROD_TAG}" \
    "${IMAGE_REPO}:sha-${SHORT_SHA}"
  RETAGGED=$((RETAGGED + 1))
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "ERROR: these apps changed but have no sha-${SHORT_SHA} image: ${MISSING[*]}" >&2
  echo "The PR was probably merged before its docker-build finished. Re-run CI on the" >&2
  echo "PR branch, then re-run this workflow." >&2
  exit 1
fi

if [ "$CHECK_CHANGED" = true ] && [ "$RETAGGED" -eq 0 ] && echo "$CHANGED_FILES" | grep -qE '^(apps|packages)/'; then
  echo "ERROR: apps/ or packages/ changed but no image was retagged (no sha-${SHORT_SHA} images found)" >&2
  exit 1
fi

echo "Retagged ${RETAGGED} image(s) as ${PROD_TAG}"
