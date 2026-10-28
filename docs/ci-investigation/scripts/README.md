# Prometheus helper scripts (CI investigation)

Read-only helpers used for the hardware analysis. They query `https://prometheus.local.abbottland.io` (no auth) with TLS verification off, and need only Python 3 (run with `python3 -I`).

| File                            | Use                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prom-multiwindow.py`           | `python3 -I prom-multiwindow.py <windows.json> <queries.json>`. Runs each query over every CI window and prints avg / p50 / p90 / max per series. `windows.json` is a list of `[start_epoch, end_epoch]` pairs; `queries.json` maps a name to a PromQL string |
| `queries-host-and-workers.json` | Query set for host CPU, disk, memory, network, pressure (PSI), worker CPU/iowait/steal and runner throttling                                                                                                                                                  |
| `queries-cpu-disk-extra.json`   | Extra queries: worker CPU split, discards, flushes, namespace writes                                                                                                                                                                                          |
| `prom-memory-by-vm.py`          | `python3 -I prom-memory-by-vm.py <windows.json>`. Prints used memory (`MemTotal - MemAvailable`) per VM for 30 days, 7 days and the CI windows                                                                                                                |

Build `windows.json` from `gh run list --workflow ci.yml --json createdAt,updatedAt,databaseId` (use the last hour for runs with re-attempts). The instance list inside `prom-memory-by-vm.py` is hard-coded to the current hosts (`192.168.4.192`, `192.168.5.91`, `192.168.6.24-27`).
