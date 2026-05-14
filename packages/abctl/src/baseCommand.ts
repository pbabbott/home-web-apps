import {Command, Flags} from '@oclif/core'

export abstract class BaseCommand extends Command {
  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to the config file',
      default: './abctl.yml',
      required: false,
    }),
  }
}
