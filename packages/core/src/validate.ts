import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import scenarioSchema from './schema/scenario.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateFn = ajv.compile(scenarioSchema);

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export function validateScenario(manifest: unknown): ValidationResult {
  const valid = validateFn(manifest);
  return { valid: valid as boolean, errors: validateFn.errors ?? [] };
}

export function validateScenarioYaml(yamlSource: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlSource);
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          instancePath: '',
          schemaPath: '',
          keyword: 'yaml',
          params: {},
          message: `YAML parse error: ${(err as Error).message}`,
        } as ErrorObject,
      ],
    };
  }
  return validateScenario(parsed);
}

export function formatErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) return 'no errors';
  return errors
    .map((e) => `  • ${e.instancePath || '<root>'} ${e.message ?? 'invalid'}`)
    .join('\n');
}
