/**
 * Logical DSL Serializer
 *
 * Converts a LogicalModel to the human-readable DSL format.
 *
 * Output format:
 * ```
 * # NeoCEG Graph Definition
 *
 * # Causes (inputs)
 * 入力A: "ユーザーがボタンをクリック"
 * 入力B: "ネットワーク接続あり"
 *
 * # Effects/Intermediates
 * 結果 := 入力A AND 入力B
 * エラー := 入力A AND NOT 入力B
 *
 * # Constraints
 * EXCL(結果, エラー)
 *
 * # Layout (optional)
 * @layout {
 *   入力A: (100, 100)
 * }
 * ```
 */

import type {
  LogicalModel,
  LogicalConstraint,
  ConstraintMemberRef,
  Expression,
} from '../types/logical';

// =============================================================================
// Serialization Options
// =============================================================================

export interface SerializeOptions {
  /** Include layout section */
  includeLayout?: boolean;
  /** Include comments */
  includeComments?: boolean;
}

// =============================================================================
// Expression Serialization
// =============================================================================

/**
 * Serialize an expression to DSL string
 * Exported for use in nodeDisplay utilities
 */
export function serializeExpression(expr: Expression, parentPrecedence: number = 0): string {
  switch (expr.type) {
    case 'ref':
      return expr.name;

    case 'not': {
      const operand = serializeExpression(expr.operand, 3);
      return `NOT ${operand}`;
    }

    case 'and': {
      const parts = expr.operands.map((op) => serializeExpression(op, 2));
      const result = parts.join(' AND ');
      // Add parentheses if we're inside an OR
      return parentPrecedence > 2 ? `(${result})` : result;
    }

    case 'or': {
      const parts = expr.operands.map((op) => serializeExpression(op, 1));
      const result = parts.join(' OR ');
      // Add parentheses if needed
      return parentPrecedence > 1 ? `(${result})` : result;
    }
  }
}

// =============================================================================
// Constraint Serialization
// =============================================================================

function serializeMember(member: ConstraintMemberRef): string {
  return member.negated ? `NOT ${member.name}` : member.name;
}

function serializeConstraint(constraint: LogicalConstraint): string {
  switch (constraint.type) {
    case 'ONE':
    case 'EXCL':
    case 'INCL': {
      const members = constraint.members.map(serializeMember).join(', ');
      return `${constraint.type}(${members})`;
    }

    case 'REQ': {
      // REQ: NOT allowed on source or targets (not both simultaneously)
      const source = serializeMember(constraint.source);
      const targets = constraint.targets.map(serializeMember).join(', ');
      return `REQ(${source} -> ${targets})`;
    }

    case 'MASK': {
      // MASK trigger: NOT allowed
      const trigger = serializeMember(constraint.trigger);
      // MASK targets: NOT not allowed
      const targets = constraint.targets.map(t => t.name).join(', ');
      return `MASK(${trigger} -> ${targets})`;
    }
  }
}

// =============================================================================
// Label Escaping
// =============================================================================

function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

// =============================================================================
// Main Serialization
// =============================================================================

/**
 * Serialize LogicalModel to DSL string
 *
 * Format:
 * 1. Propositions - symbol: "label" [unobservable] mappings
 * 2. Logical Relations - symbol := expression definitions
 * 3. Constraints
 * 4. Layout (optional)
 */
export function serializeLogicalModel(
  model: LogicalModel,
  options: SerializeOptions = {}
): string {
  const { includeLayout = true, includeComments = true } = options;
  const lines: string[] = [];

  // Header
  if (includeComments) {
    lines.push('# NeoCEG Graph Definition');
    lines.push(`# Exported: ${new Date().toISOString()}`);
    lines.push('');
  }

  // Collect all nodes
  const allNodes = Array.from(model.nodes.values());
  const nodesWithExpression = allNodes.filter((n) => n.expression);

  // Section 1: Propositions (命題記号と名前の対応)
  if (allNodes.length > 0) {
    if (includeComments) {
      lines.push('# Propositions (命題)');
    }
    for (const node of allNodes) {
      // Label (use name as fallback if null/empty)
      const label = node.label && node.label.trim() !== '' ? node.label : node.name;
      const escapedLabel = escapeLabel(label);
      let line = `${node.name}: "${escapedLabel}"`;

      // Add unobservable flag when explicitly non-observable
      if (node.observable === false) {
        line += ' [unobservable]';
      }
      lines.push(line);
    }
    lines.push('');
  }

  // Section 2: Logical Relations (論理式)
  if (nodesWithExpression.length > 0) {
    if (includeComments) {
      lines.push('# Logical Relations (論理式)');
    }
    for (const node of nodesWithExpression) {
      const exprStr = serializeExpression(node.expression!);
      lines.push(`${node.name} := ${exprStr}`);
    }
    lines.push('');
  }

  // Constraints section
  if (model.constraints.length > 0) {
    if (includeComments) {
      lines.push('# Constraints');
    }
    for (const constraint of model.constraints) {
      lines.push(serializeConstraint(constraint));
    }
    lines.push('');
  }

  // Layout section
  if (includeLayout) {
    const nodesWithLayout = Array.from(model.nodes.values()).filter((n) => n.position);
    const constraintsWithLayout = model.constraints
      .map((c, index) => ({ constraint: c, index }))
      .filter(({ constraint }) => constraint.position);

    if (nodesWithLayout.length > 0 || constraintsWithLayout.length > 0) {
      if (includeComments) {
        lines.push('# Layout');
      }
      lines.push('@layout {');

      // Node positions (with optional width)
      for (const node of nodesWithLayout) {
        if (node.position) {
          const x = Math.round(node.position.x);
          const y = Math.round(node.position.y);
          if (node.width !== undefined) {
            lines.push(`  ${node.name}: (${x}, ${y}, ${Math.round(node.width)})`);
          } else {
            lines.push(`  ${node.name}: (${x}, ${y})`);
          }
        }
      }

      // Constraint positions (c0, c1, etc.)
      for (const { constraint, index } of constraintsWithLayout) {
        if (constraint.position) {
          const x = Math.round(constraint.position.x);
          const y = Math.round(constraint.position.y);
          lines.push(`  c${index}: (${x}, ${y})`);
        }
      }

      lines.push('}');
    }
  }

  return lines.join('\n');
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Download DSL as file
 */
export function downloadLogicalDSL(content: string, filename: string = 'graph.nceg'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy DSL to clipboard
 */
export async function copyLogicalDSLToClipboard(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}
