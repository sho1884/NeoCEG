/**
 * CSV (decision-table layout) -> SkeletonInput (§3.1).
 *
 * Layout = nodes as rows, rules as columns — the exact shape NeoCEG exports via
 * `csvGenerator.generateDecisionTableCSV`. Column identification is tolerant of
 * the bilingual headers ("Classification (分類)", …) and localized classification
 * values ("Cause (原因)", …).
 */

import type { SkeletonInput, Condition, TruthValue } from './types.js';

const TRUTH_VALUES = new Set<TruthValue>(['T', 'F', 't', 'f', 'M', 'I']);

/** Parse one RFC-4180 record set into rows of fields (handles quotes, CRLF). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ',') {
      pushField();
      i++;
    } else if (c === '\r') {
      // swallow; the \n (or end) closes the row
      i++;
    } else if (c === '\n') {
      pushRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }
  // trailing field/row if file does not end with newline
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

/** Locate the four metadata columns and the rule (`#N`) columns. */
function locateColumns(header: string[]): {
  idCol: number;
  classCol: number;
  labelCol: number;
  ruleCols: number[];
} {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const idCol = Math.max(0, find(/^id$/i));
  const classCol = find(/classification|分類/i);
  const labelCol = find(/logical statement|論理言明/i);
  const ruleCols: number[] = [];
  header.forEach((h, idx) => {
    if (/^#\d+/.test(h.trim())) ruleCols.push(idx);
  });
  if (classCol < 0 || labelCol < 0 || ruleCols.length === 0) {
    throw new Error('CSV header is missing Classification / Logical Statement / rule columns');
  }
  return { idCol, classCol, labelCol, ruleCols };
}

type Role = 'cause' | 'intermediate' | 'effect' | 'status' | 'unknown';

function classify(value: string): Role {
  const v = value.trim();
  if (v === 'Status') return 'status';
  if (/^cause|原因/i.test(v)) return 'cause';
  if (/^intermediate|中間/i.test(v)) return 'intermediate';
  if (/^effect|結果/i.test(v)) return 'effect';
  return 'unknown';
}

/** Heuristic: does a Logical Statement cell carry a boolean expression? */
function looksLikeExpression(value: string): boolean {
  return /\b(AND|OR|NOT)\b/.test(value) && /\b[a-zA-Z]\w*\b/.test(value);
}

export function parseCsv(text: string): SkeletonInput {
  const rows = parseCsvRows(text);
  if (rows.length === 0) throw new Error('Empty CSV');

  const header = rows[0];
  const { idCol, classCol, labelCol, ruleCols } = locateColumns(header);

  const causeIds: string[] = [];
  const intermediateIds: string[] = [];
  const effectIds: string[] = [];
  const labels: Record<string, string> = {};
  const expressions: Record<string, string> = {};

  // Per rule column: id (1-based via header #N) and accumulating values map.
  const conditions: Condition[] = ruleCols.map((_, j) => ({
    id: j + 1,
    values: {},
    excluded: false,
  }));

  for (const row of rows.slice(1)) {
    const role = classify(row[classCol] ?? '');

    if (role === 'status') {
      ruleCols.forEach((col, j) => {
        const status = (row[col] ?? '').trim();
        // Only "Adopted" columns are converted; everything else is excluded.
        conditions[j].excluded = status !== '' && status !== 'Adopted';
      });
      continue;
    }

    if (role === 'unknown') continue;

    const id = (row[idCol] ?? '').trim();
    if (!id) continue;

    if (role === 'cause') causeIds.push(id);
    else if (role === 'intermediate') intermediateIds.push(id);
    else effectIds.push(id);

    const label = (row[labelCol] ?? '').trim();
    if (label) {
      labels[id] = label;
      if (looksLikeExpression(label)) expressions[id] = label;
    }

    ruleCols.forEach((col, j) => {
      const cell = (row[col] ?? '').trim();
      if (TRUTH_VALUES.has(cell as TruthValue)) {
        conditions[j].values[id] = cell as TruthValue;
      }
    });
  }

  const input: SkeletonInput = {
    causeIds,
    intermediateIds,
    effectIds,
    conditions,
  };
  if (Object.keys(labels).length) input.labels = labels;
  if (Object.keys(expressions).length) input.expressions = expressions;
  return input;
}
