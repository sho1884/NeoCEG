/**
 * Skeleton exporter — decision table → program control-structure skeleton.
 *
 * Mechanically derives a nested `if/else` skeleton (plus action stubs) from a
 * Cause-Effect-Graph decision table. Fully deterministic, no AI. The table is
 * already MC/DC-pruned, so each non-excluded column is a necessary control path;
 * this exporter *renders* the columns as explicitly-guarded paths and factors
 * shared conditions into nesting. It never re-prunes and never lets an effect
 * become the fall-through (the table is a cover — only the default leaf falls
 * through).
 *
 * Node ids stay the code identifiers (labels may contain spaces); the human
 * label of each node is surfaced as a comment — a legend block for causes and
 * intermediate definitions up front, plus an inline comment on each guard/return.
 *
 * See `Doc/Skeleton_Generator_Prototype_Spec.md` §11 for the integration design.
 */

import type { DecisionTable, TestCondition, TruthValue } from '../types/decisionTable';
import type { LogicalModel } from '../types/logical';
import { serializeExpression } from './logicalDslSerializer';

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

interface Literal {
  cond: string;
  value: boolean;
}

interface ControlPath {
  columnId: number;
  /** Effect ids firing on this path (cells at uppercase `T`). */
  actions: string[];
  /** Minimal distinguishing conjunction, most-discriminating literal first. */
  guard: Literal[];
}

type Node =
  | { kind: 'guard'; cond: string; then: Node[]; else: Node[] }
  | { kind: 'return'; actions: string[]; columnId: number };

const INDENT = '    ';

/** Map a cell to a boolean, or undefined for absent / indeterminate (M/I). */
function toBool(v: TruthValue | undefined): boolean | undefined {
  if (v === 'T' || v === 't') return true;
  if (v === 'F' || v === 'f') return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Step 1–2: columns → control paths with minimal distinguishing guards
// ---------------------------------------------------------------------------

function extractControlPaths(table: DecisionTable): { paths: ControlPath[]; skipped: number[] } {
  const condIds = [...table.causeIds, ...table.intermediateIds];
  const active = table.conditions.filter((c) => !c.excluded);

  const actionOf = (col: TestCondition): string[] =>
    table.effectIds.filter((e) => col.values.get(e) === 'T');
  const actionKey = (col: TestCondition): string => actionOf(col).join('+');

  const skipped: number[] = [];
  const live = active.filter((col) => {
    if (actionOf(col).length > 0) return true;
    const indeterminate = table.effectIds.some(
      (e) => col.values.get(e) === 'M' || col.values.get(e) === 'I',
    );
    if (indeterminate) skipped.push(col.id);
    return false;
  });

  const paths = live.map((col): ControlPath => {
    const myKey = actionKey(col);
    let remaining = live.filter((other) => actionKey(other) !== myKey);
    const guard: Literal[] = [];
    const used = new Set<string>();

    while (remaining.length > 0) {
      let best: { cond: string; sep: TestCondition[] } | null = null;
      for (const cond of condIds) {
        if (used.has(cond)) continue;
        const myVal = toBool(col.values.get(cond));
        if (myVal === undefined) continue;
        const sep = remaining.filter((other) => {
          const ov = toBool(other.values.get(cond));
          return ov !== undefined && ov !== myVal;
        });
        if (sep.length === 0) continue;
        if (best === null || sep.length > best.sep.length) best = { cond, sep };
      }
      if (best === null) break;
      used.add(best.cond);
      guard.push({ cond: best.cond, value: toBool(col.values.get(best.cond))! });
      const sepSet = new Set(best.sep);
      remaining = remaining.filter((other) => !sepSet.has(other));
    }

    return { columnId: col.id, actions: actionOf(col), guard };
  });

  return { paths, skipped };
}

// ---------------------------------------------------------------------------
// Step 3: factor paths into a nested if/else tree
// ---------------------------------------------------------------------------

function build(paths: ControlPath[], depth: number): Node[] {
  const terminated = paths.filter((p) => p.guard.length <= depth);
  const activePaths = paths.filter((p) => p.guard.length > depth);

  const order: string[] = [];
  const byCond = new Map<string, ControlPath[]>();
  for (const p of activePaths) {
    const cond = p.guard[depth].cond;
    if (!byCond.has(cond)) {
      byCond.set(cond, []);
      order.push(cond);
    }
    byCond.get(cond)!.push(p);
  }

  const guards: Node[] = order.map((cond) => {
    const group = byCond.get(cond)!;
    return {
      kind: 'guard',
      cond,
      then: build(group.filter((p) => p.guard[depth].value === true), depth + 1),
      else: build(group.filter((p) => p.guard[depth].value === false), depth + 1),
    };
  });

  const returns: Node[] = terminated.map((p) => ({
    kind: 'return',
    actions: p.actions,
    columnId: p.columnId,
  }));

  return [...guards, ...returns];
}

// ---------------------------------------------------------------------------
// Step 4–6: emit pseudo-code
// ---------------------------------------------------------------------------

function emitNodes(
  nodes: Node[],
  depth: number,
  label: (id: string) => string,
  lines: string[],
): void {
  const pad = INDENT.repeat(depth);
  for (const node of nodes) {
    if (node.kind === 'return') {
      const value = node.actions.map(label).join(' + ') || 'None';
      lines.push(`${pad}return ${value}      # ${node.actions.join('+')} (#${node.columnId})`);
      continue;
    }
    const hasThen = node.then.length > 0;
    const hasElse = node.else.length > 0;
    const labelComment = labelOf(node.cond, label);
    if (hasThen) {
      lines.push(`${pad}if ${node.cond}:${labelComment}`);
      emitNodes(node.then, depth + 1, label, lines);
      if (hasElse) {
        lines.push(`${pad}else:`);
        emitNodes(node.else, depth + 1, label, lines);
      }
    } else if (hasElse) {
      lines.push(`${pad}if not ${node.cond}:${labelComment}`);
      emitNodes(node.else, depth + 1, label, lines);
    }
  }
}

/** Inline ` # label` comment when the node has a label distinct from its id. */
function labelOf(id: string, label: (id: string) => string): string {
  const l = label(id);
  return l && l !== id ? `      # ${l}` : '';
}

/**
 * Generate a pseudo-code skeleton from a decision table.
 *
 * @param table       The optimized (feasible) decision table.
 * @param nodeLabels  id → human label; used for the legend and effect returns.
 * @param model       Optional logical model; when present, intermediate nodes
 *                    are defined from their expressions (otherwise they appear
 *                    as named conditions).
 */
export function generateSkeletonPseudoCode(
  table: DecisionTable,
  nodeLabels: Map<string, string>,
  model?: LogicalModel | null,
): string {
  const label = (id: string) => nodeLabels.get(id) ?? id;
  const { paths, skipped } = extractControlPaths(table);
  const body = build(paths, 0);

  const lines: string[] = [];
  lines.push(`function decide(${table.causeIds.join(', ')}):`);

  // Legend: each cause with a human label.
  const labelledCauses = table.causeIds.filter((id) => label(id) !== id);
  if (labelledCauses.length > 0) {
    lines.push(`${INDENT}# causes:`);
    for (const id of labelledCauses) {
      lines.push(`${INDENT}#   ${id} = ${label(id)}`);
    }
  }

  // Intermediates: definitions from expressions when available, else named.
  if (table.intermediateIds.length > 0) {
    for (const id of table.intermediateIds) {
      const expr = model?.nodes.get(id)?.expression;
      if (expr) {
        lines.push(`${INDENT}${id} = ${serializeExpression(expr)}${labelOf(id, label)}`);
      } else {
        lines.push(`${INDENT}# ${id} (intermediate condition)${labelOf(id, label)}`);
      }
    }
    lines.push('');
  } else if (labelledCauses.length > 0) {
    lines.push('');
  }

  emitNodes(body, 1, label, lines);

  for (const col of skipped) {
    lines.push(`${INDENT}# column #${col} skipped: action is M/I (untestable)`);
  }
  lines.push(`${INDENT}return None      # default: reached by no column`);

  return lines.join('\n') + '\n';
}
