/**
 * CSV Generation (Pure logic, no browser/DOM dependency)
 *
 * Extracted from csvExporter.ts for CLI compatibility.
 * Both the Web app (via csvExporter.ts) and CLI (via cli.ts) use these functions
 * to ensure identical output for the same input (CLI-NF-003).
 *
 * Browser-dependent download/clipboard functions remain in csvExporter.ts.
 */

import { getCoverageMarkerDisplay } from './coverageTableCalculator.js';
import { DECISION_TABLE_MESSAGES, COVERAGE_MESSAGES } from '../constants/messages.js';
import type { DecisionTable, TestCondition } from '../types/decisionTable.js';
import type { CoverageTable } from '../types/coverageTable.js';

// =============================================================================
// CSV Helpers
// =============================================================================

export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// =============================================================================
// Decision Table CSV
// =============================================================================

export function generateDecisionTableCSV(
  _table: DecisionTable,
  conditions: TestCondition[],
  nodeLabels: Map<string, string>,
  observableFlags: Map<string, boolean>,
  sortedCauseIds: string[],
  sortedIntermediateIds: string[],
  sortedEffectIds: string[]
): string {
  const lines: string[] = [];
  const getLabel = (nodeId: string) => nodeLabels.get(nodeId) || nodeId;

  // Header row
  const header = [
    'ID',
    DECISION_TABLE_MESSAGES.csvClassificationHeader,
    DECISION_TABLE_MESSAGES.csvObservableHeader,
    DECISION_TABLE_MESSAGES.csvLogicalStatementHeader,
    ...conditions.map((_, i) => `#${i + 1}`),
  ];
  lines.push(header.map(escapeCSV).join(','));

  // Status row (only when excluded conditions exist, i.e. learning mode)
  const hasExcluded = conditions.some((c) => c.excluded);
  if (hasExcluded) {
    const statusRow = [
      '',
      'Status',
      '',
      '',
      ...conditions.map((c) => {
        if (!c.excluded) return 'Adopted';
        const reason = c.exclusionReason?.type;
        if (reason === 'infeasible') return 'Infeasible';
        if (reason === 'redundant') return 'Redundant';
        if (reason === 'weak') return 'Weak';
        if (reason === 'untestable') return 'Untestable';
        return 'Excluded';
      }),
    ];
    lines.push(statusRow.map(escapeCSV).join(','));
  }

  // Causes section
  for (const nodeId of sortedCauseIds) {
    const row = [
      nodeId,
      DECISION_TABLE_MESSAGES.classificationCause,
      DECISION_TABLE_MESSAGES.observableFixed,
      escapeCSV(getLabel(nodeId)),
      ...conditions.map((c) => c.values.get(nodeId) || ''),
    ];
    lines.push(row.join(','));
  }

  // Intermediates section
  for (const nodeId of sortedIntermediateIds) {
    const isObservable = observableFlags.get(nodeId) ?? true;
    const row = [
      nodeId,
      DECISION_TABLE_MESSAGES.classificationIntermediate,
      isObservable ? DECISION_TABLE_MESSAGES.observableYes : DECISION_TABLE_MESSAGES.observableNo,
      escapeCSV(getLabel(nodeId)),
      ...conditions.map((c) => c.values.get(nodeId) || ''),
    ];
    lines.push(row.join(','));
  }

  // Effects section
  for (const nodeId of sortedEffectIds) {
    const isObservable = observableFlags.get(nodeId) ?? true;
    const row = [
      nodeId,
      DECISION_TABLE_MESSAGES.classificationEffect,
      isObservable ? DECISION_TABLE_MESSAGES.observableYes : DECISION_TABLE_MESSAGES.observableNo,
      escapeCSV(getLabel(nodeId)),
      ...conditions.map((c) => c.values.get(nodeId) || ''),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

// =============================================================================
// Coverage Table CSV
// =============================================================================

export function generateCoverageTableCSV(table: CoverageTable): string {
  const lines: string[] = [];
  const getNodeLabel_ = (nodeName: string) => table.nodeLabels.get(nodeName) || nodeName;

  // Header row
  const header = [
    COVERAGE_MESSAGES.expressionColumnHeader,
    ...table.nodeNames.map((name) => escapeCSV(`${name}: ${getNodeLabel_(name)}`)),
    ...table.conditionIds.map((_, i) => `#${i + 1}`),
    COVERAGE_MESSAGES.statusColumnHeader,
    COVERAGE_MESSAGES.reasonColumnHeader,
  ];
  lines.push(header.join(','));

  // Data rows
  for (const row of table.rows) {
    const status = row.isInfeasible
      ? COVERAGE_MESSAGES.statusInfeasible
      : row.isUntestable
        ? COVERAGE_MESSAGES.statusUntestable
        : '';

    const csvRow = [
      `Expr.${row.expressionIndex}`,
      ...table.nodeNames.map((nodeName) => row.requiredValues.get(nodeName) || ''),
      ...table.conditionIds.map((id) => getCoverageMarkerDisplay(row.coverage.get(id) || 'not_covered')),
      status,
      escapeCSV(row.reason || ''),
    ];
    lines.push(csvRow.join(','));
  }

  return lines.join('\r\n');
}
