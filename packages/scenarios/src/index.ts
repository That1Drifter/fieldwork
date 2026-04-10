import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_ROOT = join(here, '..');

export interface CatalogEntry {
  id: string;
  manifestPath: string;
}

export function listScenarios(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const dir of readdirSync(CATALOG_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    if (dir.name === 'src' || dir.name === '__tests__' || dir.name === 'node_modules')
      continue;
    const manifestPath = join(CATALOG_ROOT, dir.name, 'manifest.yaml');
    if (existsSync(manifestPath)) {
      entries.push({ id: dir.name, manifestPath });
    }
  }
  return entries;
}

export function loadScenario(id: string): unknown {
  const manifestPath = join(CATALOG_ROOT, id, 'manifest.yaml');
  if (!existsSync(manifestPath)) {
    throw new Error(`scenario not found: ${id}`);
  }
  return parseYaml(readFileSync(manifestPath, 'utf8'));
}
