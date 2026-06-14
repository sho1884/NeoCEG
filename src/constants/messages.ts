/**
 * Centralized Messages and Labels
 *
 * All user-facing messages, labels, and explanations are defined here
 * for maintainability and potential future i18n support.
 */

// =============================================================================
// Exclusion Reasons (Decision Table)
// =============================================================================

export const EXCLUSION_MESSAGES = {
  // ONE constraint
  oneViolated: (trueCount: number) =>
    `ONE constraint violated: ${trueCount} members are true (expected exactly 1)`,

  // EXCL constraint
  exclViolated: (trueCount: number) =>
    `EXCL constraint violated: ${trueCount} members are true (expected at most 1)`,

  // INCL constraint
  inclViolated: () =>
    `INCL constraint violated: no members are true (expected at least 1)`,

  // REQ constraint
  reqViolated: (targetName: string) =>
    `REQ constraint violated: source is true but target ${targetName} is false`,

  // Untestable (MASK propagation)
  untestable: (effectName: string) =>
    `Effect ${effectName} is indeterminate (I) due to MASK propagation`,

  // Redundant (Learning Mode)
  redundant: () => 'Not needed for expression coverage',
} as const;

// =============================================================================
// Coverage Table Messages
// =============================================================================

export const COVERAGE_MESSAGES = {
  // Column header
  expressionColumnHeader: 'Expr. (論理式)',

  // Expression status tooltips
  infeasibleTooltip: 'This expression is infeasible due to constraint violations',
  untestableTooltip: 'This expression is untestable due to MASK constraint',
  notCoveredTooltip: 'This expression is not covered by any test condition',

  // Status badges
  infeasibleBadge: 'Infeasible',
  untestableBadge: 'Untestable',
  notCoveredBadge: 'Not Covered',

  // Abbreviated badges for column headers
  infeasibleShort: 'Infeas.',
  untestableShort: 'Untest.',
  weakShort: 'Weak',
  redundantShort: 'Redun.',

  // Empty state
  noExpressions: 'No logical expressions to analyze',

  // Status and Reason columns
  statusColumnHeader: 'Status (状態)',
  reasonColumnHeader: 'Reason (理由)',
  statusInfeasible: 'Infeasible',
  statusUntestable: 'Untestable',
} as const;

// =============================================================================
// Decision Table Messages
// =============================================================================

export const DECISION_TABLE_MESSAGES = {
  // Empty states
  noFeasibleConditions: 'No feasible rules',
  noConditions: 'No rules',
  skeletonEmpty: 'No decision table to render',

  // Section headers
  causesSectionHeader: 'Causes (原因)',
  intermediatesSectionHeader: 'Intermediate (中間)',
  effectsSectionHeader: 'Effects (結果)',
  coverageSectionHeader: 'Coverage (カバレッジ)',

  // Column headers
  nodeColumnHeader: 'Logical Statement (論理言明)',
  expressionColumnHeader: 'Logical Expression',
  nodeExpressionColumnHeader: 'Node / Expression',

  // CSV column headers
  csvClassificationHeader: 'Classification (分類)',
  csvLogicalStatementHeader: 'Logical Statement (論理言明)',

  // Classification labels (for CSV)
  classificationCause: 'Cause (原因)',
  classificationIntermediate: 'Intermediate (中間)',
  classificationEffect: 'Effect (結果)',

  // Status text
  testConditions: (count: number) => `${count} rules`,
  infeasibleExcluded: (count: number) => `(${count} infeasible excluded)`,
  totalConditions: (total: number, feasible: number, infeasible: number, untestable: number) => {
    let text = `${total} total (${feasible} feasible, ${infeasible} infeasible`;
    if (untestable > 0) {
      text += `, ${untestable} untestable`;
    }
    text += ')';
    return text;
  },
  coverageStats: (percent: number, covered: number, total: number) =>
    `${percent.toFixed(0)}% coverage (${covered}/${total})`,
  conditionsAndCoverage: (conditions: number, percent: number) =>
    `${conditions} rules | ${percent.toFixed(0)}% coverage`,
} as const;

// =============================================================================
// Mode Toggle Messages
// =============================================================================

export const MODE_MESSAGES = {
  practiceMode: 'Practice',
  learningMode: 'Learning',
  practiceModeTooltip: 'Practice Mode: Show only feasible rules',
  learningModeTooltip: 'Learning Mode: Show all 2^n cause combinations with exclusion reasons',
  learningModeAutoDisabled: 'Decision table exceeds 256 columns. Switched to Practice Mode.',
} as const;

// =============================================================================
// Validity Warnings (model health) — GUI §7.4
// =============================================================================

export const VALIDITY_MESSAGES = {
  // A1: the skeleton was checked and a difference from the graph was found.
  skeletonMismatch:
    "ℹ The generated skeleton doesn't exactly match the graph — a difference was found in at least one case. Use it as a rough reference only.",
  // A2: too many inputs to verify exhaustively; equivalence is unconfirmed.
  skeletonUnchecked:
    "ℹ The generated skeleton couldn't be fully checked against the graph (too many inputs to verify exhaustively), so its exact equivalence is unconfirmed. Use it as a guide.",
  // B: a feasible test case produces multiple effects at once.
  multiEffect:
    "ℹ Some test cases produce more than one effect at once. That's fine if intended; otherwise, some constraint definitions may be missing.",
} as const;

// =============================================================================
// Tab Labels
// =============================================================================

export const TAB_LABELS = {
  decision: 'Decision',
  coverage: 'Coverage',
  compare: 'Compare',
  skeleton: 'Skeleton',
  ncegLanguage: 'NeoCEG Language {.nceg}',
} as const;

// =============================================================================
// Export Button Messages
// =============================================================================

export const EXPORT_MESSAGES = {
  downloadDecisionTableCSV: 'Download Decision Table as CSV',
  downloadCoverageTableCSV: 'Download Coverage Table as CSV',
  csvButtonLabel: 'CSV',
  csvCopyButtonLabel: 'Copy',
  // Single dual-format copy per table: HTML for Excel/Office, CSV for text editors.
  copyDecisionTable: 'Copy Decision Table (HTML for Excel, CSV for text)',
  copyCoverageTable: 'Copy Coverage Table (HTML for Excel, CSV for text)',
  copySkeleton: 'Copy Skeleton',
  downloadSkeleton: 'Download Skeleton',
  copyGrammar: 'Copy DSL Grammar',
  downloadGrammar: 'Download DSL Grammar',
  copyCegDefinition: 'Copy CEG Definition',
  pasteCegDefinition: 'Paste CEG Definition',
  saveCegDefinition: 'Save CEG Definition',
  importCegDefinition: 'Import CEG Definition',
  downloadSvg: 'Download SVG',
  copySvg: 'Copy SVG',
  downloadPng: 'Download PNG',
  copyPng: 'Copy PNG',
  downloadDecisionCsv: 'Download Decision CSV',
  downloadCoverageCsv: 'Download Coverage CSV',
  // File menu labels for the dual-format table copy.
  copyDecisionTableMenu: 'Copy Decision Table',
  copyCoverageTableMenu: 'Copy Coverage Table',
  copied: 'Copied!',
} as const;

// =============================================================================
// CSV Export Comments
// =============================================================================

export const CSV_COMMENTS = {
  causesSection: '# Causes',
  effectsSection: '# Effects',
  intermediatesSection: '# Intermediates',
  coveragePercent: (percent: number) => `# Coverage: ${percent.toFixed(1)}%`,
  coveredCount: (covered: number, total: number) => `# Covered: ${covered}/${total}`,
} as const;

// =============================================================================
// Toolbar Messages
// =============================================================================

export const TOOLBAR_MESSAGES = {
  undoTooltip: 'Undo (Ctrl+Z)',
  redoTooltip: 'Redo (Ctrl+Y)',
  importTooltip: 'Import graph from .nceg file',
  exportTooltip: 'Save CEG definition as .nceg file',
  copyCegTooltip: 'Copy CEG definition to clipboard',
  clearAllTooltip: 'Clear all',
  clickToToggleNot: 'Click to toggle NOT',
  clickToToggleAndOr: 'Click to toggle AND/OR',
} as const;
