import { AppConfig, ConfigSection } from '@abbottland/yaml-config';

@AppConfig({ appPrefix: 'ABCTL' })
export class AbctlConfig {
  buildPreset = '';

  /**
   * Added to the beginning of the image name
   */
  registryWithNamespace = 'harbor.local.abbottland.io/library';

  @ConfigSection()
  build = new DockerBuildConfig();
}

export class DockerBuildConfig {
  /**
   * Corresponds to the docker build arg `BASE_IMAGE`
   */
  baseImage = '';

  /**
   * The repository to push the image to, if not specified, uses the project name
   */
  repository = '';

  /**
   * The tag to use for the image, if not specified, uses the project version
   */
  tag = '';

  context = '';

  dockerfile = '';

  platform = '';

  target = '';
}
