/**
 * Coverage Table Types
 *
 * Defines types for coverage analysis of logical expressions.
 * Shows which test conditions cover (exercise) each logical expression.
 *
 * Coverage means the test condition demonstrates the effect of the expression.
 */

import type { TruthValue } from './decisionTable';

// =============================================================================
// Coverage Cell Values
// =============================================================================

/**
 * Coverage cell marker
 * - 'adopted': First test to cover this expression (display: #)
 * - 'covered': Additional test covering an already-covered expression (display: x)
 * - 'not_covered': Test condition doesn't exercise this expression (display: blank)
 * - 'infeasible': Expression is infeasible due to constraint violation (display: -)
 * - 'untestable': Expression is untestable due to MASK constraint (display: ?)
 *
 * Reference: Algorithm_Design.md §13.2, §13.4
 */
export type CoverageMarker = 'adopted' | 'covered' | 'not_covered' | 'infeasible' | 'untestable';

// =============================================================================
// Coverage Row
// =============================================================================

/**
 * A logical expression to be covered
 * Represents an edge in the CEG (source -> target with optional NOT)
 */
export interface LogicalEdge {
  /** Source node name */
  source: string;
  /** Target node name */
  target: string;
  /** Whether edge is negated (NOT) */
  negated: boolean;
  /** Display label for the edge */
  label: string;
  /**
   * Type of the edge
   * - 'logical': normal cause-effect relationship
   * - 'constraint': constraint-related edge
   */
  type: 'logical' | 'constraint';
}

/**
 * Coverage status for one logical expression across all test conditions
 *
 * CEGTest format: Each row shows the required values for each node,
 * plus coverage markers (#, x, blank) for each test condition.
 */
export interface CoverageRow {
  /** Expression index (1-based, for display as 論理式1, 論理式2, etc.) */
  expressionIndex: number;
  /** The logical expression (edge) being analyzed */
  edge: LogicalEdge;
  /**
   * Required values to cover this expression.
   * Maps node name to the truth value required.
   * Only nodes with specific requirements are included.
   *
   * Example: { "A": "T", "B": "F", "C": "T" }
   * means A must be True, B must be False, C must be True.
   */
  requiredValues: Map<string, TruthValue>;
  /** Coverage markers for each test condition (indexed by condition ID) */
  coverage: Map<number, CoverageMarker>;
  /** Whether this expression is ever covered by any test condition */
  isCovered: boolean;
  /** Whether this expression is infeasible (can never be tested) */
  isInfeasible: boolean;
  /** Whether this expression is untestable (due to MASK) */
  isUntestable: boolean;
  /** Reason string for infeasible/untestable expressions (e.g., "ONE(A, B, C)") */
  reason: string;
}

// =============================================================================
// Coverage Table
// =============================================================================

/**
 * Full coverage table
 *
 * CEGTest format:
 * - Rows: logical expressions (edges)
 * - Columns: node names (for required values) + test condition IDs (for coverage)
 */
export interface CoverageTable {
  /** All logical expressions (edges) in the graph */
  rows: CoverageRow[];
  /**
   * All node names in display order (causes, intermediates, effects).
   * Used as column headers for required values.
   */
  nodeNames: string[];
  /**
   * Node labels for display (maps node name to human-readable label).
   */
  nodeLabels: Map<string, string>;
  /** Test condition IDs (from decision table, feasible only) */
  conditionIds: number[];
  /** Statistics */
  stats: {
    /** Total number of logical expressions */
    totalExpressions: number;
    /** Number of covered expressions */
    coveredExpressions: number;
    /** Number of infeasible expressions */
    infeasibleExpressions: number;
    /** Number of untestable expressions */
    untestableExpressions: number;
    /** Coverage percentage (covered / (total - infeasible - untestable)) */
    coveragePercent: number;
  };
}

// =============================================================================
// Coverage Analysis Result
// =============================================================================

/**
 * Result of analyzing whether a test condition covers an expression
 */
export interface CoverageAnalysis {
  /** The source node's truth value in this condition */
  sourceValue: TruthValue;
  /** The target node's truth value in this condition */
  targetValue: TruthValue;
  /** Whether the expression is covered (source contributes to target's value) */
  isCovered: boolean;
  /** Reason for coverage/non-coverage */
  reason: string;
}
