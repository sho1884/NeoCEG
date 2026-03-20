/**
 * Logical Model Types for NeoCEG
 *
 * This represents the core logical structure of a Cause-Effect Graph.
 * The graph visualization is derived from this model, not the other way around.
 *
 * Design principle: "The graph is a VIEW of the logical model"
 */

// =============================================================================
// Expression AST (Abstract Syntax Tree)
// =============================================================================

/**
 * Reference to another node by name
 */
export interface RefExpression {
  type: 'ref';
  name: string;
}

/**
 * NOT expression (negation)
 */
export interface NotExpression {
  type: 'not';
  operand: Expression;
}

/**
 * AND expression (conjunction)
 * All operands must be true for the result to be true
 */
export interface AndExpression {
  type: 'and';
  operands: Expression[];
}

/**
 * OR expression (disjunction)
 * At least one operand must be true for the result to be true
 */
export interface OrExpression {
  type: 'or';
  operands: Expression[];
}

/**
 * Logical expression (union type)
 */
export type Expression = RefExpression | NotExpression | AndExpression | OrExpression;

// =============================================================================
// Node Definition
// =============================================================================

/**
 * A node in the cause-effect graph
 *
 * - If expression is undefined, this is a "cause" (input/leaf node)
 * - If expression is defined, this is an "intermediate" or "effect" node
 */
export interface LogicalNode {
  /** Unique identifier (used in expressions and DSL) */
  name: string;

  /**
   * Display label (can contain Unicode, e.g., Japanese)
   * - null or empty: Display the expression instead (auto mode)
   * - non-empty string: Display this label (user mode)
   *
   * Use getNodeDisplayText() from utils/nodeDisplay.ts to get the actual display text.
   */
  label: string | null;

  /**
   * Logical expression defining this node's value
   * - undefined: This is a cause (input node, value set by test condition)
   * - defined: This is computed from other nodes
   */
  expression?: Expression;

  /**
   * Whether this node is observable (can be directly tested/measured).
   * Default is true (observable). Only set to false for non-observable nodes.
   * In DSL: omitted when true/undefined (default), written as [unobservable] when false.
   */
  observable?: boolean;

  /** Optional position for graph layout */
  position?: { x: number; y: number };

  /** Optional width for display */
  width?: number;
}

// =============================================================================
// Constraints (same structure as before, but using node names)
// =============================================================================

/**
 * Reference to a node in a constraint (may be negated)
 */
export interface ConstraintMemberRef {
  /** Node name (not ID) */
  name: string;
  /** Whether this reference is negated */
  negated: boolean;
}

/** Constraint types based on Myers notation */
export type ConstraintType = 'ONE' | 'EXCL' | 'INCL' | 'REQ' | 'MASK';

/**
 * ONE constraint: Exactly one of the members must be true
 */
export interface OneConstraint {
  type: 'ONE';
  members: ConstraintMemberRef[];
  /** Optional position for constraint node */
  position?: { x: number; y: number };
}

/**
 * EXCL constraint: At most one of the members can be true
 */
export interface ExclConstraint {
  type: 'EXCL';
  members: ConstraintMemberRef[];
  position?: { x: number; y: number };
}

/**
 * INCL constraint: At least one of the members must be true
 */
export interface InclConstraint {
  type: 'INCL';
  members: ConstraintMemberRef[];
  position?: { x: number; y: number };
}

/**
 * REQ constraint: If source is true, all targets must be true
 */
export interface ReqConstraint {
  type: 'REQ';
  source: ConstraintMemberRef;
  targets: ConstraintMemberRef[];
  position?: { x: number; y: number };
}

/**
 * MASK constraint: When trigger is true, targets become indeterminate
 */
export interface MaskConstraint {
  type: 'MASK';
  trigger: ConstraintMemberRef;
  targets: ConstraintMemberRef[];
  position?: { x: number; y: number };
}

export type LogicalConstraint =
  | OneConstraint
  | ExclConstraint
  | InclConstraint
  | ReqConstraint
  | MaskConstraint;

// =============================================================================
// Complete Logical Model
// =============================================================================

/**
 * The complete logical model of a Cause-Effect Graph
 *
 * This is the source of truth. The visual graph is derived from this.
 */
export interface LogicalModel {
  /** All nodes, keyed by name */
  nodes: Map<string, LogicalNode>;

  /** All constraints */
  constraints: LogicalConstraint[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a reference expression
 */
export function ref(name: string): RefExpression {
  return { type: 'ref', name };
}

/**
 * Create a NOT expression
 */
export function not(operand: Expression): NotExpression {
  return { type: 'not', operand };
}

/**
 * Create an AND expression
 */
export function and(...operands: Expression[]): AndExpression {
  return { type: 'and', operands };
}

/**
 * Create an OR expression
 */
export function or(...operands: Expression[]): OrExpression {
  return { type: 'or', operands };
}

/**
 * Check if a node is a cause (no expression)
 */
export function isCause(node: LogicalNode): boolean {
  return node.expression === undefined;
}

/**
 * Check if a node is an effect (has expression, no dependents)
 */
export function isEffect(node: LogicalNode, model: LogicalModel): boolean {
  if (!node.expression) return false;

  // Check if any other node references this one
  for (const [, otherNode] of model.nodes) {
    if (otherNode.expression && referencesNode(otherNode.expression, node.name)) {
      return false; // This node is referenced by another, so it's intermediate
    }
  }
  return true;
}

/**
 * Check if an expression references a specific node
 */
export function referencesNode(expr: Expression, nodeName: string): boolean {
  switch (expr.type) {
    case 'ref':
      return expr.name === nodeName;
    case 'not':
      return referencesNode(expr.operand, nodeName);
    case 'and':
    case 'or':
      return expr.operands.some((op) => referencesNode(op, nodeName));
  }
}

/**
 * Get all node names referenced in an expression
 */
export function getReferencedNodes(expr: Expression): Set<string> {
  const refs = new Set<string>();

  function collect(e: Expression) {
    switch (e.type) {
      case 'ref':
        refs.add(e.name);
        break;
      case 'not':
        collect(e.operand);
        break;
      case 'and':
      case 'or':
        e.operands.forEach(collect);
        break;
    }
  }

  collect(expr);
  return refs;
}

/**
 * Get the top-level operator of an expression (AND or OR)
 * Returns undefined if the expression is a simple ref or not
 */
export function getTopOperator(expr: Expression): 'AND' | 'OR' | undefined {
  switch (expr.type) {
    case 'and':
      return 'AND';
    case 'or':
      return 'OR';
    default:
      return undefined;
  }
}
