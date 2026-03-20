/**
 * HTML Table Export Service
 *
 * Generates styled HTML tables for Decision Table and Coverage Table,
 * suitable for clipboard copy and paste into PowerPoint / Google Slides.
 * Uses ClipboardItem API with text/html + text/plain (CSV fallback).
 */

import { generateDecisionTableCSV, generateCoverageTableCSV, computeTablesFromGraph } from './csvExporter';
import { getCoverageMarkerDisplay } from './coverageTableCalculator';
import type { DecisionTable, TestCondition, TruthValue } from '../types/decisionTable';
import type { CoverageTable } from '../types/coverageTable';
import { DECISION_TABLE_MESSAGES, COVERAGE_MESSAGES } from '../constants/messages';

// =============================================================================
// Color Constants (matching DecisionTablePanel.tsx rendering)
// =============================================================================

const VALUE_COLORS: Record<string, { bg: string; text: string }> = {
  T: { bg: '#c8e6c9', text: '#2e7d32' },
  t: { bg: '#e8f5e9', text: '#388e3c' },
  F: { bg: '#ffcdd2', text: '#c62828' },
  f: { bg: '#ffebee', text: '#d32f2f' },
  M: { bg: '#e0e0e0', text: '#757575' },
  I: { bg: '#fff9c4', text: '#f9a825' },
};

const DEFAULT_VALUE_COLORS = { bg: '#fafafa', text: '#bdbdbd' };

const SECTION_COLORS = {
  cause:        { header: '#1976d2', row: '#e3f2fd' },
  intermediate: { header: '#3949ab', row: '#e8eaf6' },
  effect:       { header: '#7b1fa2', row: '#f3e5f5' },
};

const COVERAGE_MARKER_COLORS: Record<string, { bg: string; text: string }> = {
  adopted:     { bg: '#e3f2fd', text: '#1565c0' },
  covered:     { bg: '#e8eaf6', text: '#558b2f' },
  not_covered: { bg: '#ffffff', text: '#666666' },
  infeasible:  { bg: '#ffffff', text: '#c62828' },
  untestable:  { bg: '#ffffff', text: '#f9a825' },
};

// =============================================================================
// HTML Helpers
// =============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CELL_STYLE = 'border:1px solid #ccc; padding:4px 8px;';
const TABLE_STYLE = 'border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px;';

// =============================================================================
// Decision Table HTML Generation
// =============================================================================

export function generateDecisionTableHTML(
  _table: DecisionTable,
  conditions: TestCondition[],
  nodeLabels: Map<string, string>,
  observableFlags: Map<string, boolean>,
  sortedCauseIds: string[],
  sortedIntermediateIds: string[],
  sortedEffectIds: string[]
): string {
  const getLabel = (nodeId: string) => escapeHtml(nodeLabels.get(nodeId) || nodeId);
  const rows: string[] = [];

  // Check if any conditions are excluded (learning mode)
  const hasExcluded = conditions.some((c) => c.excluded);

  // Header row
  const headerCells = [
    `<th style="${CELL_STYLE} background:#f5f5f5; text-align:left; font-size:10px; color:#999; min-width:30px;">ID</th>`,
    `<th style="${CELL_STYLE} background:#f5f5f5; text-align:left; min-width:180px;">Logical Statement</th>`,
    ...conditions.map((c, i) => {
      const strikethrough = c.excluded ? 'text-decoration:line-through;' : '';
      const bg = c.excluded ? '#f5f5f5' : '#f5f5f5';
      return `<th style="${CELL_STYLE} background:${bg}; text-align:center; width:40px; ${strikethrough}">#${i + 1}</th>`;
    }),
  ];
  rows.push(`  <tr>${headerCells.join('')}</tr>`);

  // Status row (learning mode only)
  if (hasExcluded) {
    const statusCells = [
      `<td style="${CELL_STYLE} background:#f5f5f5;"></td>`,
      `<td style="${CELL_STYLE} background:#f5f5f5; font-weight:bold;">Status</td>`,
      ...conditions.map((c) => {
        if (!c.excluded) {
          return `<td style="${CELL_STYLE} text-align:center; background:#e8f5e9; color:#2e7d32; font-size:10px; font-weight:bold;">Adopted</td>`;
        }
        const reason = c.exclusionReason?.type;
        let label = 'Excluded';
        let color = '#757575';
        if (reason === 'infeasible') { label = 'Infeasible'; color = '#c62828'; }
        else if (reason === 'redundant') { label = 'Redundant'; color = '#757575'; }
        else if (reason === 'weak') { label = 'Weak'; color = '#e65100'; }
        else if (reason === 'untestable') { label = 'Untestable'; color = '#f9a825'; }
        return `<td style="${CELL_STYLE} text-align:center; background:#f5f5f5; color:${color}; font-size:10px;">${label}</td>`;
      }),
    ];
    rows.push(`  <tr>${statusCells.join('')}</tr>`);
  }

  // Helper to render value cell
  const valueCell = (value: TruthValue | '' | undefined, excluded: boolean): string => {
    const v = value || '';
    if (excluded) {
      return `<td style="${CELL_STYLE} text-align:center; background:#f5f5f5; color:#bdbdbd; text-decoration:line-through;">${v || '-'}</td>`;
    }
    const colors = (v && VALUE_COLORS[v]) || DEFAULT_VALUE_COLORS;
    const fontWeight = v === 'T' || v === 'F' ? 'font-weight:600;' : '';
    return `<td style="${CELL_STYLE} text-align:center; background:${colors.bg}; color:${colors.text}; ${fontWeight}">${v || '-'}</td>`;
  };

  // Helper to render section
  const renderSection = (
    nodeIds: string[],
    sectionLabel: string,
    sectionKey: keyof typeof SECTION_COLORS,
    isCause: boolean,
  ): void => {
    if (nodeIds.length === 0) return;

    const colors = SECTION_COLORS[sectionKey];

    // Section header (no colSpan — individual cells with same bg color)
    const sectionCells = [
      `<td style="${CELL_STYLE} background:${colors.header};"></td>`,
      `<td style="${CELL_STYLE} background:${colors.header}; color:white; font-weight:bold;">${sectionLabel}</td>`,
      ...conditions.map(() => `<td style="${CELL_STYLE} background:${colors.header};"></td>`),
    ];
    rows.push(`  <tr>${sectionCells.join('')}</tr>`);

    // Data rows
    for (const nodeId of nodeIds) {
      const isObservable = observableFlags.get(nodeId) ?? true;
      const obsMarker = !isCause && !isObservable ? ' *' : '';
      const idCell = `<td style="${CELL_STYLE} background:${colors.row}; font-size:10px; color:#aaa;">${nodeId}</td>`;
      const labelCell = `<td style="${CELL_STYLE} background:${colors.row};">${getLabel(nodeId)}${obsMarker}</td>`;
      const valueCells = conditions.map((c) => valueCell(c.values.get(nodeId), !!c.excluded)).join('');
      rows.push(`  <tr>${idCell}${labelCell}${valueCells}</tr>`);
    }
  };

  renderSection(sortedCauseIds, DECISION_TABLE_MESSAGES.causesSectionHeader, 'cause', true);
  renderSection(sortedIntermediateIds, DECISION_TABLE_MESSAGES.intermediatesSectionHeader, 'intermediate', false);
  renderSection(sortedEffectIds, DECISION_TABLE_MESSAGES.effectsSectionHeader, 'effect', false);

  return `<table style="${TABLE_STYLE}">\n${rows.join('\n')}\n</table>`;
}

// =============================================================================
// Coverage Table HTML Generation
// =============================================================================

export function generateCoverageTableHTML(table: CoverageTable): string {
  const getNodeLabel = (nodeName: string) => escapeHtml(table.nodeLabels.get(nodeName) || nodeName);
  const rows: string[] = [];

  // Header row
  const headerCells = [
    `<th style="${CELL_STYLE} background:#f5f5f5; text-align:left;">${COVERAGE_MESSAGES.expressionColumnHeader}</th>`,
    ...table.nodeNames.map((name) => `<th style="${CELL_STYLE} background:#f5f5f5; text-align:center; font-size:11px;"><span style="color:#aaa;">${escapeHtml(name)}: </span>${getNodeLabel(name)}</th>`),
    ...table.conditionIds.map((_, i) => `<th style="${CELL_STYLE} background:#e3f2fd; text-align:center; width:32px;">#${i + 1}</th>`),
    `<th style="${CELL_STYLE} background:#f5f5f5; text-align:left;">${COVERAGE_MESSAGES.statusColumnHeader}</th>`,
    `<th style="${CELL_STYLE} background:#f5f5f5; text-align:left;">${COVERAGE_MESSAGES.reasonColumnHeader}</th>`,
  ];
  rows.push(`  <tr>${headerCells.join('')}</tr>`);

  // Data rows
  for (const row of table.rows) {
    const cells: string[] = [];

    // Expression label
    const rowBg = (row.isInfeasible || row.isUntestable) ? '#f0f0f0' : '#fff';
    cells.push(`<td style="${CELL_STYLE} background:${rowBg};">Expr.${row.expressionIndex}</td>`);

    // Required value columns
    for (const nodeName of table.nodeNames) {
      const requiredValue = row.requiredValues.get(nodeName);
      if (requiredValue) {
        const isTrue = requiredValue === 'T' || requiredValue === 't';
        const bg = isTrue ? '#e8f5e9' : '#ffebee';
        const color = isTrue ? '#2e7d32' : '#c62828';
        cells.push(`<td style="${CELL_STYLE} text-align:center; background:${bg}; color:${color}; font-weight:bold;">${requiredValue}</td>`);
      } else {
        cells.push(`<td style="${CELL_STYLE} text-align:center; background:#fff; color:#ccc;"></td>`);
      }
    }

    // Coverage marker columns
    for (const condId of table.conditionIds) {
      const marker = row.coverage.get(condId) || 'not_covered';
      const display = getCoverageMarkerDisplay(marker);
      const colors = COVERAGE_MARKER_COLORS[marker] || COVERAGE_MARKER_COLORS.not_covered;
      const fontWeight = marker === 'adopted' ? 'font-weight:bold;' : '';
      cells.push(`<td style="${CELL_STYLE} text-align:center; background:${colors.bg}; color:${colors.text}; ${fontWeight}">${display}</td>`);
    }

    // Status column
    const status = row.isInfeasible ? COVERAGE_MESSAGES.statusInfeasible : row.isUntestable ? COVERAGE_MESSAGES.statusUntestable : '';
    const statusColor = row.isInfeasible ? '#c62828' : row.isUntestable ? '#f9a825' : '#666';
    cells.push(`<td style="${CELL_STYLE} background:${rowBg}; color:${statusColor}; font-size:11px;">${status}</td>`);

    // Reason column
    cells.push(`<td style="${CELL_STYLE} background:${rowBg}; color:#666; font-size:11px;">${escapeHtml(row.reason || '')}</td>`);

    rows.push(`  <tr>${cells.join('')}</tr>`);
  }

  return `<table style="${TABLE_STYLE}">\n${rows.join('\n')}\n</table>`;
}

// =============================================================================
// Clipboard Copy (low-level, used by DecisionTablePanel)
// =============================================================================

export async function copyDecisionTableHTMLToClipboard(
  table: DecisionTable,
  conditions: TestCondition[],
  nodeLabels: Map<string, string>,
  observableFlags: Map<string, boolean>,
  sortedCauseIds: string[],
  sortedIntermediateIds: string[],
  sortedEffectIds: string[]
): Promise<void> {
  const html = generateDecisionTableHTML(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
  const csv = generateDecisionTableCSV(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([csv], { type: 'text/plain' }),
    }),
  ]);
}

export async function copyCoverageTableHTMLToClipboard(table: CoverageTable): Promise<void> {
  const html = generateCoverageTableHTML(table);
  const csv = generateCoverageTableCSV(table);

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([csv], { type: 'text/plain' }),
    }),
  ]);
}

// =============================================================================
// Standalone Functions (high-level, used by MainToolbar File menu)
// =============================================================================

export async function copyDecisionTableHTMLFromGraph(): Promise<void> {
  const { table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds } =
    computeTablesFromGraph();
  await copyDecisionTableHTMLToClipboard(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
}

export async function copyCoverageTableHTMLFromGraph(): Promise<void> {
  const { coverageTable } = computeTablesFromGraph();
  await copyCoverageTableHTMLToClipboard(coverageTable);
}
