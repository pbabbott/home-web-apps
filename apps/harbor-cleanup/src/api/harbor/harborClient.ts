export interface HarborTag {
  name: string;
}

export interface HarborArtifact {
  digest: string;
  tags: HarborTag[];
}

export class HarborClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(host: string, username: string, password: string) {
    this.baseUrl = `https://${host}/api/v2.0`;
    this.authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  async listArtifacts(
    project: string,
    repository: string,
  ): Promise<HarborArtifact[]> {
    const results: HarborArtifact[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const url = `${this.baseUrl}/projects/${project}/repositories/${encodeURIComponent(repository)}/artifacts?with_tag=true&page_size=${pageSize}&page=${page}`;
      const res = await fetch(url, {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(
          `Harbor listArtifacts failed: ${res.status} ${await res.text()}`,
        );
      }

      const page_results = (await res.json()) as HarborArtifact[];
      results.push(...page_results);

      if (page_results.length < pageSize) break;
      page++;
    }

    return results;
  }

  async deleteTag(
    project: string,
    repository: string,
    digest: string,
    tag: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/projects/${project}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(digest)}/tags/${encodeURIComponent(tag)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Harbor deleteTag failed for ${tag}: ${res.status} ${await res.text()}`,
      );
    }
  }
}
