/**
 * Skeleton exporter — correctness over the whole feasible input space (§8 #1).
 *
 * The bug this guards against: deriving guards by fitting the 7 MC/DC columns
 * misroutes feasible inputs that are not among those points (e.g. "group + 65+"
 * must be Free). So the test independently evaluates the CEG model on EVERY
 * constraint-valid input and confirms the generated skeleton routes each one the
 * same way — using an independent interpreter, not the exporter's own verifier.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseLogicalDSL } from '../services/logicalDslParser';
import {
  generateOptimizedDecisionTableWithState,
  getNodeLabel,
} from '../services/decisionTableCalculator';
import { generateSkeletonPseudoCode } from '../services/skeletonExporter';
import { initWork, deduce, deduceConstraint, applyMask, checkConstr, isPossible } from '../services/cegAlgorithm';
import type { LogicalModel } from '../types/logical';

const DSL = readFileSync(
  new URL('../../Verification/TDD/graphs/17_admission_fee.nceg', import.meta.url),
  'utf-8',
);

function build() {
  const parsed = parseLogicalDSL(DSL);
  if (!parsed.success) throw new Error('admission-fee DSL failed to parse');
  const model = parsed.model;
  const { table } = generateOptimizedDecisionTableWithState(model);
  const nodeLabels = new Map<string, string>();
  for (const [name] of model.nodes) nodeLabels.set(name, getNodeLabel(model, name));
  return { model, table, nodeLabels };
}

/** Evaluate the CEG: cause assignment -> { feasible, firing effects }. */
function evalModel(model: LogicalModel, causeIds: string[], effectIds: string[], bits: boolean[]) {
  const work = initWork(model);
  causeIds.forEach((id, i) => work.set(id, bits[i] ? 'T' : 'F'));
  for (const c of model.constraints) if (c.type === 'MASK') applyMask(work, c.trigger, c.targets);
  deduce(work, model);
  for (const c of model.constraints) deduceConstraint(work, c);
  const feasible = checkConstr(work, model.constraints) === '' && isPossible(work, model) === '';
  const effects = effectIds.filter((e) => {
    const v = work.get(e);
    return v === 'T' || v === 't';
  });
  return { feasible, effects };
}

/**
 * Minimal independent interpreter of the emitted pseudo-code: given the boolean
 * value of every node (computed from the CEG), walk the indented if/else lines
 * and return the effect ids of the first matching `return`. Conditions use only
 * AND / OR / NOT over node ids (no parentheses are emitted for the gates here).
 */
function runSkeletonText(text: string, vals: Map<string, boolean>): string[] {
  // Body = the if/else/return lines (intermediate defs, comments, blanks dropped).
  const lines = text
    .split('\n')
    .map((l) => ({ indent: l.match(/^ */)![0].length, t: l.trim() }))
    .filter((l) => l.t.startsWith('if ') || l.t.startsWith('else') || l.t.startsWith('return '));

  const evalCond = (cond: string): boolean =>
    cond.split(/\s+OR\s+/).some((part) =>
      part.split(/\s+AND\s+/).every((lit) => {
        lit = lit.trim();
        if (lit.startsWith('NOT ')) return !(vals.get(lit.slice(4).trim()) ?? false);
        return vals.get(lit) ?? false;
      }),
    );

  let pos = 0;
  // Consume one indentation block (all lines at exactly `indent`); interpret only
  // when `evaluate` is true, otherwise just advance past the lines.
  function consume(indent: number, evaluate: boolean): string[] | null {
    let result: string[] | null = null;
    while (pos < lines.length && lines[pos].indent >= indent) {
      if (lines[pos].indent > indent) { pos++; continue; } // safety
      const line = lines[pos];
      if (line.t.startsWith('return ')) {
        pos++;
        if (evaluate && result === null) {
          const hash = line.t.indexOf('#');
          const value = line.t.slice(7, hash >= 0 ? hash : undefined).trim();
          const ids = hash >= 0 ? line.t.slice(hash + 1).trim().split('+').map((s) => s.trim()) : [];
          result = value === 'None' ? [] : ids.filter(Boolean);
          evaluate = false;
        }
        continue;
      }
      if (line.t.startsWith('if ')) {
        const cond = line.t.slice(3, line.t.lastIndexOf(':')).split('#')[0].trim();
        pos++;
        const condVal = evaluate && evalCond(cond);
        const thenIndent = pos < lines.length && lines[pos].indent > indent ? lines[pos].indent : indent + 1;
        const tRes = consume(thenIndent, condVal);
        let eRes: string[] | null = null;
        if (pos < lines.length && lines[pos].indent === indent && lines[pos].t.startsWith('else')) {
          pos++;
          const elseIndent = pos < lines.length && lines[pos].indent > indent ? lines[pos].indent : indent + 1;
          eRes = consume(elseIndent, evaluate && !condVal);
        }
        if (evaluate && result === null) {
          const r = condVal ? tRes : eRes;
          if (r && r.length) { result = r; evaluate = false; }
        }
        continue;
      }
      pos++;
    }
    return result;
  }

  pos = 0;
  const base = lines.length ? Math.min(...lines.map((l) => l.indent)) : 0;
  return consume(base, true) ?? [];
}

describe('skeletonExporter — feasible-space equivalence (§8 #1)', () => {
  const { model, table, nodeLabels } = build();
  const skeleton = generateSkeletonPseudoCode(model, table, nodeLabels);
  const { causeIds, effectIds } = table;

  test('intermediate values agree, and EVERY feasible input routes like the CEG', () => {
    let feasibleCount = 0;
    const total = 1 << causeIds.length;
    for (let mask = 0; mask < total; mask++) {
      const bits = causeIds.map((_, i) => (mask & (1 << i)) !== 0);
      const ev = evalModel(model, causeIds, effectIds, bits);
      if (!ev.feasible) continue;
      feasibleCount++;

      // Node values for the interpreter (causes + deduced intermediates/effects).
      const work = initWork(model);
      causeIds.forEach((id, i) => work.set(id, bits[i] ? 'T' : 'F'));
      for (const c of model.constraints) if (c.type === 'MASK') applyMask(work, c.trigger, c.targets);
      deduce(work, model);
      const vals = new Map<string, boolean>();
      for (const [id, v] of work) {
        if (v === 'T' || v === 't') vals.set(id, true);
        else if (v === 'F' || v === 'f') vals.set(id, false);
      }

      const got = runSkeletonText(skeleton, vals).sort();
      const want = ev.effects.slice().sort();
      expect(got).toEqual(want);
    }
    expect(feasibleCount).toBe(16); // ONE(n1,n2) × ONE(n3,n4,n5,n6) × ONE(n7,n8)
  });

  test('regression: group + 65+ returns Free (not a fee)', () => {
    // n2 (group), n3 (65+), n7 (resident) — a feasible input, not one of the 7 columns.
    const vals = new Map<string, boolean>();
    const set = (ids: string[], v: boolean) => ids.forEach((i) => vals.set(i, v));
    set(['n1', 'n4', 'n5', 'n6', 'n8'], false);
    set(['n2', 'n3', 'n7'], true);
    vals.set('n9', false);
    vals.set('n10', false);
    expect(runSkeletonText(skeleton, vals)).toEqual(['e1']); // Free
  });

  test('reproduces topology: gates + OR free guard + intermediate defs', () => {
    expect(skeleton).toContain('n9 = n5 AND n7');
    expect(skeleton).toContain('n10 = n5 AND n8');
    expect(skeleton).toMatch(/if n4:/);
    expect(skeleton).toMatch(/if n10:/);
    expect(skeleton).toMatch(/if n3 OR n6 OR n9:/);
  });

  test('verified clean: no fallback/warning note emitted', () => {
    expect(skeleton).not.toMatch(/WARNING|could not be verified|verification skipped|note:/);
  });

  test('deterministic: byte-identical on re-run', () => {
    expect(generateSkeletonPseudoCode(model, table, nodeLabels)).toBe(skeleton);
  });
});
