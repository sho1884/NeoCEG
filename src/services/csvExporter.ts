/**
 * CSV Export Service
 *
 * Generates and exports Decision Table and Coverage Table as CSV.
 * Provides both low-level generation functions (used by DecisionTablePanel)
 * and high-level standalone functions (used by MainToolbar File menu).
 */

import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { graphToLogical } from './modelConverter';
import {
  generateOptimizedDecisionTableWithState,
  generateLearningModeTable,
  getFeasibleConditions,
  getNodeLabel,
} from './decisionTableCalculator';
import { generateCoverageTableFromState, getCoverageMarkerDisplay } from './coverageTableCalculator';
import { DECISION_TABLE_MESSAGES, COVERAGE_MESSAGES } from '../constants/messages';
import type { DecisionTable, TestCondition } from '../types/decisionTable';
import type { CoverageTable } from '../types/coverageTable';

// =============================================================================
// CSV Helpers
// =============================================================================

export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// CSV Generation (low-level, used by DecisionTablePanel tab buttons)
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

// =============================================================================
// Standalone Functions (high-level, used by MainToolbar File menu)
// =============================================================================

/**
 * Compute tables from current graph state.
 * Respects the current display mode (practice/learning) from uiStore.
 * - Practice mode: feasible conditions only
 * - Learning mode: all 2^n conditions (with excluded flags)
 */
export function computeTablesFromGraph() {
  const { nodes, constraintNodes, edges, constraints } = useGraphStore.getState();
  const { displayMode } = useUIStore.getState();

  const logicalModel = graphToLogical({ nodes, constraintNodes, edges, constraints });
  const { table, state } = generateOptimizedDecisionTableWithState(logicalModel);
  const coverageTable = generateCoverageTableFromState(logicalModel, state);

  // Build node labels
  const nodeLabels = new Map<string, string>();
  for (const [name] of logicalModel.nodes) {
    nodeLabels.set(name, getNodeLabel(logicalModel, name));
  }

  // Build observable flags
  const observableFlags = new Map<string, boolean>();
  for (const node of nodes) {
    observableFlags.set(node.id, node.data.observable ?? true);
  }

  // Sort by Y position
  const sortById = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const ay = logicalModel.nodes.get(a)?.position?.y ?? 0;
      const by = logicalModel.nodes.get(b)?.position?.y ?? 0;
      return ay - by;
    });

  // Use learning mode table when in learning mode
  let conditions: TestCondition[];
  if (displayMode === 'learning') {
    const learningTable = generateLearningModeTable(logicalModel, table);
    conditions = learningTable ? learningTable.conditions : getFeasibleConditions(table);
  } else {
    conditions = getFeasibleConditions(table);
  }

  return {
    table,
    coverageTable,
    nodeLabels,
    observableFlags,
    conditions,
    sortedCauseIds: sortById(table.causeIds),
    sortedIntermediateIds: sortById(table.intermediateIds),
    sortedEffectIds: sortById(table.effectIds),
  };
}

export function downloadDecisionTableCSVFromGraph(filename: string): void {
  const { table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds } =
    computeTablesFromGraph();
  const csv = generateDecisionTableCSV(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
  downloadCSV(csv, filename);
}

export async function copyDecisionTableCSVToClipboard(): Promise<void> {
  const { table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds } =
    computeTablesFromGraph();
  const csv = generateDecisionTableCSV(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
  await navigator.clipboard.writeText(csv);
}

export function downloadCoverageTableCSVFromGraph(filename: string): void {
  const { coverageTable } = computeTablesFromGraph();
  const csv = generateCoverageTableCSV(coverageTable);
  downloadCSV(csv, filename);
}

export async function copyCoverageTableCSVToClipboard(): Promise<void> {
  const { coverageTable } = computeTablesFromGraph();
  const csv = generateCoverageTableCSV(coverageTable);
  await navigator.clipboard.writeText(csv);
}
