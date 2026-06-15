/**
 * Model-health validation shared across the parser, CLI, and GUI.
 * See DSL_Grammar_Specification (Validation) and GUI_Specification §7.4.
 */
import type { LogicalModel, LogicalConstraint } from '../types/logical';

/** Every node name referenced by a constraint (members / source / targets / trigger). */
function constraintMemberNames(c: LogicalConstraint): string[] {
  switch (c.type) {
    case 'ONE':
    case 'EXCL':
    case 'INCL':
      return c.members.map((m) => m.name);
    case 'REQ':
      return [c.source.name, ...c.targets.map((t) => t.name)];
    case 'MASK':
      return [c.trigger.name, ...c.targets.map((t) => t.name)];
  }
}

/**
 * Names of constraint members that are **derived** (intermediate/effect) nodes
 * rather than causes. Constraints restrict input (cause) combinations, so a
 * derived member is meaningless (GUI §7.4 warning C; DSL_Grammar Validation).
 * Deduplicated and order-preserving.
 */
export function findConstraintsOnDerivedNodes(model: LogicalModel): string[] {
  const result = new Set<string>();
  for (const c of model.constraints) {
    for (const name of constraintMemberNames(c)) {
      const node = model.nodes.get(name);
      if (node && node.expression) result.add(name);
    }
  }
  return [...result];
}
