#!/usr/bin/env node
/**
 * NeoCEG CLI — UNIX filter-style command for processing .nceg files.
 *
 * Usage:
 *   neoceg [options] [input-file]
 *
 * Input:
 *   input-file          Path to .nceg file (default: stdin)
 *
 * Output options:
 *   -o, --output FILE   Write output to FILE (default: stdout)
 *   --coverage          Output coverage table CSV instead of decision table
 *   --svg               Output cause-effect graph as SVG
 *
 * Information:
 *   -h, --help          Show help message
 *   --version           Show version number
 */

import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { parseLogicalDSL } from './services/logicalDslParser.js';
import {
  generateOptimizedDecisionTableWithState,
  getFeasibleConditions,
  getNodeLabel,
} from './services/decisionTableCalculator.js';
import { generateCoverageTableFromState } from './services/coverageTableCalculator.js';
import {
  generateDecisionTableCSV,
  generateCoverageTableCSV,
} from './services/csvGenerator.js';
import { generateGraphSVG } from './services/cliSvgGenerator.js';
import type { LogicalModel } from './types/logical.js';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  inputFile: string | null;
  outputFile: string | null;
  mode: 'decision-table' | 'coverage' | 'svg';
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    inputFile: null,
    outputFile: null,
    mode: 'decision-table',
    help: false,
    version: false,
  };

  let i = 2; // skip node and script path
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '--version') {
      args.version = true;
    } else if (arg === '--coverage') {
      args.mode = 'coverage';
    } else if (arg === '--svg') {
      args.mode = 'svg';
    } else if (arg === '-o' || arg === '--output') {
      i++;
      if (i >= argv.length) {
        error('Option -o requires a file path argument');
      }
      args.outputFile = argv[i];
    } else if (arg.startsWith('-')) {
      error(`Unknown option: ${arg}`);
    } else {
      if (args.inputFile !== null) {
        error('Only one input file can be specified');
      }
      args.inputFile = arg;
    }
    i++;
  }

  return args;
}

// ---------------------------------------------------------------------------
// Help and version
// ---------------------------------------------------------------------------

const HELP_TEXT = `
NeoCEG CLI — Generate decision tables and coverage tables from .nceg files.

Usage:
  neoceg [options] [input-file]

Input:
  input-file          Path to .nceg file (default: stdin)

Output options:
  -o, --output FILE   Write output to FILE (default: stdout)
  --coverage          Output coverage table CSV instead of decision table
  --svg               Output cause-effect graph as SVG

Information:
  -h, --help          Show help message
  --version           Show version number

Examples:
  neoceg input.nceg                          # Decision table to stdout
  neoceg -o dt.csv input.nceg                # Decision table to file
  neoceg --coverage input.nceg               # Coverage table to stdout
  neoceg --coverage -o cov.csv input.nceg    # Coverage table to file
  neoceg --svg -o graph.svg input.nceg       # Graph SVG to file
  cat input.nceg | neoceg                    # Pipe from stdin
`.trim();

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function error(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function writeOutput(content: string, outputFile: string | null): void {
  if (outputFile) {
    writeFileSync(outputFile, content, 'utf-8');
  } else {
    process.stdout.write(content);
  }
}

// ---------------------------------------------------------------------------
// Pipeline helpers
// ---------------------------------------------------------------------------

function parseInput(input: string): LogicalModel {
  const result = parseLogicalDSL(input);
  if (!result.success) {
    const errors = result.errors
      .map((e) => `  line ${e.line}: ${e.message}`)
      .join('\n');
    error(`Parse error:\n${errors}`);
  }
  return result.model;
}

function buildNodeLabels(model: LogicalModel): Map<string, string> {
  const labels = new Map<string, string>();
  for (const [name] of model.nodes) {
    labels.set(name, getNodeLabel(model, name));
  }
  return labels;
}

function buildObservableFlags(model: LogicalModel): Map<string, boolean> {
  const flags = new Map<string, boolean>();
  for (const [name, node] of model.nodes) {
    flags.set(name, node.observable ?? true);
  }
  return flags;
}

function sortByY(ids: string[], model: LogicalModel): string[] {
  return [...ids].sort((a, b) => {
    const ay = model.nodes.get(a)?.position?.y ?? 0;
    const by = model.nodes.get(b)?.position?.y ?? 0;
    return ay - by;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv);

  if (args.help) {
    process.stdout.write(HELP_TEXT + '\n');
    process.exit(0);
  }

  if (args.version) {
    process.stdout.write(`neoceg ${getVersion()}\n`);
    process.exit(0);
  }

  // Read input
  let input: string;
  if (args.inputFile) {
    try {
      input = readFileSync(args.inputFile, 'utf-8');
    } catch (e) {
      error(`Cannot read file: ${args.inputFile}`);
    }
  } else {
    try {
      input = readFileSync(0, 'utf-8'); // stdin
    } catch {
      error('No input provided. Specify a file or pipe .nceg content to stdin.');
    }
  }

  // Parse
  const model = parseInput(input);

  // Generate output based on mode
  if (args.mode === 'decision-table') {
    const { table } = generateOptimizedDecisionTableWithState(model);
    const conditions = getFeasibleConditions(table);
    const nodeLabels = buildNodeLabels(model);
    const observableFlags = buildObservableFlags(model);
    const csv = generateDecisionTableCSV(
      table,
      conditions,
      nodeLabels,
      observableFlags,
      sortByY(table.causeIds, model),
      sortByY(table.intermediateIds, model),
      sortByY(table.effectIds, model),
    );
    writeOutput(csv, args.outputFile);
  } else if (args.mode === 'coverage') {
    const { table, state } = generateOptimizedDecisionTableWithState(model);

    if (table.stats.feasibleConditions === 0) {
      error('No feasible rules — all combinations violate constraints');
    }

    const coverageTable = generateCoverageTableFromState(model, state);
    const csv = generateCoverageTableCSV(coverageTable);
    writeOutput(csv, args.outputFile);
  } else if (args.mode === 'svg') {
    const svg = generateGraphSVG(model);
    writeOutput(svg, args.outputFile);
  }
}

main();
