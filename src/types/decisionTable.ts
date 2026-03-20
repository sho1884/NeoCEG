/**
 * Decision Table Types
 *
 * Types for decision table generation and display.
 * Reference: Myers "The Art of Software Testing" Chapter 4
 */

// =============================================================================
// Truth Values
// =============================================================================

/**
 * Extended truth values for CEG decision tables
 *
 * T: The node is true
 * t: Must logically be true (no matching true/false combination in expressions)
 * F: The node is false
 * f: Must logically be false (no matching true/false combination in expressions)
 * M: Truth value cannot be determined due to MASK constraint
 * I: Truth value cannot be determined (cause-side node indeterminate)
 */
export type TruthValue = 'T' | 'F' | 't' | 'f' | 'M' | 'I';

/**
 * Check if a value is true (T or t)
 */
export function isTrue(v: TruthValue): boolean {
  return v === 'T' || v === 't';
}

/**
 * Check if a value is false (F or f)
 */
export function isFalse(v: TruthValue): boolean {
  return v === 'F' || v === 'f';
}

/**
 * Check if a value is determinate (not M or I)
 */
export function isDeterminate(v: TruthValue): boolean {
  return v !== 'M' && v !== 'I';
}

// =============================================================================
// Logical Operations with M/I handling
// =============================================================================

/**
 * AND operation with M/I handling (CEGTest 1.6 bug fix)
 *
 * Rules:
 * - M AND M = I (both indeterminate)
 * - M AND T = I (one indeterminate)
 * - M AND F = F (F is certain, AND is F)
 * - I AND F = F (F is absorbing for AND)
 * - I AND T = I (indeterminate propagates)
 * - I AND I = I
 */
export function truthAnd(a: TruthValue, b: TruthValue): TruthValue {
  // If either is I, check for absorbing value (F AND anything = F)
  if (a === 'I' || b === 'I') {
    if (isFalse(a) || isFalse(b)) return 'f';
    return 'I';
  }

  // M handling
  if (a === 'M' || b === 'M') {
    // If the other is definitely false, AND is false
    if (isFalse(a) || isFalse(b)) return 'f';
    // Otherwise indeterminate
    return 'I';
  }

  // Both determinate
  return isTrue(a) && isTrue(b) ? 't' : 'f';
}

/**
 * OR operation with M/I handling
 *
 * Rules:
 * - M OR M = I (both indeterminate)
 * - M OR T = T (T is certain, OR is T)
 * - M OR F = I (one indeterminate)
 * - I OR x = I (indeterminate propagates, unless x is T)
 */
export function truthOr(a: TruthValue, b: TruthValue): TruthValue {
  // If either is definitely true, OR is true
  if (isTrue(a) || isTrue(b)) return 't';

  // If either is I, result is I
  if (a === 'I' || b === 'I') return 'I';

  // M handling
  if (a === 'M' || b === 'M') {
    return 'I';
  }

  // Both determinate false
  return 'f';
}

/**
 * NOT operation with M/I handling
 *
 * Rules:
 * - NOT T = F, NOT F = T
 * - NOT M = M (masked stays masked)
 * - NOT I = I (indeterminate stays indeterminate)
 */
export function truthNot(v: TruthValue): TruthValue {
  switch (v) {
    case 'T':
      return 'f';
    case 't':
      return 'f';
    case 'F':
      return 't';
    case 'f':
      return 't';
    case 'M':
      return 'M';
    case 'I':
      return 'I';
  }
}

// =============================================================================
// Test Condition
// =============================================================================

/**
 * A single test condition (column in decision table)
 */
export interface TestCondition {
  /** Unique identifier for this test condition */
  id: number;

  /** Values for each node (keyed by node ID) */
  values: Map<string, TruthValue>;

  /** Whether this condition is excluded */
  excluded: boolean;

  /** Reason for exclusion (if excluded) */
  exclusionReason?: ExclusionReason;
}

/**
 * Reason why a test condition is excluded
 */
export interface ExclusionReason {
  type: 'infeasible' | 'weak' | 'untestable' | 'redundant';

  /** For infeasible: which constraint was violated */
  constraintId?: string;

  /** For weak: which condition subsumes this one */
  subsumedBy?: number;

  /** Human-readable explanation */
  explanation: string;
}

// =============================================================================
// Decision Table
// =============================================================================

/**
 * Complete decision table
 */
export interface DecisionTable {
  /** Ordered list of cause node IDs (rows in cause section) */
  causeIds: string[];

  /** Ordered list of effect node IDs (rows in effect section) */
  effectIds: string[];

  /** Ordered list of intermediate node IDs (for display if needed) */
  intermediateIds: string[];

  /** All test conditions (columns) */
  conditions: TestCondition[];

  /** Constraint information for traceability */
  constraints: ConstraintInfo[];

  /** Statistics */
  stats: {
    totalConditions: number;
    feasibleConditions: number;
    infeasibleCount: number;
    weakCount: number;
    untestableCount: number;
  };
}

/**
 * Constraint information for traceability
 */
export interface ConstraintInfo {
  id: string;
  type: 'ONE' | 'EXCL' | 'INCL' | 'REQ' | 'MASK';
  memberIds: string[];
  description: string;
}

// =============================================================================
// Display Options
// =============================================================================

/**
 * Display mode for decision table
 */
export type DisplayMode = 'practice' | 'learning';

/**
 * Options for decision table display
 */
export interface DisplayOptions {
  mode: DisplayMode;
  showIntermediates: boolean;
  showExcludedConditions: boolean;
}

