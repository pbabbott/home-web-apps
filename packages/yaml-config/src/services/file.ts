import YAML from 'yaml';
import fs from 'fs';

export function parseYAMLFile<T>(path: string): T {
  const file = fs.readFileSync(path, 'utf8');
  const obj = YAML.parse(file);
  return obj as T;
}

export async function fileExists(path: string) {
  return new Promise((resolve) => {
    try {
      fs.access(path, (err) => {
        if (err) resolve(false);
        else resolve(true);
      });
    } catch {
      return resolve(false);
    }
  });
}
