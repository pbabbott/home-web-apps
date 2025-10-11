import { AbctlConfig, DockerBuildConfig } from '../../config/abctl-config';
import { getBuildConfigFromPresetName } from '../build-presets';

export const combineBuildConfigs = (config: AbctlConfig): DockerBuildConfig => {
  // Get a build config from the user and the preset
  const buildPreset = config.buildPreset;
  const presetBuildConfig = getBuildConfigFromPresetName(buildPreset);
  const userBuildConfig = config.build;
  const buildConfig = getMergedBuildConfig(userBuildConfig, presetBuildConfig);

  return buildConfig;
  // // Use the build config to make docker build settings
  // return makeBuildSettings(imageWithVersion, buildConfig, projectMetadata);
};

export const getMergedBuildConfig = (
  userBuildConfig: DockerBuildConfig,
  presetBuildConfig: DockerBuildConfig,
) => {
  const result = new DockerBuildConfig();
  Object.entries(userBuildConfig).forEach(([k, value]) => {
    const key = k as keyof DockerBuildConfig;
    // If a user specified anything other than '', then use it to override the preset values
    result[key] = value === '' ? presetBuildConfig[key] : value;
  });
  return result;
};
