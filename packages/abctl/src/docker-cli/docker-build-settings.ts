export type DockerBuildSettings = {
  image: string;
  context?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
  push?: boolean;
  platform?: string;
  target?: string;
};
