/**
 * CSV Export Service
 *
 * Browser-dependent export functions (download, clipboard) and high-level
 * graph-to-CSV pipeline. Pure CSV generation logic lives in csvGenerator.ts.
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
import { generateCoverageTableFromState } from './coverageTableCalculator';
import { generateSkeletonPseudoCode } from './skeletonExporter';
import type { TestCondition } from '../types/decisionTable';

// Re-export pure CSV generation functions from csvGenerator.ts
// so existing import paths (from csvExporter) continue to work.
export {
  escapeCSV,
  generateDecisionTableCSV,
  generateCoverageTableCSV,
} from './csvGenerator';

import { generateDecisionTableCSV } from './csvGenerator';
import { generateCoverageTableCSV } from './csvGenerator';

// =============================================================================
// Browser-only Helpers
// =============================================================================

export function downloadCSV(content: string, filename: string): void {
  downloadBlob(content, filename, 'text/csv;charset=utf-8');
}

/** Download arbitrary text content (e.g. a pseudo-code skeleton) as a file. */
export function downloadText(content: string, filename: string): void {
  downloadBlob(content, filename, 'text/plain;charset=utf-8');
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
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
    logicalModel,
    table,
    coverageTable,
    nodeLabels,
    conditions,
    sortedCauseIds: sortById(table.causeIds),
    sortedIntermediateIds: sortById(table.intermediateIds),
    sortedEffectIds: sortById(table.effectIds),
  };
}

export function downloadDecisionTableCSVFromGraph(filename: string): void {
  const { table, conditions, nodeLabels, sortedCauseIds, sortedIntermediateIds, sortedEffectIds } =
    computeTablesFromGraph();
  const csv = generateDecisionTableCSV(table, conditions, nodeLabels, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
  downloadCSV(csv, filename);
}

export function downloadCoverageTableCSVFromGraph(filename: string): void {
  const { coverageTable } = computeTablesFromGraph();
  const csv = generateCoverageTableCSV(coverageTable);
  downloadCSV(csv, filename);
}

// =============================================================================
// Skeleton (graph-bound wrappers for the toolbar File menu)
// =============================================================================

/** Skeleton text for the current graph, or null when there is nothing to render. */
function computeSkeletonText(): string | null {
  const { logicalModel, table, nodeLabels } = computeTablesFromGraph();
  // Mirror DecisionTablePanel's guard: no causes / no feasible conditions => nothing to emit.
  if (table.causeIds.length === 0 || !table.conditions.some((c) => !c.excluded)) return null;
  return generateSkeletonPseudoCode(logicalModel, table, nodeLabels).text;
}

export function downloadSkeletonFromGraph(filename: string): void {
  const text = computeSkeletonText();
  if (text === null) return;
  downloadText(text, filename);
}

export async function copySkeletonToClipboard(): Promise<void> {
  const text = computeSkeletonText();
  if (text === null) return;
  await navigator.clipboard.writeText(text);
}
