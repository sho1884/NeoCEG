/**
 * Node Display Utilities
 *
 * Centralized logic for determining what text to display for nodes.
 * All display code should use these functions instead of accessing node.label directly.
 *
 * Rules:
 * - If label is a non-empty string: show the label (the node's proposition)
 * - Otherwise: show the node's identifier (name)
 * The logical expression is NEVER the display name — it is shown only as a
 * tooltip (see getNodeExpressionText).
 */

import type { LogicalNode, Expression } from '../types/logical';
import { serializeExpression } from '../services/logicalDslSerializer';

/**
 * Get the display text for a node.
 * This is THE canonical way to get what should be displayed for a node.
 *
 * Priority:
 * 1. User-provided label (non-empty string)
 * 2. Node identifier (name) — a meaningful id is the node's name; an auto
 *    placeholder id (e.g. "Logical Statement 3") prompts the user to name it.
 *
 * The logical expression is NOT used as the name (it would go stale when the
 * graph changes); it is shown only as a tooltip — see getNodeExpressionText.
 */
export function getNodeDisplayText(node: LogicalNode): string {
  if (node.label && node.label.trim() !== '') {
    return node.label;
  }
  return node.name;
}

/**
 * Get the expression text for a node (for tooltips).
 * Returns null if the node has no expression (i.e., it's a cause node).
 */
export function getNodeExpressionText(node: LogicalNode): string | null {
  if (!node.expression) {
    return null;
  }
  return serializeExpression(node.expression);
}

/**
 * Check if a node has a user-provided label.
 * Useful for determining if the label should be auto-updated when expression changes.
 */
export function hasUserLabel(node: LogicalNode): boolean {
  return node.label !== null && node.label !== undefined && node.label.trim() !== '';
}

/**
 * Get display text from an expression directly.
 * Useful when you have an expression but not a full node.
 */
export function getExpressionDisplayText(expr: Expression): string {
  return serializeExpression(expr);
}
