/**
 * CEG Algorithm - Expression-based Coverage
 *
 * Generates optimized decision tables using expression-based coverage
 * and test condition merging.
 *
 * Reference:
 * - Myers, Badgett, Sandler "The Art of Software Testing" 3rd Ed., Ch.4
 * - Doc/Algorithm_Design.md (algorithm specification)
 */

import type { LogicalModel, LogicalNode, Expression, LogicalConstraint, ConstraintMemberRef } from '../types/logical';
import { isCause, isEffect, referencesNode } from '../types/logical';
import type { TruthValue } from '../types/decisionTable';
import { isTrue, isFalse } from '../types/decisionTable';
import type { LogicalExpression, ExpressionRequiredValue, WorkValue, AlgorithmState } from '../types/cegAlgorithm';
import type { ColumnOrigin } from '../types/decisionTable';
import { encodeCauseChoice } from '../types/cegAlgorithm';

// =============================================================================
// §4 Expression Extraction
// =============================================================================

/**
 * Information about a single input to a node.
 * Extracted from the expression AST operands.
 */
interface InputInfo {
  /** Name of the input node */
  name: string;
  /** Whether the edge from this input is negated (NOT) */
  negated: boolean;
}

/**
 * Extract input info from an expression operand.
 * Each operand is either ref(name) or not(ref(name)).
 */
function extractInput(expr: Expression): InputInfo {
  if (expr.type === 'ref') {
    return { name: expr.name, negated: false };
  }
  if (expr.type === 'not' && expr.operand.type === 'ref') {
    return { name: expr.operand.name, negated: true };
  }
  throw new Error(`Unsupported expression operand: ${expr.type}`);
}

/**
 * Analyze a node's expression to determine its operator and inputs.
 *
 * - ref(A) → AND with single input A (no negation)
 * - not(ref(A)) → AND with single input A (negated)
 * - and(operands) → AND with extracted inputs
 * - or(operands) → OR with extracted inputs
 */
function analyzeNodeExpression(expr: Expression): {
  operator: 'AND' | 'OR';
  inputs: InputInfo[];
} {
  switch (expr.type) {
    case 'ref':
      return { operator: 'AND', inputs: [{ name: expr.name, negated: false }] };
    case 'not':
      if (expr.operand.type === 'ref') {
        return { operator: 'AND', inputs: [{ name: expr.operand.name, negated: true }] };
      }
      throw new Error('Unsupported: NOT with non-ref operand');
    case 'and':
      return { operator: 'AND', inputs: expr.operands.map(extractInput) };
    case 'or':
      return { operator: 'OR', inputs: expr.operands.map(extractInput) };
  }
}

/**
 * Get the "satisfy" value for an input.
 * - Non-negated edge: T satisfies
 * - Negated edge (NOT): F satisfies
 *
 * Reference: Algorithm_Design.md §4.3, §4.4
 */
function satisfyValue(input: InputInfo): ExpressionRequiredValue {
  return input.negated ? 'F' : 'T';
}

/**
 * Get the "non-satisfy" value for an input.
 * - Non-negated edge: F is non-satisfy
 * - Negated edge (NOT): T is non-satisfy
 */
function nonSatisfyValue(input: InputInfo): ExpressionRequiredValue {
  return input.negated ? 'T' : 'F';
}

/**
 * Generate (n+1) logical expressions for a single node.
 *
 * AND node with n inputs:
 *   - Expression 0: all inputs satisfy → node T
 *   - Expressions 1..n: one input non-satisfy, rest satisfy → node F
 *
 * OR node with n inputs:
 *   - Expressions 0..n-1: one input satisfy, rest non-satisfy → node T
 *   - Expression n: all inputs non-satisfy → node F
 *
 * Reference: Algorithm_Design.md §4.3, §4.4
 */
function generateNodeExpressions(
  nodeName: string,
  expr: Expression,
  startIndex: number
): LogicalExpression[] {
  const { operator, inputs } = analyzeNodeExpression(expr);
  const n = inputs.length;
  const expressions: LogicalExpression[] = [];

  if (operator === 'AND') {
    // Expression 0: all inputs satisfy → node T
    const reqValues0 = new Map<string, ExpressionRequiredValue>();
    for (const input of inputs) {
      reqValues0.set(input.name, satisfyValue(input));
    }
    reqValues0.set(nodeName, 'T');
    expressions.push({
      index: startIndex,
      ownerNode: nodeName,
      column: 0,
      requiredValues: reqValues0,
    });

    // Expressions 1..n: i-th input non-satisfy, rest satisfy → node F
    for (let i = 0; i < n; i++) {
      const reqValues = new Map<string, ExpressionRequiredValue>();
      for (let j = 0; j < n; j++) {
        if (j === i) {
          reqValues.set(inputs[j].name, nonSatisfyValue(inputs[j]));
        } else {
          reqValues.set(inputs[j].name, satisfyValue(inputs[j]));
        }
      }
      reqValues.set(nodeName, 'F');
      expressions.push({
        index: startIndex + 1 + i,
        ownerNode: nodeName,
        column: 1 + i,
        requiredValues: reqValues,
      });
    }
  } else {
    // OR
    // Expressions 0..n-1: i-th input satisfy, rest non-satisfy → node T
    for (let i = 0; i < n; i++) {
      const reqValues = new Map<string, ExpressionRequiredValue>();
      for (let j = 0; j < n; j++) {
        if (j === i) {
          reqValues.set(inputs[j].name, satisfyValue(inputs[j]));
        } else {
          reqValues.set(inputs[j].name, nonSatisfyValue(inputs[j]));
        }
      }
      reqValues.set(nodeName, 'T');
      expressions.push({
        index: startIndex + i,
        ownerNode: nodeName,
        column: i,
        requiredValues: reqValues,
      });
    }

    // Expression n: all inputs non-satisfy → node F
    const reqValuesN = new Map<string, ExpressionRequiredValue>();
    for (const input of inputs) {
      reqValuesN.set(input.name, nonSatisfyValue(input));
    }
    reqValuesN.set(nodeName, 'F');
    expressions.push({
      index: startIndex + n,
      ownerNode: nodeName,
      column: n,
      requiredValues: reqValuesN,
    });
  }

  return expressions;
}

/**
 * Extract all logical expressions from a logical model.
 *
 * Processes effects first, then intermediates (matching CEGTest 1.6 ordering).
 * Each non-cause node generates (inputCount + 1) expressions.
 * Cause nodes generate no expressions.
 *
 * Reference: Algorithm_Design.md §4
 */
export function extractExpressions(model: LogicalModel): LogicalExpression[] {
  const expressions: LogicalExpression[] = [];
  let index = 0;

  // Classify nodes: effects first, then intermediates
  const effects: LogicalNode[] = [];
  const intermediates: LogicalNode[] = [];

  for (const [, node] of model.nodes) {
    if (isCause(node)) continue;
    if (isEffect(node, model)) {
      effects.push(node);
    } else {
      intermediates.push(node);
    }
  }

  // Process effects first, then intermediates
  for (const node of [...effects, ...intermediates]) {
    if (!node.expression) continue;
    const nodeExprs = generateNodeExpressions(node.name, node.expression, index);
    expressions.push(...nodeExprs);
    index += nodeExprs.length;
  }

  return expressions;
}

// =============================================================================
// §9 Value Propagation (deduce / deduceValue)
// =============================================================================

/**
 * Check if a work value is "satisfy" for a given input (considering NOT).
 * - Non-negated: T/t satisfies
 * - Negated (NOT): F/f satisfies
 */
function isInputSatisfied(value: WorkValue, negated: boolean): boolean {
  if (value === '') return false;
  return negated ? isFalse(value) : isTrue(value);
}

/**
 * Check if a work value is "non-satisfy" for a given input (considering NOT).
 * - Non-negated: F/f is non-satisfy
 * - Negated (NOT): T/t is non-satisfy
 */
function isInputNonSatisfied(value: WorkValue, negated: boolean): boolean {
  if (value === '') return false;
  return negated ? isTrue(value) : isFalse(value);
}

/**
 * Deduce the value of a single node from its inputs.
 *
 * - AND: if any input is non-satisfy → "f" (short-circuit);
 *        if any is M/I/"" → "I"; else → "t"
 * - OR:  if any input is satisfy → "t" (short-circuit);
 *        if any is M/I/"" → "I"; else → "f"
 *
 * Output values are always lowercase ("t", "f") or "I".
 * Never outputs uppercase "T"/"F".
 *
 * Reference: Algorithm_Design.md §9.2
 */
export function deduceValue(
  work: Map<string, WorkValue>,
  nodeName: string,
  model: LogicalModel
): void {
  const node = model.nodes.get(nodeName);
  if (!node || !node.expression) return;
  if (work.get(nodeName) !== '') return;

  const { operator, inputs } = analyzeNodeExpression(node.expression);

  // Recursively deduce inputs first
  for (const input of inputs) {
    if (work.get(input.name) === '') {
      deduceValue(work, input.name, model);
    }
  }

  if (operator === 'AND') {
    let indeterminate = false;
    for (const input of inputs) {
      const v = work.get(input.name) ?? '';
      if (isInputNonSatisfied(v, input.negated)) {
        work.set(nodeName, 'f');
        return;
      }
      if (v === 'M' || v === 'I' || v === '') {
        indeterminate = true;
      }
    }
    work.set(nodeName, indeterminate ? 'I' : 't');
  } else {
    let indeterminate = false;
    for (const input of inputs) {
      const v = work.get(input.name) ?? '';
      if (isInputSatisfied(v, input.negated)) {
        work.set(nodeName, 't');
        return;
      }
      if (v === 'M' || v === 'I' || v === '') {
        indeterminate = true;
      }
    }
    work.set(nodeName, indeterminate ? 'I' : 'f');
  }
}

/**
 * Deduce values for all unset nodes in the work array.
 *
 * Reference: Algorithm_Design.md §9.1
 */
export function deduce(
  work: Map<string, WorkValue>,
  model: LogicalModel
): void {
  for (const [name] of model.nodes) {
    if (work.get(name) !== '') continue;
    deduceValue(work, name, model);
  }
}

// =============================================================================
// §11 Constraint Processing
// =============================================================================

/**
 * Check if a constraint member is satisfied (effective value is true).
 */
function isMemberSatisfied(member: ConstraintMemberRef, work: Map<string, WorkValue>): boolean {
  const v = work.get(member.name);
  if (v === '' || v === undefined) return false;
  return member.negated ? isFalse(v) : isTrue(v);
}

/**
 * Check if a constraint member is non-satisfied (effective value is false).
 */
function isMemberNonSatisfied(member: ConstraintMemberRef, work: Map<string, WorkValue>): boolean {
  const v = work.get(member.name);
  if (v === '' || v === undefined) return false;
  return member.negated ? isTrue(v) : isFalse(v);
}

/**
 * Get the value to set to make a member satisfy (uppercase for constraint deduction).
 */
function memberSatisfySetValue(member: ConstraintMemberRef): 'T' | 'F' {
  return member.negated ? 'F' : 'T';
}

/**
 * Get the value to set to make a member non-satisfy (uppercase for constraint deduction).
 */
function memberNonSatisfySetValue(member: ConstraintMemberRef): 'T' | 'F' {
  return member.negated ? 'T' : 'F';
}

/**
 * Deduce values based on a ONE constraint.
 * - If one member is satisfied → set remaining unset to non-satisfy
 * - If all but one are non-satisfied → set the remaining to satisfy
 *
 * Reference: Algorithm_Design.md §11.2
 */
function deduceONE(work: Map<string, WorkValue>, members: ConstraintMemberRef[]): void {
  let hasSatisfied = false;
  let unsetCount = 0;

  for (const member of members) {
    if (isMemberSatisfied(member, work)) {
      hasSatisfied = true;
      break;
    }
    if (work.get(member.name) === '' || work.get(member.name) === undefined) {
      unsetCount++;
    }
  }

  if (hasSatisfied) {
    for (const member of members) {
      if (work.get(member.name) === '' || work.get(member.name) === undefined) {
        work.set(member.name, memberNonSatisfySetValue(member));
      }
    }
  }

  if (unsetCount === 1 && !hasSatisfied) {
    for (const member of members) {
      if (work.get(member.name) === '' || work.get(member.name) === undefined) {
        work.set(member.name, memberSatisfySetValue(member));
        break;
      }
    }
  }
}

/**
 * Deduce values based on an EXCL constraint.
 * - If one member is satisfied → set remaining unset to non-satisfy
 *
 * Reference: Algorithm_Design.md §11.2
 */
function deduceEXCL(work: Map<string, WorkValue>, members: ConstraintMemberRef[]): void {
  let hasSatisfied = false;

  for (const member of members) {
    if (isMemberSatisfied(member, work)) {
      hasSatisfied = true;
      break;
    }
  }

  if (hasSatisfied) {
    for (const member of members) {
      if (work.get(member.name) === '' || work.get(member.name) === undefined) {
        work.set(member.name, memberNonSatisfySetValue(member));
      }
    }
  }
}

/**
 * Deduce values based on an INCL constraint.
 * - If no member is satisfied and only one is unset → set it to satisfy
 *
 * NeoCEG fix: uses member count instead of total node count
 *
 * Reference: Algorithm_Design.md §11.2
 */
function deduceINCL(work: Map<string, WorkValue>, members: ConstraintMemberRef[]): void {
  let satisfiedCount = 0;
  let unsetCount = 0;

  for (const member of members) {
    if (isMemberSatisfied(member, work)) satisfiedCount++;
    if (work.get(member.name) === '' || work.get(member.name) === undefined) unsetCount++;
  }

  if (satisfiedCount === 0 && unsetCount === 1) {
    for (const member of members) {
      if (work.get(member.name) === '' || work.get(member.name) === undefined) {
        work.set(member.name, memberSatisfySetValue(member));
        break;
      }
    }
  }
}

/**
 * Deduce values based on a REQ constraint.
 * - If trigger is satisfied → set unset targets to their satisfy values
 *
 * Reference: Algorithm_Design.md §11.2
 */
function deduceREQ(
  work: Map<string, WorkValue>,
  source: ConstraintMemberRef,
  targets: ConstraintMemberRef[]
): void {
  // Source can be negated: REQ(NOT A -> B) means if A=F then B=T
  if (!isMemberSatisfied(source, work)) return;

  for (const target of targets) {
    if (work.get(target.name) === '' || work.get(target.name) === undefined) {
      work.set(target.name, memberSatisfySetValue(target));
    }
  }
}

/**
 * Apply constraint-based deduction for a single constraint.
 * For MASK type, applies masking and can return false on contradiction.
 * For other types, always returns true.
 *
 * Reference: Algorithm_Design.md §11.2
 */
export function deduceConstraint(
  work: Map<string, WorkValue>,
  constraint: LogicalConstraint
): boolean {
  switch (constraint.type) {
    case 'ONE':
      deduceONE(work, constraint.members);
      return true;
    case 'EXCL':
      deduceEXCL(work, constraint.members);
      return true;
    case 'INCL':
      deduceINCL(work, constraint.members);
      return true;
    case 'REQ':
      deduceREQ(work, constraint.source, constraint.targets);
      return true;
    case 'MASK':
      return applyMask(work, constraint.trigger, constraint.targets);
  }
}

/**
 * Apply MASK constraint.
 * When trigger is satisfied, targets become M (masked).
 * Returns false if a target already has a non-M, non-empty value.
 *
 * Reference: Algorithm_Design.md §11.3
 */
export function applyMask(
  work: Map<string, WorkValue>,
  trigger: ConstraintMemberRef,
  targets: ConstraintMemberRef[]
): boolean {
  // Trigger can be negated: MASK(NOT A -> B) means if A=F then B=M
  if (!isMemberSatisfied(trigger, work)) return true;

  for (const target of targets) {
    const v = work.get(target.name);
    if (v !== '' && v !== undefined && v !== 'M') {
      return false;
    }
    work.set(target.name, 'M');
  }
  return true;
}

/**
 * Apply deduction for all constraints.
 * Returns false if any constraint deduction fails.
 */
export function deduceAllConstraints(
  work: Map<string, WorkValue>,
  constraints: LogicalConstraint[]
): boolean {
  for (const constraint of constraints) {
    if (!deduceConstraint(work, constraint)) return false;
  }
  return true;
}

/**
 * Apply MASK constraints only (step 2 of nextCondition).
 */
export function applyAllMasks(
  work: Map<string, WorkValue>,
  constraints: LogicalConstraint[]
): boolean {
  for (const constraint of constraints) {
    if (constraint.type !== 'MASK') continue;
    if (!applyMask(work, constraint.trigger, constraint.targets)) return false;
  }
  return true;
}

// =============================================================================
// §11.4 Constraint Violation Check
// =============================================================================

/**
 * Format a constraint member reference for display.
 * Returns "NOT name" if negated, otherwise just "name".
 */
function formatMemberRef(ref: ConstraintMemberRef): string {
  return ref.negated ? `NOT ${ref.name}` : ref.name;
}

/**
 * Format a constraint as a display string.
 * Examples: "ONE(A, B, C)", "REQ(NOT A → B, C)", "MASK(NOT X → Y)"
 */
export function formatConstraintDisplay(constraint: LogicalConstraint): string {
  switch (constraint.type) {
    case 'ONE':
    case 'EXCL':
    case 'INCL':
      return `${constraint.type}(${constraint.members.map(formatMemberRef).join(', ')})`;
    case 'REQ':
      return `REQ(${formatMemberRef(constraint.source)} → ${constraint.targets.map(formatMemberRef).join(', ')})`;
    case 'MASK':
      return `MASK(${formatMemberRef(constraint.trigger)} → ${constraint.targets.map(formatMemberRef).join(', ')})`;
  }
}

/**
 * Check a single constraint for violations.
 * Returns empty string if satisfied, or the constraint display string if violated.
 *
 * Reference: Algorithm_Design.md §11.4
 */
export function checkSingleConstraint(
  work: Map<string, WorkValue>,
  constraint: LogicalConstraint
): string {
  switch (constraint.type) {
    case 'ONE': {
      let count = 0;
      let blank = 0;
      let mask = 0;
      for (const member of constraint.members) {
        const v = work.get(member.name);
        if (isMemberSatisfied(member, work)) count++;
        else if (v === '' || v === undefined) blank++;
        else if (v === 'M') mask++;
      }
      if (mask === 0 && ((count === 0 && blank === 0) || count > 1)) {
        return formatConstraintDisplay(constraint);
      }
      return '';
    }
    case 'EXCL': {
      let count = 0;
      let mask = 0;
      for (const member of constraint.members) {
        const v = work.get(member.name);
        if (isMemberSatisfied(member, work)) count++;
        else if (v === 'M') mask++;
      }
      if (mask === 0 && count > 1) {
        return formatConstraintDisplay(constraint);
      }
      return '';
    }
    case 'INCL': {
      let count = 0;
      let blank = 0;
      let mask = 0;
      for (const member of constraint.members) {
        const v = work.get(member.name);
        if (isMemberSatisfied(member, work)) count++;
        else if (v === '' || v === undefined) blank++;
        else if (v === 'M') mask++;
      }
      if (mask === 0 && count === 0 && blank === 0) {
        return formatConstraintDisplay(constraint);
      }
      return '';
    }
    case 'REQ': {
      if (!isMemberSatisfied(constraint.source, work)) return '';
      for (const target of constraint.targets) {
        if (isMemberNonSatisfied(target, work)) {
          return formatConstraintDisplay(constraint);
        }
      }
      return '';
    }
    case 'MASK': {
      if (!isMemberSatisfied(constraint.trigger, work)) return '';
      for (const target of constraint.targets) {
        const v = work.get(target.name);
        if (v !== 'M' && v !== '' && v !== undefined) {
          return formatConstraintDisplay(constraint);
        }
      }
      return '';
    }
  }
}

/**
 * Check all constraints for violations.
 * First applies MASK, then deduces and checks each constraint.
 * Returns empty string if all satisfied, or a reason string.
 *
 * Reference: Algorithm_Design.md §11.4
 */
export function checkConstr(
  work: Map<string, WorkValue>,
  constraints: LogicalConstraint[]
): string {
  const tmp = new Map(work);

  for (const constraint of constraints) {
    if (constraint.type === 'MASK') {
      applyMask(tmp, constraint.trigger, constraint.targets);
    }
  }

  for (const constraint of constraints) {
    deduceConstraint(tmp, constraint);
    const reason = checkSingleConstraint(tmp, constraint);
    if (reason !== '') return reason;
  }

  return '';
}

// =============================================================================
// §10 Logical Consistency Check (isPossible / checkRelation)
// =============================================================================

/**
 * Check if a node's value is logically consistent with its inputs.
 *
 * For AND nodes:
 * - Any non-satisfy input → expect "F" (short-circuit)
 * - All satisfy inputs → expect "T"
 * - If node value contradicts expectation → inconsistent
 *
 * For OR nodes (symmetric):
 * - Any satisfy input → expect "T" (short-circuit)
 * - All non-satisfy inputs → expect "F"
 * - If node value contradicts expectation → inconsistent
 *
 * Returns true if consistent, false if inconsistent.
 *
 * Reference: Algorithm_Design.md §10.2
 */
export function checkRelation(
  work: Map<string, WorkValue>,
  nodeName: string,
  model: LogicalModel
): boolean {
  const v = work.get(nodeName);
  if (v === '' || v === undefined) return true;

  const node = model.nodes.get(nodeName);
  if (!node || !node.expression) return true;

  const { operator, inputs } = analyzeNodeExpression(node.expression);

  let expect = '';
  let unknown = 0;
  let mask = 0;

  if (operator === 'AND') {
    for (const input of inputs) {
      const iv = work.get(input.name) ?? '';
      if (isInputNonSatisfied(iv, input.negated)) {
        expect = 'F';
        break;
      }
      if (iv === 'M') {
        mask++;
      } else if (isInputSatisfied(iv, input.negated)) {
        expect = 'T';
      } else {
        // '' or 'I'
        unknown++;
      }
    }

    // Node is T/t but AND should be F → contradiction
    if (isTrue(v) && expect === 'F' && unknown === 0) return false;
    // Node is F/f but all inputs satisfy → contradiction
    if (isFalse(v) && expect === 'T' && unknown === 0) return false;
    // Node is M but inputs are determined
    if (v === 'M') {
      if (unknown === 0 && mask === 0) return false;
      if (expect === 'F') return false;
    }

    return true;
  } else {
    // OR - symmetric
    for (const input of inputs) {
      const iv = work.get(input.name) ?? '';
      if (isInputSatisfied(iv, input.negated)) {
        expect = 'T';
        break;
      }
      if (iv === 'M') {
        mask++;
      } else if (isInputNonSatisfied(iv, input.negated)) {
        expect = 'F';
      } else {
        // '' or 'I'
        unknown++;
      }
    }

    // Node is F/f but OR should be T → contradiction
    if (isFalse(v) && expect === 'T' && unknown === 0) return false;
    // Node is T/t but all inputs non-satisfy → contradiction
    if (isTrue(v) && expect === 'F' && unknown === 0) return false;
    // Node is M but inputs are determined
    if (v === 'M') {
      if (unknown === 0 && mask === 0) return false;
      if (expect === 'T') return false;
    }

    return true;
  }
}

/**
 * Check if the work array is logically consistent across all nodes.
 *
 * Iterates all non-cause nodes and calls checkRelation.
 * Returns empty string if consistent, or a reason string if inconsistent.
 *
 * Reference: Algorithm_Design.md §10.1
 */
export function isPossible(
  work: Map<string, WorkValue>,
  model: LogicalModel
): string {
  for (const [name, node] of model.nodes) {
    if (isCause(node)) continue;
    if (!checkRelation(work, name, model)) {
      return `Inconsistency at node ${name}`;
    }
  }
  return '';
}

// =============================================================================
// §5-8 Test Condition Generation
// =============================================================================

/**
 * Check if a cause node is "isolated" (not referenced by any other node).
 */
function isIsolatedCause(nodeName: string, model: LogicalModel): boolean {
  for (const [, node] of model.nodes) {
    if (node.expression && referencesNode(node.expression, nodeName)) {
      return false;
    }
  }
  return true;
}

/**
 * Count how many existing tests cover a given expression.
 *
 * Reference: Algorithm_Design.md §5.1 (countCoverage)
 */
function countCoverage(exprIndex: number, covs: boolean[][]): number {
  let count = 0;
  for (const testCov of covs) {
    if (testCov[exprIndex]) count++;
  }
  return count;
}

/**
 * Check if a work array covers an expression (case-sensitive match).
 *
 * Reference: Algorithm_Design.md §13.1
 */

/**
 * Check if an expression can be merged into work without value conflicts.
 */

/**
 * Merge expression values into work array.
 */

/**
 * Rebuild the column from its seed and the merges that survived backtracking.
 *
 * Reference: Algorithm_Design.md §12.3
 */

/**
 * Select and merge logical expressions into the work array.
 *
 * mode=0: only uncovered expressions (Phase 1)
 * mode=1: also already-covered expressions (Phase 3 optimization)
 *
 * Returns count of newly adopted expressions.
 *
 * Reference: Algorithm_Design.md §7.1
 */

/**
 * Try to assign a value to a cause node.
 *
 * Tests the assignment on a temporary copy, checking constraints
 * and logical consistency. If valid, applies to work array.
 *
 * Reference: Algorithm_Design.md §8.1
 */
function chooseCauseValue(
  work: Map<string, WorkValue>,
  state: AlgorithmState,
  model: LogicalModel,
  nodeName: string,
  value: 't' | 'f'
): boolean {
  // Unsuitable check
  const choiceKey = encodeCauseChoice(nodeName, value === 't' ? 'T' : 'F');
  if (state.unsuitableCauseValues.has(choiceKey)) return false;

  // Trial on temp copy
  const tmp = new Map(work);
  tmp.set(nodeName, value);

  // Deduce values
  deduce(tmp, model);

  // Constraint deduction + mask
  for (const constraint of model.constraints) {
    if (!deduceConstraint(tmp, constraint)) return false;
  }
  if (!applyAllMasks(tmp, model.constraints)) return false;

  // Constraint violation check
  if (checkConstr(tmp, model.constraints) !== '') return false;

  // Logical consistency check
  if (isPossible(tmp, model) !== '') return false;

  // Success: apply value to work (not the full tmp)
  work.set(nodeName, value);
  return true;
}

/**
 * Generate a single test condition.
 *
 * Selects uncovered expressions, merges them, assigns cause values,
 * and backtracks on failure.
 *
 * Reference: Algorithm_Design.md §6.1
 */

/**
 * Initialize a fresh work array with all nodes set to ''.
 */
export function initWork(model: LogicalModel): Map<string, WorkValue> {
  const work = new Map<string, WorkValue>();
  for (const name of model.nodes.keys()) {
    work.set(name, '');
  }
  return work;
}

/**
 * Check if a test is "strong" (has at least one unique coverage '#').
 * Returns false if the test is weak (can be removed).
 *
 * Reference: Algorithm_Design.md §14.2
 */
/**
 * Whether test `t` demonstrates MASK constraint `c` functioning:
 * the trigger is satisfied AND at least one target is masked (M).
 * (Algorithm_Design.md §14.4)
 */
function demonstratesMask(
  test: Map<string, WorkValue>,
  c: LogicalConstraint
): boolean {
  if (c.type !== 'MASK') return false;
  if (!isMemberSatisfied(c.trigger, test)) return false;
  return c.targets.some((target) => test.get(target.name) === 'M');
}


/**
 * Generate optimized test conditions using the CEG algorithm.
 *
 * Returns the algorithm state containing tests, coverage, expressions, etc.
 *
 * Reference: Algorithm_Design.md §5.1
 */

// =============================================================================
// §2.5 Observability
// =============================================================================

/** A value the tester can read as true or false (not M / I / unset). */
function isDecided(v: WorkValue | undefined): boolean {
  return v !== undefined && v !== '' && (isTrue(v) || isFalse(v));
}

/** Effect node names, in model order. */
function effectNodeNames(model: LogicalModel): string[] {
  const names: string[] = [];
  for (const [name, node] of model.nodes) {
    if (isEffect(node, model)) names.push(name);
  }
  return names;
}

/** Copy of `work` with `nodeName` pinned to `value` and every other derived node re-derived. */
function pinAndRecompute(
  work: Map<string, WorkValue>,
  model: LogicalModel,
  nodeName: string,
  value: WorkValue
): Map<string, WorkValue> {
  const copy = new Map(work);
  copy.set(nodeName, value);
  for (const [name, node] of model.nodes) {
    if (node.expression && name !== nodeName) copy.set(name, '');
  }
  for (const [name, node] of model.nodes) {
    if (node.expression && name !== nodeName) deduceValue(copy, name, model);
  }
  return copy;
}

/**
 * Is `nodeName` observable in this column? (Algorithm_Design.md §2.5)
 *
 * Both sides are produced the same way, and only effects that are decided on
 * both sides count — a change from decided to M/I is nothing the tester can
 * judge, so it is not evidence that the value was observed.
 */
function observable(
  work: Map<string, WorkValue>,
  model: LogicalModel,
  nodeName: string,
  effects: string[]
): boolean {
  const v = work.get(nodeName);
  if (!isDecided(v)) return false;
  const kept = pinAndRecompute(work, model, nodeName, v as WorkValue);
  const flipped = pinAndRecompute(work, model, nodeName, isTrue(v as TruthValue) ? 'f' : 't');
  for (const name of effects) {
    const before = kept.get(name);
    const after = flipped.get(name);
    if (!isDecided(before) || !isDecided(after)) continue;
    if (isTrue(before as TruthValue) !== isTrue(after as TruthValue)) return true;
  }
  return false;
}

/** The column as the tester receives it: constraint completion and masking applied (§5.1). */
function settled(work: Map<string, WorkValue>, model: LogicalModel): Map<string, WorkValue> {
  const copy = new Map(work);
  deduceAllConstraints(copy, model.constraints);
  applyAllMasks(copy, model.constraints);
  return copy;
}

// =============================================================================
// §2 Sensitisation — the conditions that carry a value to an effect
// =============================================================================

/** Nodes taking `nodeName` as a direct input, in model order. */
function consumersOf(model: LogicalModel, nodeName: string): string[] {
  const out: string[] = [];
  for (const [name, node] of model.nodes) {
    if (node.expression && referencesNode(node.expression, nodeName)) out.push(name);
  }
  return out;
}

/**
 * §2.1: what the other inputs of `gate` must be so the value of `input` passes through.
 * AND lets a value through when the others satisfy; OR when the others do not.
 */
function gateSensitisation(
  model: LogicalModel,
  gate: string,
  input: string
): Map<string, ExpressionRequiredValue> | null {
  const node = model.nodes.get(gate);
  if (!node?.expression) return null;
  const { operator, inputs } = analyzeNodeExpression(node.expression);
  if (!inputs.some((i) => i.name === input)) return null;

  const req = new Map<string, ExpressionRequiredValue>();
  for (const other of inputs) {
    if (other.name === input) continue;
    const value: ExpressionRequiredValue =
      operator === 'AND' ? (other.negated ? 'F' : 'T') : (other.negated ? 'T' : 'F');
    const seen = req.get(other.name);
    if (seen !== undefined && seen !== value) return null; // the gate contradicts itself
    req.set(other.name, value);
  }
  return req;
}

/** One way to carry a value to an effect: what must hold, and where it lands. */
interface SensitisationPath {
  req: Map<string, ExpressionRequiredValue>;
  effect: string;
}

/**
 * §2.2 / §2.3: requirement sets that carry `nodeName` to an effect, in model order.
 * An effect observes itself, so it needs nothing. An empty result means the value
 * can reach no effect at all — the obligation is unobservable (§13.4).
 */
function sensitisationPaths(
  model: LogicalModel,
  nodeName: string,
  effects: string[],
  limit = 64
): SensitisationPath[] {
  if (effects.includes(nodeName)) return [{ req: new Map(), effect: nodeName }];

  const out: SensitisationPath[] = [];
  const queue: { node: string; req: Map<string, ExpressionRequiredValue>; seen: Set<string> }[] = [
    { node: nodeName, req: new Map(), seen: new Set([nodeName]) },
  ];
  while (queue.length > 0 && out.length < limit) {
    const cur = queue.shift()!;
    for (const gate of consumersOf(model, cur.node)) {
      if (cur.seen.has(gate)) continue;
      const gs = gateSensitisation(model, gate, cur.node);
      if (!gs) continue;

      const merged = new Map(cur.req);
      let ok = true;
      for (const [k, v] of gs) {
        const seen = merged.get(k);
        if (seen !== undefined && seen !== v) { ok = false; break; }
        merged.set(k, v);
      }
      if (!ok) continue;

      if (effects.includes(gate)) out.push({ req: merged, effect: gate });
      else queue.push({ node: gate, req: merged, seen: new Set([...cur.seen, gate]) });
    }
  }
  return out;
}

// =============================================================================
// §1.4 Obligations
// =============================================================================

type Obligation =
  | { kind: 'A'; index: number; owner: string }
  | { kind: 'B'; cause: string; want: boolean }
  | { kind: 'C'; constraint: Extract<LogicalConstraint, { type: 'MASK' }> };

/** The obligation set O of §1.4, in model order (so the output is deterministic). */
function buildObligations(model: LogicalModel, expressions: LogicalExpression[]): Obligation[] {
  const out: Obligation[] = [];
  expressions.forEach((e, i) => out.push({ kind: 'A', index: i, owner: e.ownerNode }));
  for (const [name, node] of model.nodes) {
    if (!isCause(node) || isIsolatedCause(name, model)) continue;
    out.push({ kind: 'B', cause: name, want: true });
    out.push({ kind: 'B', cause: name, want: false });
  }
  for (const c of model.constraints) {
    if (c.type === 'MASK') out.push({ kind: 'C', constraint: c });
  }
  return out;
}

/** The node whose value must reach an effect, or null when nothing propagates (§3.1). */
function obligationTarget(o: Obligation): string | null {
  if (o.kind === 'A') return o.owner;
  if (o.kind === 'B') return o.cause;
  return null; // C demonstrates masking itself, which is visible in the column
}

/** The values the obligation asks for, before sensitisation. */
function baseRequirements(
  o: Obligation,
  expressions: LogicalExpression[]
): Map<string, ExpressionRequiredValue> {
  const req = new Map<string, ExpressionRequiredValue>();
  if (o.kind === 'A') {
    for (const [k, v] of expressions[o.index].requiredValues) req.set(k, v);
  } else if (o.kind === 'B') {
    req.set(o.cause, o.want ? 'T' : 'F');
  } else {
    req.set(o.constraint.trigger.name, o.constraint.trigger.negated ? 'F' : 'T');
  }
  return req;
}

/** §13.1: does this column realise the expression? Truth matters, its origin does not (§2.2). */
function realizesExpression(work: Map<string, WorkValue>, expr: LogicalExpression): boolean {
  for (const [name, req] of expr.requiredValues) {
    const v = work.get(name);
    if (v === undefined || v === '') continue; // unset cell: no conflict
    if (req === 'T' ? !isTrue(v) : !isFalse(v)) return false;
  }
  return true;
}

/** §1.4: does this column discharge the obligation? */
function dischargesObligation(
  work: Map<string, WorkValue>,
  model: LogicalModel,
  o: Obligation,
  expressions: LogicalExpression[],
  effects: string[]
): boolean {
  if (o.kind === 'A') {
    return realizesExpression(work, expressions[o.index]) && observable(work, model, o.owner, effects);
  }
  if (o.kind === 'B') {
    const v = work.get(o.cause);
    if (!isDecided(v)) return false;
    if (isTrue(v as TruthValue) !== o.want) return false;
    return observable(work, model, o.cause, effects);
  }
  return demonstratesMask(work, o.constraint);
}

// =============================================================================
// §4 Column construction
// =============================================================================

/** Place one required value, reporting a conflict. 'T' and 't' agree (§2.2). */
function placeRequirement(
  work: Map<string, WorkValue>,
  name: string,
  value: ExpressionRequiredValue
): boolean {
  const cur = work.get(name);
  if (cur === undefined || cur === '') {
    work.set(name, value);
    return true;
  }
  if (!isDecided(cur)) return false; // M / I cannot be forced to a value
  return value === 'T' ? isTrue(cur as TruthValue) : isFalse(cur as TruthValue);
}

/** Masks, constraint deduction and the two consistency checks (§6.2, obligation D). */
function prepareColumn(work: Map<string, WorkValue>, model: LogicalModel): boolean {
  if (!applyAllMasks(work, model.constraints)) return false;
  for (const constraint of model.constraints) {
    if (!deduceConstraint(work, constraint)) return false;
  }
  if (checkConstr(work, model.constraints) !== '') return false;
  if (isPossible(work, model) !== '') return false;
  return true;
}

/** One expression merged into the column, with the requirement set it brought. */
interface AppliedExpression {
  index: number;
  req: Map<string, ExpressionRequiredValue>;
}

/** Rebuild the column from its seed and the merges that survived backtracking. */
function rebuildColumn(
  work: Map<string, WorkValue>,
  seed: Map<string, ExpressionRequiredValue>,
  applied: AppliedExpression[]
): void {
  for (const key of work.keys()) work.set(key, '');
  for (const [k, v] of seed) work.set(k, v);
  for (const a of applied) {
    for (const [k, v] of a.req) {
      const cur = work.get(k);
      if (cur === undefined || cur === '') work.set(k, v);
    }
  }
}

/**
 * Merge further expressions into the column (§7.1).
 *
 * A candidate brings its own values **and** the sensitisation its owner needs,
 * so a merge that would close another obligation's path simply fails the value
 * conflict check. No separate observability gate is needed here.
 */
function mergeExpressions(
  work: Map<string, WorkValue>,
  state: AlgorithmState,
  model: LogicalModel,
  effects: string[],
  applied: AppliedExpression[],
  mode: 0 | 1
): void {
  for (let l = 0; l < state.expressions.length; l++) {
    if (mode === 0 && countCoverage(l, state.covs) > 0) continue;
    if (state.vtestcov[l]) continue;
    if (state.unsuitableExpressions.has(l)) continue;
    if (state.infeasibles[l] !== null) continue;

    const expr = state.expressions[l];
    const paths = sensitisationPaths(model, expr.ownerNode, effects);
    if (paths.length === 0) continue; // the owner reaches no effect: nothing to verify

    for (const path of paths) {
      const req = new Map<string, ExpressionRequiredValue>();
      let ok = true;
      for (const [k, v] of expr.requiredValues) {
        const seen = req.get(k);
        if (seen !== undefined && seen !== v) { ok = false; break; }
        req.set(k, v);
      }
      if (ok) {
        for (const [k, v] of path.req) {
          const seen = req.get(k);
          if (seen !== undefined && seen !== v) { ok = false; break; }
          req.set(k, v);
        }
      }
      if (!ok) continue;

      const tmp = new Map(work);
      for (const [k, v] of req) {
        if (!placeRequirement(tmp, k, v)) { ok = false; break; }
      }
      if (!ok) continue;
      if (!prepareColumn(tmp, model)) continue;

      for (const [k, v] of tmp) work.set(k, v);
      state.vtestcov[l] = true;
      applied.push({ index: l, req });
      break;
    }
  }
}

/** Fill the free causes and settle the column (§6.2 steps 4-5). */
function completeColumn(
  work: Map<string, WorkValue>,
  state: AlgorithmState,
  model: LogicalModel,
  effects: string[],
  seed: Map<string, ExpressionRequiredValue>,
  applied: AppliedExpression[]
): boolean {
  const causeNodes: string[] = [];
  for (const [name, node] of model.nodes) {
    if (isCause(node) && !isIsolatedCause(name, model)) causeNodes.push(name);
  }

  const maxAttempts = state.lnum + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    applyAllMasks(work, model.constraints);
    mergeExpressions(work, state, model, effects, applied, 0);
    mergeExpressions(work, state, model, effects, applied, 1);

    let assigned = true;
    for (const causeName of causeNodes) {
      if (work.get(causeName) !== '') continue;
      if (chooseCauseValue(work, state, model, causeName, 't')) continue;
      if (chooseCauseValue(work, state, model, causeName, 'f')) continue;

      if (applied.length === 0) return false;
      const bad = applied.pop()!;
      state.vtestcov[bad.index] = false;
      state.unsuitableExpressions.add(bad.index);
      rebuildColumn(work, seed, applied);
      assigned = false;
      break;
    }
    if (!assigned) continue;

    deduce(work, model);
    if (isPossible(work, model) === '') return true;

    if (applied.length === 0) return false;
    const bad = applied.pop()!;
    state.vtestcov[bad.index] = false;
    state.unsuitableExpressions.add(bad.index);
    rebuildColumn(work, seed, applied);
  }
  return false;
}

/**
 * Build one column whose reason for existing is `o` (§4 Phase 1).
 *
 * The obligation's own values and the sensitisation that carries them to an
 * effect are placed together, so the column verifies `o` by construction.
 * Reconvergent paths can still cancel, so the finished column is checked
 * against §2.5 and the next path is tried when it does (§7.1).
 */
function buildColumn(
  model: LogicalModel,
  state: AlgorithmState,
  o: Obligation,
  effects: string[]
): { work: Map<string, WorkValue>; origin: ColumnOrigin } | null {
  const target = obligationTarget(o);
  const paths: SensitisationPath[] = target === null
    ? [{ req: new Map(), effect: '' }]
    : sensitisationPaths(model, target, effects);

  for (const path of paths) {
    const seed = new Map<string, ExpressionRequiredValue>();
    let ok = true;
    for (const [k, v] of baseRequirements(o, state.expressions)) {
      const seen = seed.get(k);
      if (seen !== undefined && seen !== v) { ok = false; break; }
      seed.set(k, v);
    }
    if (ok) {
      for (const [k, v] of path.req) {
        const seen = seed.get(k);
        if (seen !== undefined && seen !== v) { ok = false; break; }
        seed.set(k, v);
      }
    }
    if (!ok) continue;

    state.vtestcov = new Array(state.lnum).fill(false);
    state.unsuitableExpressions = new Set();
    state.unsuitableCauseValues = new Set();

    const work = initWork(model);
    for (const [k, v] of seed) {
      if (!placeRequirement(work, k, v)) { ok = false; break; }
    }
    if (!ok) continue;
    if (!prepareColumn(work, model)) continue;

    const applied: AppliedExpression[] = [];
    if (!completeColumn(work, state, model, effects, seed, applied)) continue;

    // The assertion of §7.1: construction should have made this true.
    if (!dischargesObligation(settled(work, model), model, o, state.expressions, effects)) continue;

    return { work, origin: originOf(o, path.effect) };
  }
  return null;
}

/** Why this column exists, in the shape the output carries (§3.7). */
function originOf(o: Obligation, effect: string): ColumnOrigin {
  if (o.kind === 'A') {
    return { kind: 'A', expressionIndex: o.index, observed: o.owner, effect };
  }
  if (o.kind === 'B') {
    return { kind: 'B', cause: o.cause, causeValue: o.want, observed: o.cause, effect };
  }
  return { kind: 'C', constraint: formatConstraintDisplay(o.constraint) };
}

/**
 * One line saying why a column exists (§3.7). Every output renders it the same
 * way, so the decision table, the coverage table, the CSV and the API agree.
 */
export function formatColumnOrigin(origin: ColumnOrigin | null | undefined): string {
  if (!origin) return '';
  // An effect observes itself, so naming it twice says nothing.
  const at = origin.observed === origin.effect ? '' : ` → ${origin.effect ?? ''}`;
  if (origin.kind === 'A') {
    return `Expr.${(origin.expressionIndex ?? 0) + 1} ${origin.observed ?? ''}${at}`;
  }
  if (origin.kind === 'B') {
    return `${origin.cause ?? ''}=${origin.causeValue ? 'T' : 'F'}${at}`;
  }
  return origin.constraint ?? '';
}

// =============================================================================
// §14 Weak test deletion — over obligations A, B and C
// =============================================================================

/**
 * May this column be removed? (§14.1)
 *
 * Only when every obligation it discharges is also discharged by another column
 * that is still kept. Expression coverage, result coverage and MASK
 * demonstration are all handled by this one rule.
 */
function isRemovable(
  testIndex: number,
  state: AlgorithmState,
  model: LogicalModel,
  obligations: Obligation[],
  effects: string[]
): boolean {
  const mine = obligations.filter((o) =>
    dischargesObligation(state.tests[testIndex], model, o, state.expressions, effects));

  for (const o of mine) {
    let coveredElsewhere = false;
    for (let t = 0; t < state.tests.length; t++) {
      if (t === testIndex || state.weaks[t]) continue;
      if (dischargesObligation(state.tests[t], model, o, state.expressions, effects)) {
        coveredElsewhere = true;
        break;
      }
    }
    if (!coveredElsewhere) return false;
  }
  return true;
}

// =============================================================================
// §5.1 calcTable — the pipeline of §4
// =============================================================================

/**
 * Generate the decision table for a model.
 *
 * Phase 0  list the obligations (A, B, C) in model order
 * Phase 1  build one column per obligation still undischarged
 * Phase 2  constraint completion, so the columns are what the tester receives
 * Phase 3  drop columns that repeat an input already present (obligation I)
 * Phase 4  judge expression coverage on the finished columns (§13.1)
 * Phase 5  weak test deletion over A u B u C (§14)
 * Phase 6  classify what could not be discharged (§13.4)
 *
 * Reference: Algorithm_Design.md §1.4, §4, §5.1
 */
export function calcTable(model: LogicalModel): AlgorithmState {
  const expressions = extractExpressions(model);
  const lnum = expressions.length;

  const state: AlgorithmState = {
    expressions,
    lnum,
    work: initWork(model),
    tests: [],
    covs: [],
    vtestcov: new Array(lnum).fill(false),
    unsuitableExpressions: new Set(),
    unsuitableCauseValues: new Set(),
    infeasibles: new Array(lnum).fill(null),
    unobservables: new Array(lnum).fill(null),
    origins: [],
    weaks: [],
  };

  if (lnum === 0) return state;

  const effects = effectNodeNames(model);
  const obligations = buildObligations(model, expressions);

  // === Phase 1: one column per obligation that is still undischarged ===
  for (const o of obligations) {
    const already = state.tests.some((t) =>
      dischargesObligation(settled(t, model), model, o, expressions, effects));
    if (already) continue;

    const built = buildColumn(model, state, o, effects);
    if (!built) continue; // classified in Phase 6

    state.tests.push(built.work as Map<string, TruthValue>);
    state.origins.push(built.origin);
    const view = settled(built.work, model);
    state.covs.push(expressions.map((e) =>
      realizesExpression(view, e) && observable(view, model, e.ownerNode, effects)));
  }

  // === Phase 2: constraint completion (§5.1) ===
  for (const test of state.tests) {
    const work = test as Map<string, WorkValue>;
    deduceAllConstraints(work, model.constraints);
    applyAllMasks(work, model.constraints);
  }

  // === Phase 3: one column per distinct executed input (obligation I) ===
  const causeNames: string[] = [];
  for (const [name, node] of model.nodes) if (isCause(node)) causeNames.push(name);
  const inputSignature = (t: Map<string, TruthValue>) =>
    causeNames.map((c) => {
      const v = t.get(c);
      if (isDecided(v)) return isTrue(v as TruthValue) ? '1' : '0';
      return v === 'M' ? 'M' : '-';
    }).join('');
  const seenInputs = new Set<string>();
  const kept: Map<string, TruthValue>[] = [];
  const keptOrigins: ColumnOrigin[] = [];
  state.tests.forEach((test, i) => {
    const sig = inputSignature(test);
    if (seenInputs.has(sig)) return; // the surviving column keeps its own origin
    seenInputs.add(sig);
    kept.push(test);
    keptOrigins.push(state.origins[i]);
  });
  state.tests = kept;
  state.origins = keptOrigins;

  // === Phase 4: expression coverage on the finished columns (§13.1) ===
  state.covs = state.tests.map((t) =>
    expressions.map((e) =>
      realizesExpression(t as Map<string, WorkValue>, e) &&
      observable(t as Map<string, WorkValue>, model, e.ownerNode, effects)));

  // === Phase 5: weak test deletion over A u B u C (§14) ===
  state.weaks = new Array(state.tests.length).fill(false);
  for (let t = 0; t < state.tests.length; t++) {
    if (isRemovable(t, state, model, obligations, effects)) state.weaks[t] = true;
  }

  // === Phase 6: classify the expressions no kept column discharges (§13.4) ===
  for (let l = 0; l < lnum; l++) {
    const dischargedHere = state.tests.some((_, t) => !state.weaks[t] && state.covs[t][l]);
    if (dischargedHere) continue;

    const probe = initWork(model);
    let realisable = true;
    for (const [k, v] of expressions[l].requiredValues) {
      if (!placeRequirement(probe, k, v)) { realisable = false; break; }
    }
    if (realisable) {
      applyAllMasks(probe, model.constraints);
      for (const constraint of model.constraints) {
        if (!deduceConstraint(probe, constraint)) { realisable = false; break; }
      }
    }
    if (realisable) {
      deduce(probe, model);
      const constr = checkConstr(probe, model.constraints);
      const logic = isPossible(probe, model);
      if (constr !== '') { state.infeasibles[l] = constr; continue; }
      if (logic !== '') { state.infeasibles[l] = logic; continue; }
    } else {
      // Report the constraint that rejects it, not a generic message.
      let reason = 'Infeasible';
      const retry = initWork(model);
      let placed = true;
      for (const [k, v] of expressions[l].requiredValues) {
        if (!placeRequirement(retry, k, v)) { placed = false; break; }
      }
      if (placed) {
        applyAllMasks(retry, model.constraints);
        for (const constraint of model.constraints) {
          if (!deduceConstraint(retry, constraint)) {
            reason = formatConstraintDisplay(constraint);
            break;
          }
        }
      }
      state.infeasibles[l] = reason;
      continue;
    }

    // Unobservable when no sensitisation path can hold together with the
    // expression's own values: the row can be executed and the value produced,
    // but it reaches no effect, so the tester could never decide it (§13.4).
    // A path that merely exists is not enough — it must also survive the
    // constraints.
    let sensitisable = false;
    for (const path of sensitisationPaths(model, expressions[l].ownerNode, effects)) {
      const witness = initWork(model);
      let placed = true;
      for (const [k, v] of expressions[l].requiredValues) {
        if (!placeRequirement(witness, k, v)) { placed = false; break; }
      }
      if (placed) {
        for (const [k, v] of path.req) {
          if (!placeRequirement(witness, k, v)) { placed = false; break; }
        }
      }
      if (!placed) continue;
      if (!prepareColumn(witness, model)) continue;
      sensitisable = true;
      break;
    }
    if (!sensitisable) state.unobservables[l] = '遮断';
  }

  return state;
}
