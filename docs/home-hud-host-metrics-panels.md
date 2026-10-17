# home-hud Host Metrics Panels — Touchpoint Reference

CPU panel on `/infra/hosts` is done (ECharts, per-core lines). Memory, Disk
(root fs used), and Temperature are still placeholders. This doc maps every
file the CPU implementation touched, so the same pattern can be repeated
without re-discovering the plumbing. Read this before implementing a new
panel; don't start from scratch.

## The pattern, end to end

```
Prometheus (query_range)
  → homelab-api: api/prometheus/prometheus-client.ts  (raw HTTP + PromQL)
  → homelab-api: services/host-metrics.ts              (per-host shaping)
  → homelab-api: schemas/hosts.ts + controllers/hosts.ts + server.ts + openapi.ts
  → home-hud: src/app/infra/hosts/lib/homelab-api.ts    (typed fetch)
  → home-hud: src/app/infra/hosts/page.tsx              (server-fetch on host select)
  → home-hud: src/app/infra/hosts/HostsClient.tsx        (threads prop down)
  → home-hud: src/app/infra/hosts/<Metric>Chart.tsx       ('use client' ECharts)
```

One new route per metric: `GET /hosts/:id/metrics/<metric>`. CPU's is
`GET /hosts/:id/metrics/cpu`, query params `rangeSeconds` (default 3600) and
`stepSeconds` (default 30).

## Backend touchpoints (apps/homelab-api)

| File                                      | What CPU added                                                                                                                                                                  | What to add for the next metric                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/prometheus/prometheus-client.ts` | `queryRange()` (generic, already handles any PromQL — reuse as-is), `TimeseriesSample` type, `getNodeCpuSeries(instance, startSec, endSec, stepSec)`                            | A new `getNode<Metric>Series(...)` function next to `getNodeCpuSeries`. Reuse `queryRange` and `NODE_EXPORTER_JOB_MATCH` directly.                      |
| `src/services/host-metrics.ts`            | `getHostCpuSeries(id, { rangeSeconds, stepSeconds })` — looks up host, no-instance → empty series, else calls the client fn and reshapes to `{ instance, stepSeconds, series }` | A sibling `getHost<Metric>Series` in the same file, same shape/error contract (best-effort: Prometheus outage → empty series, never throws into a 500). |
| `src/schemas/hosts.ts`                    | `hostCpuQuerySchema` (`rangeSeconds`/`stepSeconds`, both `z.coerce.number()...default(...)`)                                                                                    | Can likely be reused as-is for any range-based metric — don't duplicate, import the same schema.                                                        |
| `src/controllers/hosts.ts`                | `getHostCpuMetrics` handler — same try/catch/404 shape as `getHost`/`updateHost`                                                                                                | One handler per metric, copy-paste the CPU one and swap the service call.                                                                               |
| `src/server.ts`                           | Route registration: `app.get('/hosts/:id/metrics/cpu', validateParams(hostIdParamsSchema), validateQuery(hostCpuQuerySchema), getHostCpuMetrics)`                               | Same line, new path segment + handler import.                                                                                                           |
| `src/openapi.ts`                          | `hostCpuSeriesSchema` / `hostCpuResponseSchema`, new path entry under `/hosts/{id}/metrics/cpu`                                                                                 | Mirror for the new metric so `GET /docs` stays accurate.                                                                                                |

### PromQL gotcha hit while building CPU — read before writing a new query

The original idle/iowait/steal query from the user had a `sum without (mode)
(rate(...))` step that collapses the `mode` label _within_ each cpu before
the `ignoring(cpu) group_left` join. Dropping that step (to "just add an
instance filter") breaks the join silently: the left side keeps a `mode`
label, the right side never had one, so `group_left` matches nothing and the
query returns `{"result":[]}` with `status: "success"` — no error, just
empty. **Any join-based query (`group_left`/`group_right`/`ignoring`/`on`)
must match label sets exactly, or it silently returns nothing.**

Don't trust a query until you've run it directly against Prometheus:

```bash
curl -s --data-urlencode 'query=<promql>' \
  --data-urlencode "start=$(($(date +%s)-3600))" \
  --data-urlencode "end=$(date +%s)" \
  --data-urlencode 'step=30' \
  'https://prometheus.local.abbottland.io/api/v1/query_range' | python3 -m json.tool
```

Check `data.result` is non-empty and has the labels you expect _before_
wiring it into `homelab-api`.

### Candidate node_exporter metrics for the remaining panels

Not verified against the live Prometheus yet — confirm with the curl
snippet above before coding, the same way the CPU query needed a fix.

- **Memory**: `node_memory_MemTotal_bytes` / `node_memory_MemAvailable_bytes`
  (used = total − available). Single series per host, no label-join needed
  — simpler than CPU.
- **Disk (root fs used)**: `node_filesystem_size_bytes{mountpoint="/", fstype!~"tmpfs|overlay"}`
  minus `node_filesystem_avail_bytes{...}` with the same label filter.
  Check what `fstype` your hosts actually report first.
- **Temperature**: `node_hwmon_temp_celsius`. Depends on the `hwmon`
  collector being enabled on that node-exporter target — may simply not
  exist for some hosts (VMs especially). Treat a Prometheus series with no
  temp data the same as "no instance": empty-state in the chart, not an
  error.

## Frontend touchpoints (apps/home-hud)

| File                                       | What CPU added                                                                                                                                                                                                                          | What to add for the next metric                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/infra/hosts/lib/homelab-api.ts`   | `HostCpuMetrics`/`HostCpuSeries`/`HostCpuSeriesPoint` types, `getHostCpuMetrics(id)` fetch fn (`GET /hosts/:id/metrics/cpu`, `cache: 'no-store'`, 404 → null)                                                                           | Same pattern, new types + fetch fn per metric.                                                                                                                                                                                                                                                                    |
| `src/app/infra/hosts/lib/echarts-theme.ts` | `CPU_LINE_PALETTE` + shared axis/grid/tooltip color constants (`CHART_AXIS_COLOR`, `CHART_SPLIT_LINE_COLOR`, `CHART_TOOLTIP_BG`, `CHART_TOOLTIP_BORDER`, `CHART_TEXT_COLOR`) pulled from `@abbottland/fui-components` tokens            | The shared constants are metric-agnostic — reuse them directly. Only add a new palette array if a metric needs a different color count/scheme (e.g. memory is probably a single line/area, not 4).                                                                                                                |
| `src/app/infra/hosts/CpuChart.tsx`         | `'use client'` component: `echarts.init` in `useEffect`, `ResizeObserver` for resize, `dispose()` on unmount, empty states for `instance === null` / empty series                                                                       | Copy as `<Metric>Chart.tsx`. Keep the init/resize/dispose lifecycle identical — that part isn't CPU-specific. Swap `buildOption()`'s series/axis formatting (e.g. memory might be bytes → GiB, not a 0–100% axis).                                                                                                |
| `src/app/infra/hosts/page.tsx`             | Server-fetches `cpuMetrics` when `selectedHostId` is set, try/catch → null (best-effort, matches `getHosts`'s error handling)                                                                                                           | One more `await getHost<Metric>Metrics(...)` block, one more prop into `HostsClient`.                                                                                                                                                                                                                             |
| `src/app/infra/hosts/HostsClient.tsx`      | `CpuMetricPanel` component (label + status badge header, chart body, `sm:col-span-2` to span both grid columns) replacing the old generic `MetricPanel` CPU card; `cpuMetrics` threaded `HostsClient` → `HostDetail` → `CpuMetricPanel` | Either add a `<Metric>MetricPanel` per metric, or — once 2+ panels are real — consider collapsing them into one parameterized component. The remaining `MetricPanel` (dashed-box placeholder) is still used for whichever of Memory/Disk/Temperature aren't done yet; remove it only once all three are replaced. |

## Exporter types (node_exporter / windows_exporter)

Each host has an `exporterType` (set in the Add/Edit host modal) that picks
which exporter's metric names are queried. homelab-api dispatches through the
`EXPORTERS` registry (`api/prometheus/exporters.ts`); `node-*.ts` and
`windows-exporter.ts` implement the same `ExporterQueries` shape and return
the **same label names** (`cpu`, `device`, `mountpoint`, `component`,
`chip`/`sensor`/`label`) so `services/host-metrics.ts` and the charts never
branch on type.

- **New metric panel:** add the query to `ExporterQueries` and implement it
  for every exporter (the `Record<ExporterType, …>` type enforces this).
- **New exporter:** add the value to `exporterTypeEnum` (+ migration), a
  `<name>-exporter.ts` of queries, an `EXPORTERS` entry, and an option in
  `ExporterSelectField.tsx`.
- windows_exporter has no buffers/cached memory split and thermalzone is
  opt-in, so those panels render partial/empty for Windows hosts by design.

## Known gap, not addressed by CPU work

The host **list** CPU badge (`HostListItem`, left sidebar) is still driven
by `getNodeCpuUsage()` in `prometheus-client.ts` — the original
instant-query, label-collapsed scalar. It works but is a separate code path
from the new range-based per-core chart. Not a blocker for Memory/Disk/Temp,
but don't assume it's "the same query, already correct" if you touch it.

## Verification loop that worked

1. `curl` the raw PromQL against Prometheus directly (command above) —
   confirms the query shape before any TypeScript exists.
2. `pnpm --filter @abbottland/homelab-api dev`, curl
   `GET /hosts/:id/metrics/<metric>` for a real host — confirms the service
   layer/shaping.
3. `pnpm --filter @abbottland/homelab-api build` + `lint` — type/lint clean.
4. `pnpm --filter home-hud dev` (with `HOMELAB_API_URL=http://localhost:4003`),
   curl the `/infra/hosts?...` page HTML to confirm SSR renders the chart
   container and the placeholder text is gone.
5. Screenshot with a headless browser (Playwright; `chromium-cli` wasn't
   available in this sandbox, see `/run` skill's fallback instructions) to
   confirm the chart actually paints client-side and `console --errors` is
   empty.
