import { HarborClient } from '../api/harbor/harborClient';
import { GitHubClient } from '../api/github/githubClient';
import { KubernetesClient } from '../api/kubernetes/kubernetesClient';
import { catalogTags, sortProdTagsDesc } from './tagParser';
import type { PrTag } from './tagParser';
import { config } from '../config';

export interface RepositoryCleanupResult {
  repository: string;
  deleted: string[];
  kept: string[];
  skippedDeployed: string[];
  errors: string[];
  durationMs: number;
}

export interface CleanupResult {
  /** True when CLEANUP_DRY_RUN is set: `deleted` lists tags that WOULD be deleted. */
  dryRun: boolean;
  repositories: RepositoryCleanupResult[];
  totalDeleted: number;
  totalErrors: number;
  durationMs: number;
}

const log = (repo: string, msg: string) =>
  console.log(`[cleanup][${repo}] ${msg}`);

async function cleanupRepository(
  repo: string,
  harbor: HarborClient,
  github: GitHubClient,
  deployedTags: Set<string>,
): Promise<RepositoryCleanupResult> {
  const start = Date.now();
  const result: RepositoryCleanupResult = {
    repository: repo,
    deleted: [],
    kept: [],
    skippedDeployed: [],
    errors: [],
    durationMs: 0,
  };

  log(repo, 'Fetching artifacts from Harbor...');
  const artifacts = await harbor.listArtifacts('library', repo);
  log(repo, `Found ${artifacts.length} artifact(s) with tags`);

  const catalog = catalogTags(artifacts);
  log(
    repo,
    `Tags: ${catalog.sha.length} sha, ${catalog.pr.length} pr, ${catalog.prMoving.length} pr-moving, ${catalog.prod.length} prod, ${catalog.floating.length} floating, ${catalog.legacy.length} legacy`,
  );

  // ── Collect safe sha7 values that must never be deleted ───────────────────
  const openPrs = await github.listOpenPullRequests();
  const openPrSha7s = new Set(openPrs.map((pr) => pr.headSha.slice(0, 7)));
  log(
    repo,
    `Open PRs: ${openPrs.length} (head sha7s: ${[...openPrSha7s].join(', ') || 'none'})`,
  );

  const prodSha7s = new Set(catalog.prod.map((t) => t.sha7));

  const safeToDelete = (tag: string): boolean => {
    if (deployedTags.has(tag)) {
      log(repo, `  SKIP (deployed in cluster): ${tag}`);
      result.skippedDeployed.push(tag);
      return false;
    }
    return true;
  };

  const deleteTag = async (tag: string, digest: string) => {
    if (config.dryRun) {
      log(repo, `  DRY RUN, would delete: ${tag}`);
      result.deleted.push(tag);
      return;
    }
    try {
      await harbor.deleteTag('library', repo, digest, tag);
      log(repo, `  DELETED: ${tag}`);
      result.deleted.push(tag);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(repo, `  ERROR deleting ${tag}: ${msg}`);
      result.errors.push(`${tag}: ${msg}`);
    }
  };

  // ── 1. Legacy semver tags ─────────────────────────────────────────────────
  log(repo, `Processing ${catalog.legacy.length} legacy tag(s)...`);
  for (const t of catalog.legacy) {
    if (safeToDelete(t.tag)) {
      log(repo, `  Queued legacy delete: ${t.tag}`);
      await deleteTag(t.tag, t.digest);
    }
  }

  // ── 2. PR tags (backwards-compat: pr-<N>-<sha7> format) ──────────────────
  log(repo, `Processing ${catalog.pr.length} pr tag(s)...`);
  const prGroups = new Map<number, PrTag[]>();
  for (const t of catalog.pr) {
    const group = prGroups.get(t.prNumber) ?? [];
    group.push(t);
    prGroups.set(t.prNumber, group);
  }

  for (const [prNumber, tags] of prGroups) {
    const pr = await github.getPullRequest(prNumber);

    if (!pr || pr.state === 'closed') {
      log(repo, `  PR #${prNumber} is closed — deleting ${tags.length} tag(s)`);
      for (const t of tags) {
        if (safeToDelete(t.tag)) await deleteTag(t.tag, t.digest);
      }
    } else {
      const currentSha7 = pr.headSha.slice(0, 7);
      for (const t of tags) {
        if (t.sha7 === currentSha7) {
          log(repo, `  KEEP (current head of open PR #${prNumber}): ${t.tag}`);
          result.kept.push(t.tag);
        } else {
          log(
            repo,
            `  PR #${prNumber} open but stale sha — deleting: ${t.tag}`,
          );
          if (safeToDelete(t.tag)) await deleteTag(t.tag, t.digest);
        }
      }
    }
  }

  // ── 2b. Moving PR tags (pr-<N>): keep while the PR is open ───────────────
  log(repo, `Processing ${catalog.prMoving.length} moving pr tag(s)...`);
  for (const t of catalog.prMoving) {
    const pr = await github.getPullRequest(t.prNumber);
    if (!pr || pr.state === 'closed') {
      log(repo, `  PR #${t.prNumber} is closed, deleting moving tag: ${t.tag}`);
      if (safeToDelete(t.tag)) await deleteTag(t.tag, t.digest);
    } else {
      log(repo, `  KEEP (open PR #${t.prNumber}): ${t.tag}`);
      result.kept.push(t.tag);
    }
  }

  // ── 2c. Floating tags (latest) are never deleted ─────────────────────────
  for (const t of catalog.floating) {
    log(repo, `  KEEP (floating tag): ${t.tag}`);
    result.kept.push(t.tag);
  }

  // ── 3. SHA tags ───────────────────────────────────────────────────────────
  log(repo, `Processing ${catalog.sha.length} sha tag(s)...`);
  for (const t of catalog.sha) {
    const referencedByOpenPr = openPrSha7s.has(t.sha7);
    const referencedByProd = prodSha7s.has(t.sha7);

    if (referencedByOpenPr) {
      log(repo, `  KEEP (open PR head): ${t.tag}`);
      result.kept.push(t.tag);
    } else if (referencedByProd) {
      log(repo, `  KEEP (referenced by prod tag): ${t.tag}`);
      result.kept.push(t.tag);
    } else {
      if (safeToDelete(t.tag)) await deleteTag(t.tag, t.digest);
    }
  }

  // ── 4. Production tags — keep most recent N, protect deployed ─────────────
  log(
    repo,
    `Processing ${catalog.prod.length} prod tag(s), keeping ${config.prodKeepCount}...`,
  );
  const sortedProd = sortProdTagsDesc(catalog.prod);
  let kept = 0;

  for (const t of sortedProd) {
    if (deployedTags.has(t.tag)) {
      log(repo, `  KEEP (deployed in cluster): ${t.tag}`);
      result.skippedDeployed.push(t.tag);
      kept++;
      continue;
    }
    if (kept < config.prodKeepCount) {
      log(
        repo,
        `  KEEP (within retention window ${kept + 1}/${config.prodKeepCount}): ${t.tag}`,
      );
      result.kept.push(t.tag);
      kept++;
    } else {
      await deleteTag(t.tag, t.digest);
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}

export async function runCleanup(): Promise<CleanupResult> {
  const start = Date.now();
  console.log('[cleanup] Starting cleanup run');

  const harbor = new HarborClient(
    config.harbor.host,
    config.harbor.username,
    config.harbor.password,
  );
  const github = new GitHubClient(
    config.gitHub.token,
    config.gitHub.owner,
    config.gitHub.repo,
  );
  const k8s = new KubernetesClient();

  // Throws if the cluster can't be read: with no deployed-tag list we must not
  // delete anything, so the whole run fails instead of silently unprotecting.
  const deployedTags = await k8s.getDeployedImageTags(config.harbor.host);
  if (config.dryRun) console.log('[cleanup] DRY RUN: no tags will be deleted');

  const repos = config.cleanupRepositories
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  const results: RepositoryCleanupResult[] = [];

  for (const repo of repos) {
    console.log(`[cleanup] Processing repository: ${repo}`);
    try {
      const result = await cleanupRepository(
        repo,
        harbor,
        github,
        deployedTags,
      );
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cleanup] Fatal error for repository ${repo}: ${msg}`);
      results.push({
        repository: repo,
        deleted: [],
        kept: [],
        skippedDeployed: [],
        errors: [msg],
        durationMs: 0,
      });
    }
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const durationMs = Date.now() - start;

  console.log(
    `[cleanup] Done. Deleted ${totalDeleted} tag(s), ${totalErrors} error(s) in ${durationMs}ms`,
  );
  return {
    dryRun: config.dryRun,
    repositories: results,
    totalDeleted,
    totalErrors,
    durationMs,
  };
}
