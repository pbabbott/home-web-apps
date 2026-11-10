#!/usr/bin/env python3
"""Summarise one ci.yml run (attempt) into a row for the CI run log.

Usage: python3 -I collect.py [RUN_ID] [--attempt N] [--branch BRANCH] [--no-prom]

With no RUN_ID it uses the newest ci.yml run on the current (or given) branch.
Prints one JSON object: "row" is the 16 values for the Runs tab, in column order;
"details" holds per-job data for the notes. Prometheus is best effort: if it is
unreachable the node-metric columns stay empty.
"""
import argparse
import json
import ssl
import statistics
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime

PROM = "https://prometheus.local.abbottland.io/api/v1/"
# Gen3 CI runner pods are pinned to k3s workers 1 and 2 (192.168.6.42/.43). The
# gen3 Prometheus scrapes their node-exporters; it does not scrape the Proxmox
# host (hogwarts) underneath them.
WORKERS = "instance=~'192.168.6.4[23]:9100'"
LOAD1 = f"node_load1{{{WORKERS}}}"
MEM_AVAIL_GIB = f"node_memory_MemAvailable_bytes{{{WORKERS}}}/1024/1024/1024"
MEM_PSI = f"rate(node_pressure_memory_waiting_seconds_total{{{WORKERS}}}[2m])*100"
FIRST_STAGE = ("lint", "format", "docker-build-plan", "unit-test-plan", "integration-test-plan")
TIMEOUT_STEP_S = 1195  # docker-build publish step has timeout-minutes: 20


def sh(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def gh_json(path, jq=None):
    cmd = ["gh", "api", path]
    if jq:
        cmd += ["--paginate", "--jq", jq]
    out = sh(*cmd)
    if jq:
        return [json.loads(line) for line in out.splitlines() if line.strip()]
    return json.loads(out)


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def secs(a, b):
    a, b = ts(a), ts(b)
    return round((b - a).total_seconds()) if a and b else None


def prom_stat(query, start, end, fn=statistics.mean):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = PROM + "query_range?" + urllib.parse.urlencode(
        {"query": query, "start": start, "end": end, "step": 60}
    )
    try:
        res = json.load(urllib.request.urlopen(url, context=ctx, timeout=30))["data"]["result"]
    except Exception:
        return None
    vals = [float(v[1]) for s in res for v in s["values"] if v[1] not in ("NaN", "+Inf")]
    return round(fn(vals), 1) if vals else None


def peak_concurrency(jobs):
    events = []
    for j in jobs:
        if j.get("started_at") and j.get("completed_at"):
            events.append((ts(j["started_at"]), 1))
            events.append((ts(j["completed_at"]), -1))
    cur = peak = 0
    for _, d in sorted(events):
        cur += d
        peak = max(peak, cur)
    return peak


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run_id", nargs="?")
    ap.add_argument("--attempt", type=int)
    ap.add_argument("--branch")
    ap.add_argument("--no-prom", action="store_true")
    a = ap.parse_args()

    repo = sh("gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner").strip()
    run_id = a.run_id
    if not run_id:
        branch = a.branch or sh("git", "branch", "--show-current").strip()
        runs = json.loads(sh("gh", "run", "list", "--workflow", "ci.yml", "--branch", branch,
                             "--limit", "1", "--json", "databaseId"))
        if not runs:
            sys.exit(f"no ci.yml runs found on branch {branch}")
        run_id = str(runs[0]["databaseId"])

    run = gh_json(f"repos/{repo}/actions/runs/{run_id}")
    attempt = a.attempt or run["run_attempt"]
    run = gh_json(f"repos/{repo}/actions/runs/{run_id}/attempts/{attempt}")
    jobs = gh_json(f"repos/{repo}/actions/runs/{run_id}/attempts/{attempt}/jobs", ".jobs[]")

    jobs = [j for j in jobs if j["conclusion"] != "skipped"]
    ended = [j["completed_at"] for j in jobs if j.get("completed_at")]
    end = max(ended) if ended else run["updated_at"]
    wall_min = round(secs(run["run_started_at"], end) / 60, 1)

    per_job, timeouts, failed = {}, [], []
    for j in jobs:
        dur = secs(j.get("started_at"), j.get("completed_at"))
        per_job[j["name"]] = dur
        if j["conclusion"] in ("failure", "cancelled", "timed_out"):
            failed.append(j["name"])
            for s in j.get("steps", []):
                sd = secs(s.get("started_at"), s.get("completed_at"))
                if s["conclusion"] in ("failure", "cancelled") and sd and sd >= TIMEOUT_STEP_S:
                    timeouts.append(f'{j["name"]} / {s["name"]}')

    started = ts(run["run_started_at"])
    active = [j for j in jobs if not (j.get("completed_at") and ts(j["completed_at"]) < started)]
    carried_over = len(jobs) - len(active)

    fs = [per_job[j["name"]] for j in active if j["name"] in FIRST_STAGE and per_job.get(j["name"]) is not None]
    first_stage = f"{min(fs)}-{max(fs)}" if fs else ""

    def build(app):
        j = next((x for x in active if x["name"] == f"docker-build ({app})"), None)
        if not j:
            return ""  # not run in this attempt (skipped or carried over)
        d = per_job[j["name"]]
        return f"timeout at {d}" if j["name"] in " ".join(timeouts) else (d if d is not None else "")

    load = mem_min = psi = None
    if not a.no_prom:
        s, e = int(ts(run["run_started_at"]).timestamp()), int(ts(end).timestamp())
        load = prom_stat(LOAD1, s, e)
        mem_min = prom_stat(MEM_AVAIL_GIB, s, e, min)
        psi = prom_stat(MEM_PSI, s, e)

    outcome = run["conclusion"] or run["status"]
    if failed:
        outcome += f' ({len(failed)} failed: {", ".join(failed[:4])}{"..." if len(failed) > 4 else ""})'
    if timeouts:
        outcome += f' [20-min timeouts: {len(timeouts)}]'

    row = [
        "done",
        run["run_started_at"][:10],
        f'{run_id} (attempt {attempt})',
        run["head_sha"][:7],
        "",  # single change under test: filled in by the skill
        "",  # expected result: filled in by the skill
        wall_min,
        first_stage,
        build("blog"),
        build("home-hud"),
        load if load is not None else "",
        mem_min if mem_min is not None else "",
        peak_concurrency(active),
        outcome,
        "",  # verdict / notes: filled in by the skill
        run["html_url"],
    ]
    print(json.dumps({
        "row": row,
        "details": {
            "branch": run["head_branch"],
            "title": run["display_title"],
            "event": run["event"],
            "jobs_seconds": per_job,
            "failed_jobs": failed,
            "timeouts": timeouts,
            "workers_mean_memory_psi_waiting_pct": psi,
            "jobs_total": len(jobs),
            "jobs_carried_over_from_earlier_attempts": carried_over,
        },
    }, indent=2))


if __name__ == "__main__":
    main()
