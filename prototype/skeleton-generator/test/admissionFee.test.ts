/**
 * Golden example — admission-fee graph (§8).
 * Input = the tool-exported decision-table CSV (admissionFee.csv).
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseCsv } from '../src/parseCsv.js';
import { buildSkeleton } from '../src/buildTree.js';
import { generateSkeleton } from '../src/index.js';
import type { Node, Skeleton } from '../src/types.js';

const CSV = readFileSync(new URL('./admissionFee.csv', import.meta.url), 'utf-8');

const EFFECT_LABELS = ['Free', '1200 yen', '1000 yen', '600 yen', '500 yen'];

// --- helpers ---------------------------------------------------------------

function countReturns(nodes: Node[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === 'return') n++;
    else n += countReturns(node.then) + countReturns(node.else);
  }
  return n;
}

/** Collect (action, guardConds-on-path) for every return leaf. */
function leaves(nodes: Node[], path: string[] = []): { actions: string[]; path: string[] }[] {
  const out: { actions: string[]; path: string[] }[] = [];
  for (const node of nodes) {
    if (node.kind === 'return') out.push({ actions: node.actions, path: [...path] });
    else {
      out.push(...leaves(node.then, [...path, node.cond]));
      out.push(...leaves(node.else, [...path, node.cond]));
    }
  }
  return out;
}

/** Interpret the skeleton on a boolean assignment; returns the effect label. */
function run(skel: Skeleton, assign: Record<string, boolean>): string | null {
  const label = (id: string) => skel.labels[id] ?? id;
  const evalNodes = (nodes: Node[]): string | null => {
    for (const node of nodes) {
      if (node.kind === 'return') return node.actions.map(label).join(' + ');
      const v = assign[node.cond];
      if (v === true) {
        const r = evalNodes(node.then);
        if (r !== null) return r;
      } else if (v === false) {
        const r = evalNodes(node.else);
        if (r !== null) return r;
      }
    }
    return null;
  };
  return evalNodes(skel.body);
}

// --- tests -----------------------------------------------------------------

describe('admission fee skeleton (§8)', () => {
  const skel = buildSkeleton(parseCsv(CSV));

  test('parses to 8 causes / 2 intermediates / 5 effects / 7 columns', () => {
    const input = parseCsv(CSV);
    expect(input.causeIds).toHaveLength(8);
    expect(input.intermediateIds).toEqual(['n9', 'n10']);
    expect(input.effectIds).toHaveLength(5);
    expect(input.conditions.filter((c) => !c.excluded)).toHaveLength(7);
  });

  test('#1 every effect appears in ≥1 reachable leaf', () => {
    const labels = skel.labels;
    const fired = new Set(leaves(skel.body).flatMap((l) => l.actions.map((a) => labels[a] ?? a)));
    for (const e of EFFECT_LABELS) expect(fired).toContain(e);
  });

  test('#2 no root-to-leaf path tests the same condition twice', () => {
    for (const { path } of leaves(skel.body)) {
      expect(new Set(path).size).toBe(path.length);
    }
  });

  test('#3 deterministic: byte-identical on re-run', () => {
    expect(generateSkeleton(CSV)).toBe(generateSkeleton(CSV));
  });

  test('#4 Free leaves do not test individual/group (n1/n2)', () => {
    const freeLeaves = leaves(skel.body).filter((l) => l.actions.includes('e1'));
    expect(freeLeaves).toHaveLength(3); // 3 Free columns
    for (const { path } of freeLeaves) {
      expect(path).not.toContain('n1');
      expect(path).not.toContain('n2');
    }
  });

  test('#5 path count = column count (7)', () => {
    expect(countReturns(skel.body)).toBe(7);
  });

  test('oracle: each column routes to its own effect', () => {
    const input = parseCsv(CSV);
    const condIds = [...input.causeIds, ...input.intermediateIds];
    const toBool = (v?: string) => (v === 'T' || v === 't' ? true : v === 'F' || v === 'f' ? false : undefined);

    for (const col of input.conditions.filter((c) => !c.excluded)) {
      const assign: Record<string, boolean> = {};
      for (const id of condIds) {
        const b = toBool(col.values[id]);
        if (b !== undefined) assign[id] = b;
      }
      const expected = input.effectIds
        .filter((e) => col.values[e] === 'T')
        .map((e) => skel.labels[e] ?? e)
        .join(' + ');
      expect(run(skel, assign)).toBe(expected);
    }
  });

  test('intermediates stay named conditions (no definitions from CSV)', () => {
    expect(skel.intermediateDefs).toEqual({});
    const text = generateSkeleton(CSV);
    expect(text).toContain('definitions require expressions');
    expect(text).toMatch(/if n9:/);
    expect(text).toMatch(/if n10:/);
  });
});
