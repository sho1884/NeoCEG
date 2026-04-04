#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, '..', 'src', 'cli.ts');
const tsx = join(__dirname, '..', 'node_modules', '.bin', 'tsx');

try {
  execFileSync(tsx, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status ?? 1);
}
