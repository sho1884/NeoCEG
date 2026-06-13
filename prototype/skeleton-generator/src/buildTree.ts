/**
 * Factor control paths into a nested if/else skeleton (§5 step 3).
 *
 * Paths are grouped by their leading (most-discriminating) guard literal: a
 * shared condition is tested once and its columns nested beneath it. Two columns
 * that share a condition with opposite values factor into `then`/`else`.
 * Factoring never merges two columns into one path — path count = column count.
 */

import type { SkeletonInput, ControlPath, Node, Skeleton } from './types.js';
import { extractControlPaths } from './paths.js';

/** Build the node list for paths that already share `guard[0..depth-1]`. */
function build(paths: ControlPath[], depth: number): Node[] {
  // Paths whose guard is exhausted fire unconditionally here (placed last, so
  // the more specific guarded siblings are tested first).
  const terminated = paths.filter((p) => p.guard.length <= depth);
  const active = paths.filter((p) => p.guard.length > depth);

  const order: string[] = [];
  const byCond = new Map<string, ControlPath[]>();
  for (const p of active) {
    const cond = p.guard[depth].cond;
    if (!byCond.has(cond)) {
      byCond.set(cond, []);
      order.push(cond);
    }
    byCond.get(cond)!.push(p);
  }

  const guards: Node[] = order.map((cond) => {
    const group = byCond.get(cond)!;
    const thenPaths = group.filter((p) => p.guard[depth].value === true);
    const elsePaths = group.filter((p) => p.guard[depth].value === false);
    return {
      kind: 'guard',
      cond,
      then: build(thenPaths, depth + 1),
      else: build(elsePaths, depth + 1),
    };
  });

  const returns: Node[] = terminated.map((p) => ({
    kind: 'return',
    actions: p.actions,
    columnId: p.columnId,
  }));

  return [...guards, ...returns];
}

export function buildSkeleton(input: SkeletonInput): Skeleton {
  const { paths, skipped } = extractControlPaths(input);
  const body = build(paths, 0);

  const intermediateDefs: Record<string, string> = {};
  if (input.expressions) {
    for (const id of input.intermediateIds) {
      const expr = input.expressions[id];
      if (expr) intermediateDefs[id] = expr;
    }
  }

  return {
    causeIds: input.causeIds,
    intermediateIds: input.intermediateIds,
    labels: input.labels ?? {},
    intermediateDefs,
    skipped,
    body,
    defaultReturn: 'None',
  };
}
