import YAML from 'yaml'
import fs from 'fs'

export function parseConfig<T>(path: string): T {
  console.log('🔥')
  const file = fs.readFileSync(path, 'utf8')
  console.log('file', file)
  const obj = YAML.parse(file)

  console.log('obj', obj)
  return obj as T
}
