/**
 * CEG Algorithm Tests
 *
 * Tests for:
 * - Expression extraction (Algorithm_Design.md §4)
 * - Value propagation (§9)
 * - Constraint processing (§11)
 */

import { describe, it, expect } from 'vitest';
import type { LogicalModel, LogicalConstraint } from '../types/logical';
import { ref, not, and, or } from '../types/logical';
import type { LogicalExpression, ExpressionRequiredValue, WorkValue } from '../types/cegAlgorithm';
import {
  extractExpressions,
  deduceValue,
  deduce,
  deduceConstraint,
  applyMask,
  checkSingleConstraint,
  checkConstr,
  checkRelation,
  isPossible,
  calcTable,
} from '../services/cegAlgorithm';
import { generateCoverageTableFromState } from '../services/coverageTableCalculator';
import { generateOptimizedDecisionTableWithState } from '../services/decisionTableCalculator';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a minimal LogicalModel from node definitions.
 * Nodes without expressions are causes.
 */
function createModel(
  nodes: { name: string; expression?: ReturnType<typeof and> | ReturnType<typeof or> | ReturnType<typeof ref> | ReturnType<typeof not> }[]
): LogicalModel {
  const nodeMap = new Map();
  for (const n of nodes) {
    nodeMap.set(n.name, {
      name: n.name,
      label: n.name,
      expression: n.expression,
    });
  }
  return { nodes: nodeMap, constraints: [] };
}

/**
 * Convert requiredValues Map to a plain object for easier assertion.
 */
function reqObj(expr: LogicalExpression): Record<string, ExpressionRequiredValue> {
  const obj: Record<string, ExpressionRequiredValue> = {};
  for (const [k, v] of expr.requiredValues) {
    obj[k] = v;
  }
  return obj;
}

/**
 * Create a work array (Map) with initial values.
 */
function createWork(entries: Record<string, WorkValue>): Map<string, WorkValue> {
  return new Map(Object.entries(entries));
}

// =============================================================================
// §4.3 AND Node Expression Extraction
// =============================================================================

describe('extractExpressions - AND nodes', () => {
  it('AND(A, B) → C generates 3 expressions', () => {
    // A AND B → C (Algorithm_Design.md §3.1 example)
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(3);

    // Expression 0: all satisfy → C=T
    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'T', C: 'T' });
    expect(exprs[0].ownerNode).toBe('C');
    expect(exprs[0].column).toBe(0);

    // Expression 1: A non-satisfy → C=F
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'T', C: 'F' });
    expect(exprs[1].ownerNode).toBe('C');
    expect(exprs[1].column).toBe(1);

    // Expression 2: B non-satisfy → C=F
    expect(reqObj(exprs[2])).toEqual({ A: 'T', B: 'F', C: 'F' });
    expect(exprs[2].ownerNode).toBe('C');
    expect(exprs[2].column).toBe(2);
  });

  it('AND with 3 inputs generates 4 expressions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D', expression: and(ref('A'), ref('B'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(4);

    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'T', C: 'T', D: 'T' });
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'T', C: 'T', D: 'F' });
    expect(reqObj(exprs[2])).toEqual({ A: 'T', B: 'F', C: 'T', D: 'F' });
    expect(reqObj(exprs[3])).toEqual({ A: 'T', B: 'T', C: 'F', D: 'F' });
  });

  it('AND with NOT edge: A AND NOT(B) → C', () => {
    // NOT on B means: B=F is satisfy, B=T is non-satisfy
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), not(ref('B'))) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(3);

    // Expression 0: all satisfy (A=T, B=F because NOT) → C=T
    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'F', C: 'T' });

    // Expression 1: A non-satisfy (A=F), B satisfy (B=F) → C=F
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'F', C: 'F' });

    // Expression 2: B non-satisfy (B=T because NOT), A satisfy (A=T) → C=F
    expect(reqObj(exprs[2])).toEqual({ A: 'T', B: 'T', C: 'F' });
  });
});

// =============================================================================
// §4.4 OR Node Expression Extraction
// =============================================================================

describe('extractExpressions - OR nodes', () => {
  it('OR(A, B) → C generates 3 expressions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(3);

    // Expression 0: A satisfy, B non-satisfy → C=T
    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'F', C: 'T' });

    // Expression 1: B satisfy, A non-satisfy → C=T
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'T', C: 'T' });

    // Expression 2: all non-satisfy → C=F
    expect(reqObj(exprs[2])).toEqual({ A: 'F', B: 'F', C: 'F' });
  });

  it('OR with 3 inputs generates 4 expressions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D', expression: or(ref('A'), ref('B'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(4);

    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'F', C: 'F', D: 'T' });
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'T', C: 'F', D: 'T' });
    expect(reqObj(exprs[2])).toEqual({ A: 'F', B: 'F', C: 'T', D: 'T' });
    expect(reqObj(exprs[3])).toEqual({ A: 'F', B: 'F', C: 'F', D: 'F' });
  });

  it('OR with NOT edge: A OR NOT(B) → C', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), not(ref('B'))) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(3);

    // Expression 0: A satisfy (T), B non-satisfy (T because NOT) → C=T
    expect(reqObj(exprs[0])).toEqual({ A: 'T', B: 'T', C: 'T' });

    // Expression 1: B satisfy (F because NOT), A non-satisfy (F) → C=T
    expect(reqObj(exprs[1])).toEqual({ A: 'F', B: 'F', C: 'T' });

    // Expression 2: all non-satisfy (A=F, B=T because NOT inverts) → C=F
    expect(reqObj(exprs[2])).toEqual({ A: 'F', B: 'T', C: 'F' });
  });
});

// =============================================================================
// Single-input nodes
// =============================================================================

describe('extractExpressions - single input nodes', () => {
  it('simple pass-through: ref(A) → C', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'C', expression: ref('A') },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(2);

    expect(reqObj(exprs[0])).toEqual({ A: 'T', C: 'T' });
    expect(reqObj(exprs[1])).toEqual({ A: 'F', C: 'F' });
  });

  it('negation: NOT(A) → C', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'C', expression: not(ref('A')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(2);

    // NOT(A): satisfy=F, non-satisfy=T
    expect(reqObj(exprs[0])).toEqual({ A: 'F', C: 'T' });
    expect(reqObj(exprs[1])).toEqual({ A: 'T', C: 'F' });
  });
});

// =============================================================================
// §4.5 Expression numbering
// =============================================================================

describe('extractExpressions - expression numbering', () => {
  it('sequential indices across nodes', () => {
    // A AND B → I AND C → E
    // Effect E processed first, then intermediate I
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(6);

    // Effects first (E: 3 expressions, indices 0-2)
    expect(exprs[0].index).toBe(0);
    expect(exprs[0].ownerNode).toBe('E');
    expect(exprs[1].index).toBe(1);
    expect(exprs[1].ownerNode).toBe('E');
    expect(exprs[2].index).toBe(2);
    expect(exprs[2].ownerNode).toBe('E');

    // Then intermediates (I: 3 expressions, indices 3-5)
    expect(exprs[3].index).toBe(3);
    expect(exprs[3].ownerNode).toBe('I');
    expect(exprs[4].index).toBe(4);
    expect(exprs[4].ownerNode).toBe('I');
    expect(exprs[5].index).toBe(5);
    expect(exprs[5].ownerNode).toBe('I');
  });

  it('column indices are per-node (0-based)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs[0].column).toBe(0);
    expect(exprs[1].column).toBe(1);
    expect(exprs[2].column).toBe(2);
  });
});

// =============================================================================
// §4.6 Required values scope
// =============================================================================

describe('extractExpressions - required values scope', () => {
  it('only contains owner node and direct inputs', () => {
    // A AND B → I AND C → E
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);

    // E's expressions should only have I, C, E (not A, B)
    const eExpr = exprs.find(e => e.ownerNode === 'E' && e.column === 0)!;
    expect(eExpr.requiredValues.has('I')).toBe(true);
    expect(eExpr.requiredValues.has('C')).toBe(true);
    expect(eExpr.requiredValues.has('E')).toBe(true);
    expect(eExpr.requiredValues.has('A')).toBe(false);
    expect(eExpr.requiredValues.has('B')).toBe(false);

    // I's expressions should only have A, B, I (not C, E)
    const iExpr = exprs.find(e => e.ownerNode === 'I' && e.column === 0)!;
    expect(iExpr.requiredValues.has('A')).toBe(true);
    expect(iExpr.requiredValues.has('B')).toBe(true);
    expect(iExpr.requiredValues.has('I')).toBe(true);
    expect(iExpr.requiredValues.has('C')).toBe(false);
    expect(iExpr.requiredValues.has('E')).toBe(false);
  });

  it('chain example matches Algorithm_Design.md §4.6', () => {
    // A AND B → I AND C → E (exact example from the document)
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);

    // E's expressions (processed first as effect)
    const eExprs = exprs.filter(e => e.ownerNode === 'E');
    expect(reqObj(eExprs[0])).toEqual({ I: 'T', C: 'T', E: 'T' });
    expect(reqObj(eExprs[1])).toEqual({ I: 'F', C: 'T', E: 'F' });
    expect(reqObj(eExprs[2])).toEqual({ I: 'T', C: 'F', E: 'F' });

    // I's expressions (processed second as intermediate)
    const iExprs = exprs.filter(e => e.ownerNode === 'I');
    expect(reqObj(iExprs[0])).toEqual({ A: 'T', B: 'T', I: 'T' });
    expect(reqObj(iExprs[1])).toEqual({ A: 'F', B: 'T', I: 'F' });
    expect(reqObj(iExprs[2])).toEqual({ A: 'T', B: 'F', I: 'F' });
  });
});

// =============================================================================
// Cause-only models
// =============================================================================

describe('extractExpressions - edge cases', () => {
  it('model with only causes generates no expressions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
    ]);

    const exprs = extractExpressions(model);
    expect(exprs).toHaveLength(0);
  });

  it('mixed AND/OR graph', () => {
    // A AND B → I (AND), I OR C → E (OR)
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: or(ref('I'), ref('C')) },
    ]);

    const exprs = extractExpressions(model);
    // E (OR, 2 inputs): 3 expressions
    // I (AND, 2 inputs): 3 expressions
    expect(exprs).toHaveLength(6);

    // E (OR): effects first
    const eExprs = exprs.filter(e => e.ownerNode === 'E');
    expect(eExprs).toHaveLength(3);
    expect(reqObj(eExprs[0])).toEqual({ I: 'T', C: 'F', E: 'T' });
    expect(reqObj(eExprs[1])).toEqual({ I: 'F', C: 'T', E: 'T' });
    expect(reqObj(eExprs[2])).toEqual({ I: 'F', C: 'F', E: 'F' });

    // I (AND): intermediates second
    const iExprs = exprs.filter(e => e.ownerNode === 'I');
    expect(iExprs).toHaveLength(3);
    expect(reqObj(iExprs[0])).toEqual({ A: 'T', B: 'T', I: 'T' });
    expect(reqObj(iExprs[1])).toEqual({ A: 'F', B: 'T', I: 'F' });
    expect(reqObj(iExprs[2])).toEqual({ A: 'T', B: 'F', I: 'F' });
  });
});

// =============================================================================
// §9 Value Propagation (deduceValue / deduce)
// =============================================================================

describe('deduceValue - AND nodes', () => {
  it('AND(T, T) → t', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('t');
  });

  it('AND(T, F) → f (short-circuit)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('f');
  });

  it('AND(T, M) → I (indeterminate)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'M', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('I');
  });

  it('AND(F, M) → f (F absorbs for AND)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: 'M', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('f');
  });

  it('AND with NOT: A AND NOT(B), A=T, B=F → t', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('t');
  });

  it('AND with NOT: A AND NOT(B), A=T, B=T → f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('f');
  });

  it('AND with unset input → I', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: '', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('I');
  });

  it('skips already-set nodes', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 'F' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('F'); // unchanged
  });
});

describe('deduceValue - OR nodes', () => {
  it('OR(T, F) → t (short-circuit)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('t');
  });

  it('OR(F, F) → f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: 'F', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('f');
  });

  it('OR(M, F) → I', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'M', B: 'F', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('I');
  });

  it('OR(M, T) → t (T absorbs for OR)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'M', B: 'T', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('t');
  });

  it('OR with NOT: A OR NOT(B), A=F, B=T → f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'F', B: 'T', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('f');
  });
});

describe('deduce - multi-node propagation', () => {
  it('chain: A AND B → I AND C → E, all T → t', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 'T', I: '', E: '' });
    deduce(work, model);
    expect(work.get('I')).toBe('t');
    expect(work.get('E')).toBe('t');
  });

  it('chain with false propagation: A=T, B=F → I=f → E=f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'T', I: '', E: '' });
    deduce(work, model);
    expect(work.get('I')).toBe('f');
    expect(work.get('E')).toBe('f');
  });

  it('mixed AND/OR chain: A AND B → I, I OR C → E', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: or(ref('I'), ref('C')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'F', I: '', E: '' });
    deduce(work, model);
    expect(work.get('I')).toBe('f');
    expect(work.get('E')).toBe('f');
  });

  it('lowercase input values: t/f propagate correctly', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 't', B: 't', C: '' });
    deduceValue(work, 'C', model);
    expect(work.get('C')).toBe('t');
  });
});

// =============================================================================
// §11 Constraint Deduction
// =============================================================================

describe('deduceConstraint - ONE', () => {
  it('ONE(A, B): A=T → B=F', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('F'); // uppercase: constraint deduction
  });

  it('ONE(A, B, C): A=F, B=F → C=T', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
        { name: 'C', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: 'F', C: '' });
    deduceConstraint(work, constraint);
    expect(work.get('C')).toBe('T'); // last unset → must be satisfy
  });

  it('ONE(A, NOT B): A=T → B=T (non-satisfy for negated member)', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: true },
      ],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    // B is negated: non-satisfy means NOT B = F, so B = T
    expect(work.get('B')).toBe('T');
  });

  it('ONE(A, B, C): A=F, B="", C="" → no deduction (2 unset)', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
        { name: 'C', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: '', C: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
    expect(work.get('C')).toBe('');
  });
});

describe('deduceConstraint - EXCL', () => {
  it('EXCL(A, B): A=T → B=F', () => {
    const constraint: LogicalConstraint = {
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('F');
  });

  it('EXCL(A, B): A=F, B="" → no deduction (does not force last)', () => {
    const constraint: LogicalConstraint = {
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
  });
});

describe('deduceConstraint - INCL', () => {
  it('INCL(A, B): A=F → B=T (last unset must satisfy)', () => {
    const constraint: LogicalConstraint = {
      type: 'INCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('T');
  });

  it('INCL(A, B, C): A=F, B=F, C="" → C=T', () => {
    const constraint: LogicalConstraint = {
      type: 'INCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
        { name: 'C', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: 'F', C: '' });
    deduceConstraint(work, constraint);
    expect(work.get('C')).toBe('T');
  });

  it('INCL(A, B): A=T → no deduction (already satisfied)', () => {
    const constraint: LogicalConstraint = {
      type: 'INCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
  });
});

describe('deduceConstraint - REQ', () => {
  it('REQ(A → B): A=T → B=T', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('T');
  });

  it('REQ(A → B): A=F → no deduction', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'F', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
  });

  it('REQ(NOT A → B): A=F → source satisfied → B=T', () => {
    // Negated source: satisfied when A=F (NOT A = T)
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: true },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'F', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('T');
  });

  it('REQ(NOT A → B): A=T → source not satisfied → B unchanged', () => {
    // Negated source: not satisfied when A=T (NOT A = F)
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: true },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
  });

  it('REQ(A → NOT B): A=T → B deduced to F', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: true }],
    };
    const work = createWork({ A: 'T', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('F');
  });

  it('REQ(A → NOT B): A=F → B unchanged', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: true }],
    };
    const work = createWork({ A: 'F', B: '' });
    deduceConstraint(work, constraint);
    expect(work.get('B')).toBe('');
  });
});

// =============================================================================
// §11.3 MASK Constraint
// =============================================================================

describe('applyMask', () => {
  it('MASK(A → B): A=T → B=M', () => {
    const work = createWork({ A: 'T', B: '' });
    const result = applyMask(
      work,
      { name: 'A', negated: false },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(true);
    expect(work.get('B')).toBe('M');
  });

  it('MASK(NOT A → B): A=F → trigger satisfied → B=M', () => {
    const work = createWork({ A: 'F', B: '' });
    const result = applyMask(
      work,
      { name: 'A', negated: true },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(true);
    expect(work.get('B')).toBe('M');
  });

  it('MASK(NOT A → B): A=T → trigger not satisfied → B unchanged', () => {
    const work = createWork({ A: 'T', B: '' });
    const result = applyMask(
      work,
      { name: 'A', negated: true },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(true);
    expect(work.get('B')).toBe('');
  });

  it('MASK(A → B): A=F → B unchanged', () => {
    const work = createWork({ A: 'F', B: 'T' });
    const result = applyMask(
      work,
      { name: 'A', negated: false },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(true);
    expect(work.get('B')).toBe('T');
  });

  it('MASK contradiction: target already has value → false', () => {
    const work = createWork({ A: 'T', B: 'T' });
    const result = applyMask(
      work,
      { name: 'A', negated: false },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(false);
  });

  it('MASK: target already M → ok', () => {
    const work = createWork({ A: 'T', B: 'M' });
    const result = applyMask(
      work,
      { name: 'A', negated: false },
      [{ name: 'B', negated: false }]
    );
    expect(result).toBe(true);
    expect(work.get('B')).toBe('M');
  });

});

// =============================================================================
// §11.4 Constraint Violation Check
// =============================================================================

describe('checkSingleConstraint', () => {
  it('ONE(A, B): A=T, B=F → ok', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).toBe('');
  });

  it('ONE(A, B): A=T, B=T → violation', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: 'T' });
    expect(checkSingleConstraint(work, constraint)).not.toBe('');
  });

  it('ONE(A, B): A=F, B=F → violation', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).not.toBe('');
  });

  it('ONE(A, B): A=T, B="" → ok (blank = undetermined)', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: '' });
    expect(checkSingleConstraint(work, constraint)).toBe('');
  });

  it('EXCL(A, B): A=T, B=T → violation', () => {
    const constraint: LogicalConstraint = {
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'T', B: 'T' });
    expect(checkSingleConstraint(work, constraint)).not.toBe('');
  });

  it('EXCL(A, B): A=F, B=F → ok', () => {
    const constraint: LogicalConstraint = {
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).toBe('');
  });

  it('INCL(A, B): A=F, B=F → violation', () => {
    const constraint: LogicalConstraint = {
      type: 'INCL',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'F', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).not.toBe('');
  });

  it('REQ(A → B): A=T, B=F → violation', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'T', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).not.toBe('');
  });

  it('REQ(A → B): A=T, B=T → ok', () => {
    const constraint: LogicalConstraint = {
      type: 'REQ',
      source: { name: 'A', negated: false },
      targets: [{ name: 'B', negated: false }],
    };
    const work = createWork({ A: 'T', B: 'T' });
    expect(checkSingleConstraint(work, constraint)).toBe('');
  });

  it('constraints with M values: ONE(A,B) A=M → no violation', () => {
    const constraint: LogicalConstraint = {
      type: 'ONE',
      members: [
        { name: 'A', negated: false },
        { name: 'B', negated: false },
      ],
    };
    const work = createWork({ A: 'M', B: 'F' });
    expect(checkSingleConstraint(work, constraint)).toBe('');
  });
});

describe('checkConstr - integrated', () => {
  it('EXCL(A, D): A=T → D deduced to F, no violation', () => {
    const constraints: LogicalConstraint[] = [{
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'D', negated: false },
      ],
    }];
    const work = createWork({ A: 'T', D: '' });
    const reason = checkConstr(work, constraints);
    expect(reason).toBe('');
  });

  it('EXCL(A, D): A=T, D=T → violation', () => {
    const constraints: LogicalConstraint[] = [{
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'D', negated: false },
      ],
    }];
    const work = createWork({ A: 'T', D: 'T' });
    const reason = checkConstr(work, constraints);
    expect(reason).not.toBe('');
  });
});

// =============================================================================
// Integration: deduce + constraints
// =============================================================================

// =============================================================================
// §10 Logical Consistency Check (checkRelation / isPossible)
// =============================================================================

describe('checkRelation - AND nodes', () => {
  it('AND(T, T) with node=t → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 't' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('AND(T, F) with node=f → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'f' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('AND(T, T) with node=F → inconsistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 'F' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('AND(T, F) with node=T → inconsistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'T' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('AND(T, "") with node=T → consistent (unknown input)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: '', C: 'T' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('AND with NOT: A AND NOT(B), A=T, B=T, node=T → inconsistent', () => {
    // NOT(B): B=T is non-satisfy → AND should be F
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 'T' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('AND with NOT: A AND NOT(B), A=T, B=F, node=t → consistent', () => {
    // NOT(B): B=F is satisfy → AND should be T
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 't' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('AND(M, T) with node=M → consistent (mask present)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'M', B: 'T', C: 'M' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('AND(T, T) with node=M → inconsistent (all determined, no mask)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 'M' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('AND(F, M) with node=M → inconsistent (definite F, not M)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: 'M', C: 'M' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });
});

describe('checkRelation - OR nodes', () => {
  it('OR(T, F) with node=t → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 't' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('OR(F, F) with node=f → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: 'F', C: 'f' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('OR(T, F) with node=F → inconsistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'F' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('OR(F, F) with node=T → inconsistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: 'F', C: 'T' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });

  it('OR(F, "") with node=F → consistent (unknown input)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'F', B: '', C: 'F' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('OR with NOT: A OR NOT(B), A=F, B=F, node=t → consistent', () => {
    // NOT(B): B=F is satisfy → OR should be T
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), not(ref('B'))) },
    ]);
    const work = createWork({ A: 'F', B: 'F', C: 't' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('OR(M, F) with node=M → consistent (mask present)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'M', B: 'F', C: 'M' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('OR(T, M) with node=M → inconsistent (definite T, not M)', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'M', C: 'M' });
    expect(checkRelation(work, 'C', model)).toBe(false);
  });
});

describe('checkRelation - edge cases', () => {
  it('unset node value → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: '' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });

  it('cause node → always consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'C', expression: ref('A') },
    ]);
    const work = createWork({ A: 'T', C: '' });
    expect(checkRelation(work, 'A', model)).toBe(true);
  });

  it('I input treated as unknown for AND', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    // A=I, B=T, C=T → consistent (I makes result uncertain)
    const work = createWork({ A: 'I', B: 'T', C: 'T' });
    expect(checkRelation(work, 'C', model)).toBe(true);
  });
});

describe('isPossible', () => {
  it('consistent graph → empty string', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'T', C: 't' });
    expect(isPossible(work, model)).toBe('');
  });

  it('inconsistent node → returns reason', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: 'T', B: 'F', C: 'T' });
    const reason = isPossible(work, model);
    expect(reason).not.toBe('');
    expect(reason).toContain('C');
  });

  it('chain: A AND B → I AND C → E, I inconsistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);
    // A=T, B=F → I should be f, but I=T → inconsistency
    const work = createWork({ A: 'T', B: 'F', C: 'T', I: 'T', E: '' });
    const reason = isPossible(work, model);
    expect(reason).not.toBe('');
    expect(reason).toContain('I');
  });

  it('all unset → consistent', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);
    const work = createWork({ A: '', B: '', C: '' });
    expect(isPossible(work, model)).toBe('');
  });
});

// =============================================================================
// Integration: deduce + constraints
// =============================================================================

describe('integration - deduce with EXCL constraint', () => {
  it('A(T) AND D → C with EXCL(A, D): A=t → D=F, C=f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'D' },
      { name: 'C', expression: and(ref('A'), ref('D')) },
    ]);
    const constraints: LogicalConstraint[] = [{
      type: 'EXCL',
      members: [
        { name: 'A', negated: false },
        { name: 'D', negated: false },
      ],
    }];

    const work = createWork({ A: 't', D: '', C: '' });

    // 1. Constraint deduction: EXCL(A, D), A=t → D=F
    deduceConstraint(work, constraints[0]);
    expect(work.get('D')).toBe('F');

    // 2. Value propagation: AND(t, F) = f
    deduce(work, model);
    expect(work.get('C')).toBe('f');
  });
});

// =============================================================================
// §5 calcTable - Full Algorithm Integration
// =============================================================================

describe('calcTable - simple AND', () => {
  it('AND(A, B) → C generates 3 test conditions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const state = calcTable(model);

    // 3 expressions for AND(A,B)→C, should need 3 tests
    expect(state.expressions).toHaveLength(3);

    // Filter non-weak tests
    const activeTests = state.tests.filter((_, i) => !state.weaks[i]);
    expect(activeTests.length).toBeGreaterThanOrEqual(3);

    // Each expression should be covered at least once
    for (let l = 0; l < state.expressions.length; l++) {
      if (state.infeasibles[l] !== null) continue;
      let covered = false;
      for (let t = 0; t < state.covs.length; t++) {
        if (state.weaks[t]) continue;
        if (state.covs[t][l]) { covered = true; break; }
      }
      expect(covered).toBe(true);
    }
  });
});

describe('calcTable - simple OR', () => {
  it('OR(A, B) → C generates 3 test conditions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: or(ref('A'), ref('B')) },
    ]);

    const state = calcTable(model);
    expect(state.expressions).toHaveLength(3);

    const activeTests = state.tests.filter((_, i) => !state.weaks[i]);
    expect(activeTests.length).toBeGreaterThanOrEqual(3);
  });
});

describe('calcTable - chain graph', () => {
  it('A AND B → I AND C → E covers all expressions', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'I', expression: and(ref('A'), ref('B')) },
      { name: 'E', expression: and(ref('I'), ref('C')) },
    ]);

    const state = calcTable(model);

    // 6 expressions total (3 for E + 3 for I)
    expect(state.expressions).toHaveLength(6);

    // All feasible expressions covered
    for (let l = 0; l < state.expressions.length; l++) {
      if (state.infeasibles[l] !== null) continue;
      let covered = false;
      for (let t = 0; t < state.covs.length; t++) {
        if (state.weaks[t]) continue;
        if (state.covs[t][l]) { covered = true; break; }
      }
      expect(covered).toBe(true);
    }
  });
});

describe('calcTable - result coverage', () => {
  it('each non-isolated cause appears as both T/t and F/f', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const state = calcTable(model);
    const activeTests = state.tests.filter((_, i) => !state.weaks[i]);

    for (const causeName of ['A', 'B']) {
      const hasT = activeTests.some(t => {
        const v = t.get(causeName);
        return v === 'T' || v === 't';
      });
      const hasF = activeTests.some(t => {
        const v = t.get(causeName);
        return v === 'F' || v === 'f';
      });
      expect(hasT).toBe(true);
      expect(hasF).toBe(true);
    }
  });
});

// =============================================================================
// §13 Coverage Table from AlgorithmState
// =============================================================================

describe('generateCoverageTableFromState', () => {
  it('AND(A, B) → C: 3 rows, 100% coverage', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const state = calcTable(model);
    const table = generateCoverageTableFromState(model, state);

    expect(table.rows).toHaveLength(3);
    expect(table.stats.coveragePercent).toBe(100);
    expect(table.stats.infeasibleExpressions).toBe(0);

    // Each row should be covered
    for (const row of table.rows) {
      expect(row.isCovered).toBe(true);
    }
  });

  it('coverage markers: # for unique, x for redundant', () => {
    const model = createModel([
      { name: 'A' },
      { name: 'B' },
      { name: 'C', expression: and(ref('A'), ref('B')) },
    ]);

    const state = calcTable(model);
    const table = generateCoverageTableFromState(model, state);

    // At least one row should have an 'adopted' (#) marker
    let hasAdopted = false;
    for (const row of table.rows) {
      for (const [, marker] of row.coverage) {
        if (marker === 'adopted') hasAdopted = true;
      }
    }
    expect(hasAdopted).toBe(true);
  });
});

// =============================================================================
// §17 Admission Fee Example (End-to-End)
// =============================================================================

describe('calcTable - admission fee example', () => {
  // Admission fee calculation graph from Algorithm_Design.md §17
  function createAdmissionFeeModel(): LogicalModel {
    const nodeMap = new Map();
    // 8 Causes
    nodeMap.set('n1', { name: 'n1', label: '個人' });
    nodeMap.set('n2', { name: 'n2', label: '団体' });
    nodeMap.set('n3', { name: 'n3', label: '65歳以上' });
    nodeMap.set('n4', { name: 'n4', label: '一般' });
    nodeMap.set('n5', { name: 'n5', label: '小学生' });
    nodeMap.set('n6', { name: 'n6', label: '6歳未満' });
    nodeMap.set('n7', { name: 'n7', label: '県内在住Yes' });
    nodeMap.set('n8', { name: 'n8', label: '県内在住No' });
    // 2 Intermediates
    nodeMap.set('n9', { name: 'n9', label: '県内在住の小学生', expression: and(ref('n5'), ref('n7')) });
    nodeMap.set('n10', { name: 'n10', label: '県内在住ではない小学生', expression: and(ref('n5'), ref('n8')) });
    // 5 Effects
    nodeMap.set('e1', { name: 'e1', label: '無料', expression: or(ref('n3'), ref('n6'), ref('n9')) });
    nodeMap.set('e2', { name: 'e2', label: '1200円', expression: and(ref('n1'), ref('n4')) });
    nodeMap.set('e3', { name: 'e3', label: '1000円', expression: and(ref('n2'), ref('n4')) });
    nodeMap.set('e4', { name: 'e4', label: '600円', expression: and(ref('n1'), ref('n10')) });
    nodeMap.set('e5', { name: 'e5', label: '500円', expression: and(ref('n2'), ref('n10')) });

    const constraints: LogicalConstraint[] = [
      { type: 'ONE', members: [{ name: 'n1', negated: false }, { name: 'n2', negated: false }] },
      { type: 'ONE', members: [{ name: 'n3', negated: false }, { name: 'n4', negated: false }, { name: 'n5', negated: false }, { name: 'n6', negated: false }] },
      { type: 'ONE', members: [{ name: 'n7', negated: false }, { name: 'n8', negated: false }] },
    ];

    return { nodes: nodeMap, constraints };
  }

  it('generates 22 expressions', () => {
    const model = createAdmissionFeeModel();
    const state = calcTable(model);
    expect(state.expressions).toHaveLength(22);
  });

  it('generates 7 test conditions after weak test removal', () => {
    const model = createAdmissionFeeModel();
    const state = calcTable(model);
    const activeTests = state.tests.filter((_, i) => !state.weaks[i]);
    expect(activeTests).toHaveLength(7);
  });

  it('achieves 100% expression coverage', () => {
    const model = createAdmissionFeeModel();
    const state = calcTable(model);
    const coverageTable = generateCoverageTableFromState(model, state);
    expect(coverageTable.stats.coveragePercent).toBe(100);
    expect(coverageTable.stats.coveredExpressions).toBe(22);
  });

  it('end-to-end: DecisionTable + CoverageTable', () => {
    const model = createAdmissionFeeModel();
    const { table, state } = generateOptimizedDecisionTableWithState(model);

    // 7 active test conditions
    expect(table.conditions).toHaveLength(7);
    expect(table.stats.feasibleConditions).toBe(7);

    // 3 constraints
    expect(table.constraints).toHaveLength(3);

    // Node classification
    expect(table.causeIds).toHaveLength(8);
    expect(table.intermediateIds).toHaveLength(2);
    expect(table.effectIds).toHaveLength(5);

    // Coverage table: 22 rows, 100% coverage
    const coverageTable = generateCoverageTableFromState(model, state);
    expect(coverageTable.rows).toHaveLength(22);
    expect(coverageTable.stats.totalExpressions).toBe(22);
    expect(coverageTable.stats.coveredExpressions).toBe(22);
    expect(coverageTable.stats.coveragePercent).toBe(100);
  });
});
