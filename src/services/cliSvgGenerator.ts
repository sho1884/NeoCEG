/**
 * CLI SVG Generator (DOM-free)
 *
 * Generates SVG output from a LogicalModel without any browser/DOM dependency.
 * Mirrors the visual output of svgExporter.ts (colors, layout, bezier curves)
 * but builds SVG as a plain string.
 *
 * Requires @layout coordinates in the .nceg file.
 */

import type {
  LogicalModel,
  LogicalNode,
  LogicalConstraint,
  ConstraintType,
} from '../types/logical.js';

// =============================================================================
// Constants (matching svgExporter.ts / graph.ts)
// =============================================================================

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

const NODE_COLORS = {
  cause: { fill: '#e3f2fd', border: '#1976d2' },
  intermediate: { fill: '#e8eaf6', border: '#3949ab' },
  effect: { fill: '#f3e5f5', border: '#7b1fa2' },
} as const;

const EDGE_COLORS = {
  logical: { positive: '#333333', negative: '#1976d2' },
  constraint: { positive: '#9e9e9e', negative: '#64b5f6' },
} as const;

const CONSTRAINT_COLOR = '#757575';

const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  ONE: 'One', EXCL: 'Excl', INCL: 'Incl', REQ: 'Req', MASK: 'Mask',
};

type NodeRole = 'cause' | 'intermediate' | 'effect';

// =============================================================================
// Text width estimation & wrapping (same as svgExporter.ts)
// =============================================================================

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isCJK = (code >= 0x3000 && code <= 0x9FFF) ||
                  (code >= 0xF900 && code <= 0xFAFF) ||
                  (code >= 0xFF00 && code <= 0xFFEF);
    width += isCJK ? fontSize : fontSize * 0.6;
  }
  return width;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
      continue;
    }
    const charWidth = estimateTextWidth(ch, fontSize);
    if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = ch;
      currentWidth = charWidth;
    } else {
      currentLine += ch;
      currentWidth += charWidth;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

// =============================================================================
// XML escaping
// =============================================================================

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// =============================================================================
// Model analysis helpers
// =============================================================================

interface NodeInfo {
  name: string;
  node: LogicalNode;
  role: NodeRole;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  labelStartXOffset: number;
  operator?: 'AND' | 'OR';
}

interface EdgeInfo {
  source: string;
  target: string;
  negated: boolean;
}

interface ConstraintInfo {
  constraint: LogicalConstraint;
  x: number;
  y: number;
  w: number;
  h: number;
}

function deriveRole(name: string, model: LogicalModel): NodeRole {
  const node = model.nodes.get(name)!;
  // Cause: no expression (input node)
  if (!node.expression) return 'cause';
  // Effect: no other node references this one in their expression
  const hasOutgoing = Array.from(model.nodes.values()).some((other) => {
    if (!other.expression) return false;
    return expressionReferences(other.expression, name);
  });
  return hasOutgoing ? 'intermediate' : 'effect';
}

function expressionReferences(expr: import('../types/logical.js').Expression, name: string): boolean {
  if (expr.type === 'ref') return expr.name === name;
  if (expr.type === 'not') return expressionReferences(expr.operand, name);
  if (expr.type === 'and' || expr.type === 'or') {
    return expr.operands.some((op) => expressionReferences(op, name));
  }
  return false;
}

function deriveOperator(node: LogicalNode): 'AND' | 'OR' | undefined {
  if (!node.expression) return undefined;
  if (node.expression.type === 'and') return 'AND';
  if (node.expression.type === 'or') return 'OR';
  // NOT wrapping AND/OR
  if (node.expression.type === 'not') {
    if (node.expression.operand.type === 'and') return 'AND';
    if (node.expression.operand.type === 'or') return 'OR';
  }
  return undefined;
}

function extractEdges(model: LogicalModel): EdgeInfo[] {
  const edges: EdgeInfo[] = [];
  for (const [name, node] of model.nodes) {
    if (!node.expression) continue;
    collectEdges(node.expression, name, false, edges);
  }
  return edges;
}

function collectEdges(
  expr: import('../types/logical.js').Expression,
  target: string,
  parentNegated: boolean,
  edges: EdgeInfo[],
): void {
  if (expr.type === 'ref') {
    edges.push({ source: expr.name, target, negated: parentNegated });
  } else if (expr.type === 'not') {
    collectEdges(expr.operand, target, !parentNegated, edges);
  } else if (expr.type === 'and' || expr.type === 'or') {
    for (const op of expr.operands) {
      collectEdges(op, target, parentNegated, edges);
    }
  }
}

function calcNodeDimensions(
  label: string, w: number, role: NodeRole, operator?: 'AND' | 'OR',
): { h: number; lines: string[]; labelStartXOffset: number } {
  const hasBadge = role !== 'cause' && operator;
  const fontSize = 13;
  const lineHeight = fontSize * 1.4;
  const paddingY = 8;
  const paddingLeft = hasBadge ? 4 : 12;
  const paddingRight = 12;

  let labelStartXOffset = paddingLeft;
  if (hasBadge) {
    const badgeW = operator === 'AND' ? 28 : 20;
    labelStartXOffset = paddingLeft + badgeW + 6;
  }

  const maxTextWidth = w - labelStartXOffset - paddingRight;
  const lines = wrapText(label, fontSize, maxTextWidth);
  const textHeight = lines.length * lineHeight;
  const h = Math.max(36, textHeight + paddingY * 2);

  return { h, lines, labelStartXOffset };
}

// =============================================================================
// SVG string builders
// =============================================================================

function svgRect(
  x: number, y: number, w: number, h: number,
  attrs: Record<string, string | number> = {},
): string {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
}

function svgCircle(cx: number, cy: number, r: number, attrs: Record<string, string | number> = {}): string {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${a}/>`;
}

function svgText(
  text: string, x: number, y: number,
  opts: {
    fontSize?: number; fontWeight?: number | string; fill?: string;
    textAnchor?: string; dominantBaseline?: string;
  } = {},
): string {
  const fs = opts.fontSize ?? 13;
  const fw = opts.fontWeight ? ` font-weight="${opts.fontWeight}"` : '';
  const fill = opts.fill ?? '#333';
  const anchor = opts.textAnchor ?? 'start';
  const baseline = opts.dominantBaseline ?? 'central';
  return `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${fs}"${fw} fill="${fill}" text-anchor="${anchor}" dominant-baseline="${baseline}">${esc(text)}</text>`;
}

function svgPath(d: string, attrs: Record<string, string | number> = {}): string {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ');
  return `<path d="${d}" ${a}/>`;
}

function svgLine(x1: number, y1: number, x2: number, y2: number, attrs: Record<string, string | number> = {}): string {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ');
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
}

function svgPolygon(points: number[][], fill: string): string {
  return `<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${fill}"/>`;
}

// =============================================================================
// Node rendering
// =============================================================================

function renderCEGNode(info: NodeInfo): string {
  const { x, y, w, h, lines, labelStartXOffset, role, operator, node } = info;
  const colors = NODE_COLORS[role];
  const hasBadge = role !== 'cause' && operator;
  const parts: string[] = [];

  parts.push('<g>');

  // Node body
  parts.push(svgRect(x, y, w, h, { rx: 8, ry: 8, fill: colors.fill, stroke: colors.border, 'stroke-width': 2 }));

  // AND/OR badge
  if (hasBadge) {
    const badgeText = operator!;
    const badgeBg = badgeText === 'AND' ? '#1976d2' : '#bf6c00';
    const badgeW = badgeText === 'AND' ? 28 : 20;
    const badgeH = 16;
    const badgeX = x + 4;
    const badgeY = y + h / 2 - badgeH / 2;
    parts.push(svgRect(badgeX, badgeY, badgeW, badgeH, { rx: 3, ry: 3, fill: badgeBg }));
    parts.push(svgText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2, {
      fontSize: 9, fontWeight: 'bold', fill: '#fff', textAnchor: 'middle',
    }));
  }

  // Label lines
  const fontSize = 13;
  const lineHeight = fontSize * 1.4;
  const totalTextHeight = lines.length * lineHeight;
  const textStartY = y + (h - totalTextHeight) / 2 + lineHeight / 2;
  const labelStartX = x + labelStartXOffset;
  for (let i = 0; i < lines.length; i++) {
    parts.push(svgText(lines[i], labelStartX, textStartY + i * lineHeight, {
      fontSize, fontWeight: 500, fill: '#333',
    }));
  }

  // Non-observable indicator
  if (node.observable === false) {
    const dotR = 8;
    const dotCx = x + w - 1;
    const dotCy = y + 1;
    parts.push(svgCircle(dotCx, dotCy, dotR, { fill: '#ffa726', stroke: 'white', 'stroke-width': 2 }));
    parts.push(`<g transform="translate(${dotCx - 5}, ${dotCy - 5})">`);
    parts.push(svgPath('M1 5 Q5 2 9 5', { stroke: 'white', 'stroke-width': 1.5, fill: 'none' }));
    parts.push(svgLine(3, 5, 2.5, 7, { stroke: 'white', 'stroke-width': 1 }));
    parts.push(svgLine(5, 4.5, 5, 7, { stroke: 'white', 'stroke-width': 1 }));
    parts.push(svgLine(7, 5, 7.5, 7, { stroke: 'white', 'stroke-width': 1 }));
    parts.push('</g>');
  }

  parts.push('</g>');
  return parts.join('\n');
}

function renderConstraintNode(info: ConstraintInfo): string {
  const { constraint, x, y, w, h } = info;
  const cType = constraint.type;
  const label = CONSTRAINT_LABELS[cType];
  const isDirectional = cType === 'REQ' || cType === 'MASK';
  const parts: string[] = [];

  parts.push('<g>');
  if (isDirectional) {
    parts.push(svgRect(x, y, w, h, { rx: 4, ry: 4, fill: CONSTRAINT_COLOR, stroke: CONSTRAINT_COLOR, 'stroke-width': 2 }));
  } else {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    parts.push(svgCircle(cx, cy, r, { fill: CONSTRAINT_COLOR, stroke: CONSTRAINT_COLOR, 'stroke-width': 2 }));
  }
  parts.push(svgText(label, x + w / 2, y + h / 2, {
    fontSize: 12, fontWeight: 600, fill: '#fff', textAnchor: 'middle',
  }));
  parts.push('</g>');
  return parts.join('\n');
}

// =============================================================================
// Edge rendering
// =============================================================================

interface Rect { x: number; y: number; w: number; h: number }

function renderLogicalEdge(
  sourceRect: Rect, targetRect: Rect, negated: boolean,
): string {
  const color = negated ? EDGE_COLORS.logical.negative : EDGE_COLORS.logical.positive;
  const sx = sourceRect.x + sourceRect.w;
  const sy = sourceRect.y + sourceRect.h / 2;
  const tx = targetRect.x;
  const ty = targetRect.y + targetRect.h / 2;

  const dx = Math.abs(tx - sx);
  const offset = Math.max(50, dx * 0.4);
  const c1x = sx + offset, c1y = sy;
  const c2x = tx - offset, c2y = ty;

  const d = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  const targetAngle = Math.atan2(ty - c2y, tx - c2x);

  const parts: string[] = [];
  parts.push(svgPath(d, { fill: 'none', stroke: color, 'stroke-width': 2 }));

  // Arrowhead
  const arrowSize = 10;
  const arrowPoints = [
    [tx, ty],
    [tx - arrowSize * Math.cos(targetAngle - Math.PI / 6), ty - arrowSize * Math.sin(targetAngle - Math.PI / 6)],
    [tx - arrowSize * Math.cos(targetAngle + Math.PI / 6), ty - arrowSize * Math.sin(targetAngle + Math.PI / 6)],
  ];
  parts.push(svgPolygon(arrowPoints, color));

  // NOT label
  if (negated) {
    const t = 0.7;
    const mt = 1 - t;
    const lx = mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * tx;
    const ly = mt * mt * mt * sy + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ty;
    const fontSize = 11;
    const labelW = estimateTextWidth('Not', fontSize) + 12;
    const labelH = fontSize + 6;
    parts.push(svgRect(lx - labelW / 2, ly - labelH / 2, labelW, labelH, {
      rx: 4, ry: 4, fill: '#fff', stroke: color, 'stroke-width': 1,
    }));
    parts.push(svgText('Not', lx, ly, { fontSize, fontWeight: 500, fill: color, textAnchor: 'middle' }));
  }

  return parts.join('\n');
}

function calcFloatingSourcePoint(
  rect: Rect, targetX: number, targetY: number, isDirectional: boolean,
): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: cx, y: cy };

  if (isDirectional) {
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    const t = Math.min(
      Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity,
    );
    return { x: cx + dx * t, y: cy + dy * t };
  } else {
    const radius = Math.min(rect.w, rect.h) / 2;
    return { x: cx + (dx / dist) * radius, y: cy + (dy / dist) * radius };
  }
}

function renderConstraintEdge(
  constraintRect: Rect, targetRect: Rect,
  negated: boolean, isDirectional: boolean, isSource: boolean,
): string {
  const color = negated ? EDGE_COLORS.constraint.negative : EDGE_COLORS.constraint.positive;

  // Target: top-center of the CEG node
  const tx = targetRect.x + targetRect.w / 2;
  const ty = targetRect.y;
  const source = calcFloatingSourcePoint(constraintRect, tx, ty, isDirectional);

  const parts: string[] = [];
  parts.push(svgLine(source.x, source.y, tx, ty, {
    stroke: color, 'stroke-width': 2, 'stroke-dasharray': '3,3',
  }));

  // Arrowhead for directional constraints
  if (isDirectional) {
    const angle = Math.atan2(ty - source.y, tx - source.x);
    const arrowSize = 10;
    if (isSource) {
      const pts = [
        [source.x, source.y],
        [source.x + arrowSize * Math.cos(angle + Math.PI - Math.PI / 6), source.y + arrowSize * Math.sin(angle + Math.PI - Math.PI / 6)],
        [source.x + arrowSize * Math.cos(angle + Math.PI + Math.PI / 6), source.y + arrowSize * Math.sin(angle + Math.PI + Math.PI / 6)],
      ];
      parts.push(svgPolygon(pts, color));
    } else {
      const pts = [
        [tx, ty],
        [tx - arrowSize * Math.cos(angle - Math.PI / 6), ty - arrowSize * Math.sin(angle - Math.PI / 6)],
        [tx - arrowSize * Math.cos(angle + Math.PI / 6), ty - arrowSize * Math.sin(angle + Math.PI / 6)],
      ];
      parts.push(svgPolygon(pts, color));
    }
  }

  // NOT label
  if (negated) {
    const mx = (source.x + tx) / 2;
    const my = (source.y + ty) / 2;
    const fontSize = 10;
    const labelW = estimateTextWidth('Not', fontSize) + 12;
    const labelH = fontSize + 6;
    parts.push(svgRect(mx - labelW / 2, my - labelH / 2, labelW, labelH, {
      rx: 3, ry: 3, fill: '#fff', stroke: EDGE_COLORS.constraint.negative, 'stroke-width': 1,
    }));
    parts.push(svgText('Not', mx, my, {
      fontSize, fontWeight: 600, fill: EDGE_COLORS.constraint.negative, textAnchor: 'middle',
    }));
  }

  return parts.join('\n');
}

// =============================================================================
// Main entry point
// =============================================================================

export function generateGraphSVG(model: LogicalModel): string {
  // Check for @layout
  const hasLayout = Array.from(model.nodes.values()).some((n) => n.position);
  if (!hasLayout) {
    process.stderr.write('Error: SVG output requires @layout coordinates in the .nceg file\n');
    process.exit(1);
  }

  // Build node info
  const nodeInfos = new Map<string, NodeInfo>();
  for (const [name, node] of model.nodes) {
    const role = deriveRole(name, model);
    const operator = deriveOperator(node);
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const w = node.width ?? 150;
    const label = node.label || name;
    const { h, lines, labelStartXOffset } = calcNodeDimensions(label, w, role, operator);

    nodeInfos.set(name, { name, node, role, x, y, w, h, lines, labelStartXOffset, operator });
  }

  // Build constraint info with layout
  const constraintInfos: ConstraintInfo[] = [];
  // Constraints don't have explicit positions in the model, so we derive them.
  // Place constraint nodes between their member nodes.
  for (const constraint of model.constraints) {
    const memberNames = constraint.type === 'REQ'
      ? [constraint.source.name, ...constraint.targets.map((t) => t.name)]
      : constraint.type === 'MASK'
        ? [constraint.trigger.name, ...constraint.targets.map((t) => t.name)]
        : constraint.members.map((m) => m.name);

    let cx = 0, cy = 0, count = 0;
    for (const mn of memberNames) {
      const ni = nodeInfos.get(mn);
      if (ni) {
        cx += ni.x + ni.w / 2;
        cy += ni.y;
        count++;
      }
    }
    if (count > 0) {
      cx = cx / count;
      cy = cy / count - 40; // Place above the midpoint
    }

    const isDirectional = constraint.type === 'REQ' || constraint.type === 'MASK';
    const w = isDirectional ? 50 : 40;
    const h = 40;

    constraintInfos.push({
      constraint,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
    });
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, ni] of nodeInfos) {
    minX = Math.min(minX, ni.x);
    minY = Math.min(minY, ni.y);
    maxX = Math.max(maxX, ni.x + ni.w);
    maxY = Math.max(maxY, ni.y + ni.h);
  }
  for (const ci of constraintInfos) {
    minX = Math.min(minX, ci.x);
    minY = Math.min(minY, ci.y);
    maxX = Math.max(maxX, ci.x + ci.w);
    maxY = Math.max(maxY, ci.y + ci.h);
  }

  const padding = 50;
  const offsetX = minX - padding;
  const offsetY = minY - padding;
  const svgW = Math.ceil(maxX - minX + 2 * padding);
  const svgH = Math.ceil(maxY - minY + 2 * padding);

  // Shift all coordinates
  for (const [, ni] of nodeInfos) {
    ni.x -= offsetX;
    ni.y -= offsetY;
  }
  for (const ci of constraintInfos) {
    ci.x -= offsetX;
    ci.y -= offsetY;
  }

  // Build SVG
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`);

  // Render logical edges
  const edges = extractEdges(model);
  for (const edge of edges) {
    const sourceInfo = nodeInfos.get(edge.source);
    const targetInfo = nodeInfos.get(edge.target);
    if (!sourceInfo || !targetInfo) continue;
    svgParts.push(renderLogicalEdge(sourceInfo, targetInfo, edge.negated));
  }

  // Render constraint edges
  for (const ci of constraintInfos) {
    const c = ci.constraint;
    const cRect: Rect = { x: ci.x, y: ci.y, w: ci.w, h: ci.h };
    const isDirectional = c.type === 'REQ' || c.type === 'MASK';

    if (isDirectional) {
      // Source/trigger edge
      const sourceRef = c.type === 'REQ' ? c.source : c.trigger;
      const sourceNode = nodeInfos.get(sourceRef.name);
      if (sourceNode) {
        svgParts.push(renderConstraintEdge(
          cRect, sourceNode, sourceRef.negated, true, true,
        ));
      }
      // Target edges
      for (const t of c.targets) {
        const targetNode = nodeInfos.get(t.name);
        if (targetNode) {
          svgParts.push(renderConstraintEdge(
            cRect, targetNode, t.negated, true, false,
          ));
        }
      }
    } else {
      for (const m of c.members) {
        const memberNode = nodeInfos.get(m.name);
        if (memberNode) {
          svgParts.push(renderConstraintEdge(
            cRect, memberNode, m.negated, false, false,
          ));
        }
      }
    }
  }

  // Render CEG nodes
  for (const [, ni] of nodeInfos) {
    svgParts.push(renderCEGNode(ni));
  }

  // Render constraint nodes
  for (const ci of constraintInfos) {
    svgParts.push(renderConstraintNode(ci));
  }

  svgParts.push('</svg>');
  return svgParts.join('\n');
}
