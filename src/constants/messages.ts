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
  csvObservableHeader: 'Observable (観測可能)',

  // Classification labels (for CSV)
  classificationCause: 'Cause (原因)',
  classificationIntermediate: 'Intermediate (中間)',
  classificationEffect: 'Effect (結果)',

  // Observable labels
  observableYes: 'Yes',
  observableNo: 'No',
  observableFixed: '-',  // For causes (always observable)

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
// Tab Labels
// =============================================================================

export const TAB_LABELS = {
  decision: 'Decision',
  coverage: 'Coverage',
  compare: 'Compare',
  ncegLanguage: 'NeoCEG Language {.nceg}',
} as const;

// =============================================================================
// Export Button Messages
// =============================================================================

export const EXPORT_MESSAGES = {
  downloadDecisionTableCSV: 'Download Decision Table as CSV',
  downloadCoverageTableCSV: 'Download Coverage Table as CSV',
  copyDecisionTableCSV: 'Copy Decision Table as CSV',
  copyCoverageTableCSV: 'Copy Coverage Table as CSV',
  csvButtonLabel: 'CSV',
  csvCopyButtonLabel: 'Copy',
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
  copyDecisionCsv: 'Copy Decision CSV',
  copyCoverageCsv: 'Copy Coverage CSV',
  copyDecisionTableHTML: 'Copy Decision Table (HTML)',
  copyCoverageTableHTML: 'Copy Coverage Table (HTML)',
  copyDecisionHtml: 'Copy Decision HTML',
  copyCoverageHtml: 'Copy Coverage HTML',
  htmlCopyButtonLabel: 'HTML',
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
  nonObservableTooltip: 'Not Observable - cannot be directly tested (観測不可)',
} as const;
