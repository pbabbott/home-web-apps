# 2026-05-14 — Gluetun Sync Integration Tests Fix

## Branch

`new-comp-lib`

## Problem

`integration-tests` CI job failing on `@abbottland/gluetun-sync`. `sync.integration.test.ts` reporting:

```
SyntaxError: Unexpected token 'U', "Unauthorized" is not valid JSON
```

Two tests failing:
- `sync › do sync › should return 200 for POST /sync` — got 502
- `sync › do sync › should return a sensible response for GET /status` — `mostRecentAttemptSuccessful` was false

## Root Causes (3 separate upstream breaking changes)

### 1. gluetun control server added role-based auth

Recent gluetun image added `HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE={}` as default — empty role means all unauthenticated requests return 401. The auth config file (`/gluetun/auth/config.toml`) didn't exist, so the container started but blocked all API calls.

**Fix:** Added `HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE={"auth":"none"}` to gluetun service in `docker-compose.yaml`. The TOML config format accepts `[[roles]]` with `name` and `apikey` fields, but for a local test dependency, open access is appropriate.

### 2. gluetun deprecated `/v1/openvpn/portforwarded`

Endpoint moved to `/v1/portforward` (old URL returns 301 redirect). The `response.json()` call on a redirect body caused a JSON parse error. Also, `path.join('http://localhost:8000', '/v1/...')` corrupts the URL to `http:/localhost:8000/...` (normalizes double slash) — happens to work with Node.js undici but is technically wrong.

**Fix (`src/api/gluetun/gluetun.ts`):**
- Switch to `/v1/portforward`
- Template literal URL instead of `path.join`
- Add `response.ok` guard before `response.json()`

### 3. qBittorrent 5.x API changes

Two changes in qBittorrent 5.x (linuxserver image `5.2.0`):

1. Login endpoint now returns **204** on success (not 200) — code was checking `!== 200`, so every login was treated as failure
2. Session cookie renamed from `SID` to `QBT_SID_<port>` (e.g. `QBT_SID_8080`) — code was extracting just the token value and rebuilding the cookie as `SID=<token>`, which qBittorrent no longer recognizes

**Fix (`src/api/qbittorrent/index.ts`):**
- Login check: `!== 200` → `!response.ok`
- Cookie: return and forward the full `name=value` string (`QBT_SID_8080=token`) instead of splitting and reconstructing as `SID=token`

## Image Pinning

Both images were `latest` — pinned to avoid recurrence:

- `qmcgaw/gluetun:latest` → `qmcgaw/gluetun@sha256:bd84f4f090ca61170c8329a72d4f451255b01f6489486a621bfcb89749fb80ab` (no semver tag available; built from commit `cd19093`, 2026-05-12)
- `lscr.io/linuxserver/qbittorrent:latest` → `lscr.io/linuxserver/qbittorrent:5.2.0`

## Investigation Notes

- gluetun auth TOML strict mode rejects unknown fields — discovered valid fields are `name` and `apikey` (not `auth`, `routes`, or `[default]` sections)
- `HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE` JSON: `{"routes":["all"]}` panics, `{"auth":"none"}` works
- gluetun has no published semver in its Docker image labels; version API returns `{"version":"latest",...}`

## Commit

`8dd6bc7` — `fix(gluetun-sync): update API clients for gluetun and qBittorrent breaking changes`

## Test Result

All 4 integration tests passing locally after fixes.
