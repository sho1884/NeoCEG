/**
 * Default emitter: language-agnostic pseudo-code (§4).
 *
 * Conditions are rendered by id (n3, n9, …); return values use the effect label
 * when available. Intermediate definitions are emitted only when expressions
 * were supplied; otherwise intermediates appear as named conditions.
 */

import type { Skeleton, Node } from '../types.js';

const INDENT = '    ';

export function emitPseudo(skel: Skeleton): string {
  const label = (id: string) => skel.labels[id] ?? id;
  const lines: string[] = [];

  lines.push(`function decide(${skel.causeIds.join(', ')}):`);

  // Intermediate conditions / definitions.
  if (skel.intermediateIds.length > 0) {
    const defined = skel.intermediateIds.filter((id) => skel.intermediateDefs[id]);
    if (defined.length === skel.intermediateIds.length) {
      for (const id of skel.intermediateIds) {
        lines.push(`${INDENT}${id} = ${skel.intermediateDefs[id]}`);
      }
    } else {
      lines.push(
        `${INDENT}# intermediate conditions: ${skel.intermediateIds.join(', ')}` +
          ` (definitions require expressions)`,
      );
    }
    lines.push('');
  }

  emitNodes(skel.body, 1, label, lines);

  for (const col of skel.skipped) {
    lines.push(`${INDENT}# column #${col} skipped: action is M/I (untestable)`);
  }

  lines.push(`${INDENT}return ${skel.defaultReturn}` + `${' '.repeat(6)}# default: reached by no column`);

  return lines.join('\n') + '\n';
}

function emitNodes(
  nodes: Node[],
  depth: number,
  label: (id: string) => string,
  lines: string[],
): void {
  const pad = INDENT.repeat(depth);
  for (const node of nodes) {
    if (node.kind === 'return') {
      const value = node.actions.map(label).join(' + ') || skel_none();
      const comment = `# ${node.actions.join('+')} (#${node.columnId})`;
      lines.push(`${pad}return ${value}      ${comment}`);
      continue;
    }
    // guard
    const hasThen = node.then.length > 0;
    const hasElse = node.else.length > 0;
    if (hasThen) {
      lines.push(`${pad}if ${node.cond}:`);
      emitNodes(node.then, depth + 1, label, lines);
      if (hasElse) {
        lines.push(`${pad}else:`);
        emitNodes(node.else, depth + 1, label, lines);
      }
    } else if (hasElse) {
      lines.push(`${pad}if not ${node.cond}:`);
      emitNodes(node.else, depth + 1, label, lines);
    }
  }
}

function skel_none(): string {
  return 'None';
}
