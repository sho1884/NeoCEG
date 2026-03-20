/**
 * Decision Table Panel Component
 *
 * Displays the decision table and coverage table in a collapsible panel with tabs.
 * Practice Mode: Shows only feasible test conditions.
 */

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { graphToLogical, applyLogicalModelToStore } from '../services/modelConverter';
import { parseLogicalDSL, readFileAsText } from '../services/logicalDslParser';
import {
  generateOptimizedDecisionTableWithState,
  generateLearningModeTable,
  getFeasibleConditions,
  getNodeLabel,
} from '../services/decisionTableCalculator';
import {
  generateCoverageTableFromState,
  getCoverageMarkerDisplay,
} from '../services/coverageTableCalculator';
import {
  serializeLogicalModel,
  downloadLogicalDSL,
  copyLogicalDSLToClipboard,
} from '../services/logicalDslSerializer';
import {
  generateDecisionTableCSV,
  generateCoverageTableCSV,
  downloadCSV,
} from '../services/csvExporter';
import {
  copyDecisionTableHTMLToClipboard,
  copyCoverageTableHTMLToClipboard,
} from '../services/htmlTableExporter';
import type { DecisionTable, TestCondition, TruthValue, DisplayMode } from '../types/decisionTable';
import type { LogicalModel } from '../types/logical';
import type { CoverageTable, CoverageMarker, CoverageRow } from '../types/coverageTable';
import {
  COVERAGE_MESSAGES,
  DECISION_TABLE_MESSAGES,
  MODE_MESSAGES,
  TAB_LABELS,
  EXPORT_MESSAGES,
} from '../constants/messages';

type TabType = 'decision' | 'coverage' | 'compare' | 'ncegLanguage';

// =============================================================================
// Value Display
// =============================================================================

const VALUE_COLORS: Record<string, { bg: string; text: string }> = {
  T: { bg: '#c8e6c9', text: '#2e7d32' }, // Green for explicit true
  t: { bg: '#e8f5e9', text: '#388e3c' }, // Light green for derived true
  F: { bg: '#ffcdd2', text: '#c62828' }, // Red for explicit false
  f: { bg: '#ffebee', text: '#d32f2f' }, // Light red for derived false
  M: { bg: '#e0e0e0', text: '#757575' }, // Gray for masked
  I: { bg: '#fff9c4', text: '#f9a825' }, // Yellow for indeterminate
};

const DEFAULT_COLORS = { bg: '#fafafa', text: '#bdbdbd' };

// =============================================================================
// Decision Table Component
// =============================================================================

interface DecisionTableViewProps {
  table: DecisionTable;
  conditions: TestCondition[];
  nodeLabels: Map<string, string>;
  mode: DisplayMode;
  observableFlags: Map<string, boolean>;
  sortedCauseIds: string[];
  sortedIntermediateIds: string[];
  sortedEffectIds: string[];
}

/**
 * Observable icon component
 */
function ObservableIcon({ observable, isCause }: { observable: boolean; isCause: boolean }) {
  if (isCause) return null;
  if (observable) return null; // Default state, no indicator needed

  // Non-observable warning indicator
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        marginLeft: '4px',
        borderRadius: '50%',
        backgroundColor: '#ffa726',
        border: '1px solid #f57c00',
        verticalAlign: 'middle',
      }}
      title="Not Observable (観測不可)"
    />
  );
}

/**
 * Value cell that handles excluded conditions in Learning Mode
 */
function ValueCellWithExclusion({
  value,
  isExcluded,
}: {
  value: TruthValue | '' | undefined;
  isExcluded: boolean;
}) {
  const colors = (value && VALUE_COLORS[value]) || DEFAULT_COLORS;
  const display = value || '-';
  return (
    <td
      style={{
        backgroundColor: isExcluded ? '#f5f5f5' : colors.bg,
        color: isExcluded ? '#999' : colors.text,
        fontWeight: value === 'T' || value === 'F' ? 'bold' : 'normal',
        textAlign: 'center',
        padding: '4px 8px',
        border: '1px solid #ddd',
        minWidth: '32px',
        textDecoration: isExcluded ? 'line-through' : 'none',
        opacity: isExcluded ? 0.7 : 1,
      }}
    >
      {display}
    </td>
  );
}

/**
 * Exclusion reason badge shown in Learning Mode header
 */
function ExclusionBadge({ reason }: { reason: TestCondition['exclusionReason'] }) {
  if (!reason) return null;

  const badgeColors: Record<string, { bg: string; text: string }> = {
    infeasible: { bg: '#ffcdd2', text: '#c62828' },
    untestable: { bg: '#fff9c4', text: '#f9a825' },
    weak: { bg: '#e0e0e0', text: '#757575' },
    redundant: { bg: '#bbdefb', text: '#1565c0' },
  };

  const badgeLabels: Record<string, string> = {
    infeasible: COVERAGE_MESSAGES.infeasibleShort,
    untestable: COVERAGE_MESSAGES.untestableShort,
    weak: COVERAGE_MESSAGES.weakShort,
    redundant: COVERAGE_MESSAGES.redundantShort,
  };

  const colors = badgeColors[reason.type] || badgeColors.weak;

  return (
    <div
      style={{
        fontSize: '9px',
        backgroundColor: colors.bg,
        color: colors.text,
        padding: '1px 4px',
        borderRadius: '2px',
        marginTop: '2px',
        whiteSpace: 'nowrap',
      }}
      title={reason.explanation}
    >
      {badgeLabels[reason.type] || reason.type}
    </div>
  );
}

function DecisionTableView({ table: _table, conditions, nodeLabels, mode, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds }: DecisionTableViewProps) {
  if (conditions.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#666', textAlign: 'center' }}>
        {mode === 'practice'
          ? DECISION_TABLE_MESSAGES.noFeasibleConditions
          : DECISION_TABLE_MESSAGES.noConditions}
      </div>
    );
  }

  const getLabel = (nodeId: string) => nodeLabels.get(nodeId) || nodeId;

  // In Learning Mode, number conditions sequentially but show exclusion status
  // In Practice Mode, number only feasible conditions
  const getColumnNumber = (index: number) => index + 1;

  return (
    <div>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '13px',
          width: '100%',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th
              style={{
                padding: '4px 6px',
                border: '1px solid #ddd',
                textAlign: 'left',
                backgroundColor: '#f5f5f5',
                fontSize: '10px',
                color: '#999',
                minWidth: '30px',
              }}
            >
              ID
            </th>
            <th
              style={{
                padding: '8px',
                border: '1px solid #ddd',
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                backgroundColor: '#f5f5f5',
                zIndex: 1,
              }}
            >
              {DECISION_TABLE_MESSAGES.nodeColumnHeader}
            </th>
            {conditions.map((c, i) => (
              <th
                key={c.id}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  textAlign: 'center',
                  minWidth: '40px',
                  backgroundColor: c.excluded ? '#f5f5f5' : '#f5f5f5',
                  opacity: c.excluded ? 0.7 : 1,
                  verticalAlign: 'top',
                }}
                title={c.exclusionReason?.explanation}
              >
                <div style={{ textDecoration: c.excluded ? 'line-through' : 'none' }}>
                  {getColumnNumber(i)}
                </div>
                {mode === 'learning' && c.excluded && (
                  <ExclusionBadge reason={c.exclusionReason} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Causes section */}
          {sortedCauseIds.length > 0 && (
            <tr>
              <td style={{ padding: '4px 8px', backgroundColor: '#1976d2', border: '1px solid #ddd' }} />
              <td
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#1976d2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.causesSectionHeader}
              </td>
              {conditions.map((c) => (
                <td key={c.id} style={{ padding: '4px 8px', backgroundColor: '#1976d2', border: '1px solid #ddd' }} />
              ))}
            </tr>
          )}
          {sortedCauseIds.map((nodeId) => (
            <tr key={nodeId}>
              <td
                style={{
                  padding: '4px 6px',
                  border: '1px solid #ddd',
                  backgroundColor: '#e3f2fd',
                  fontSize: '10px',
                  color: '#aaa',
                  whiteSpace: 'nowrap',
                }}
              >
                {nodeId}
              </td>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e3f2fd',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}

          {/* Intermediates section */}
          {sortedIntermediateIds.length > 0 && (
            <tr>
              <td style={{ padding: '4px 8px', backgroundColor: '#3949ab', border: '1px solid #ddd' }} />
              <td
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#3949ab',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.intermediatesSectionHeader}
              </td>
              {conditions.map((c) => (
                <td key={c.id} style={{ padding: '4px 8px', backgroundColor: '#3949ab', border: '1px solid #ddd' }} />
              ))}
            </tr>
          )}
          {sortedIntermediateIds.map((nodeId) => (
            <tr key={nodeId}>
              <td
                style={{
                  padding: '4px 6px',
                  border: '1px solid #ddd',
                  backgroundColor: '#e8eaf6',
                  fontSize: '10px',
                  color: '#aaa',
                  whiteSpace: 'nowrap',
                }}
              >
                {nodeId}
              </td>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e8eaf6',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
                <ObservableIcon observable={observableFlags.get(nodeId) ?? true} isCause={false} />
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}

          {/* Effects section */}
          {sortedEffectIds.length > 0 && (
            <tr>
              <td style={{ padding: '4px 8px', backgroundColor: '#7b1fa2', border: '1px solid #ddd' }} />
              <td
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#7b1fa2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.effectsSectionHeader}
              </td>
              {conditions.map((c) => (
                <td key={c.id} style={{ padding: '4px 8px', backgroundColor: '#7b1fa2', border: '1px solid #ddd' }} />
              ))}
            </tr>
          )}
          {sortedEffectIds.map((nodeId) => (
            <tr key={nodeId}>
              <td
                style={{
                  padding: '4px 6px',
                  border: '1px solid #ddd',
                  backgroundColor: '#f3e5f5',
                  fontSize: '10px',
                  color: '#aaa',
                  whiteSpace: 'nowrap',
                }}
              >
                {nodeId}
              </td>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f3e5f5',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
                <ObservableIcon observable={observableFlags.get(nodeId) ?? true} isCause={false} />
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Coverage Table Components
// =============================================================================

const COVERAGE_COLORS: Record<CoverageMarker, { bg: string; text: string }> = {
  adopted: { bg: '#c8e6c9', text: '#2e7d32' },
  covered: { bg: '#e8f5e9', text: '#558b2f' },
  not_covered: { bg: '#ffffff', text: '#999999' },
  infeasible: { bg: '#ffcdd2', text: '#c62828' },
  untestable: { bg: '#fff9c4', text: '#f9a825' },
};

function StatusBadge({ row }: { row: CoverageRow }) {
  if (row.isInfeasible) {
    return (
      <span
        style={{
          marginLeft: '8px',
          padding: '2px 6px',
          fontSize: '10px',
          backgroundColor: '#ffcdd2',
          color: '#c62828',
          borderRadius: '3px',
        }}
        title={COVERAGE_MESSAGES.infeasibleTooltip}
      >
        {COVERAGE_MESSAGES.infeasibleBadge}
      </span>
    );
  }

  if (row.isUntestable) {
    return (
      <span
        style={{
          marginLeft: '8px',
          padding: '2px 6px',
          fontSize: '10px',
          backgroundColor: '#fff9c4',
          color: '#f9a825',
          borderRadius: '3px',
        }}
        title={COVERAGE_MESSAGES.untestableTooltip}
      >
        {COVERAGE_MESSAGES.untestableBadge}
      </span>
    );
  }

  if (!row.isCovered) {
    return (
      <span
        style={{
          marginLeft: '8px',
          padding: '2px 6px',
          fontSize: '10px',
          backgroundColor: '#ffe0b2',
          color: '#e65100',
          borderRadius: '3px',
        }}
        title={COVERAGE_MESSAGES.notCoveredTooltip}
      >
        {COVERAGE_MESSAGES.notCoveredBadge}
      </span>
    );
  }

  return null;
}

interface CoverageTableViewProps {
  table: CoverageTable;
  conditions?: TestCondition[];
  mode?: DisplayMode;
}

/**
 * Coverage Table View (CEGTest Format)
 *
 * Displays logical expressions with:
 * - Expression column (論理式1, 論理式2, ...)
 * - Node columns showing required values (T/F)
 * - Test condition columns showing coverage (# = covered, x = infeasible, blank = not covered)
 * - Remarks column showing status
 */
function CoverageTableView({ table, conditions, mode = 'practice' }: CoverageTableViewProps) {
  if (table.rows.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#666', textAlign: 'center' }}>
        {COVERAGE_MESSAGES.noExpressions}
      </div>
    );
  }

  // Use provided conditions or fall back to table.conditionIds
  const displayConditions = conditions || table.conditionIds.map(id => ({ id, excluded: false } as TestCondition));

  // Get node labels for headers
  const getNodeLabel = (nodeName: string) => table.nodeLabels.get(nodeName) || nodeName;

  return (
    <div>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '12px',
          width: 'auto',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            {/* Expression column header */}
            <th
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                backgroundColor: '#f5f5f5',
                zIndex: 2,
                minWidth: '80px',
                whiteSpace: 'nowrap',
              }}
            >
              {COVERAGE_MESSAGES.expressionColumnHeader}
            </th>
            {/* Node columns (for required values) */}
            {table.nodeNames.map((nodeName) => (
              <th
                key={nodeName}
                style={{
                  padding: '4px 6px',
                  border: '1px solid #ddd',
                  textAlign: 'center',
                  minWidth: '24px',
                  maxWidth: '100px',
                  fontSize: '10px',
                  fontWeight: 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  height: '80px',
                }}
                title={`${nodeName}: ${getNodeLabel(nodeName)}`}
              >
                <span style={{ color: '#aaa' }}>{nodeName}: </span>{getNodeLabel(nodeName)}
              </th>
            ))}
            {/* Test condition columns */}
            {displayConditions.map((c, i) => {
              const isExcluded = typeof c === 'object' && 'excluded' in c ? c.excluded : false;
              const exclusionReason = typeof c === 'object' && 'exclusionReason' in c ? c.exclusionReason : undefined;
              return (
                <th
                  key={typeof c === 'number' ? c : c.id}
                  style={{
                    padding: '4px 6px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                    minWidth: '28px',
                    opacity: isExcluded ? 0.7 : 1,
                    verticalAlign: 'bottom',
                    backgroundColor: '#e3f2fd',
                  }}
                  title={exclusionReason?.explanation || `Test condition #${i + 1}`}
                >
                  <div style={{ textDecoration: isExcluded ? 'line-through' : 'none' }}>
                    #{i + 1}
                  </div>
                  {mode === 'learning' && isExcluded && (
                    <ExclusionBadge reason={exclusionReason} />
                  )}
                </th>
              );
            })}
            {/* Status column */}
            <th
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                textAlign: 'left',
                minWidth: '60px',
                backgroundColor: '#f5f5f5',
              }}
            >
              {COVERAGE_MESSAGES.statusColumnHeader}
            </th>
            {/* Reason column */}
            <th
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                textAlign: 'left',
                minWidth: '80px',
                backgroundColor: '#f5f5f5',
              }}
            >
              {COVERAGE_MESSAGES.reasonColumnHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr
              key={row.expressionIndex}
              style={{
                backgroundColor: (row.isInfeasible || row.isUntestable) ? '#f0f0f0' : undefined,
              }}
            >
              {/* Expression name column */}
              <td
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: (row.isInfeasible || row.isUntestable) ? '#f0f0f0' : '#fff',
                  whiteSpace: 'nowrap',
                  zIndex: 1,
                }}
                title={row.edge.label}
              >
                Expr.{row.expressionIndex}
              </td>
              {/* Node value columns (required values for this expression) */}
              {table.nodeNames.map((nodeName) => {
                const requiredValue = row.requiredValues.get(nodeName);
                return (
                  <td
                    key={nodeName}
                    style={{
                      padding: '2px 4px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      backgroundColor: requiredValue
                        ? requiredValue === 'T' || requiredValue === 't'
                          ? '#e8f5e9'
                          : '#ffebee'
                        : '#fff',
                      color: requiredValue
                        ? requiredValue === 'T' || requiredValue === 't'
                          ? '#2e7d32'
                          : '#c62828'
                        : '#ccc',
                      fontWeight: requiredValue ? 'bold' : 'normal',
                    }}
                  >
                    {requiredValue || ''}
                  </td>
                );
              })}
              {/* Coverage columns */}
              {displayConditions.map((c) => {
                const conditionId = typeof c === 'number' ? c : c.id;
                const isExcluded = typeof c === 'object' && 'excluded' in c ? c.excluded : false;
                const marker = row.coverage.get(conditionId) || 'not_covered';
                const displayMarker = getCoverageMarkerDisplay(marker);

                return (
                  <td
                    key={conditionId}
                    style={{
                      padding: '2px 4px',
                      border: '1px solid #ddd',
                      textAlign: 'center',
                      backgroundColor: isExcluded
                        ? '#f5f5f5'
                        : marker === 'adopted'
                          ? '#e3f2fd'
                          : marker === 'covered'
                            ? '#e8eaf6'
                            : '#fff',
                      color: isExcluded
                        ? '#999'
                        : marker === 'adopted'
                          ? '#1565c0'
                          : marker === 'covered'
                            ? '#558b2f'
                            : marker === 'infeasible'
                              ? '#c62828'
                              : marker === 'untestable'
                                ? '#f9a825'
                                : '#666',
                      fontWeight: marker === 'adopted' ? 'bold' : 'normal',
                      opacity: isExcluded ? 0.7 : 1,
                    }}
                  >
                    {isExcluded ? '' : displayMarker}
                  </td>
                );
              })}
              {/* Status column */}
              <td
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  backgroundColor: (row.isInfeasible || row.isUntestable) ? '#f0f0f0' : '#fff',
                  fontSize: '10px',
                  color: row.isInfeasible ? '#c62828' : row.isUntestable ? '#f9a825' : '#666',
                }}
              >
                {row.isInfeasible
                  ? COVERAGE_MESSAGES.statusInfeasible
                  : row.isUntestable
                    ? COVERAGE_MESSAGES.statusUntestable
                    : ''}
              </td>
              {/* Reason column */}
              <td
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  backgroundColor: (row.isInfeasible || row.isUntestable) ? '#f0f0f0' : '#fff',
                  fontSize: '10px',
                  color: '#666',
                }}
              >
                {row.reason || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Compare View (Both tables stacked vertically)
// =============================================================================

interface CompareViewProps {
  decisionTable: DecisionTable;
  conditions: TestCondition[];
  nodeLabels: Map<string, string>;
  coverageTable: CoverageTable;
  mode: DisplayMode;
  observableFlags: Map<string, boolean>;
  sortedCauseIds: string[];
  sortedIntermediateIds: string[];
  sortedEffectIds: string[];
}

function CompareView({
  decisionTable: _decisionTable,
  conditions,
  nodeLabels,
  coverageTable,
  mode,
  observableFlags,
  sortedCauseIds,
  sortedIntermediateIds,
  sortedEffectIds,
}: CompareViewProps) {
  if (conditions.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#666', textAlign: 'center' }}>
        {mode === 'practice'
          ? DECISION_TABLE_MESSAGES.noFeasibleConditions
          : DECISION_TABLE_MESSAGES.noConditions}
      </div>
    );
  }

  const getLabel = (nodeId: string) => nodeLabels.get(nodeId) || nodeId;

  return (
    <div>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '13px',
          width: '100%',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th
              style={{
                padding: '8px',
                border: '1px solid #ddd',
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                backgroundColor: '#f5f5f5',
                zIndex: 1,
                minWidth: '200px',
              }}
            >
              {DECISION_TABLE_MESSAGES.nodeExpressionColumnHeader}
            </th>
            {conditions.map((c, i) => (
              <th
                key={c.id}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  textAlign: 'center',
                  minWidth: '40px',
                  opacity: c.excluded ? 0.7 : 1,
                  verticalAlign: 'top',
                }}
                title={c.exclusionReason?.explanation}
              >
                <div style={{ textDecoration: c.excluded ? 'line-through' : 'none' }}>
                  {i + 1}
                </div>
                {mode === 'learning' && c.excluded && (
                  <ExclusionBadge reason={c.exclusionReason} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Decision Table Section - Causes */}
          {sortedCauseIds.length > 0 && (
            <tr>
              <td
                colSpan={conditions.length + 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#1976d2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.causesSectionHeader}
              </td>
            </tr>
          )}
          {sortedCauseIds.map((nodeId) => (
            <tr key={`cause-${nodeId}`}>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e3f2fd',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}

          {/* Decision Table Section - Intermediates */}
          {sortedIntermediateIds.length > 0 && (
            <tr>
              <td
                colSpan={conditions.length + 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#3949ab',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.intermediatesSectionHeader}
              </td>
            </tr>
          )}
          {sortedIntermediateIds.map((nodeId) => (
            <tr key={`intermediate-${nodeId}`}>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e8eaf6',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
                <ObservableIcon observable={observableFlags.get(nodeId) ?? true} isCause={false} />
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}

          {/* Decision Table Section - Effects */}
          {sortedEffectIds.length > 0 && (
            <tr>
              <td
                colSpan={conditions.length + 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#7b1fa2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.effectsSectionHeader}
              </td>
            </tr>
          )}
          {sortedEffectIds.map((nodeId) => (
            <tr key={`effect-${nodeId}`}>
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f3e5f5',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={getLabel(nodeId)}
              >
                {getLabel(nodeId)}
                <ObservableIcon observable={observableFlags.get(nodeId) ?? true} isCause={false} />
              </td>
              {conditions.map((c) => (
                <ValueCellWithExclusion
                  key={c.id}
                  value={c.values.get(nodeId)}
                  isExcluded={c.excluded}
                />
              ))}
            </tr>
          ))}

          {/* Coverage Table Section */}
          {coverageTable.rows.length > 0 && (
            <tr>
              <td
                colSpan={conditions.length + 1}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#7b1fa2',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  color: '#fff',
                  border: '1px solid #ddd',
                }}
              >
                {DECISION_TABLE_MESSAGES.coverageSectionHeader}
              </td>
            </tr>
          )}
          {coverageTable.rows.map((row, rowIndex) => (
            <tr
              key={`coverage-${rowIndex}`}
              style={{
                backgroundColor: row.isInfeasible ? '#fafafa' : row.isUntestable ? '#fffde7' : undefined,
              }}
            >
              <td
                style={{
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: row.isInfeasible ? '#fafafa' : row.isUntestable ? '#fffde7' : '#fff',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={row.edge.label}
              >
                {row.edge.label}
                <StatusBadge row={row} />
              </td>
              {conditions.map((c) => {
                // In Learning Mode, show coverage for excluded conditions too
                const marker = row.coverage.get(c.id) || 'not_covered';
                return (
                  <td
                    key={c.id}
                    style={{
                      backgroundColor: c.excluded ? '#f5f5f5' : COVERAGE_COLORS[marker].bg,
                      color: c.excluded ? '#999' : COVERAGE_COLORS[marker].text,
                      fontWeight: marker === 'adopted' && !c.excluded ? 'bold' : 'normal',
                      textAlign: 'center',
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      minWidth: '32px',
                      opacity: c.excluded ? 0.7 : 1,
                    }}
                    title={c.excluded ? c.exclusionReason?.explanation : marker}
                  >
                    {c.excluded ? '' : getCoverageMarkerDisplay(marker)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Tab Button
// =============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '5px 14px',
        border: '1px solid #ccc',
        borderBottom: active ? '1px solid #fff' : '1px solid #ccc',
        borderRadius: '6px 6px 0 0',
        backgroundColor: active ? '#fff' : '#e8e8e8',
        color: active ? '#1976d2' : '#666',
        fontWeight: active ? 600 : 'normal',
        fontSize: '13px',
        cursor: 'pointer',
        position: 'relative',
        bottom: '-1px',
        marginBottom: 0,
        transition: 'color 0.15s, background-color 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = '#333'; e.currentTarget.style.backgroundColor = '#f0f0f0'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.backgroundColor = '#e8e8e8'; } }}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Display Mode Toggle
// =============================================================================

interface ModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        padding: '2px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => onChange('practice')}
        style={{
          padding: '3px 8px',
          border: 'none',
          borderRadius: '3px',
          backgroundColor: mode === 'practice' ? '#1976d2' : 'transparent',
          color: mode === 'practice' ? '#fff' : '#666',
          fontSize: '11px',
          cursor: 'pointer',
          fontWeight: mode === 'practice' ? 'bold' : 'normal',
        }}
        title={MODE_MESSAGES.practiceModeTooltip}
      >
        {MODE_MESSAGES.practiceMode}
      </button>
      <button
        onClick={() => onChange('learning')}
        style={{
          padding: '3px 8px',
          border: 'none',
          borderRadius: '3px',
          backgroundColor: mode === 'learning' ? '#1976d2' : 'transparent',
          color: mode === 'learning' ? '#fff' : '#666',
          fontSize: '11px',
          cursor: 'pointer',
          fontWeight: mode === 'learning' ? 'bold' : 'normal',
        }}
        title={MODE_MESSAGES.learningModeTooltip}
      >
        {MODE_MESSAGES.learningMode}
      </button>
    </div>
  );
}

// CSV Export Functions are in ../services/csvExporter.ts

// =============================================================================
// Download Button
// =============================================================================

interface CSVButtonProps {
  onClick: () => void;
  title: string;
}

function DownloadButton({ onClick, title }: CSVButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#666',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
      title={title}
    >
      <span style={{ fontSize: '12px' }}>↓</span>
      {EXPORT_MESSAGES.csvButtonLabel}
    </button>
  );
}

function CopyCSVButton({ onClick, title }: CSVButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#666',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
      title={title}
    >
      <span style={{ fontSize: '12px' }}>⎘</span>
      {EXPORT_MESSAGES.csvCopyButtonLabel}
    </button>
  );
}

function CopyHTMLButton({ onClick, title }: CSVButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '4px 8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#666',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
      title={title}
    >
      <span style={{ fontSize: '12px' }}>⎘</span>
      {EXPORT_MESSAGES.htmlCopyButtonLabel}
    </button>
  );
}

// =============================================================================
// Export View
// =============================================================================

function ExportView({ dslText }: { dslText: string }) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingModel, setPendingModel] = useState<LogicalModel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nodes = useGraphStore((s) => s.nodes);
  const constraints = useGraphStore((s) => s.constraints);
  const hasData = nodes.length > 0 || constraints.length > 0;

  const showFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const confirmAndApply = useCallback((model: LogicalModel) => {
    if (hasData) {
      setPendingModel(model);
      setShowConfirmDialog(true);
    } else {
      applyLogicalModelToStore(model);
    }
  }, [hasData]);

  const handlePaste = useCallback(async () => {
    let content: string;
    try {
      content = await navigator.clipboard.readText();
    } catch {
      setImportError('Failed to read clipboard. Please allow clipboard access.');
      return;
    }
    if (!content.trim()) {
      setImportError('Clipboard is empty.');
      return;
    }
    const result = parseLogicalDSL(content);
    if (!result.success) {
      setImportError(result.errors.map(err => `Line ${err.line}: ${err.message}`).join('\n'));
      return;
    }
    confirmAndApply(result.model);
  }, [confirmAndApply]);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      const result = parseLogicalDSL(content);
      if (!result.success) {
        setImportError(result.errors.map(err => `Line ${err.line}: ${err.message}`).join('\n'));
        return;
      }
      confirmAndApply(result.model);
    } catch (err) {
      setImportError(`Failed to read file: ${err}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [confirmAndApply]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      {/* DSL text */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <textarea
          readOnly
          value={dslText}
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            resize: 'none',
            backgroundColor: '#fafafa',
            color: '#333',
            minHeight: 0,
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <ExportButton
          label={EXPORT_MESSAGES.copyCegDefinition}
          onClick={async () => {
            await copyLogicalDSLToClipboard(dslText);
            showFeedback(EXPORT_MESSAGES.copied);
          }}
        />
        <ExportButton
          label={EXPORT_MESSAGES.pasteCegDefinition}
          onClick={handlePaste}
        />
        <ExportButton
          label={EXPORT_MESSAGES.saveCegDefinition}
          onClick={() => {
            const date = new Date().toISOString().split('T')[0];
            downloadLogicalDSL(dslText, `graph_${date}.nceg`);
          }}
        />
        <ExportButton
          label={EXPORT_MESSAGES.importCegDefinition}
          onClick={() => fileInputRef.current?.click()}
        />
        {copyFeedback && (
          <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 600 }}>
            {copyFeedback}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".nceg,.txt"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Import confirmation dialog */}
      {showConfirmDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#333' }}>Import Graph</h3>
            <p style={{ margin: '0 0 20px', color: '#666' }}>
              The current graph has data. How would you like to import?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowConfirmDialog(false); setPendingModel(null); }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingModel) applyLogicalModelToStore(pendingModel);
                  setShowConfirmDialog(false);
                  setPendingModel(null);
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parse error dialog */}
      {importError && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '500px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: '#d32f2f' }}>Import Error</h3>
            <pre
              style={{
                margin: '0 0 20px',
                padding: '12px',
                backgroundColor: '#ffebee',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                color: '#c62828',
                border: '1px solid #ffcdd2',
              }}
            >
              {importError}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setImportError(null)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#fff',
        cursor: 'pointer',
        color: '#333',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// =============================================================================
// Main Panel
// =============================================================================

export default function DecisionTablePanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('decision');
  const displayMode = useUIStore((s) => s.displayMode);
  const setDisplayMode = useUIStore((s) => s.setDisplayMode);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(350);
  const [csvCopyFeedback, setCsvCopyFeedback] = useState<string | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 100, startHeight.current + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Get graph data from store
  const nodes = useGraphStore((state) => state.nodes);
  const constraintNodes = useGraphStore((state) => state.constraintNodes);
  const edges = useGraphStore((state) => state.edges);
  const constraints = useGraphStore((state) => state.constraints);

  // Generate decision table, coverage table, node labels, and observable flags.
  // Wrapped in try-catch: graph may be in an incomplete state during editing.
  const { table, coverageTable, nodeLabels, observableFlags, logicalModel } = useMemo(() => {
    // Build observable flags map from graph nodes (always needed)
    const observableFlags = new Map<string, boolean>();
    for (const node of nodes) {
      observableFlags.set(node.id, node.data.observable ?? true);
    }

    try {
      // Convert graph to logical model
      const logicalModel = graphToLogical({
        nodes,
        constraintNodes,
        edges,
        constraints,
      });

      // Generate decision table and algorithm state using CEG algorithm
      const { table, state } = generateOptimizedDecisionTableWithState(logicalModel);

      // Generate coverage table from algorithm state
      const coverageTable = generateCoverageTableFromState(logicalModel, state);

      // Build node labels map
      const nodeLabels = new Map<string, string>();
      for (const [name] of logicalModel.nodes) {
        nodeLabels.set(name, getNodeLabel(logicalModel, name));
      }

      return { table, coverageTable, nodeLabels, observableFlags, logicalModel, error: null };
    } catch (e) {
      // Graph is in an incomplete/invalid state during editing — return empty table
      const emptyTable: DecisionTable = {
        causeIds: [],
        effectIds: [],
        intermediateIds: [],
        conditions: [],
        constraints: [],
        stats: { totalConditions: 0, feasibleConditions: 0, infeasibleCount: 0, weakCount: 0, untestableCount: 0 },
      };
      const emptyCoverage: CoverageTable = {
        rows: [],
        nodeNames: [],
        nodeLabels: new Map(),
        conditionIds: [],
        stats: { totalExpressions: 0, coveredExpressions: 0, infeasibleExpressions: 0, untestableExpressions: 0, coveragePercent: 100 },
      };
      return {
        table: emptyTable,
        coverageTable: emptyCoverage,
        nodeLabels: new Map<string, string>(),
        observableFlags,
        logicalModel: null as LogicalModel | null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [nodes, constraintNodes, edges, constraints]);

  // Learning mode table: brute-force 2^n enumeration (separate memo, only when learning mode)
  const learningTable = useMemo(() => {
    if (displayMode !== 'learning') return null;
    if (!logicalModel) return null;
    return generateLearningModeTable(logicalModel, table);
  }, [displayMode, logicalModel, table]);

  // Auto-switch to Practice Mode when 2^n > 256
  useEffect(() => {
    if (displayMode === 'learning' && learningTable === null && logicalModel) {
      setDisplayMode('practice');
      setWarningMessage(MODE_MESSAGES.learningModeAutoDisabled);
      const timer = setTimeout(() => setWarningMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [displayMode, learningTable, logicalModel]);

  // Get the table and conditions to display based on mode
  const displayTable = displayMode === 'learning' && learningTable ? learningTable : table;

  // Sort node IDs within each section by Y coordinate (display-layer only)
  const sortedCauseIds = useMemo(() => {
    if (!logicalModel) return displayTable.causeIds;
    return [...displayTable.causeIds].sort((a, b) => {
      const ay = logicalModel.nodes.get(a)?.position?.y ?? 0;
      const by = logicalModel.nodes.get(b)?.position?.y ?? 0;
      return ay - by;
    });
  }, [displayTable.causeIds, logicalModel]);

  const sortedIntermediateIds = useMemo(() => {
    if (!logicalModel) return displayTable.intermediateIds;
    return [...displayTable.intermediateIds].sort((a, b) => {
      const ay = logicalModel.nodes.get(a)?.position?.y ?? 0;
      const by = logicalModel.nodes.get(b)?.position?.y ?? 0;
      return ay - by;
    });
  }, [displayTable.intermediateIds, logicalModel]);

  const sortedEffectIds = useMemo(() => {
    if (!logicalModel) return displayTable.effectIds;
    return [...displayTable.effectIds].sort((a, b) => {
      const ay = logicalModel.nodes.get(a)?.position?.y ?? 0;
      const by = logicalModel.nodes.get(b)?.position?.y ?? 0;
      return ay - by;
    });
  }, [displayTable.effectIds, logicalModel]);

  // Conditions for the decision table (mode-dependent)
  const conditions = useMemo(() => {
    if (displayMode === 'practice') {
      return getFeasibleConditions(table);
    }
    // Learning mode: show all 2^n conditions from learningTable
    return displayTable.conditions;
  }, [table, displayTable, displayMode]);

  // Conditions for coverage table (always practice mode — coverage is algorithm-driven)
  const practiceConditions = useMemo(() => getFeasibleConditions(table), [table]);

  // Coverage table is computed together with the decision table above

  // DSL text for export tab (reactive)
  const dslText = useMemo(() => {
    if (!logicalModel) return '';
    return serializeLogicalModel(logicalModel);
  }, [logicalModel]);

  // Don't show panel if no causes
  if (table.causeIds.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderTop: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        height: isExpanded ? `${panelHeight}px` : '40px',
        minHeight: isExpanded ? '100px' : '40px',
        transition: isExpanded ? 'none' : 'height 0.2s ease',
      }}
    >
      {/* Resize Handle */}
      {isExpanded && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            height: '6px',
            backgroundColor: '#e0e0e0',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #ccc',
          }}
          title="Drag to resize"
        >
          <div
            style={{
              width: '40px',
              height: '3px',
              backgroundColor: '#999',
              borderRadius: '2px',
            }}
          />
        </div>
      )}
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#f0f0f0',
          borderBottom: isExpanded ? '1px solid #ccc' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px' }}>
            <TabButton
              active={activeTab === 'decision'}
              onClick={() => setActiveTab('decision')}
            >
              {TAB_LABELS.decision}
            </TabButton>
            <TabButton
              active={activeTab === 'coverage'}
              onClick={() => setActiveTab('coverage')}
            >
              {TAB_LABELS.coverage}
            </TabButton>
            <TabButton
              active={activeTab === 'compare'}
              onClick={() => setActiveTab('compare')}
            >
              {TAB_LABELS.compare}
            </TabButton>
            <TabButton
              active={activeTab === 'ncegLanguage'}
              onClick={() => setActiveTab('ncegLanguage')}
            >
              {TAB_LABELS.ncegLanguage}
            </TabButton>
          </div>

          {/* Mode Toggle */}
          <ModeToggle mode={displayMode} onChange={setDisplayMode} />

          {/* Stats */}
          <span style={{ color: '#666', fontSize: '12px' }}>
            {activeTab === 'decision' && (
              <>
                {displayMode === 'practice' ? (
                  <>
                    {table.stats.feasibleConditions} rules
                    {table.stats.infeasibleCount > 0 && (
                      <span style={{ color: '#999' }}>
                        {' '}
                        ({table.stats.infeasibleCount} infeasible excluded)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {displayTable.stats.totalConditions} total ({displayTable.stats.feasibleConditions} feasible
                    {displayTable.stats.weakCount > 0 && (
                      <>, <span style={{ color: '#1565c0' }}>{displayTable.stats.weakCount} redundant</span></>
                    )}
                    {displayTable.stats.infeasibleCount > 0 && (
                      <>, <span style={{ color: '#c62828' }}>{displayTable.stats.infeasibleCount} infeasible</span></>
                    )}
                    {displayTable.stats.untestableCount > 0 && (
                      <>, <span style={{ color: '#f9a825' }}>{displayTable.stats.untestableCount} untestable</span></>
                    )}
                    )
                  </>
                )}
              </>
            )}
            {activeTab === 'coverage' && (
              <>
                <span
                  style={{
                    color: coverageTable.stats.coveragePercent >= 100 ? '#2e7d32' : '#e65100',
                    fontWeight: 'bold',
                  }}
                >
                  {coverageTable.stats.coveragePercent.toFixed(0)}%
                </span>
                {' '}coverage ({coverageTable.stats.coveredExpressions}/
                {coverageTable.stats.totalExpressions - coverageTable.stats.infeasibleExpressions - coverageTable.stats.untestableExpressions})
              </>
            )}
            {activeTab === 'compare' && (
              <>
                {displayMode === 'practice' ? table.stats.feasibleConditions : displayTable.stats.totalConditions} rules |{' '}
                <span
                  style={{
                    color: coverageTable.stats.coveragePercent >= 100 ? '#2e7d32' : '#e65100',
                    fontWeight: 'bold',
                  }}
                >
                  {coverageTable.stats.coveragePercent.toFixed(0)}%
                </span>
                {' '}coverage
              </>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Download buttons */}
          {isExpanded && (
            <>
              {(activeTab === 'decision' || activeTab === 'compare') && (
                <>
                  <DownloadButton
                    onClick={() => {
                      const csv = generateDecisionTableCSV(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
                      const date = new Date().toISOString().split('T')[0];
                      downloadCSV(csv, `decision_table_${date}.csv`);
                    }}
                    title={EXPORT_MESSAGES.downloadDecisionTableCSV}
                  />
                  <CopyCSVButton
                    onClick={async () => {
                      const csv = generateDecisionTableCSV(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
                      await navigator.clipboard.writeText(csv);
                      setCsvCopyFeedback(EXPORT_MESSAGES.copied);
                      setTimeout(() => setCsvCopyFeedback(null), 2000);
                    }}
                    title={EXPORT_MESSAGES.copyDecisionTableCSV}
                  />
                  <CopyHTMLButton
                    onClick={async () => {
                      await copyDecisionTableHTMLToClipboard(table, conditions, nodeLabels, observableFlags, sortedCauseIds, sortedIntermediateIds, sortedEffectIds);
                      setCsvCopyFeedback(EXPORT_MESSAGES.copied);
                      setTimeout(() => setCsvCopyFeedback(null), 2000);
                    }}
                    title={EXPORT_MESSAGES.copyDecisionTableHTML}
                  />
                </>
              )}
              {(activeTab === 'coverage' || activeTab === 'compare') && (
                <>
                  <DownloadButton
                    onClick={() => {
                      const csv = generateCoverageTableCSV(coverageTable);
                      const date = new Date().toISOString().split('T')[0];
                      downloadCSV(csv, `coverage_table_${date}.csv`);
                    }}
                    title={EXPORT_MESSAGES.downloadCoverageTableCSV}
                  />
                  <CopyCSVButton
                    onClick={async () => {
                      const csv = generateCoverageTableCSV(coverageTable);
                      await navigator.clipboard.writeText(csv);
                      setCsvCopyFeedback(EXPORT_MESSAGES.copied);
                      setTimeout(() => setCsvCopyFeedback(null), 2000);
                    }}
                    title={EXPORT_MESSAGES.copyCoverageTableCSV}
                  />
                  <CopyHTMLButton
                    onClick={async () => {
                      await copyCoverageTableHTMLToClipboard(coverageTable);
                      setCsvCopyFeedback(EXPORT_MESSAGES.copied);
                      setTimeout(() => setCsvCopyFeedback(null), 2000);
                    }}
                    title={EXPORT_MESSAGES.copyCoverageTableHTML}
                  />
                </>
              )}
              {csvCopyFeedback && (
                <span style={{ fontSize: '11px', color: '#2e7d32', fontWeight: 600 }}>
                  {csvCopyFeedback}
                </span>
              )}
            </>
          )}

          {/* Expand/Collapse button */}
          <button
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#666',
              padding: '4px',
            }}
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Warning message (auto-switch notification) */}
      {warningMessage && (
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: '#fff3e0',
            color: '#e65100',
            fontSize: '12px',
            borderBottom: '1px solid #ffe0b2',
          }}
        >
          {warningMessage}
        </div>
      )}

      {/* Table content */}
      {isExpanded && (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {activeTab === 'decision' && (
            <DecisionTableView
              table={displayTable}
              conditions={conditions}
              nodeLabels={nodeLabels}
              mode={displayMode}
              observableFlags={observableFlags}
              sortedCauseIds={sortedCauseIds}
              sortedIntermediateIds={sortedIntermediateIds}
              sortedEffectIds={sortedEffectIds}
            />
          )}
          {activeTab === 'coverage' && (
            <CoverageTableView
              table={coverageTable}
              conditions={practiceConditions}
              mode={displayMode}
            />
          )}
          {activeTab === 'compare' && (
            <CompareView
              decisionTable={displayTable}
              conditions={practiceConditions}
              nodeLabels={nodeLabels}
              coverageTable={coverageTable}
              mode={displayMode}
              observableFlags={observableFlags}
              sortedCauseIds={sortedCauseIds}
              sortedIntermediateIds={sortedIntermediateIds}
              sortedEffectIds={sortedEffectIds}
            />
          )}
          {activeTab === 'ncegLanguage' && (
            <ExportView dslText={dslText} />
          )}
        </div>
      )}
    </div>
  );
}
