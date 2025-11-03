export default {
  bin: 'abctl',
  commands: './dist/commands',
  dirname: 'abctl',
  plugins: ['@oclif/plugin-help'],
  topics: {
    docker: {
      description: 'Docker build and publish commands',
    },
    secrets: {
      description: 'Secrets management commands',
    },
  },
  topicSeparator: ' ',
}
