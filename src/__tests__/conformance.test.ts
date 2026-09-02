/**
 * Conformance of generated decision tables to the obligation set A-J
 * (Doc/Algorithm_Design.md §1.4).
 *
 * The judgements come from the model and the emitted columns only, so this test
 * fails when the generator stops meeting an obligation, whatever its own
 * coverage bookkeeping says.
 */
import { describe, test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkConformance } from './helpers/conformance';

const GRAPH_DIR = join(process.cwd(), 'Verification', 'TDD', 'graphs');
const models = readdirSync(GRAPH_DIR).filter((f) => f.endsWith('.nceg')).sort();

describe('decision table conformance (Algorithm_Design.md §1.4)', () => {
  test.each(models)('%s satisfies every obligation', (name) => {
    const report = checkConformance(join(GRAPH_DIR, name));
    const detail = report.violations.map((v) => `[${v.obligation}] ${v.detail}`).join('\n');
    expect(detail).toBe('');
  });

  test('10_chain_and_or keeps the column that verifies p1 (AND -> OR chain)', () => {
    // p4 := p1 AND p2, p5 := p4 OR p3. The row "p1=F, p2=T => p4=F" can only be
    // verified when p3=F, otherwise the OR covers p4 and the test decides nothing.
    const report = checkConformance(join(GRAPH_DIR, '10_chain_and_or.nceg'));
    expect(report.columns).toBe(4);
    expect(report.discharged).toBe(report.expressions);
  });

  test('17_admission_fee stays at seven test conditions', () => {
    const report = checkConformance(join(GRAPH_DIR, '17_admission_fee.nceg'));
    expect(report.columns).toBe(7);
    expect(report.discharged).toBe(report.expressions);
  });

  test('15_mask demonstrates its MASK constraint', () => {
    const report = checkConformance(join(GRAPH_DIR, '15_mask.nceg'));
    expect(report.violations.filter((v) => v.obligation === 'C')).toEqual([]);
  });

  test('expressions that cannot be discharged are classified, never silently missing', () => {
    for (const name of models) {
      const report = checkConformance(join(GRAPH_DIR, name));
      expect(report.classification.missing, `${name} has unclassified gaps`).toBe(0);
    }
  });
});

describe('unobservable expressions (§13.4)', () => {
  test('a blocked intermediate is reported as unobservable, not as covered or missing', async () => {
    const { parseLogicalDSL } = await import('../services/logicalDslParser');
    const { calcTable } = await import('../services/cegAlgorithm');
    const { generateCoverageTableFromState, getCoverageMarkerDisplay } =
      await import('../services/coverageTableCalculator');
    const { readFileSync } = await import('node:fs');

    // g := x OR c with INCL(c) forcing c true: x reaches no effect, so its rows
    // can be executed but never decided.
    const file = join(GRAPH_DIR, '19_blocked_intermediate.nceg');
    const model = parseLogicalDSL(readFileSync(file, 'utf8')).model!;
    const state = calcTable(model);
    const coverage = generateCoverageTableFromState(model, state);

    const blocked = coverage.rows.filter((r) => r.edge.target === 'x');
    expect(blocked).toHaveLength(3);
    for (const row of blocked) {
      expect(row.isUnobservable).toBe(true);
      expect(row.isCovered).toBe(false);
      expect([...row.coverage.values()].every((m) => m === 'unobservable')).toBe(true);
      expect(row.reason).not.toBe('');
    }

    expect(getCoverageMarkerDisplay('unobservable')).toBe('>');
    expect(coverage.stats.unobservableExpressions).toBe(3);
    expect(coverage.stats.infeasibleExpressions).toBe(2);
    expect(coverage.stats.coveredExpressions).toBe(1);
    // Every expression counts in the denominator (§1.4)
    expect(coverage.stats.totalExpressions).toBe(6);
    expect(coverage.stats.coveragePercent).toBeCloseTo((1 / 6) * 100, 5);
  });
});
