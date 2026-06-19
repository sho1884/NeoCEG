// =============================================================================
// CLI integration tests — exercise src/cli.ts as a real process.
//
// These cover the --all-combinations output mode and, critically, the
// all-or-nothing output contract (CLI-SR-013/014/015): on error the CLI must
// write NOTHING to stdout and must not touch a -o target file.
// =============================================================================

import { describe, test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = fileURLToPath(new URL('../cli.ts', import.meta.url));
const RUN_TIMEOUT = 30_000; // tsx cold-start can be slow

function runCli(args: string[], input: string) {
  return spawnSync('node', ['--no-warnings', '--import', 'tsx', CLI, ...args], {
    input,
    encoding: 'utf-8',
  });
}

function headerColumnCount(csv: string): number {
  const header = csv.split(/\r?\n/)[0] ?? '';
  return header.split(',').filter((c) => c.startsWith('#')).length;
}

// AND(A,B)->C with ONE(p1,p2): 2 causes => 2^2 = 4 combinations.
// ONE makes "both true" and "both false" infeasible, so the learning-mode
// table carries a Status row marking those columns Infeasible.
const TWO_CAUSE_DSL = `p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
ONE(p1, p2)
`;

// 9 independent causes => 2^9 = 512 > 256 (exceeds the learning-mode limit).
const NINE_CAUSE_DSL = (() => {
  const causes = Array.from({ length: 9 }, (_, i) => `p${i + 1}: "c${i + 1}"`).join('\n');
  const orExpr = Array.from({ length: 9 }, (_, i) => `p${i + 1}`).join(' OR ');
  return `${causes}\np10: "Out"\np10 := ${orExpr}\n`;
})();

describe('CLI --all-combinations', () => {
  test(
    'emits the full 2^n table with a feasibility Status row',
    () => {
      const res = runCli(['--all-combinations'], TWO_CAUSE_DSL);
      expect(res.status).toBe(0);
      // All 2^2 = 4 input combinations are present as columns.
      expect(headerColumnCount(res.stdout)).toBe(4);
      // The status row carries the constraint feasibility info.
      expect(res.stdout).toContain('Status');
      expect(res.stdout).toContain('Infeasible');
    },
    RUN_TIMEOUT,
  );

  test(
    'default (optimized) mode emits fewer columns than --all-combinations',
    () => {
      const res = runCli([], TWO_CAUSE_DSL);
      expect(res.status).toBe(0);
      // ONE(p1,p2) leaves only the 2 feasible combinations.
      expect(headerColumnCount(res.stdout)).toBeLessThan(4);
    },
    RUN_TIMEOUT,
  );
});

describe('CLI --all-combinations 256-column limit (CLI-SR-014/015)', () => {
  test(
    'errors with no stdout when 2^n exceeds 256',
    () => {
      const res = runCli(['--all-combinations'], NINE_CAUSE_DSL);
      expect(res.status).not.toBe(0);
      expect(res.stdout.trim()).toBe(''); // no partial table on stdout
      expect(res.stderr).toContain('256');
    },
    RUN_TIMEOUT,
  );

  test(
    'leaves an existing -o target file unmodified on error',
    () => {
      const tmp = join(tmpdir(), `neoceg-cli-test-${process.pid}.csv`);
      writeFileSync(tmp, 'PREEXISTING', 'utf-8');
      try {
        const res = runCli(['--all-combinations', '-o', tmp], NINE_CAUSE_DSL);
        expect(res.status).not.toBe(0);
        // The pre-existing file must be untouched — no partial write.
        expect(existsSync(tmp)).toBe(true);
        expect(readFileSync(tmp, 'utf-8')).toBe('PREEXISTING');
      } finally {
        rmSync(tmp, { force: true });
      }
    },
    RUN_TIMEOUT,
  );
});
