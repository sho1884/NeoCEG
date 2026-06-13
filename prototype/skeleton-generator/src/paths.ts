/**
 * Columns -> control paths (§5 steps 1–2).
 *
 * Each non-excluded column becomes one explicitly-guarded control path. The
 * guard is the *minimal* set of conditions whose values distinguish the column
 * from every column with a different action (the column's controlling
 * conditions, in the MC/DC sense). The pruning is already done by the table; we
 * only render — we never merge columns or re-prune (§2).
 */

import type { SkeletonInput, ControlPath, TruthValue, Literal } from './types.js';

/** Map a cell to a boolean, or undefined for absent / indeterminate (M/I). */
function toBool(v: TruthValue | undefined): boolean | undefined {
  if (v === 'T' || v === 't') return true;
  if (v === 'F' || v === 'f') return false;
  return undefined; // M, I, or absent
}

export interface PathResult {
  paths: ControlPath[];
  /** Column ids skipped because their action is M/I (untestable). */
  skipped: number[];
}

export function extractControlPaths(input: SkeletonInput): PathResult {
  // Conditions usable as guards = all rows (causes AND intermediates).
  const condIds = [...input.causeIds, ...input.intermediateIds];

  const active = input.conditions.filter((c) => !c.excluded);

  // Action set per column = effects at uppercase `T`.
  const actionOf = (col: (typeof active)[number]): string[] =>
    input.effectIds.filter((e) => col.values[e] === 'T');

  const skipped: number[] = [];
  const live = active.filter((col) => {
    if (actionOf(col).length > 0) return true;
    // No firing effect: skip with a note if any effect is indeterminate.
    const indeterminate = input.effectIds.some(
      (e) => col.values[e] === 'M' || col.values[e] === 'I',
    );
    if (indeterminate) skipped.push(col.id);
    return false;
  });

  const actionKey = (col: (typeof active)[number]) => actionOf(col).join('+');

  const paths: ControlPath[] = live.map((col) => {
    const myActions = actionOf(col);
    const myKey = actionKey(col);

    // Columns we must distinguish ourselves from = those with a different action.
    let remaining = live.filter((other) => actionKey(other) !== myKey);

    const guard: Literal[] = [];
    const used = new Set<string>();

    while (remaining.length > 0) {
      let best: { cond: string; sep: typeof remaining } | null = null;

      // Tie-break by condId order; first found with max wins.
      for (const cond of condIds) {
        if (used.has(cond)) continue;
        const myVal = toBool(col.values[cond]);
        if (myVal === undefined) continue; // can't branch on what we don't fix
        const sep = remaining.filter((other) => {
          const ov = toBool(other.values[cond]);
          return ov !== undefined && ov !== myVal;
        });
        if (sep.length === 0) continue;
        if (best === null || sep.length > best.sep.length) {
          best = { cond, sep };
        }
      }

      if (best === null) break; // indistinguishable (should not happen for feasible columns)

      used.add(best.cond);
      guard.push({ cond: best.cond, value: toBool(col.values[best.cond])! });
      const sepSet = new Set(best.sep);
      remaining = remaining.filter((other) => !sepSet.has(other));
    }

    return { columnId: col.id, actions: myActions, guard };
  });

  return { paths, skipped };
}
