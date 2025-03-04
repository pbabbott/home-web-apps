import { AppConfig, ConfigSection } from '@abbottland/yaml-config';

@AppConfig({ appPrefix: 'ABCTL' })
export class AbctlConfig {
  buildPreset = '';

  repository = 'harbor.local.abbottland.io/library';

  @ConfigSection()
  build = new DockerBuildConfig();
}

export class DockerBuildConfig {
  baseImage = '';

  context = '';

  dockerfile = '';

  platform = '';
}
