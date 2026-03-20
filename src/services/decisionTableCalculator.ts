/**
 * Decision Table Calculator
 *
 * Generates optimized decision tables from a logical model
 * using the CEG algorithm (expression-based coverage).
 *
 * Reference: Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4
 */

import type {
  LogicalModel,
  LogicalNode,
  LogicalConstraint,
  ConstraintMemberRef,
} from '../types/logical';

import { isCause, isEffect } from '../types/logical';

import type {
  TestCondition,
  DecisionTable,
  ConstraintInfo,
} from '../types/decisionTable';

import type { TruthValue } from '../types/decisionTable';
import { isTrue, isFalse } from '../types/decisionTable';

import type { AlgorithmState } from '../types/cegAlgorithm';

import type { LogicalExpression } from '../types/cegAlgorithm';

import {
  calcTable,
  initWork,
  deduce,
  deduceConstraint,
  checkSingleConstraint,
} from './cegAlgorithm';

// =============================================================================
// Node Classification
// =============================================================================

interface NodeClassification {
  causes: LogicalNode[];
  intermediates: LogicalNode[];
  effects: LogicalNode[];
}

/**
 * Classify nodes into causes, intermediates, and effects
 */
function classifyNodes(model: LogicalModel): NodeClassification {
  const causes: LogicalNode[] = [];
  const intermediates: LogicalNode[] = [];
  const effects: LogicalNode[] = [];

  for (const [, node] of model.nodes) {
    if (isCause(node)) {
      causes.push(node);
    } else if (isEffect(node, model)) {
      effects.push(node);
    } else {
      intermediates.push(node);
    }
  }

  return { causes, intermediates, effects };
}

// =============================================================================
// Constraint Display Helpers
// =============================================================================

/**
 * Get member names from a constraint
 */
function getConstraintMemberNames(constraint: LogicalConstraint): string[] {
  switch (constraint.type) {
    case 'ONE':
    case 'EXCL':
    case 'INCL':
      return constraint.members.map((m) => m.name);
    case 'REQ':
      return [constraint.source.name, ...constraint.targets.map((t) => t.name)];
    case 'MASK':
      return [constraint.trigger.name, ...constraint.targets.map((t) => t.name)];
  }
}

/**
 * Create human-readable description of a constraint
 */
function describeConstraint(constraint: LogicalConstraint): string {
  const formatMember = (m: ConstraintMemberRef) =>
    m.negated ? `NOT ${m.name}` : m.name;

  switch (constraint.type) {
    case 'ONE':
      return `ONE(${constraint.members.map(formatMember).join(', ')})`;
    case 'EXCL':
      return `EXCL(${constraint.members.map(formatMember).join(', ')})`;
    case 'INCL':
      return `INCL(${constraint.members.map(formatMember).join(', ')})`;
    case 'REQ':
      return `REQ(${formatMember(constraint.source)} -> ${constraint.targets.map(formatMember).join(', ')})`;
    case 'MASK':
      return `MASK(${formatMember(constraint.trigger)} -> ${constraint.targets.map(formatMember).join(', ')})`;
  }
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get only feasible (non-excluded) conditions for Practice Mode
 */
export function getFeasibleConditions(table: DecisionTable): TestCondition[] {
  return table.conditions.filter((c) => !c.excluded);
}

/**
 * Get node label for display
 */
export function getNodeLabel(model: LogicalModel, nodeName: string): string {
  const node = model.nodes.get(nodeName);
  if (!node) return nodeName;
  return node.label && node.label.trim() !== '' ? node.label : nodeName;
}

// =============================================================================
// Truth Value Case Normalization
// =============================================================================

/**
 * Check if a test condition's values match a logical expression's requirements.
 * Comparison is case-insensitive (T/t both match 'T', F/f both match 'F').
 */
function conditionMatchesExpression(
  values: Map<string, TruthValue>,
  expr: LogicalExpression
): boolean {
  for (const [nodeName, reqValue] of expr.requiredValues) {
    const actual = values.get(nodeName);
    if (!actual) return false;
    if (reqValue === 'T' && !isTrue(actual)) return false;
    if (reqValue === 'F' && !isFalse(actual)) return false;
  }
  return true;
}

/**
 * Upgrade lowercase t/f to uppercase T/F when a matching expression exists.
 *
 * CEGTest convention:
 * - T/F: The node's value has a matching combination in the extracted expressions
 * - t/f: No matching combination exists (the value is a forced logical consequence)
 *
 * For each node with a lowercase value, check all expressions that include
 * that node. If any expression's required values are all satisfied by the
 * current test condition, upgrade to uppercase.
 */
function upgradeMatchedValues(
  conditions: TestCondition[],
  expressions: LogicalExpression[]
): void {
  // Build index: nodeName → expressions that include it
  const exprByNode = new Map<string, LogicalExpression[]>();
  for (const expr of expressions) {
    for (const nodeName of expr.requiredValues.keys()) {
      let list = exprByNode.get(nodeName);
      if (!list) {
        list = [];
        exprByNode.set(nodeName, list);
      }
      list.push(expr);
    }
  }

  for (const cond of conditions) {
    for (const [nodeName, value] of cond.values) {
      if (value !== 't' && value !== 'f') continue;

      const nodeExprs = exprByNode.get(nodeName);
      if (!nodeExprs) continue;

      for (const expr of nodeExprs) {
        if (conditionMatchesExpression(cond.values, expr)) {
          cond.values.set(nodeName, value === 't' ? 'T' : 'F');
          break;
        }
      }
    }
  }
}

// =============================================================================
// Optimized Decision Table Generation (CEG Algorithm)
// =============================================================================

/**
 * Convert AlgorithmState to DecisionTable format.
 *
 * Only includes active (non-weak) test conditions.
 * Maps internal WorkValue/TruthValue to the public DecisionTable format.
 */
function convertStateToDecisionTable(
  model: LogicalModel,
  state: AlgorithmState
): DecisionTable {
  const { causes, intermediates, effects } = classifyNodes(model);

  const conditions: TestCondition[] = [];
  let weakCount = 0;
  let feasibleCount = 0;

  for (let t = 0; t < state.tests.length; t++) {
    const conditionId = t + 1;
    if (state.weaks[t]) {
      weakCount++;
      conditions.push({
        id: conditionId,
        values: new Map(state.tests[t]),
        excluded: true,
        exclusionReason: {
          type: 'weak',
          explanation: 'Weak: all covered expressions are redundantly covered by other tests',
        },
      });
    } else {
      feasibleCount++;
      conditions.push({
        id: conditionId,
        values: new Map(state.tests[t]),
        excluded: false,
      });
    }
  }

  // Upgrade t/f → T/F where a matching expression exists
  upgradeMatchedValues(conditions, state.expressions);

  const constraintInfos: ConstraintInfo[] = model.constraints.map((c, i) => ({
    id: `c${i}`,
    type: c.type,
    memberIds: getConstraintMemberNames(c),
    description: describeConstraint(c),
  }));

  return {
    causeIds: causes.map((n) => n.name),
    effectIds: effects.map((n) => n.name),
    intermediateIds: intermediates.map((n) => n.name),
    conditions,
    constraints: constraintInfos,
    stats: {
      totalConditions: state.tests.length,
      feasibleConditions: feasibleCount,
      infeasibleCount: 0,
      weakCount,
      untestableCount: 0,
    },
  };
}

/**
 * Generate an optimized decision table using the CEG algorithm.
 *
 * Uses expression-based coverage and result coverage to minimize
 * the number of test conditions while ensuring complete coverage.
 *
 * Reference: Algorithm_Design.md
 */
export function generateOptimizedDecisionTable(model: LogicalModel): DecisionTable {
  const state = calcTable(model);
  return convertStateToDecisionTable(model, state);
}

/**
 * Generate an optimized decision table and return both the table and the
 * algorithm state. The state is needed for coverage table generation.
 */
export function generateOptimizedDecisionTableWithState(
  model: LogicalModel
): { table: DecisionTable; state: AlgorithmState } {
  const state = calcTable(model);
  const table = convertStateToDecisionTable(model, state);
  return { table, state };
}

// =============================================================================
// Learning Mode: Brute-Force 2^n Enumeration
// =============================================================================

/**
 * Generate a learning mode decision table with all 2^n cause combinations.
 *
 * Enumerates every possible cause combination in binary counting order,
 * evaluates each one, and marks excluded columns with beginner-friendly reasons.
 *
 * MASK handling: When a MASK trigger is satisfied, target causes are set to M
 * before value propagation. This means multiple brute-force rows may collapse
 * to the same effective condition (both are shown, one adopted, others redundant).
 *
 * Returns null if 2^n > 256 (too many columns for educational display).
 *
 * Reference: SR-025 (Learning Mode), SR-026 (256-column threshold)
 */
export function generateLearningModeTable(
  model: LogicalModel,
  optimizedTable: DecisionTable
): DecisionTable | null {
  const { causes, intermediates, effects } = classifyNodes(model);
  const n = causes.length;
  const total = 1 << n; // 2^n

  if (total > 256) return null;

  // Build cause name list (ordered)
  const causeNames = causes.map((c) => c.name);

  // Build a Map of optimized (non-excluded) cause value patterns for matching.
  // Each pattern can only be matched once (consumed on first match).
  const optimizedPatterns = new Map<string, boolean>();
  for (const cond of optimizedTable.conditions) {
    if (cond.excluded) continue;
    const key = causeNames.map((name) => {
      const v = cond.values.get(name);
      if (!v) return '';
      if (v === 'T' || v === 't') return 'T';
      if (v === 'F' || v === 'f') return 'F';
      return v; // M, I etc.
    }).join(',');
    optimizedPatterns.set(key, true); // true = available for matching
  }

  // Collect effect node names for untestable check
  const effectNames = effects.map((e) => e.name);

  const conditions: TestCondition[] = [];
  let feasibleCount = 0;
  let infeasibleCount = 0;
  let redundantCount = 0;
  let untestableCount = 0;

  for (let i = 0; i < total; i++) {
    const work = initWork(model);

    // Set cause values from binary counting (MSB first)
    for (let j = 0; j < n; j++) {
      const bit = (i >> (n - 1 - j)) & 1;
      work.set(causeNames[j], bit ? 'F' : 'T');
    }

    // Apply MASK constraints: if trigger satisfied, force targets to M.
    // This must happen BEFORE deduce so M propagates through logic correctly.
    for (const constraint of model.constraints) {
      if (constraint.type !== 'MASK') continue;
      const trigger = constraint.trigger;
      const trigVal = work.get(trigger.name);
      if (trigVal === '' || trigVal === undefined) continue;
      const satisfied = trigger.negated
        ? isFalse(trigVal as TruthValue)
        : isTrue(trigVal as TruthValue);
      if (satisfied) {
        for (const target of constraint.targets) {
          work.set(target.name, 'M');
        }
      }
    }

    // Propagate values through the graph (M → I through AND/OR)
    deduce(work, model);

    // Check non-MASK constraints for violations.
    // Skip MASK because we already applied it above.
    let violation = '';
    for (const constraint of model.constraints) {
      if (constraint.type === 'MASK') continue;
      deduceConstraint(work, constraint);
      const reason = checkSingleConstraint(work, constraint);
      if (reason !== '') {
        violation = reason;
        break;
      }
    }

    // Convert work values to TruthValue map (exclude empty strings)
    const values = new Map<string, TruthValue>();
    for (const [name, v] of work) {
      if (v !== '') values.set(name, v as TruthValue);
    }

    const conditionId = i + 1;

    if (violation !== '') {
      // Infeasible: constraint violated
      infeasibleCount++;
      conditions.push({
        id: conditionId,
        values,
        excluded: true,
        exclusionReason: {
          type: 'infeasible',
          explanation: violation,
        },
      });
    } else if (effectNames.some((name) => work.get(name) === 'I')) {
      // Untestable: at least one effect is indeterminate due to MASK
      untestableCount++;
      conditions.push({
        id: conditionId,
        values,
        excluded: true,
        exclusionReason: {
          type: 'untestable',
          explanation: 'Effect indeterminate (I) due to MASK',
        },
      });
    } else {
      // Build matching key from current (post-MASK) cause values
      const key = causeNames.map((name) => {
        const v = work.get(name);
        if (!v) return '';
        if (v === 'T' || v === 't') return 'T';
        if (v === 'F' || v === 'f') return 'F';
        return v; // M, I etc.
      }).join(',');

      if (optimizedPatterns.get(key)) {
        // Adopted: matches an optimized condition (consume the match)
        optimizedPatterns.set(key, false);
        feasibleCount++;
        conditions.push({
          id: conditionId,
          values,
          excluded: false,
        });
      } else {
        // Redundant: feasible but not needed for coverage
        redundantCount++;
        conditions.push({
          id: conditionId,
          values,
          excluded: true,
          exclusionReason: {
            type: 'redundant',
            explanation: 'Not needed for expression coverage',
          },
        });
      }
    }
  }

  // Learning mode: always show uppercase T/F (no expression-matching distinction)
  // Beginners see "what would happen if tested" — t/f vs T/F subtlety is not relevant.
  for (const cond of conditions) {
    for (const [nodeName, value] of cond.values) {
      if (value === 't') cond.values.set(nodeName, 'T');
      else if (value === 'f') cond.values.set(nodeName, 'F');
    }
  }

  const constraintInfos: ConstraintInfo[] = model.constraints.map((c, idx) => ({
    id: `c${idx}`,
    type: c.type,
    memberIds: getConstraintMemberNames(c),
    description: describeConstraint(c),
  }));

  return {
    causeIds: causeNames,
    effectIds: effectNames,
    intermediateIds: intermediates.map((n) => n.name),
    conditions,
    constraints: constraintInfos,
    stats: {
      totalConditions: total,
      feasibleConditions: feasibleCount,
      infeasibleCount,
      weakCount: redundantCount,
      untestableCount,
    },
  };
}
