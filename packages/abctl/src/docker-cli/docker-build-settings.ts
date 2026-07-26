export type DockerBuildSecret = {
  id: string
  env: string
}

export type DockerBuildSettings = {
  image: string
  context?: string
  dockerfile?: string
  buildArgs?: Record<string, string>
  secrets?: DockerBuildSecret[]
  push?: boolean
  load?: boolean
  platform?: string
  target?: string
  cacheRef?: string
}
