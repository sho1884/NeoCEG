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
function isCoveredBy(
  work: Map<string, WorkValue>,
  expr: LogicalExpression
): boolean {
  for (const [nodeName, reqValue] of expr.requiredValues) {
    const wv = work.get(nodeName);
    if (wv !== '' && wv !== undefined) {
      if (wv !== reqValue) return false;
    }
  }
  return true;
}

/**
 * Check if an expression can be merged into work without value conflicts.
 */
function isMergeable(
  work: Map<string, WorkValue>,
  expr: LogicalExpression
): boolean {
  for (const [nodeName, reqValue] of expr.requiredValues) {
    const wv = work.get(nodeName);
    if (wv !== '' && wv !== undefined) {
      if (wv !== reqValue) return false;
    }
  }
  return true;
}

/**
 * Merge expression values into work array.
 */
function mergeExpression(
  work: Map<string, WorkValue>,
  expr: LogicalExpression
): void {
  for (const [nodeName, reqValue] of expr.requiredValues) {
    if (work.get(nodeName) === '' || work.get(nodeName) === undefined) {
      work.set(nodeName, reqValue);
    }
  }
}

/**
 * Rebuild work array from turns history.
 *
 * Reference: Algorithm_Design.md §12.3
 */
function reCalc(
  work: Map<string, WorkValue>,
  state: AlgorithmState
): void {
  // Clear all nodes
  for (const key of work.keys()) {
    work.set(key, '');
  }

  // Re-apply turns
  for (const turn of state.turns) {
    if (turn.type === 'expression') {
      const expr = state.expressions[turn.expressionIndex];
      mergeExpression(work, expr);
    } else {
      work.set(turn.nodeName, turn.value);
    }
  }
}

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
function chooseCondition(
  work: Map<string, WorkValue>,
  state: AlgorithmState,
  model: LogicalModel,
  mode: 0 | 1
): number {
  let ret = 0;

  for (let l = 0; l < state.expressions.length; l++) {
    const expr = state.expressions[l];

    // (a) mode=0: skip already covered across all tests
    if (mode === 0 && countCoverage(l, state.covs) > 0) continue;

    // (b) skip if already covered in current test
    if (state.vtestcov[l]) continue;

    // (c) skip unsuitable
    if (state.unsuitableExpressions.has(l)) continue;

    // (d) skip infeasible
    if (state.infeasibles[l] !== null) continue;

    // (e) check mergeability
    if (!isMergeable(work, expr)) continue;

    // Trial merge on temp copy
    const tmp = new Map(work);
    mergeExpression(tmp, expr);

    // (f) constraint deduction check
    let constraintOk = true;
    for (const constraint of model.constraints) {
      if (!deduceConstraint(tmp, constraint)) {
        constraintOk = false;
        break;
      }
    }
    if (!constraintOk) {
      if (state.turns.length === 0) {
        // Find the constraint that failed deduction
        const tmpCheck = new Map(work);
        mergeExpression(tmpCheck, expr);
        for (const constraint of model.constraints) {
          if (!deduceConstraint(tmpCheck, constraint)) {
            state.infeasibles[l] = formatConstraintDisplay(constraint);
            break;
          }
        }
      }
      continue;
    }

    // (g) constraint violation check
    const constrReason = checkConstr(tmp, model.constraints);
    if (constrReason !== '') {
      if (state.turns.length === 0) {
        state.infeasibles[l] = constrReason;
      }
      continue;
    }

    // (h) logical consistency check
    const possibleReason = isPossible(tmp, model);
    if (possibleReason !== '') {
      if (state.turns.length === 0) {
        state.infeasibles[l] = possibleReason;
      }
      continue;
    }

    // Adopt: apply to work
    for (const key of tmp.keys()) {
      work.set(key, tmp.get(key)!);
    }
    state.vtestcov[l] = true;
    state.turns.push({ type: 'expression', expressionIndex: l });
    ret++;
  }

  return ret;
}

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
function nextCondition(
  work: Map<string, WorkValue>,
  state: AlgorithmState,
  model: LogicalModel
): boolean {
  const maxAttempts = state.lnum;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Step (1): choose uncovered expressions
    const ret = chooseCondition(work, state, model, 0);
    if (state.turns.length === 0 && ret === 0) {
      return false;
    }

    // Step (2): apply MASK constraints
    applyAllMasks(work, model.constraints);

    // Step (3): merge already-covered expressions too
    chooseCondition(work, state, model, 1);

    // Step (4): assign values to cause nodes
    let match = true;
    const causeNodes: string[] = [];
    for (const [name, node] of model.nodes) {
      if (isCause(node)) causeNodes.push(name);
    }

    for (const causeName of causeNodes) {
      if (work.get(causeName) !== '') continue;
      if (isIsolatedCause(causeName, model)) continue;

      // Try 't' first, then 'f'
      if (!chooseCauseValue(work, state, model, causeName, 't')) {
        if (!chooseCauseValue(work, state, model, causeName, 'f')) {
          // Both failed → backtrack
          if (state.turns.length === 0) {
            match = false;
            break;
          }
          const lastTurn = state.turns[state.turns.length - 1];

          if (lastTurn.type === 'expression') {
            state.vtestcov[lastTurn.expressionIndex] = false;
            state.unsuitableExpressions.add(lastTurn.expressionIndex);
          } else {
            state.unsuitableCauseValues.add(
              encodeCauseChoice(lastTurn.nodeName, lastTurn.value)
            );
          }

          if (state.turns.length === 1 && lastTurn.type === 'expression') {
            state.infeasibles[lastTurn.expressionIndex] = 'Infeasible (backtrack)';
          }

          state.turns.pop();
          reCalc(work, state);
          match = false;
          break;
        }
      }
    }

    if (!match) continue;

    // Step (5): deduce remaining values
    deduce(work, model);

    // Step (6): recalculate coverage
    for (let l = 0; l < state.expressions.length; l++) {
      state.vtestcov[l] = isCoveredBy(work, state.expressions[l]);
    }

    // Step (7): save coverage and return
    state.covs.push([...state.vtestcov]);
    return true;
  }

  return true;
}

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
function checkStrong(
  testIndex: number,
  state: AlgorithmState
): boolean {
  let strong = 0;
  let weak = 0;

  for (let l = 0; l < state.expressions.length; l++) {
    if (!state.covs[testIndex][l]) continue;

    let ccount = 0;
    for (let t = 0; t < state.covs.length; t++) {
      if (state.weaks[t]) continue;
      if (state.covs[t][l]) ccount++;
    }

    if (ccount === 1) strong++;
    else if (ccount > 1) weak++;
  }

  if (strong === 0 && weak > 0) {
    // Check if removal would leave any expression uncovered
    for (let l = 0; l < state.expressions.length; l++) {
      if (state.infeasibles[l] !== null) continue;

      let otherCoverage = 0;
      for (let t = 0; t < state.covs.length; t++) {
        if (t === testIndex) continue;
        if (state.weaks[t]) continue;
        if (state.covs[t][l]) otherCoverage++;
      }

      if (otherCoverage === 0) return true; // Can't remove
    }
    return false; // Weak: safe to remove
  }

  return true; // Strong: keep
}

/**
 * Generate optimized test conditions using the CEG algorithm.
 *
 * Returns the algorithm state containing tests, coverage, expressions, etc.
 *
 * Reference: Algorithm_Design.md §5.1
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
    turns: [],
    unsuitableExpressions: new Set(),
    unsuitableCauseValues: new Set(),
    infeasibles: new Array(lnum).fill(null),
    weaks: [],
  };

  // No expressions = incomplete graph (e.g., nodes only, no edges yet)
  if (lnum === 0) {
    return state;
  }

  // === Phase 1: Expression coverage ===
  let uncover = -1;

  for (let iteration = 0; iteration < lnum; iteration++) {
    const work = initWork(model);
    state.vtestcov = new Array(lnum).fill(false);
    state.unsuitableExpressions = new Set();
    state.unsuitableCauseValues = new Set();
    state.turns = [];

    if (nextCondition(work, state, model)) {
      state.tests.push(new Map(work) as Map<string, TruthValue>);
    } else {
      break;
    }

    // Check if all expressions are covered
    let complete = true;
    for (let l = 0; l < lnum; l++) {
      if (state.infeasibles[l] !== null) continue;
      if (countCoverage(l, state.covs) === 0) {
        if (uncover === l) {
          break;
        }
        uncover = l;
        complete = false;
        break;
      }
    }
    if (complete) break;
  }

  // === Phase 2: Result coverage (T/F for each cause) ===
  const causeNodes: string[] = [];
  for (const [name, node] of model.nodes) {
    if (isCause(node) && !isIsolatedCause(name, model)) {
      causeNodes.push(name);
    }
  }

  for (const causeName of causeNodes) {
    let countT = 0;
    let countF = 0;
    for (const test of state.tests) {
      const v = test.get(causeName);
      if (v !== undefined && isTrue(v)) countT++;
      if (v !== undefined && isFalse(v)) countF++;
    }

    if (countT === 0) {
      const work = initWork(model);
      work.set(causeName, 't');
      state.vtestcov = new Array(lnum).fill(false);
      state.unsuitableExpressions = new Set();
      state.unsuitableCauseValues = new Set();
      state.turns = [{ type: 'causeValue', nodeName: causeName, value: 'T' }];

      if (nextCondition(work, state, model)) {
        state.tests.push(new Map(work) as Map<string, TruthValue>);
      }
    }

    if (countF === 0) {
      const work = initWork(model);
      work.set(causeName, 'f');
      state.vtestcov = new Array(lnum).fill(false);
      state.unsuitableExpressions = new Set();
      state.unsuitableCauseValues = new Set();
      state.turns = [{ type: 'causeValue', nodeName: causeName, value: 'F' }];

      if (nextCondition(work, state, model)) {
        state.tests.push(new Map(work) as Map<string, TruthValue>);
      }
    }
  }

  // === Phase 3: Weak test deletion ===
  state.weaks = new Array(state.tests.length).fill(false);
  for (let t = 0; t < state.tests.length; t++) {
    if (!checkStrong(t, state)) {
      state.weaks[t] = true;
    }
  }

  return state;
}