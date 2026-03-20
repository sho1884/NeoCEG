/**
 * CEG Algorithm Types
 *
 * Data structures for the CEG test condition generation algorithm.
 * Corresponds to Algorithm_Design.md §3.
 *
 * Key distinction from decisionTable.ts:
 * - These types are internal to the algorithm
 * - decisionTable.ts types are the public output interface
 *
 * Reference: Doc/Algorithm_Design.md §3 "Data Structures"
 */

import type { TruthValue } from './decisionTable';

// =============================================================================
// §3.1 Logical Expression (logics[l][k])
// =============================================================================

/**
 * Required value in a logical expression.
 * Always uppercase: 'T' or 'F'. Never lowercase, M, or I.
 *
 * Reference: Algorithm_Design.md §3.1
 * "logics配列の値は常に大文字 ("T", "F") である"
 */
export type ExpressionRequiredValue = 'T' | 'F';

/**
 * A single logical expression (one row of logics[][]).
 *
 * Each expression represents one condition to be covered.
 * For an AND/OR node with n inputs, there are (n+1) expressions.
 *
 * The requiredValues map only contains entries for the owner node
 * and its direct inputs. Other nodes are irrelevant ("").
 *
 * Reference: Algorithm_Design.md §3.1, §4
 */
export interface LogicalExpression {
  /** Global expression index (0-based, corresponds to 'l' in logics[l][k]) */
  index: number;

  /** The node this expression was generated from */
  ownerNode: string;

  /** Column index within the owner node's expressions (0-based) */
  column: number;

  /**
   * Required values for relevant nodes.
   * Key: node name, Value: 'T' or 'F'
   *
   * Only contains the owner node and its direct inputs.
   * Nodes not in this map are irrelevant ("" in CEGTest).
   *
   * Example for AND(A, B) -> C, expression "A fails":
   *   { "A": "F", "B": "T", "C": "F" }
   */
  requiredValues: Map<string, ExpressionRequiredValue>;
}

// =============================================================================
// §3.2 Work Array (work[k])
// =============================================================================

/**
 * Value in the work array during test condition generation.
 * Includes all TruthValue variants plus '' (unset).
 *
 * Reference: Algorithm_Design.md §3.2
 */
export type WorkValue = TruthValue | '';

// =============================================================================
// §3.6 Turn Choice (turns[])
// =============================================================================

/**
 * A single choice recorded in the turns history.
 *
 * CEGTest encodes this as integers:
 * - < lnum: expression index
 * - >= lnum: cause value (lnum + nodeIndex*2 for T, +1 for F)
 *
 * NeoCEG uses a discriminated union for clarity.
 *
 * Reference: Algorithm_Design.md §3.6
 */
export type TurnChoice =
  | { type: 'expression'; expressionIndex: number }
  | { type: 'causeValue'; nodeName: string; value: 'T' | 'F' };

// =============================================================================
// Algorithm State
// =============================================================================

/**
 * Complete algorithm state during test condition generation.
 *
 * Combines all data structures from Algorithm_Design.md §3.
 */
export interface AlgorithmState {
  // --- §3.1 Logical expressions ---

  /** All logical expressions extracted from the model (logics[][]) */
  expressions: LogicalExpression[];

  /** Total number of expressions (lnum) - §3.10 */
  lnum: number;

  // --- §3.2 Working values ---

  /**
   * Current working values for each node (work[]).
   * '' means unset/unassigned.
   */
  work: Map<string, WorkValue>;

  // --- §3.3 Generated test conditions ---

  /**
   * Generated test conditions (tests[][]).
   * Each entry is a complete set of node values for one test.
   */
  tests: Map<string, TruthValue>[];

  // --- §3.4 Coverage ---

  /**
   * Coverage matrix (covs[][]).
   * covs[t][l] = true if test condition t covers expression l.
   */
  covs: boolean[][];

  // --- §3.5 Current test coverage ---

  /**
   * Coverage of the test condition currently being generated (vtestcov[]).
   * vtestcov[l] = true if the current work[] covers expression l.
   */
  vtestcov: boolean[];

  // --- §3.6 Turn history ---

  /**
   * Choices made during current test condition generation (turns[]).
   * Used for backtracking (reCalc).
   */
  turns: TurnChoice[];

  // --- §3.7 Unsuitable marks ---

  /** Expression indices marked as unsuitable for current attempt */
  unsuitableExpressions: Set<number>;

  /** Cause value assignments marked as unsuitable: "nodeName:T" or "nodeName:F" */
  unsuitableCauseValues: Set<string>;

  // --- §3.8 Infeasible expressions ---

  /**
   * Infeasible expression marks (infeasibles[]).
   * null = feasible, string = reason for infeasibility.
   */
  infeasibles: (string | null)[];

  // --- §3.9 Weak test marks ---

  /**
   * Weak test marks (weaks[]).
   * true = weak test (candidate for removal).
   */
  weaks: boolean[];
}

// =============================================================================
// Helper: Unsuitable cause value encoding
// =============================================================================

/**
 * Encode a cause value choice as a string key for the unsuitables set.
 */
export function encodeCauseChoice(nodeName: string, value: 'T' | 'F'): string {
  return `${nodeName}:${value}`;
}

/**
 * Decode a cause value choice string key.
 */
export function decodeCauseChoice(key: string): { nodeName: string; value: 'T' | 'F' } {
  const lastColon = key.lastIndexOf(':');
  return {
    nodeName: key.substring(0, lastColon),
    value: key.substring(lastColon + 1) as 'T' | 'F',
  };
}
