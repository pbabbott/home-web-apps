import { getRequest } from '../../jest.integration.setup';

/**
 * An in-memory stand-in for a Windows drive plus a scripted "agent" that
 * drives the real REST API with it. The real OpenClaw agent reasons about the
 * filesystem; this fixture only encodes a few fixed judgments so the tests can
 * check how the API behaves when an agent works selectively. Nothing here
 * touches the host filesystem.
 */
type Git = {
  remoteUrl: string | null;
  remoteVisibility: 'public' | 'private' | 'none' | 'unknown';
  localStateKnown: boolean;
  uncommittedChanges: boolean | null;
  untrackedFiles: boolean | null;
  unpushedCommits: boolean | null;
  ignoredFilesOfNote: boolean | null;
};

export type FsNode =
  | { kind: 'container'; children: Record<string, FsNode> }
  | { kind: 'system' }
  | { kind: 'personal'; internalDirs: number }
  | { kind: 'unknown'; internalDirs: number }
  | { kind: 'git'; git: Git; internalDirs: number }
  | { kind: 'valuable-file' };

const clean: Git = {
  remoteUrl: 'https://github.com/someone/public-clean',
  remoteVisibility: 'public',
  localStateKnown: true,
  uncommittedChanges: false,
  untrackedFiles: false,
  unpushedCommits: false,
  ignoredFilesOfNote: false,
};

export const FIXTURE: FsNode = {
  kind: 'container',
  children: {
    Windows: { kind: 'system' },
    'Program Files': { kind: 'system' },
    Users: {
      kind: 'container',
      children: {
        You: {
          kind: 'container',
          children: {
            Documents: { kind: 'personal', internalDirs: 12 },
            AppData: { kind: 'system' },
            'taxes-2025.xlsx': { kind: 'valuable-file' },
          },
        },
      },
    },
    code: {
      kind: 'container',
      children: {
        'project-a': {
          kind: 'git',
          internalDirs: 3,
          git: {
            ...clean,
            remoteUrl: 'https://github.com/me/project-a',
            remoteVisibility: 'private',
            uncommittedChanges: true,
          },
        },
        'public-clean': { kind: 'git', internalDirs: 5, git: clean },
        'public-unknown': {
          kind: 'git',
          internalDirs: 2,
          git: {
            ...clean,
            remoteUrl: 'https://github.com/someone/public-unknown',
            localStateKnown: false,
            uncommittedChanges: null,
            untrackedFiles: null,
            unpushedCommits: null,
            ignoredFilesOfNote: null,
          },
        },
      },
    },
    data: {
      kind: 'container',
      children: { mystery: { kind: 'unknown', internalDirs: 4 } },
    },
  },
};

/** Every directory in the fixture, including ones an agent should never visit. */
export const countDirectories = (node: FsNode = FIXTURE): number => {
  switch (node.kind) {
    case 'container':
      return (
        1 +
        Object.values(node.children).reduce(
          (sum, child) => sum + countDirectories(child),
          0,
        )
      );
    case 'system':
      return 1;
    case 'valuable-file':
      return 0;
    default:
      return 1 + node.internalDirs;
  }
};

const lookup = (path: string): FsNode => {
  let node: FsNode = FIXTURE;
  for (const segment of path
    .split('\\')
    .filter((s) => s && !/^[A-Za-z]:$/.test(s))) {
    if (node.kind !== 'container') throw new Error(`no such path ${path}`);
    node = node.children[segment];
    if (!node) throw new Error(`no such path ${path}`);
  }

  return node;
};

const join = (dir: string, name: string) =>
  dir.endsWith('\\') ? `${dir}${name}` : `${dir}\\${name}`;

export const evidence = (overrides: Record<string, unknown> = {}) => ({
  contentKinds: ['other'],
  git: null,
  reproducible: 'unknown',
  sufficientInformation: true,
  observations: [],
  openQuestions: [],
  ...overrides,
});

type InventoryItem = Record<string, unknown>;

/** The fixed judgment the scripted agent applies to one child. */
const judge = (path: string, node: FsNode): InventoryItem | null => {
  switch (node.kind) {
    case 'personal':
      return {
        rootPath: path,
        kind: 'directory',
        summary: 'Personal documents',
        recommendation: 'back_up',
        confidence: 'high',
        reason: 'Documents folder holds unique personal data',
        evidence: evidence({
          contentKinds: ['personal_documents'],
          reproducible: 'no',
          observations: ['Standard Documents folder with user files'],
        }),
      };
    case 'valuable-file':
      return {
        rootPath: path,
        kind: 'file',
        summary: 'Tax spreadsheet',
        recommendation: 'back_up',
        confidence: 'medium',
        reason:
          'A standalone spreadsheet with tax data is unlikely to exist elsewhere',
        evidence: evidence({
          contentKinds: ['personal_documents'],
          reproducible: 'no',
        }),
      };
    case 'unknown':
      return {
        rootPath: path,
        kind: 'directory',
        summary: 'Unfamiliar data directory',
        recommendation: 'needs_review',
        confidence: 'low',
        reason: 'Purpose and replaceability are unclear',
        evidence: evidence({
          sufficientInformation: false,
          openQuestions: [
            'What application writes here?',
            'Is it replaceable?',
          ],
        }),
      };
    case 'git': {
      const { git } = node;
      const localWork =
        git.uncommittedChanges === true ||
        git.untrackedFiles === true ||
        git.unpushedCommits === true;
      const cleanAndKnown = git.localStateKnown && !localWork;
      const recommendation = localWork
        ? 'back_up'
        : cleanAndKnown
          ? 'skip'
          : 'needs_review';

      return {
        rootPath: path,
        kind: 'directory',
        summary: 'Git repository',
        recommendation,
        confidence: recommendation === 'needs_review' ? 'low' : 'high',
        reason: localWork
          ? 'Local work may not exist on the remote'
          : cleanAndKnown
            ? 'Clean checkout of a pushed repository'
            : 'Remote exists but local state could not be checked',
        evidence: evidence({
          contentKinds: ['source_code'],
          git,
          reproducible: cleanAndKnown ? 'yes' : 'unknown',
          sufficientInformation: recommendation !== 'needs_review',
          openQuestions:
            recommendation === 'needs_review'
              ? ['Run git status and compare with the upstream']
              : [],
        }),
      };
    }
    default:
      return null;
  }
};

export type ClaimedItem = { id: string; path: string; claimToken: string };

export type AgentRun = {
  visited: string[];
  proposed: { path: string; recommendation: string }[];
};

/**
 * Drains a job like a selective agent: at each claimed directory it skips
 * system paths (recording why), proposes inventory items for logical backup units
 * without descending into them, and queues only container directories.
 */
export const runSelectiveAgent = async (jobId: string): Promise<AgentRun> => {
  const run: AgentRun = { visited: [], proposed: [] };

  for (;;) {
    const claimed = await getRequest()
      .post(`/discovery-jobs/${jobId}/queue-items/claim`)
      .send({ workerId: 'fixture-agent', leaseSeconds: 300 })
      .expect(200);
    const item = claimed.body.item as ClaimedItem | null;
    if (!item) return run;

    run.visited.push(item.path);
    const node = lookup(item.path);
    const inventoryItems: InventoryItem[] = [];
    const followUps: { path: string; reason: string }[] = [];
    const skipped: { path: string; reason: string }[] = [];

    if (node.kind === 'container') {
      for (const [name, child] of Object.entries(node.children)) {
        const path = join(item.path, name);

        if (child.kind === 'system') {
          skipped.push({ path, reason: 'operating system or generated data' });
        } else if (child.kind === 'container') {
          followUps.push({ path, reason: 'may contain user data' });
        } else {
          inventoryItems.push(judge(path, child) as InventoryItem);
        }
      }
    }

    if (inventoryItems.length > 0) {
      const res = await getRequest()
        .post(`/queue-items/${item.id}/inventory-items`)
        .send({
          claimToken: item.claimToken,
          workerId: 'fixture-agent',
          inventoryItems,
        })
        .expect(200);
      for (const c of res.body) {
        run.proposed.push({
          path: c.rootPath,
          recommendation: c.recommendation,
        });
      }
    }

    await getRequest()
      .post(`/queue-items/${item.id}/complete`)
      .send({
        claimToken: item.claimToken,
        discoveredPaths: followUps,
        summary: `inspected ${item.path}`,
        skipped,
      })
      .expect(200);
  }
};
