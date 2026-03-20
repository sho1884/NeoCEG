/**
 * Coverage Table Calculator
 *
 * Generates coverage tables from a logical model and decision table.
 * Shows which test conditions cover (exercise) each logical expression.
 *
 * Reference: Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4
 * Reference: Doc/Algorithm_Design.md §13
 */

import type { LogicalModel } from '../types/logical';
import { isCause, isEffect } from '../types/logical';
import type { TruthValue } from '../types/decisionTable';
import type {
  CoverageTable,
  CoverageRow,
  CoverageMarker,
  LogicalEdge,
} from '../types/coverageTable';
import type { AlgorithmState } from '../types/cegAlgorithm';
import { formatConstraintDisplay } from './cegAlgorithm';

/**
 * Check if a test condition covers an expression using relaxed matching.
 * M (Masked) and I (Indeterminate) values are treated as wildcards.
 *
 * Used to detect "untestable" expressions: those that WOULD be covered
 * if MASK constraints did not make some nodes indeterminate.
 *
 * Reference: Algorithm_Design.md §13.4.2
 */
function isRelaxedCoveredBy(
  test: Map<string, TruthValue>,
  expr: Map<string, TruthValue>
): boolean {
  for (const [nodeName, reqValue] of expr) {
    const testValue = test.get(nodeName);
    if (testValue === undefined || testValue === ('' as TruthValue)) continue;
    // M and I are wildcards — skip comparison
    if (testValue === 'M' || testValue === 'I') continue;
    if (testValue !== reqValue) return false;
  }
  return true;
}

/**
 * Generate coverage table from AlgorithmState.
 *
 * Uses the expressions, tests, and coverage data from calcTable()
 * to build a CoverageTable with proper markers:
 * - # : first test to cover this expression (§13.2)
 * - x : additional test covering an already-covered expression
 * - - : infeasible expression (§13.4)
 * - ? : untestable expression due to MASK (§13.4)
 *
 * Reference: Algorithm_Design.md §13
 */
export function generateCoverageTableFromState(
  model: LogicalModel,
  state: AlgorithmState
): CoverageTable {
  // Build ordered node names: causes, intermediates, effects
  const causes: string[] = [];
  const intermediates: string[] = [];
  const effects: string[] = [];
  for (const [name, node] of model.nodes) {
    if (isCause(node)) causes.push(name);
    else if (isEffect(node, model)) effects.push(name);
    else intermediates.push(name);
  }
  const nodeNames = [...causes, ...intermediates, ...effects];

  // Build node labels
  const nodeLabels = new Map<string, string>();
  for (const [name, node] of model.nodes) {
    nodeLabels.set(name, node.label || name);
  }

  // All test indices (including weak) for condition columns
  const allTestIndices: number[] = [];
  for (let t = 0; t < state.tests.length; t++) {
    allTestIndices.push(t);
  }
  const conditionIds = allTestIndices.map((_, i) => i + 1);

  // Build rows
  const rows: CoverageRow[] = [];
  let coveredCount = 0;
  let infeasibleCount = 0;
  let untestableCount = 0;

  for (let l = 0; l < state.expressions.length; l++) {
    const expr = state.expressions[l];
    const isInfeasible = state.infeasibles[l] !== null;

    // Build edge info from expression
    const inputNames = [...expr.requiredValues.keys()].filter(k => k !== expr.ownerNode);
    const edge: LogicalEdge = {
      source: inputNames.join(', '),
      target: expr.ownerNode,
      negated: false,
      label: `Expr ${l + 1} (${expr.ownerNode} col ${expr.column})`,
      type: 'logical',
    };

    // Build required values as TruthValue map
    const requiredValues = new Map<string, TruthValue>();
    for (const [k, v] of expr.requiredValues) {
      requiredValues.set(k, v as TruthValue);
    }

    // --- §13.2: Order-based #/x marking ---
    // Scan tests left-to-right. First non-weak covering test gets '#',
    // subsequent covering tests get 'x'.
    const coverage = new Map<number, CoverageMarker>();
    let isCovered = false;
    let firstCovered = false; // tracks if '#' has been assigned for this expression

    if (isInfeasible) {
      // All cells get 'infeasible' marker
      for (let t = 0; t < state.tests.length; t++) {
        coverage.set(t + 1, 'infeasible');
      }
    } else {
      for (let t = 0; t < state.tests.length; t++) {
        const condId = t + 1;
        if (state.covs[t]?.[l]) {
          if (state.weaks[t]) {
            // Weak tests always get 'covered' (x)
            coverage.set(condId, 'covered');
          } else if (!firstCovered) {
            // First non-weak covering test gets '#'
            coverage.set(condId, 'adopted');
            firstCovered = true;
            isCovered = true;
          } else {
            // Subsequent covering tests get 'x'
            coverage.set(condId, 'covered');
          }
        } else {
          coverage.set(condId, 'not_covered');
        }
      }
    }

    // --- §13.4: Detect untestable expressions ---
    // An expression is untestable if:
    // 1. Not infeasible
    // 2. Not covered by any non-weak test (strict match)
    // 3. At least one non-weak test would cover it with relaxed matching
    //    (treating M/I as wildcards)
    let isUntestable = false;
    if (!isInfeasible && !isCovered) {
      for (let t = 0; t < state.tests.length; t++) {
        if (state.weaks[t]) continue;
        if (isRelaxedCoveredBy(state.tests[t], requiredValues)) {
          isUntestable = true;
          break;
        }
      }
    }

    // If untestable, override coverage markers to 'untestable'
    if (isUntestable) {
      for (let t = 0; t < state.tests.length; t++) {
        const condId = t + 1;
        if (!state.weaks[t] && isRelaxedCoveredBy(state.tests[t], requiredValues)) {
          coverage.set(condId, 'untestable');
        }
      }
    }

    // Build reason string
    let reason = '';
    if (isInfeasible) {
      reason = state.infeasibles[l] || 'Infeasible';
    } else if (isUntestable) {
      // Find MASK constraints from model
      const maskConstraints = model.constraints
        .filter(c => c.type === 'MASK')
        .map(formatConstraintDisplay);
      reason = maskConstraints.length > 0 ? maskConstraints.join(', ') : 'MASK';
    }

    if (isCovered) coveredCount++;
    if (isInfeasible) infeasibleCount++;
    if (isUntestable) untestableCount++;

    rows.push({
      expressionIndex: l + 1,
      edge,
      requiredValues,
      coverage,
      isCovered,
      isInfeasible,
      isUntestable,
      reason,
    });
  }

  const testable = state.expressions.length - infeasibleCount - untestableCount;
  const coveragePercent = testable > 0 ? (coveredCount / testable) * 100 : 100;

  return {
    rows,
    nodeNames,
    nodeLabels,
    conditionIds,
    stats: {
      totalExpressions: state.expressions.length,
      coveredExpressions: coveredCount,
      infeasibleExpressions: infeasibleCount,
      untestableExpressions: untestableCount,
      coveragePercent,
    },
  };
}

/**
 * Get coverage marker display character.
 *
 * Symbols (Algorithm_Design.md §13.3, §13.4.3):
 * - # : first coverage (first non-weak test to cover this expression)
 * - x : additional coverage (expression already covered by a previous test)
 * - - : infeasible (constraint violation, cannot execute)
 * - ? : untestable (can execute, but result unknown due to MASK)
 * - (blank) : not covered
 */
export function getCoverageMarkerDisplay(marker: CoverageMarker): string {
  switch (marker) {
    case 'adopted':
      return '#';
    case 'covered':
      return 'x';
    case 'not_covered':
      return '';
    case 'infeasible':
      return '-';
    case 'untestable':
      return '?';
  }
}

/**
 * Get edge display label
 */
export function getEdgeLabel(edge: LogicalEdge): string {
  return edge.label;
}
