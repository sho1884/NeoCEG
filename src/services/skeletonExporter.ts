/**
 * Skeleton exporter — Cause-Effect Graph → program control-structure skeleton.
 *
 * Reproduces the CEG's control-flow **topology** and simplifies it under the
 * **constraint premise**, then **verifies** the result against the CEG over the
 * whole feasible input space. Fully deterministic, no AI.
 *
 *  - Intermediates become topologically-ordered computed variables.
 *  - Effects are gated by controlling conditions shared in their expressions
 *    (e.g. `n4` for 1200/1000; `n10` for 600/500); OR-effects are guarded by the
 *    disjunction. Person-type ONE pairs (n1/n2) stay the innermost discriminator.
 *  - Constraints are a premise: the skeleton assumes they hold and never defends
 *    against violations.
 *  - Self-verification: every constraint-valid input must route to the same
 *    effect the CEG computes. On mismatch we fall back to explicit per-effect
 *    guards; a skeleton that cannot be verified is emitted with a warning.
 *
 * See `Doc/Skeleton_Generator_Specification.md` (§2–§5, §11).
 */

import type { DecisionTable } from '../types/decisionTable';
import type { LogicalModel, Expression } from '../types/logical';
import { getReferencedNodes } from '../types/logical';
import { serializeExpression } from './logicalDslSerializer';
import { initWork, deduce, deduceConstraint, applyMask, checkConstr, isPossible } from './cegAlgorithm';

const INDENT = '    ';
const MAX_VERIFY_CAUSES = 16; // 2^16 = 65536 feasible-space scan upper bound

// ---------------------------------------------------------------------------
// Skeleton tree
// ---------------------------------------------------------------------------

type Node =
  | { kind: 'guard'; cond: Expression; then: Node[]; els: Node[] }
  | { kind: 'return'; effects: string[] };

interface Item {
  effect: string;
  conjuncts: Expression[];
}

// ---------------------------------------------------------------------------
// Model evaluation (the ground-truth oracle, shared with the rest of the app)
// ---------------------------------------------------------------------------

interface Eval {
  feasible: boolean;
  effects: Set<string>;
  /** node id -> boolean (undefined when M/I). */
  bools: Map<string, boolean>;
}

function evalModel(
  model: LogicalModel,
  causeIds: string[],
  effectIds: string[],
  assignment: boolean[],
): Eval {
  const work = initWork(model);
  causeIds.forEach((id, i) => work.set(id, assignment[i] ? 'T' : 'F'));
  for (const c of model.constraints) {
    if (c.type === 'MASK') applyMask(work, c.trigger, c.targets);
  }
  deduce(work, model);
  for (const c of model.constraints) deduceConstraint(work, c);

  const feasible = checkConstr(work, model.constraints) === '' && isPossible(work, model) === '';

  const bools = new Map<string, boolean>();
  for (const [id, v] of work) {
    if (v === 'T' || v === 't') bools.set(id, true);
    else if (v === 'F' || v === 'f') bools.set(id, false);
    // M / I / '' -> undefined
  }
  const effects = new Set<string>();
  for (const id of effectIds) {
    const v = work.get(id);
    if (v === 'T' || v === 't') effects.add(id);
  }
  return { feasible, effects, bools };
}

// ---------------------------------------------------------------------------
// Constraint helpers
// ---------------------------------------------------------------------------

/** Members of a ONE constraint that `id` belongs to (positive membership only). */
function oneSiblings(model: LogicalModel, id: string): Set<string> {
  const out = new Set<string>();
  for (const c of model.constraints) {
    if (c.type !== 'ONE') continue;
    const names = c.members.filter((m) => !m.negated).map((m) => m.name);
    if (names.includes(id)) names.forEach((n) => out.add(n));
  }
  return out;
}

/** Are a and b two members of the same ONE constraint? */
function sameOne(model: LogicalModel, a: string, b: string): boolean {
  return a !== b && oneSiblings(model, a).has(b);
}

// ---------------------------------------------------------------------------
// Topological order of intermediates
// ---------------------------------------------------------------------------

function topoIntermediates(model: LogicalModel, intermediateIds: string[]): string[] {
  const set = new Set(intermediateIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id) || !set.has(id)) return;
    seen.add(id);
    const expr = model.nodes.get(id)?.expression;
    if (expr) {
      for (const ref of getReferencedNodes(expr)) {
        if (set.has(ref)) visit(ref);
      }
    }
    ordered.push(id);
  };
  for (const id of intermediateIds) visit(id);
  return ordered;
}

// ---------------------------------------------------------------------------
// Build: reproduce topology by factoring effect expressions
// ---------------------------------------------------------------------------

/** Top-level conjuncts of a conjunction effect, or null for OR / complex. */
function conjunctsOf(expr: Expression): Expression[] | null {
  if (expr.type === 'and') return expr.operands;
  if (expr.type === 'ref' || expr.type === 'not') return [expr];
  return null; // 'or' (or other) — guarded whole
}

function refNameOf(expr: Expression): string | null {
  return expr.type === 'ref' ? expr.name : null;
}

/** Factor a set of conjunction-items into gated nodes (most-shared first,
 *  but ONE-pair members are kept as the innermost discriminator). */
function factor(items: Item[], model: LogicalModel): Node[] {
  if (items.length === 0) return [];

  // Tally conjunct keys (preserve first-seen order for deterministic ties).
  const order: string[] = [];
  const count = new Map<string, number>();
  const exprOf = new Map<string, Expression>();
  for (const it of items) {
    for (const c of it.conjuncts) {
      const k = serializeExpression(c);
      if (!count.has(k)) {
        count.set(k, 0);
        order.push(k);
        exprOf.set(k, c);
      }
      count.set(k, count.get(k)! + 1);
    }
  }

  // Candidate gates: shared by >= 2 items. Deprioritise a ref that is a ONE
  // co-member of another present ref (those are discriminators — keep inner).
  const present = new Set(
    order.map((k) => refNameOf(exprOf.get(k)!)).filter((n): n is string => n !== null),
  );
  const isDiscriminator = (k: string): boolean => {
    const n = refNameOf(exprOf.get(k)!);
    if (!n) return false;
    for (const other of present) if (sameOne(model, n, other)) return true;
    return false;
  };

  let gate: string | null = null;
  let bestCount = 1;
  let bestDiscr = true;
  for (const k of order) {
    const c = count.get(k)!;
    if (c < 2) continue;
    const discr = isDiscriminator(k);
    // Prefer: higher count; then non-discriminator; then first-seen.
    if (c > bestCount || (c === bestCount && bestDiscr && !discr)) {
      gate = k;
      bestCount = c;
      bestDiscr = discr;
    }
  }

  if (gate === null) {
    // No useful sharing: emit each item by its remaining conjuncts.
    return ifElseOpt(items.map((it) => itemToNode(it)), model);
  }

  const gateExpr = exprOf.get(gate)!;
  const inGroup = items.filter((it) => it.conjuncts.some((c) => serializeExpression(c) === gate));
  const outGroup = items.filter((it) => !it.conjuncts.some((c) => serializeExpression(c) === gate));
  const inner = inGroup.map((it) => ({
    effect: it.effect,
    conjuncts: it.conjuncts.filter((c) => serializeExpression(c) !== gate),
  }));
  const gateNode: Node = { kind: 'guard', cond: gateExpr, then: factor(inner, model), els: [] };
  return [gateNode, ...factor(outGroup, model)];
}

function itemToNode(it: Item): Node {
  if (it.conjuncts.length === 0) return { kind: 'return', effects: [it.effect] };
  const cond: Expression =
    it.conjuncts.length === 1 ? it.conjuncts[0] : { type: 'and', operands: it.conjuncts };
  return { kind: 'guard', cond, then: [{ kind: 'return', effects: [it.effect] }], els: [] };
}

/** Render two single-ref sibling guards as if/else when their refs are a ONE pair. */
function ifElseOpt(nodes: Node[], model: LogicalModel): Node[] {
  if (nodes.length !== 2) return nodes;
  const [a, b] = nodes;
  if (
    a.kind === 'guard' && b.kind === 'guard' &&
    a.els.length === 0 && b.els.length === 0 &&
    a.cond.type === 'ref' && b.cond.type === 'ref' &&
    sameOne(model, a.cond.name, b.cond.name)
  ) {
    return [{ kind: 'guard', cond: a.cond, then: a.then, els: b.then }];
  }
  return nodes;
}

function buildFactored(model: LogicalModel, effectIds: string[]): Node[] {
  const conj: Item[] = [];
  const other: Node[] = [];
  for (const e of effectIds) {
    const expr = model.nodes.get(e)?.expression;
    if (!expr) continue; // effect with no definition — nothing to guard
    const cs = conjunctsOf(expr);
    if (cs) conj.push({ effect: e, conjuncts: cs });
    else other.push({ kind: 'guard', cond: expr, then: [{ kind: 'return', effects: [e] }], els: [] });
  }
  return [...factor(conj, model), ...other];
}

function buildFlat(model: LogicalModel, effectIds: string[]): Node[] {
  const nodes: Node[] = [];
  for (const e of effectIds) {
    const expr = model.nodes.get(e)?.expression;
    if (!expr) continue;
    nodes.push({ kind: 'guard', cond: expr, then: [{ kind: 'return', effects: [e] }], els: [] });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Skeleton interpretation + verification
// ---------------------------------------------------------------------------

function evalExpr(expr: Expression, bools: Map<string, boolean>): boolean {
  switch (expr.type) {
    case 'ref':
      return bools.get(expr.name) ?? false;
    case 'not':
      return !evalExpr(expr.operand, bools);
    case 'and':
      return expr.operands.every((o) => evalExpr(o, bools));
    case 'or':
      return expr.operands.some((o) => evalExpr(o, bools));
  }
}

function runSkeleton(nodes: Node[], bools: Map<string, boolean>): string[] | null {
  for (const node of nodes) {
    if (node.kind === 'return') return node.effects;
    const branch = evalExpr(node.cond, bools) ? node.then : node.els;
    const r = runSkeleton(branch, bools);
    if (r !== null) return r;
  }
  return null;
}

/** Verify the skeleton equals the CEG over every constraint-valid input. */
function verify(
  model: LogicalModel,
  causeIds: string[],
  effectIds: string[],
  nodes: Node[],
): { ok: boolean; checked: boolean } {
  if (causeIds.length > MAX_VERIFY_CAUSES) return { ok: false, checked: false };
  const total = 1 << causeIds.length;
  for (let mask = 0; mask < total; mask++) {
    const assignment = causeIds.map((_, i) => (mask & (1 << i)) !== 0);
    const ev = evalModel(model, causeIds, effectIds, assignment);
    if (!ev.feasible) continue;
    const got = runSkeleton(nodes, ev.bools) ?? [];
    if (!sameSet(new Set(got), ev.effects)) return { ok: false, checked: true };
  }
  return { ok: true, checked: true };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Emit pseudo-code
// ---------------------------------------------------------------------------

function emitNodes(nodes: Node[], depth: number, label: (id: string) => string, lines: string[]): void {
  const pad = INDENT.repeat(depth);
  for (const node of nodes) {
    if (node.kind === 'return') {
      const value = node.effects.map(label).join(' + ') || 'None';
      lines.push(`${pad}return ${value}      # ${node.effects.join('+') || 'none'}`);
      continue;
    }
    const condText = serializeExpression(node.cond);
    const condLabel = node.cond.type === 'ref' && label(node.cond.name) !== node.cond.name
      ? `      # ${label(node.cond.name)}`
      : '';
    lines.push(`${pad}if ${condText}:${condLabel}`);
    emitNodes(node.then, depth + 1, label, lines);
    if (node.els.length > 0) {
      lines.push(`${pad}else:`);
      emitNodes(node.els, depth + 1, label, lines);
    }
  }
}

/**
 * Verification status of a generated skeleton (drives GUI §7.4 warnings A1/A2).
 *  - verified   : the factored topology skeleton was verified equivalent to the CEG over the feasible space.
 *  - explicit   : the factored form was not verifiable, but the explicit per-effect fallback IS verified
 *                 equivalent — still correct, just less compact (no warning needed).
 *  - unverified : the skeleton WAS checked and a difference from the CEG was found on a feasible input
 *                 → warning A1 (mismatch).
 *  - unchecked  : too many causes to verify exhaustively, so equivalence is unconfirmed (no mismatch was
 *                 found — it simply could not be checked) → warning A2 (unconfirmed).
 */
export type SkeletonStatus = 'verified' | 'explicit' | 'unverified' | 'unchecked';

export interface SkeletonResult {
  text: string;
  status: SkeletonStatus;
  /** A feasible decision-table column fires >= 2 effects (GUI §7.4 warning B). */
  multiEffect: boolean;
}

/**
 * Generate a pseudo-code skeleton from a Cause-Effect Graph.
 *
 * @param model       The CEG model (expressions + intermediates + constraints) — the topology source.
 * @param table       The decision table — supplies cause/intermediate/effect ids (and the §8 path cross-check).
 * @param nodeLabels  id -> human label, for the legend and effect return values.
 */
export function generateSkeletonPseudoCode(
  model: LogicalModel,
  table: DecisionTable,
  nodeLabels: Map<string, string>,
): SkeletonResult {
  const label = (id: string) => nodeLabels.get(id) ?? id;
  const { causeIds, intermediateIds, effectIds } = table;

  // Build the topology skeleton, then verify it; fall back to explicit guards.
  let body = buildFactored(model, effectIds);
  const v = verify(model, causeIds, effectIds, body);
  let note = '';
  let status: SkeletonStatus;
  if (v.checked && v.ok) {
    status = 'verified';
  } else if (v.checked && !v.ok) {
    body = buildFlat(model, effectIds);
    const v2 = verify(model, causeIds, effectIds, body);
    if (v2.ok) {
      status = 'explicit';
      note = '# note: factored form could not be verified; using explicit per-effect guards.';
    } else {
      status = 'unverified';
      note = '# WARNING: skeleton could not be verified equivalent to the CEG — review before use.';
    }
  } else {
    // Verification skipped (too many causes): cannot claim equivalence (no mismatch found, just unchecked).
    body = buildFlat(model, effectIds);
    status = 'unchecked';
    note = `# WARNING: ${causeIds.length} causes — exhaustive verification skipped; correctness not confirmed.`;
  }

  // Warning B signal: a feasible column firing two or more effects.
  const fires = (v: string | undefined) => v === 'T' || v === 't';
  const multiEffect = table.conditions.some(
    (c) => !c.excluded && effectIds.filter((e) => fires(c.values.get(e))).length >= 2,
  );

  const lines: string[] = [];
  lines.push(`function decide(${causeIds.join(', ')}):`);
  if (note) lines.push(`${INDENT}${note}`);

  // Legend: causes with a human label.
  const labelled = causeIds.filter((id) => label(id) !== id);
  if (labelled.length > 0) {
    lines.push(`${INDENT}# causes:`);
    for (const id of labelled) lines.push(`${INDENT}#   ${id} = ${label(id)}`);
  }

  // Intermediate definitions (topological order).
  const intsOrdered = topoIntermediates(model, intermediateIds);
  if (intsOrdered.length > 0) {
    for (const id of intsOrdered) {
      const expr = model.nodes.get(id)?.expression;
      if (expr) lines.push(`${INDENT}${id} = ${serializeExpression(expr)}` + labelComment(id, label));
      else lines.push(`${INDENT}# ${id} (intermediate condition)` + labelComment(id, label));
    }
    lines.push('');
  } else if (labelled.length > 0) {
    lines.push('');
  }

  emitNodes(body, 1, label, lines);
  lines.push(`${INDENT}return None      # default: no effect fires`);

  return { text: lines.join('\n') + '\n', status, multiEffect };
}

function labelComment(id: string, label: (id: string) => string): string {
  const l = label(id);
  return l && l !== id ? `      # ${l}` : '';
}
