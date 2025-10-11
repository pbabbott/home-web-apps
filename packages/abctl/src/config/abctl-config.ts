import { AppConfig, ConfigSection } from '@abbottland/yaml-config';

@AppConfig({ appPrefix: 'ABCTL' })
export class AbctlConfig {
  buildPreset = '';

  /**
   * Added to the beginning of the image name
   */
  registryWithNamespace = 'harbor.local.abbottland.io/library';

  /**
   * Configuration for the docker build
   */
  @ConfigSection()
  build = new DockerBuildConfig();

  /**
   * Configuration for generating an .env file with secrets
   */
  @ConfigSection()
  secrets = new SecretConfig();
}

export class SecretConfig {
  /**
   * Should the secrets be generated into an .env file?
   */
  generateEnv = false;

  /**
   * The file to write the secrets to
   */
  envFile = '';

  /**
   * The file to read the sample secrets from
   */
  envSampleFile = '';

  /**
   * The one password config. Helps determine how to get secrets from 1Password and load them into the .env file
   */
  @ConfigSection()
  onePassword = new OnePasswordConfig();
}

export class OnePasswordConfig {
  /**
   * The vault to get the secrets from
   */
  vault = '';

  /**
   * The items to get from the vault
   */
  items: OnePasswordItemConfig[] = [];
}

export class OnePasswordItemConfig {
  /**
   * The name of the item to get from the vault
   */
  secretName = '';

  /**
   * The key to get from the item
   */
  secretKey = '';

  /**
   * The environment variable name to set the secret to
   */
  envVarName = '';
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

  /** Should --load be set during the build process? */
  load = 'false';
}
