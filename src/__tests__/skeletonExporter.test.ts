/**
 * Skeleton exporter — integrated (in-memory) golden test.
 *
 * Builds the admission-fee decision table through the real app pipeline
 * (DSL → LogicalModel → optimized DecisionTable) and checks the §8 acceptance
 * criteria, plus the integration-only feature: intermediate definitions and the
 * node legend (expressions/labels are available in the in-memory model).
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseLogicalDSL } from '../services/logicalDslParser';
import {
  generateOptimizedDecisionTableWithState,
  getNodeLabel,
} from '../services/decisionTableCalculator';
import { generateSkeletonPseudoCode } from '../services/skeletonExporter';

const DSL = readFileSync(
  new URL('../../Verification/TDD/graphs/17_admission_fee.nceg', import.meta.url),
  'utf-8',
);

function buildAdmissionFee() {
  const parsed = parseLogicalDSL(DSL);
  if (!parsed.success) throw new Error('admission-fee DSL failed to parse');
  const model = parsed.model;
  const { table } = generateOptimizedDecisionTableWithState(model);
  const nodeLabels = new Map<string, string>();
  for (const [name] of model.nodes) nodeLabels.set(name, getNodeLabel(model, name));
  return { model, table, nodeLabels };
}

describe('skeletonExporter — admission fee (§8 + §11)', () => {
  const { model, table, nodeLabels } = buildAdmissionFee();
  const skeleton = generateSkeletonPseudoCode(table, nodeLabels, model);

  const effectLabels = ['Free', '1200 yen', '1000 yen', '600 yen', '500 yen'];
  // One return line per column: `return <label>      # <effectId> (#<col>)`.
  const returnLines = skeleton.split('\n').filter((l) => /#\s*e\d+\s*\(#\d+\)/.test(l));

  test('#1 every effect appears in a reachable leaf', () => {
    for (const e of effectLabels) {
      expect(skeleton).toContain(`return ${e}`);
    }
  });

  test('#3 deterministic: byte-identical on re-run', () => {
    const again = generateSkeletonPseudoCode(table, nodeLabels, model);
    expect(again).toBe(skeleton);
  });

  test('#4 Free is guarded only by n3/n6/n9 (never tests n1/n2)', () => {
    const freeReturns = returnLines.filter((l) => l.includes('return Free'));
    expect(freeReturns).toHaveLength(3);
    // The three Free returns are each directly under if n3 / n6 / n9.
    expect(skeleton).toMatch(/if n3:[^\n]*\n\s*return Free/);
    expect(skeleton).toMatch(/if n6:[^\n]*\n\s*return Free/);
    expect(skeleton).toMatch(/if n9:[^\n]*\n\s*return Free/);
  });

  test('#5 path count = column count (7 feasible columns)', () => {
    const feasible = table.conditions.filter((c) => !c.excluded).length;
    expect(feasible).toBe(7);
    expect(returnLines).toHaveLength(7);
  });

  test('§11: intermediate definitions emitted from expressions (AND)', () => {
    expect(skeleton).toContain('n9 = n5 AND n7');
    expect(skeleton).toContain('n10 = n5 AND n8');
  });

  test('§11: legend surfaces each cause label', () => {
    expect(skeleton).toContain('n1 = Individual');
    expect(skeleton).toContain('n3 = 65+ years old');
    expect(skeleton).toContain('n8 = Prefecture resident No');
  });

  test('without a model, intermediates stay named (no definitions)', () => {
    const noModel = generateSkeletonPseudoCode(table, nodeLabels);
    expect(noModel).not.toContain('n9 = n5 AND n7');
    expect(noModel).toContain('(intermediate condition)');
  });
});
