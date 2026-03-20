/**
 * NeoCEG Graph Model Types
 * Based on Requirements Specification and Myers "The Art of Software Testing"
 */

// =============================================================================
// Node Types
// =============================================================================

/** Logical operator for combining inputs */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Node role derived from graph structure
 * - cause: in-degree 0 (input node)
 * - intermediate: has both in and out edges
 * - effect: out-degree 0 (output node)
 */
export type NodeRole = 'cause' | 'intermediate' | 'effect';

/** CEG Node data stored in React Flow node */
export interface CEGNodeData {
  /** Display label (Unicode allowed, e.g., Japanese) */
  label: string;
  /** Logical operator for combining inputs (undefined for cause nodes) */
  operator?: LogicalOperator;
  /** Node display width in pixels (default: 150, min: 80, max: 400) */
  width?: number;
  /** Observable flag - default true. Set to false for non-observable nodes */
  observable?: boolean;
}

/** Node rendering constants per requirements specification */
export const NODE_RENDERING = {
  DEFAULT_WIDTH: 150,
  MIN_WIDTH: 80,
  MAX_WIDTH: 400,
} as const;

/** React Flow node with CEG-specific data */
export interface CEGNode {
  id: string;
  type: 'cegNode';
  position: { x: number; y: number };
  data: CEGNodeData;
}

// =============================================================================
// Edge Types
// =============================================================================

/** Logical edge data */
export interface LogicalEdgeData {
  /** Type discriminator */
  edgeType: 'logical';
  /** Whether this edge represents NOT (negative logic) */
  negated: boolean;
}

/** Constraint edge data (connects constraint node to member node) */
export interface ConstraintEdgeData {
  /** Type discriminator */
  edgeType: 'constraint';
  /** Whether this member reference is negated (NOT) */
  negated: boolean;
  /** For directional constraints (REQ/MASK): is this the source/trigger edge? */
  isSource?: boolean;
  /** Is this a directional constraint (REQ/MASK)? */
  isDirectional?: boolean;
  /** Is this a MASK constraint? */
  isMask?: boolean;
}

export type CEGEdgeData = LogicalEdgeData | ConstraintEdgeData;

/** React Flow edge with CEG-specific data */
export interface CEGEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data: CEGEdgeData;
}

// =============================================================================
// Constraint Types
// =============================================================================

/** Constraint types based on Myers notation */
export type ConstraintType = 'ONE' | 'EXCL' | 'INCL' | 'REQ' | 'MASK';

/** Member reference in a constraint (may be negated) */
export interface ConstraintMember {
  /** Node ID */
  nodeId: string;
  /** Whether this reference is negated (NOT) */
  negated: boolean;
}

/** Base constraint interface */
interface BaseConstraint {
  id: string;
  type: ConstraintType;
}

/**
 * ONE constraint: Exactly one of the members must be true
 * Myers symbol: O
 * Logic: ∑(effective_values) = 1
 */
export interface OneConstraint extends BaseConstraint {
  type: 'ONE';
  members: ConstraintMember[];
}

/**
 * EXCL constraint: At most one of the members can be true
 * Myers symbol: E
 * Logic: ∑(effective_values) <= 1
 */
export interface ExclConstraint extends BaseConstraint {
  type: 'EXCL';
  members: ConstraintMember[];
}

/**
 * INCL constraint: At least one of the members must be true
 * Myers symbol: I
 * Logic: ∑(effective_values) >= 1
 */
export interface InclConstraint extends BaseConstraint {
  type: 'INCL';
  members: ConstraintMember[];
}

/**
 * REQ constraint: If source is true, all targets must be true
 * Myers symbol: R
 * Logic: source → (target1 ∧ target2 ∧ ...)
 * Supports NOT on source: ¬source → targets
 * Supports NOT on targets: source → ¬target
 */
export interface ReqConstraint extends BaseConstraint {
  type: 'REQ';
  source: ConstraintMember;
  targets: ConstraintMember[];
}

/**
 * MASK constraint: When trigger is true, targets become indeterminate
 * Myers symbol: M
 * Logic: trigger=T → targets=M (masked/don't care)
 * Supports NOT on trigger: ¬trigger=T (i.e., trigger=F) → targets=M
 */
export interface MaskConstraint extends BaseConstraint {
  type: 'MASK';
  trigger: ConstraintMember;
  targets: ConstraintMember[];
}

export type Constraint = OneConstraint | ExclConstraint | InclConstraint | ReqConstraint | MaskConstraint;

// =============================================================================
// Constraint Node (for React Flow rendering)
// =============================================================================

/** Constraint node data for React Flow */
export interface ConstraintNodeData {
  /** Constraint type */
  constraintType: ConstraintType;
  /** Reference to the actual constraint object */
  constraintId: string;
}

/** React Flow node representing a constraint */
export interface ConstraintNode {
  id: string;
  type: 'constraintNode';
  position: { x: number; y: number };
  data: ConstraintNodeData;
}

// =============================================================================
// Graph State
// =============================================================================

/** Complete graph state */
export interface GraphState {
  nodes: CEGNode[];
  constraintNodes: ConstraintNode[];
  edges: CEGEdge[];
  constraints: Constraint[];
}

// =============================================================================
// Decision Table Types
// =============================================================================

/** Truth value in decision table */
export type TruthValue = 'T' | 'F' | 'M' | 'I';

/** Test condition status */
export type ConditionStatus = 'valid' | 'infeasible' | 'untestable' | 'weak';

/** Single test condition (column in decision table) */
export interface TestCondition {
  /** Condition number */
  number: number;
  /** Cause values */
  causes: Record<string, TruthValue>;
  /** Effect values (calculated) */
  effects: Record<string, TruthValue>;
  /** Condition status */
  status: ConditionStatus;
  /** Violated constraint IDs (if infeasible) */
  violatedConstraints?: string[];
  /** MASK constraint info (if untestable) */
  maskSource?: {
    constraintId: string;
    propagationPath: string[];
  };
  /** Subsuming condition numbers (if weak) */
  subsumedBy?: number[];
}

/** Decision table */
export interface DecisionTable {
  /** Cause node IDs in order */
  causes: string[];
  /** Effect node IDs in order */
  effects: string[];
  /** Test conditions */
  conditions: TestCondition[];
}

// =============================================================================
// Rendering Constants (from Requirements Specification)
// =============================================================================

export const NODE_COLORS = {
  cause: {
    fill: '#e3f2fd',
    border: '#1976d2',
  },
  intermediate: {
    fill: '#e8eaf6',
    border: '#3949ab',
  },
  effect: {
    fill: '#f3e5f5',
    border: '#7b1fa2',
  },
} as const;

export const EDGE_COLORS = {
  logical: {
    positive: '#333333',
    negative: '#1976d2', // Blue for NOT
  },
  constraint: {
    positive: '#9e9e9e',
    negative: '#64b5f6', // Light blue for constraint NOT
  },
} as const;

export const CONSTRAINT_COLORS = {
  ONE: '#757575',   // Gray (unified)
  EXCL: '#757575',  // Gray (unified)
  INCL: '#757575',  // Gray (unified)
  REQ: '#757575',   // Gray (unified)
  MASK: '#757575',  // Gray (unified)
} as const;

export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  ONE: 'One',
  EXCL: 'Excl',
  INCL: 'Incl',
  REQ: 'Req',
  MASK: 'Mask',
} as const;
