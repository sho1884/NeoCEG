#!/usr/bin/env node
/**
 * Skeleton generator prototype — CLI: read a decision-table CSV, emit a skeleton.
 *
 * Usage:
 *   skeleton-gen [input.csv]      # CSV file, or stdin if omitted
 *
 * Pipeline: parseCsv -> extractControlPaths -> buildSkeleton -> emitPseudo (§9).
 */

import { readFileSync } from 'fs';
import { parseCsv } from './parseCsv.js';
import { buildSkeleton } from './buildTree.js';
import { emitPseudo } from './emit/pseudo.js';
import type { SkeletonInput } from './types.js';

/** Pure transform — exported for tests and future integration. */
export function generateSkeleton(csv: string): string {
  const input: SkeletonInput = parseCsv(csv);
  const skeleton = buildSkeleton(input);
  return emitPseudo(skeleton);
}

function main(argv: string[]): void {
  const file = argv[2];
  const csv = file ? readFileSync(file, 'utf-8') : readFileSync(0, 'utf-8');
  process.stdout.write(generateSkeleton(csv));
}

// Run only when invoked directly.
const invokedDirectly = process.argv[1] && /skeleton-generator[\\/]src[\\/]index\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv);
}
