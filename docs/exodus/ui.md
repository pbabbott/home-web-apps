# Exodus - UI (home-hud)

[← Project Exodus](./README.md)

- **`/exodus/sources`** — table of sources with their linked host, and an Add Source modal. The host is optional.
- **`/exodus/sources/[id]`** — the latest job with queue counts (refreshes itself every 5 seconds while a job is active), Start Job, Mark Complete, Cancel Job (with confirmation), failed directories (with a Retry button only while their job is still active; a finished job's failures say to start a new job), a "Browse inventory" link, and job history.
- **`/exodus/inventory`** — a read-only browser for a source's inventory, under the Exodus nav menu (Sources, Jobs, Inventory) and linked from each source page ("Browse inventory"). A Source selector at the top (`?source=<id>`) picks whose inventory to show; a missing or unknown source falls back to the first one. It starts at the latest job's root and lists a folder's direct children (folders link into themselves, with a breadcrumb trail back up); "Everything beneath it" lists every descendant with full paths, and the Type filter narrows to files or folders. Sorted by path, 100 per page with Next/First page links. All state lives in the URL (`source`, `path`, `recursive`, `type`, `after`), so a view can be bookmarked or shared, and the page is server-rendered with no client-side fetching. Switching source resets the folder to that source's job root.
- **`/exodus/jobs`** — jobs across all sources, filterable by source through a `?source=<id>` URL parameter.
