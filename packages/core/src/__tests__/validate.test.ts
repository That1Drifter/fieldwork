import { describe, it, expect } from 'vitest';
import { validateScenario, validateScenarioYaml } from '../validate';

describe('validateScenario', () => {
  it('rejects manifest with missing id', () => {
    const result = validateScenario({
      version: 1,
      tier: 1,
      title: 'Bad manifest',
      world: { company: { name: 'x', industry: 'y' } },
      objectives: [{ id: 'a', desc: 'a' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message?.includes("'id'"))).toBe(true);
  });

  it('accepts a minimal valid manifest', () => {
    const result = validateScenario({
      id: 'demo',
      version: 1,
      tier: 1,
      title: 'Demo',
      world: { company: { name: 'Acme', industry: 'test' } },
      objectives: [{ id: 'obj1', desc: 'do the thing' }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects invalid id characters', () => {
    const result = validateScenario({
      id: 'BadID!',
      version: 1,
      tier: 1,
      title: 'x',
      world: { company: { name: 'x', industry: 'y' } },
      objectives: [{ id: 'a', desc: 'a' }],
    });
    expect(result.valid).toBe(false);
  });

  it('parses and validates YAML', () => {
    const yaml = `
id: yaml-demo
version: 1
tier: 2
title: Yaml Demo
world:
  company:
    name: Acme
    industry: test
objectives:
  - id: obj1
    desc: do the thing
`;
    const result = validateScenarioYaml(yaml);
    expect(result.valid).toBe(true);
  });

  it('reports YAML parse errors', () => {
    const result = validateScenarioYaml('id: [unclosed\n');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/YAML parse error/);
  });
});
