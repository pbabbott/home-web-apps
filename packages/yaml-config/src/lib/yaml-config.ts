import YAML from 'yaml'
import fs from 'fs'

export function parseConfig<T>(path: string): T {
  const file = fs.readFileSync(path, 'utf8')
  const obj = YAML.parse(file)
  return obj as T
}
