/**
 * JSON serializers for the HTTP API (serve mode).
 *
 * Pure functions that flatten the in-memory DecisionTable / CoverageTable
 * (which use Map fields) into the JSON shapes defined in
 * Doc/CLI_Requirements_Specification.md §7.3. No I/O, no process exit — safe to
 * call from the long-running server.
 *
 * The server is a transport over the same core the batch CLI uses; these
 * serializers add no algorithm, they only re-shape an already-computed table.
 */

import type { LogicalModel } from '../types/logical.js';
import type {
  DecisionTable,
  TestCondition,
  TruthValue,
} from '../types/decisionTable.js';
import type { CoverageTable } from '../types/coverageTable.js';
import { getNodeLabel, findUnreachableEffects } from './decisionTableCalculator.js';

/** A node reference in an API response: id plus its resolved display label. */
interface NodeRef {
  id: string;
  label: string;
}

/** Sort node ids by their @layout y-coordinate (the CSV display order). */
export function sortByY(ids: string[], model: LogicalModel): string[] {
  return [...ids].sort((a, b) => {
    const ay = model.nodes.get(a)?.position?.y ?? 0;
    const by = model.nodes.get(b)?.position?.y ?? 0;
    return ay - by;
  });
}

/** Build id+label refs for a set of node ids, in y-sorted display order. */
function nodeRefs(ids: string[], model: LogicalModel): NodeRef[] {
  return sortByY(ids, model).map((id) => ({ id, label: getNodeLabel(model, id) }));
}

/** Warnings the batch CLI writes to stderr, surfaced in-payload (§7.3). */
export function collectWarnings(table: DecisionTable, model: LogicalModel): string[] {
  return findUnreachableEffects(table).map(
    (id) =>
      `effect '${id}' (${getNodeLabel(model, id)}) can never be true in any feasible test — unreachable effect.`
  );
}

/** Flatten a node-value map (Map<nodeId, TruthValue>) to a plain object. */
function valuesToObject(values: Map<string, TruthValue>): Record<string, TruthValue> {
  const out: Record<string, TruthValue> = {};
  for (const [id, v] of values) out[id] = v;
  return out;
}

/**
 * Serialize a decision table to the §7.3 JSON shape.
 *
 * For `mode: "decision-table"` pass the optimized table with its feasible
 * conditions; for `mode: "all-combinations"` pass the learning-mode table with
 * its own conditions — both are self-consistent DecisionTable values.
 */
export function serializeDecisionTable(
  table: DecisionTable,
  conditions: TestCondition[],
  model: LogicalModel,
  mode: 'decision-table' | 'all-combinations',
  warnings: string[]
): object {
  return {
    mode,
    causes: nodeRefs(table.causeIds, model),
    intermediates: nodeRefs(table.intermediateIds, model),
    effects: nodeRefs(table.effectIds, model),
    conditions: conditions.map((c) => ({
      id: c.id,
      excluded: c.excluded,
      exclusionReason: c.exclusionReason ?? null,
      values: valuesToObject(c.values),
    })),
    constraints: table.constraints,
    stats: table.stats,
    warnings,
  };
}

/** Serialize a coverage table to the §7.3 JSON shape. */
export function serializeCoverageTable(coverage: CoverageTable): object {
  return {
    mode: 'coverage',
    nodes: coverage.nodeNames.map((id) => ({
      id,
      label: coverage.nodeLabels.get(id) ?? id,
    })),
    conditionIds: coverage.conditionIds,
    rows: coverage.rows.map((r) => ({
      expressionIndex: r.expressionIndex,
      edge: r.edge,
      requiredValues: valuesToObject(r.requiredValues),
      coverage: coverageMarkersToObject(r.coverage),
      isCovered: r.isCovered,
      isInfeasible: r.isInfeasible,
      isUntestable: r.isUntestable,
      isUnobservable: r.isUnobservable,
      reason: r.reason,
    })),
    stats: coverage.stats,
  };
}

/** Flatten a coverage-marker map (Map<conditionId, marker>) to an object. */
function coverageMarkersToObject(
  coverage: Map<number, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [conditionId, marker] of coverage) out[String(conditionId)] = marker;
  return out;
}
