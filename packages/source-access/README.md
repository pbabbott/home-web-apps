# source-access

The code that talks to a Project Exodus **source** (a Windows machine), shared by `apps/homelab-api` (preview, discovery) and `apps/backup-worker` (the copy engine). Schema, migrations and queries are not here: they stay in `packages/homelab-db`, which this package imports types from.

## What is in it

| Module                     | Purpose                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `connections/types.ts`     | `ConnectionDriver`, `ConnectionTarget`, `ConnectionError` and the result types (`DirEntry`, `TreeEntry`, `FileInfo`).                  |
| `connections/smb.ts`       | The `smbclient` driver: share resolution (`resolveShare`), the child-process plumbing and the driver itself.                           |
| `connections/smb-parse.ts` | Pure parsers for `smbclient` output (`SmbTreeParser` for `recurse ON; ls`, `parseAllinfoOutput`), so they are tested without a source. |
| `connection-target.ts`     | `buildConnectionTarget(connection, host)`: the row and its host to a target, with the password decrypted.                              |
| `secret-box.ts`            | AES-256-GCM encryption of stored passwords with `EXODUS_CREDENTIAL_KEY`.                                                               |
| `windows-path.ts`          | Canonical Windows paths (`normalizeWindowsPath`, `isWithinPath`, ...).                                                                 |
| `testing/fake-driver.ts`   | `FakeDriver`: an in-memory source for tests.                                                                                           |

## The driver

Paths are Windows paths as stored in inventory (`C:\Users\you\a.jpg`). `resolveShare` picks the SMB share from the connection's share mappings (longest prefix wins), else the administrative share (`C$`). A path containing `;`, `"` or a line break is refused (`unsupported_path`): `smbclient` takes its commands as one `;`-separated string.

| Method                                         | What it does                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test`, `stat`, `list`, `open`, `readTail`     | The preview and connection-test calls (unchanged).                                                                                                                                       |
| `listTree(target, path)`                       | One `recurse ON; ls` session as an async iterable of `TreeEntry`, parsed line by line; stop iterating to stop the transfer. A directory that cannot be entered comes as `kind: 'error'`. |
| `allinfo(target, paths)`                       | `FileInfo` (or a `ConnectionError`) for each path, in order. Batches of 100 paths and 64 KB per session; if the number of result blocks is wrong the batch is redone path by path.       |
| `openStream(target, path, { stallTimeoutMs })` | `get ... -` as a stream. No bytes for the timeout kills the child and ends the stream with `ConnectionError('stalled')`; an `AbortSignal` also stops it.                                 |
| `readNamedStream(target, path, name, max)`     | The text of a small alternate stream (`Zone.Identifier`), or null if there is none.                                                                                                      |

`FileInfo` carries the four times (absolute instants), attribute letters and bits, alternate streams and `isReparsePoint` (bit `0x400`).

Things learned against a real source (details in the [backup plan, section 10](../../docs/exodus/backup-design/plan.md#10-spike-results)):

- Every child runs with `TZ=UTC`, so `allinfo` times are absolute. A different zone in the output is refused instead of silently shifted.
- `get ... -` prints its errors on **stdout**, in the middle of the data, and exits 1. `openStream` therefore decides by the exit code; bytes read before a failure are not the file. A stream can also end early with exit 0, so compare the byte count with the size.
- `ls` shows no junctions and cannot flag reparse points; use `allinfo`.
- The account may be denied `C$`; a mapping to a plain share (`C:\` to `C`) is needed.

## Tests

`pnpm test:unit`. The parsers are tested on captured `smbclient` output, the driver with a fake `smbclient` script first on `PATH` (stalls, aborts, exit codes), and `FakeDriver` has its own suite. `FakeDriver` supports files with content, times, attributes and streams; directories, unlistable directories and junctions (listed or hidden); faults on read (`short`, `error`, `stall`, `unreachable`, optionally a number of times); an `unreachable` switch; and a call log. Like the real source, reading a file moves its access time in the fake.

Build with `pnpm build` after changes: other packages load `dist/`.
