/**
 * Conformance check for generated decision tables.
 *
 * Judges a table against the obligation set A-J of Doc/Algorithm_Design.md §1.4.
 * Everything here is derived from the model and the emitted columns alone — the
 * algorithm's own covs/weaks bookkeeping is never consulted — so a defect in the
 * generator cannot hide behind its own accounting.
 */
import { readFileSync } from 'node:fs';
import { parseLogicalDSL } from '../../services/logicalDslParser';
import {
  calcTable, extractExpressions, initWork, deduce, deduceValue, applyMask,
  deduceConstraint, checkConstr, isPossible,
} from '../../services/cegAlgorithm';
import { isCause, isEffect, getReferencedNodes } from '../../types/logical';
import type { LogicalModel, LogicalConstraint, ConstraintMemberRef } from '../../types/logical';
import type { TruthValue } from '../../types/decisionTable';
import type { LogicalExpression } from '../../types/cegAlgorithm';

type Cell = TruthValue | '';
type Work = Map<string, Cell>;

const isT = (v: Cell | undefined) => v === 'T' || v === 't';
const isF = (v: Cell | undefined) => v === 'F' || v === 'f';
const decided = (v: Cell | undefined) => isT(v) || isF(v);

export type Obligation =
  | { kind: 'A'; index: number; owner: string; label: string }
  | { kind: 'B'; cause: string; want: boolean; label: string }
  | { kind: 'C'; constraint: LogicalConstraint; label: string };

export interface Violation {
  obligation: 'A' | 'B' | 'C' | 'D' | 'E' | 'I' | 'J';
  detail: string;
}

export interface ConformanceReport {
  file: string;
  columns: number;
  violations: Violation[];
  /** Expressions no kept column discharges, by reason (§13.4). */
  classification: { infeasible: number; untestable: number; unobservable: number; missing: number };
  discharged: number;
  expressions: number;
}

/** Maximum causes for which the feasible input space is enumerated. */
const MAX_CAUSES = 20;

export function checkConformance(file: string): ConformanceReport {
  const parsed = parseLogicalDSL(readFileSync(file, 'utf8'));
  if (!parsed.model) throw new Error(`${file}: ${JSON.stringify(parsed.errors)}`);
  const model: LogicalModel = parsed.model;

  const causes: string[] = [];
  const effects: string[] = [];
  for (const [name, node] of model.nodes) {
    if (isCause(node)) causes.push(name);
    else if (isEffect(node, model)) effects.push(name);
  }
  const referenced = new Set<string>();
  for (const [, node] of model.nodes) {
    if (node.expression) for (const r of getReferencedNodes(node.expression)) referenced.add(r);
  }
  const activeCauses = causes.filter((c) => referenced.has(c));
  const expressions: LogicalExpression[] = extractExpressions(model);

  const memberOn = (m: ConstraintMemberRef, w: Work): boolean => {
    const v = w.get(m.name);
    if (!decided(v)) return false;
    return m.negated ? isF(v) : isT(v);
  };

  /** Evaluate one full input assignment over the causes. */
  const evalInput = (assignment: boolean[]): { work: Work; feasible: boolean } => {
    const work = initWork(model) as Work;
    causes.forEach((id, i) => work.set(id, assignment[i] ? 'T' : 'F'));
    for (const c of model.constraints) {
      if (c.type !== 'MASK') continue;
      // applyMask only writes empty cells, so clear the targets first.
      if (memberOn(c.trigger, work)) for (const g of c.targets) work.set(g.name, '');
      applyMask(work, c.trigger, c.targets);
    }
    deduce(work, model);
    for (const c of model.constraints) deduceConstraint(work, c);
    const feasible =
      checkConstr(work, model.constraints) === '' && isPossible(work, model) === '';
    return { work, feasible };
  };

  const pin = (work: Work, nodeName: string, value: Cell): Work => {
    const copy: Work = new Map(work);
    copy.set(nodeName, value);
    for (const [name, node] of model.nodes) {
      if (node.expression && name !== nodeName) copy.set(name, '');
    }
    for (const [name, node] of model.nodes) {
      if (node.expression && name !== nodeName) deduceValue(copy, name, model);
    }
    return copy;
  };

  /** §2.5: flipping the node changes an effect that is decided on both sides. */
  const observable = (work: Work, nodeName: string): boolean => {
    const v = work.get(nodeName);
    if (!decided(v)) return false;
    const kept = pin(work, nodeName, v as Cell);
    const flipped = pin(work, nodeName, isT(v) ? 'f' : 't');
    for (const e of effects) {
      const a = kept.get(e);
      const b = flipped.get(e);
      if (!decided(a) || !decided(b)) continue; // M / I: the tester cannot decide
      if (isT(a) !== isT(b)) return true;
    }
    return false;
  };

  const realizes = (w: Work, l: number): boolean => {
    for (const [nodeName, req] of expressions[l].requiredValues) {
      const v = w.get(nodeName);
      if (v === undefined || v === '') continue;
      if (req === 'T' ? !isT(v) : !isF(v)) return false;
    }
    return true;
  };

  const demonstrates = (w: Work, c: LogicalConstraint): boolean => {
    if (c.type !== 'MASK') return false;
    if (!memberOn(c.trigger, w)) return false;
    return c.targets.some((g) => w.get(g.name) === 'M');
  };

  const obligations: Obligation[] = [];
  expressions.forEach((e, i) =>
    obligations.push({ kind: 'A', index: i, owner: e.ownerNode, label: `Expr${i + 1}(${e.ownerNode})` }));
  for (const c of activeCauses) {
    obligations.push({ kind: 'B', cause: c, want: true, label: `${c}=T` });
    obligations.push({ kind: 'B', cause: c, want: false, label: `${c}=F` });
  }
  for (const c of model.constraints) {
    if (c.type !== 'MASK') continue;
    obligations.push({
      kind: 'C',
      constraint: c,
      label: `MASK(${c.trigger.name}->${c.targets.map((g) => g.name).join(',')})`,
    });
  }

  const discharges = (w: Work, o: Obligation): boolean => {
    if (o.kind === 'A') return realizes(w, o.index) && observable(w, o.owner);
    if (o.kind === 'B') {
      const v = w.get(o.cause);
      return decided(v) && isT(v) === o.want && observable(w, o.cause);
    }
    return demonstrates(w, o.constraint);
  };

  const generate = (): Work[] => {
    const st = calcTable(model);
    const out: Work[] = [];
    for (let t = 0; t < st.tests.length; t++) if (!st.weaks[t]) out.push(st.tests[t] as Work);
    return out;
  };
  const cols = generate();

  const space: Work[] = [];
  if (causes.length <= MAX_CAUSES) {
    for (let m = 0; m < 1 << causes.length; m++) {
      const a = causes.map((_, i) => (m & (1 << i)) !== 0);
      const r = evalInput(a);
      if (r.feasible) space.push(r.work);
    }
  }

  const violations: Violation[] = [];

  // A. expression coverage, and the classification of what is left (§13.4)
  const classification = { infeasible: 0, untestable: 0, unobservable: 0, missing: 0 };
  let dischargedCount = 0;
  for (let l = 0; l < expressions.length; l++) {
    if (cols.some((w) => realizes(w, l) && observable(w, expressions[l].ownerNode))) {
      dischargedCount++;
      continue;
    }
    const owner = expressions[l].ownerNode;
    const realizable = space.filter((w) => realizes(w, l));
    if (space.length === 0) continue; // too many causes to classify
    if (realizable.length === 0) classification.infeasible++;
    else if (!realizable.some((w) => decided(w.get(owner)))) classification.untestable++;
    else if (!realizable.some((w) => observable(w, owner))) classification.unobservable++;
    else {
      classification.missing++;
      violations.push({ obligation: 'A', detail: `${expressions[l].ownerNode} の Expr${l + 1} は検証可能だが果たされていない` });
    }
  }

  // B. cause-value coverage
  for (const o of obligations) {
    if (o.kind !== 'B') continue;
    if (cols.some((w) => discharges(w, o))) continue;
    if (space.some((w) => discharges(w, o))) {
      violations.push({ obligation: 'B', detail: `${o.label} を観測できる列がない` });
    }
  }

  // C. MASK demonstration
  for (const o of obligations) {
    if (o.kind !== 'C') continue;
    if (cols.some((w) => discharges(w, o))) continue;
    if (space.some((w) => discharges(w, o))) {
      violations.push({ obligation: 'C', detail: `${o.label} を実演する列がない` });
    }
  }

  // D. every emitted column is executable
  cols.forEach((w, i) => {
    const constr = checkConstr(w, model.constraints);
    const logic = isPossible(w, model);
    if (constr !== '') violations.push({ obligation: 'D', detail: `列#${i + 1}: 制約違反 ${constr}` });
    if (logic !== '') violations.push({ obligation: 'D', detail: `列#${i + 1}: 論理矛盾 ${logic}` });
  });

  // E. minimality over A u B u C
  cols.forEach((_, i) => {
    const rest = cols.filter((_, j) => j !== i);
    const redundant = obligations.every((o) => {
      if (!cols.some((w) => discharges(w, o))) return true;
      return rest.some((w) => discharges(w, o));
    });
    if (redundant) violations.push({ obligation: 'E', detail: `列#${i + 1} は削除しても義務が失われない` });
  });

  // I. one column per distinct executed input
  const signature = cols.map((w) =>
    causes.map((c) => {
      const v = w.get(c);
      if (isT(v)) return '1';
      if (isF(v)) return '0';
      return v === 'M' ? 'M' : '-';
    }).join(''));
  for (let i = 0; i < signature.length; i++) {
    for (let j = i + 1; j < signature.length; j++) {
      if (signature[i] === signature[j]) {
        violations.push({ obligation: 'I', detail: `列#${i + 1} と 列#${j + 1} が同一入力` });
      }
    }
  }

  // J. same source, same table
  const dump = (c: Work[]) => JSON.stringify(c.map((w) => [...w.entries()]));
  if (dump(cols) !== dump(generate())) {
    violations.push({ obligation: 'J', detail: '同一ソースから異なるデシジョンテーブルが生成された' });
  }

  return {
    file,
    columns: cols.length,
    violations,
    classification,
    discharged: dischargedCount,
    expressions: expressions.length,
  };
}
