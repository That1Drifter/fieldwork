import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateScenarioYaml, formatErrors } from '@fieldwork/core';
import { listScenarios } from '../src/index';

describe('scenario catalog', () => {
  const scenarios = listScenarios();

  it('has at least one scenario', () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  for (const { id, manifestPath } of scenarios) {
    it(`validates: ${id}`, () => {
      const yaml = readFileSync(manifestPath, 'utf8');
      const result = validateScenarioYaml(yaml);
      if (!result.valid) {
        throw new Error(
          `scenario ${id} failed validation:\n${formatErrors(result.errors)}`,
        );
      }
      expect(result.valid).toBe(true);
    });
  }
});
