import { RequestThrottler } from '../throttle.js';

export type PullRequestState = 'open' | 'closed';

export interface PullRequest {
  number: number;
  state: PullRequestState;
  headSha: string;
}

export class GitHubClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly authHeader: string;
  private readonly repoPath: string;
  private readonly throttler = new RequestThrottler(200);

  constructor(token: string, owner: string, repo: string) {
    this.authHeader = `Bearer ${token}`;
    this.repoPath = `${owner}/${repo}`;
  }

  async getPullRequest(prNumber: number): Promise<PullRequest | null> {
    const url = `${this.baseUrl}/repos/${this.repoPath}/pulls/${prNumber}`;
    await this.throttler.wait();
    const res = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.status === 404) return null;
    if (!res.ok)
      throw new Error(
        `GitHub getPullRequest failed: ${res.status} ${await res.text()}`,
      );

    const data = (await res.json()) as {
      number: number;
      state: string;
      head: { sha: string };
    };
    return {
      number: data.number,
      state: data.state as PullRequestState,
      headSha: data.head.sha,
    };
  }

  async listOpenPullRequests(): Promise<PullRequest[]> {
    const results: PullRequest[] = [];
    let page = 1;

    while (true) {
      const url = `${this.baseUrl}/repos/${this.repoPath}/pulls?state=open&per_page=100&page=${page}`;
      await this.throttler.wait();
      const res = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!res.ok)
        throw new Error(
          `GitHub listOpenPullRequests failed: ${res.status} ${await res.text()}`,
        );

      const data = (await res.json()) as Array<{
        number: number;
        state: string;
        head: { sha: string };
      }>;
      results.push(
        ...data.map((pr) => ({
          number: pr.number,
          state: pr.state as PullRequestState,
          headSha: pr.head.sha,
        })),
      );

      if (data.length < 100) break;
      page++;
    }

    return results;
  }
}
