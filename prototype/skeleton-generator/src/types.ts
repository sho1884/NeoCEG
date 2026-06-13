/**
 * Internal data model for the skeleton generator (§3.2, §9).
 *
 * `SkeletonInput` mirrors NeoCEG's in-memory `DecisionTable` so that future
 * integration can feed that type directly (no parsing round-trip). It is NOT an
 * external input format — the only external input is CSV (parseCsv.ts -> here).
 */

/** Cell value domain, matching NeoCEG `TruthValue`. */
export type TruthValue = 'T' | 'F' | 't' | 'f' | 'M' | 'I';

/** One decision-table column (a control path before rendering). */
export interface Condition {
  /** Stable column id (1-based, matching the `#N` header). */
  id: number;
  /** Cell value per node id; absent key = node not present in this column. */
  values: Record<string, TruthValue>;
  /** Excluded columns are ignored by the converter. */
  excluded: boolean;
}

/** Self-contained model the converter operates on. */
export interface SkeletonInput {
  causeIds: string[];
  intermediateIds: string[];
  effectIds: string[];
  /** Human labels for readable output; absent → ids used verbatim. */
  labels?: Record<string, string>;
  /** Expressions enable intermediate-variable definitions; absent from CSV. */
  expressions?: Record<string, string>;
  conditions: Condition[];
}

// ---------------------------------------------------------------------------
// Internal types (not part of the input model)
// ---------------------------------------------------------------------------

/** A single condition test, e.g. `n4 == true`. */
export interface Literal {
  /** Node id of the condition (cause or intermediate). */
  cond: string;
  /** Required value on this path. */
  value: boolean;
}

/** A control path = one column rendered as guard literals + action(s). */
export interface ControlPath {
  /** Source column id. */
  columnId: number;
  /** Effect ids firing on this path (cells at uppercase `T`). */
  actions: string[];
  /**
   * Minimal guard: ordered conjunction of literals that distinguishes this
   * column from every column with a different action (§5 step 2). Leading
   * literal is the most-discriminating, enabling factoring (§5 step 3).
   */
  guard: Literal[];
}

/** Nested skeleton node. A guard tests one condition; sibling columns that share
 *  a condition with opposite values factor into `then`/`else`. */
export type Node =
  | { kind: 'guard'; cond: string; then: Node[]; else: Node[] }
  | { kind: 'return'; actions: string[]; columnId: number };

/** Full skeleton, ready for an emitter. */
export interface Skeleton {
  causeIds: string[];
  intermediateIds: string[];
  /** Human labels for ids (effects for return values); absent → id verbatim. */
  labels: Record<string, string>;
  /** Intermediate definitions, only when expressions were available. */
  intermediateDefs: Record<string, string>;
  /** Columns skipped because their action was M/I (untestable). */
  skipped: number[];
  body: Node[];
  defaultReturn: string;
}
