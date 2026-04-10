import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateScenarioYaml, formatErrors } from '@fieldwork/core';

export function validateCommand(path: string): void {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    console.error(`error: file not found: ${abs}`);
    process.exit(2);
  }
  const yaml = readFileSync(abs, 'utf8');
  const result = validateScenarioYaml(yaml);
  if (result.valid) {
    console.log(`ok: ${path}`);
    return;
  }
  console.error(`invalid: ${path}`);
  console.error(formatErrors(result.errors));
  process.exit(1);
}
