export type SourceConnectionType = 'smb';

export interface ShareMapping {
  pathPrefix: string;
  share: string;
}

/** A source's connection as the API returns it: the password is never included. */
export interface SourceConnection {
  sourceId: string;
  connectionType: SourceConnectionType;
  username: string;
  domain: string | null;
  settings: { shareMappings?: ShareMapping[] };
  hasPassword: true;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}
