/**
 * Node Display Utilities
 *
 * Centralized logic for determining what text to display for nodes.
 * All display code should use these functions instead of accessing node.label directly.
 *
 * Rules:
 * - If label is non-empty string: show label (user-provided)
 * - If label is empty/null and has expression: show expression
 * - Fallback: show node name
 */

import type { LogicalNode, Expression } from '../types/logical';
import { serializeExpression } from '../services/logicalDslSerializer';

/**
 * Get the display text for a node.
 * This is THE canonical way to get what should be displayed for a node.
 *
 * Priority:
 * 1. User-provided label (non-empty string)
 * 2. Serialized expression (for effect/intermediate nodes)
 * 3. Node name (fallback)
 */
export function getNodeDisplayText(node: LogicalNode): string {
  // User-provided label takes priority
  if (node.label && node.label.trim() !== '') {
    return node.label;
  }

  // Show expression if available
  if (node.expression) {
    return serializeExpression(node.expression);
  }

  // Fallback to name
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
