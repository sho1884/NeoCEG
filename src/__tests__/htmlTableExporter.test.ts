/**
 * Tests for HTML Table Export Service
 */

import { describe, it, expect } from 'vitest';
import { generateDecisionTableHTML, generateCoverageTableHTML } from '../services/htmlTableExporter';
import type { DecisionTable, TestCondition } from '../types/decisionTable';
import type { CoverageTable, CoverageMarker } from '../types/coverageTable';

// =============================================================================
// Test Data Helpers
// =============================================================================

function makeCondition(id: number, values: Record<string, 'T' | 'F' | 't' | 'f' | 'M' | 'I'>): TestCondition {
  return {
    id,
    values: new Map(Object.entries(values)),
    excluded: false,
  };
}

function makeDecisionTable(causeIds: string[], effectIds: string[], intermediateIds: string[] = []): DecisionTable {
  return {
    causeIds,
    effectIds,
    intermediateIds,
    conditions: [],
    constraints: [],
    stats: {
      totalConditions: 0,
      feasibleConditions: 0,
      infeasibleCount: 0,
      weakCount: 0,
      untestableCount: 0,
    },
  };
}

// =============================================================================
// Decision Table HTML Tests
// =============================================================================

describe('generateDecisionTableHTML', () => {
  it('should generate valid HTML table with correct structure', () => {
    const table = makeDecisionTable(['c1', 'c2'], ['e1']);
    const conditions = [
      makeCondition(0, { c1: 'T', c2: 'T', e1: 't' }),
      makeCondition(1, { c1: 'T', c2: 'F', e1: 'f' }),
    ];
    const nodeLabels = new Map([['c1', 'Valid user'], ['c2', 'Password OK'], ['e1', 'Login success']]);
    const observableFlags = new Map([['c1', true], ['c2', true], ['e1', true]]);

    const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, ['c1', 'c2'], [], ['e1']);

    // Should be a valid table
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
    expect(html).toContain('border-collapse:collapse');

    // Should contain section headers
    expect(html).toContain('Cause');
    expect(html).toContain('Effect');

    // Should contain section header colors
    expect(html).toContain('#1976d2'); // Cause header blue
    expect(html).toContain('#7b1fa2'); // Effect header purple

    // Should contain node labels
    expect(html).toContain('Valid user');
    expect(html).toContain('Password OK');
    expect(html).toContain('Login success');

    // Should contain column headers
    expect(html).toContain('#1');
    expect(html).toContain('#2');
  });

  it('should apply correct colors for truth values', () => {
    const table = makeDecisionTable(['c1'], ['e1']);
    const conditions = [
      makeCondition(0, { c1: 'T', e1: 't' }),
      makeCondition(1, { c1: 'F', e1: 'f' }),
    ];
    const nodeLabels = new Map([['c1', 'Cause'], ['e1', 'Effect']]);
    const observableFlags = new Map<string, boolean>();

    const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, ['c1'], [], ['e1']);

    // T value: green background
    expect(html).toContain('#c8e6c9'); // T bg
    expect(html).toContain('#2e7d32'); // T text

    // F value: red background
    expect(html).toContain('#ffcdd2'); // F bg
    expect(html).toContain('#c62828'); // F text

    // t value: light green
    expect(html).toContain('#e8f5e9'); // t bg

    // f value: light red
    expect(html).toContain('#ffebee'); // f bg
  });

  it('should include intermediate section with correct color', () => {
    const table = makeDecisionTable(['c1'], ['e1'], ['i1']);
    const conditions = [makeCondition(0, { c1: 'T', i1: 't', e1: 't' })];
    const nodeLabels = new Map([['c1', 'C'], ['i1', 'I'], ['e1', 'E']]);
    const observableFlags = new Map<string, boolean>();

    const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, ['c1'], ['i1'], ['e1']);

    expect(html).toContain('#3949ab'); // Intermediate header indigo
    expect(html).toContain('#e8eaf6'); // Intermediate row bg
  });

  it('should mark non-observable nodes', () => {
    const table = makeDecisionTable(['c1'], ['e1'], ['i1']);
    const conditions = [makeCondition(0, { c1: 'T', i1: 't', e1: 't' })];
    const nodeLabels = new Map([['c1', 'C'], ['i1', 'Hidden'], ['e1', 'E']]);
    const observableFlags = new Map([['c1', true], ['i1', false], ['e1', true]]);

    const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, ['c1'], ['i1'], ['e1']);

    // Non-observable intermediate should have marker
    expect(html).toContain('Hidden *');
  });

  it('should handle empty sections gracefully', () => {
    const table = makeDecisionTable(['c1'], ['e1']);
    const conditions = [makeCondition(0, { c1: 'T', e1: 't' })];
    const nodeLabels = new Map([['c1', 'C'], ['e1', 'E']]);
    const observableFlags = new Map<string, boolean>();

    const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, ['c1'], [], ['e1']);

    // No intermediate section
    expect(html).not.toContain('Intermediate');
  });
});

// =============================================================================
// Coverage Table HTML Tests
// =============================================================================

describe('generateCoverageTableHTML', () => {
  it('should generate valid HTML table', () => {
    const coverageMap = new Map<number, CoverageMarker>([[0, 'adopted'], [1, 'not_covered']]);
    const requiredValues = new Map([['c1', 'T' as const], ['e1', 't' as const]]);

    const table: CoverageTable = {
      rows: [{
        expressionIndex: 1,
        edge: { source: 'c1', target: 'e1', negated: false, label: 'c1→e1', type: 'logical' },
        requiredValues,
        coverage: coverageMap,
        isCovered: true,
        isInfeasible: false,
        isUntestable: false,
        reason: '',
      }],
      nodeNames: ['c1', 'e1'],
      nodeLabels: new Map([['c1', 'Cause 1'], ['e1', 'Effect 1']]),
      conditionIds: [0, 1],
      stats: {
        totalExpressions: 1,
        coveredExpressions: 1,
        infeasibleExpressions: 0,
        untestableExpressions: 0,
        coveragePercent: 100,
      },
    };

    const html = generateCoverageTableHTML(table);

    expect(html).toContain('<table');
    expect(html).toContain('</table>');

    // Node labels in header
    expect(html).toContain('Cause 1');
    expect(html).toContain('Effect 1');

    // Expression label
    expect(html).toContain('Expr.1');

    // Column headers
    expect(html).toContain('#1');
    expect(html).toContain('#2');

    // Adopted marker color (blue)
    expect(html).toContain('#e3f2fd');

    // Status and Reason column headers (bilingual)
    expect(html).toContain('Status');
    expect(html).toContain('状態');
    expect(html).toContain('Reason');
    expect(html).toContain('理由');
  });

  it('should show infeasible status and reason', () => {
    const table: CoverageTable = {
      rows: [{
        expressionIndex: 1,
        edge: { source: 'c1', target: 'e1', negated: false, label: 'c1→e1', type: 'logical' },
        requiredValues: new Map([['c1', 'T']]),
        coverage: new Map([[0, 'infeasible']]),
        isCovered: false,
        isInfeasible: true,
        isUntestable: false,
        reason: 'ONE(A, B)',
      }],
      nodeNames: ['c1', 'e1'],
      nodeLabels: new Map([['c1', 'C'], ['e1', 'E']]),
      conditionIds: [0],
      stats: {
        totalExpressions: 1,
        coveredExpressions: 0,
        infeasibleExpressions: 1,
        untestableExpressions: 0,
        coveragePercent: 0,
      },
    };

    const html = generateCoverageTableHTML(table);
    expect(html).toContain('Infeasible');
    expect(html).toContain('ONE(A, B)');
    expect(html).toContain('#f0f0f0'); // infeasible row bg (gray)
  });

  it('should show untestable status and reason', () => {
    const table: CoverageTable = {
      rows: [{
        expressionIndex: 1,
        edge: { source: 'c1', target: 'e1', negated: false, label: 'c1→e1', type: 'logical' },
        requiredValues: new Map([['c1', 'T']]),
        coverage: new Map([[0, 'untestable']]),
        isCovered: false,
        isInfeasible: false,
        isUntestable: true,
        reason: 'MASK(X → Y)',
      }],
      nodeNames: ['c1', 'e1'],
      nodeLabels: new Map([['c1', 'C'], ['e1', 'E']]),
      conditionIds: [0],
      stats: {
        totalExpressions: 1,
        coveredExpressions: 0,
        infeasibleExpressions: 0,
        untestableExpressions: 1,
        coveragePercent: 0,
      },
    };

    const html = generateCoverageTableHTML(table);
    expect(html).toContain('Untestable');
    expect(html).toContain('MASK(X → Y)');
    expect(html).toContain('#f0f0f0'); // untestable row bg (gray)
  });
});
