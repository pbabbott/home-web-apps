import {initConfig} from '../../config/config-loader.js'
import {dockerBuild} from '../../docker-cli/docker-commands.js'
import {combineBuildConfigs} from '../../build-logic/build-config-merger/build-config-merger.js'
import {makeBuildSettings} from '../../build-logic/docker-build-settings-builder/docker-build-settings-builder.js'
import {getImageWithVersion, resolveBaseImage} from '../../build-logic/image-reference/image-reference.js'
import {getProjectMetadata} from '../../build-logic/project-metadata.js'
import {BaseCommand} from '../../baseCommand.js'

export default class Build extends BaseCommand {
  static args = {}
  static description = 'Build a Docker image for the current project'
  static examples = [
    `<%= config.bin %> <%= command.id %>
build the Docker image for the current project
`,
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)

    console.log('🏎️  Starting docker build process...')

    // Read and combine the config with any presets
    const config = await initConfig(flags.config)
    const combinedBuildConfig = combineBuildConfigs(config)

    // Get metadata regarding the project, dir, and version
    const projectMetadata = getProjectMetadata()

    // Resolve base image from base config if not explicitly set
    if (config.baseConfig && !combinedBuildConfig.baseImage) {
      combinedBuildConfig.baseImage = await resolveBaseImage(config.baseConfig, projectMetadata)
      console.log(`🔗 Resolved base image: ${combinedBuildConfig.baseImage}`)
    }

    // Determine a versioned image name
    const imageWithVersion = getImageWithVersion(projectMetadata, combinedBuildConfig)
    console.log(`🎯 Target image is ${imageWithVersion}`)

    // Finally run docker build making the build settings
    const dockerBuildSettings = makeBuildSettings(imageWithVersion, combinedBuildConfig, projectMetadata)
    await dockerBuild(dockerBuildSettings)
  }
}
