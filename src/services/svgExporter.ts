/**
 * SVG Graph Exporter (Pure SVG)
 *
 * Renders the cause-effect graph as a standalone SVG using only native SVG
 * elements (rect, text, circle, path, polygon). No foreignObject, no DOM
 * cloning — fully self-contained. Works in Inkscape, Illustrator, PowerPoint,
 * and all standards-compliant SVG viewers.
 *
 * Strategy:
 * 1. Read nodes/edges/constraints from the Zustand store
 * 2. Derive node roles (cause/intermediate/effect) from edge topology
 * 3. Measure node dimensions from DOM (offsetWidth/offsetHeight)
 * 4. Render all edges as pure SVG paths (bezier for logical, straight for constraint)
 * 5. Render nodes, badges, labels as pure SVG elements
 */

import { useGraphStore } from '../stores/graphStore';
import {
  NODE_COLORS, EDGE_COLORS, CONSTRAINT_COLORS, CONSTRAINT_LABELS,
  type CEGNode, type ConstraintNode, type CEGEdge, type NodeRole,
} from '../types/graph';

const SVG_NS = 'http://www.w3.org/2000/svg';

// =============================================================================
// Role Calculation (mirrors GraphCanvas.tsx logic)
// =============================================================================

function calculateNodeRole(nodeId: string, edges: CEGEdge[]): NodeRole {
  const hasIncoming = edges.some((e) => e.target === nodeId && e.data.edgeType === 'logical');
  const hasOutgoing = edges.some((e) => e.source === nodeId && e.data.edgeType === 'logical');
  if (!hasIncoming) return 'cause';
  if (!hasOutgoing) return 'effect';
  return 'intermediate';
}

// =============================================================================
// Text Wrapping Helpers
// =============================================================================

/** Font used for node labels in the export */
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

/**
 * Estimate the rendered width of a string in pixels.
 * Uses a simple heuristic: CJK characters are wider than Latin.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK Unified Ideographs, Hiragana, Katakana, Full-width
    const isCJK = (code >= 0x3000 && code <= 0x9FFF) ||
                  (code >= 0xF900 && code <= 0xFAFF) ||
                  (code >= 0xFF00 && code <= 0xFFEF);
    width += isCJK ? fontSize : fontSize * 0.6;
  }
  return width;
}

/**
 * Break a string into lines that fit within maxWidth pixels.
 */
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
// SVG Element Helpers
// =============================================================================

function createSvgElement(tag: string, attrs: Record<string, string | number>): Element {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function createSvgText(
  text: string, x: number, y: number,
  opts: {
    fontSize?: number; fontWeight?: number | string; fill?: string;
    textAnchor?: string; dominantBaseline?: string; fontFamily?: string;
  } = {},
): SVGTextElement {
  const el = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
  el.setAttribute('x', String(x));
  el.setAttribute('y', String(y));
  el.setAttribute('font-family', opts.fontFamily ?? FONT_FAMILY);
  el.setAttribute('font-size', String(opts.fontSize ?? 13));
  if (opts.fontWeight) el.setAttribute('font-weight', String(opts.fontWeight));
  el.setAttribute('fill', opts.fill ?? '#333');
  el.setAttribute('text-anchor', opts.textAnchor ?? 'start');
  el.setAttribute('dominant-baseline', opts.dominantBaseline ?? 'central');
  el.textContent = text;
  return el;
}

// =============================================================================
// Node Rendering
// =============================================================================

/**
 * Calculate node dimensions for SVG export.
 * Height is derived from text wrapping — not from DOM — to ensure the rect
 * and the rendered text are always consistent.
 */
function calcNodeDimensions(
  node: CEGNode, role: NodeRole,
): { w: number; h: number; lines: string[]; labelStartXOffset: number } {
  const w = node.data.width ?? 150;
  const hasBadge = role !== 'cause' && node.data.operator;
  const fontSize = 13;
  const lineHeight = fontSize * 1.4; // 18.2px

  // Match CEGNode.tsx padding: 8px top/bottom, 12px right, 4px or 12px left
  const paddingY = 8;
  const paddingLeft = hasBadge ? 4 : 12;
  const paddingRight = 12;

  // Badge width: AND=28+6margin, OR=20+6margin
  let labelStartXOffset = paddingLeft;
  if (hasBadge) {
    const badgeW = node.data.operator === 'AND' ? 28 : 20;
    labelStartXOffset = paddingLeft + badgeW + 6;
  }

  const maxTextWidth = w - labelStartXOffset - paddingRight;
  const label = node.data.label || '';
  const lines = wrapText(label, fontSize, maxTextWidth);
  const textHeight = lines.length * lineHeight;
  const minHeight = 36; // matches CEGNode.tsx minHeight
  const h = Math.max(minHeight, textHeight + paddingY * 2);

  return { w, h, lines, labelStartXOffset };
}

/** Render a CEG node as pure SVG elements */
function renderCEGNode(
  node: CEGNode, role: NodeRole,
): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  const x = node.position.x;
  const y = node.position.y;
  const { w, h, lines, labelStartXOffset } = calcNodeDimensions(node, role);
  const colors = NODE_COLORS[role];
  const hasBadge = role !== 'cause' && node.data.operator;

  // Node body (rounded rect)
  g.appendChild(createSvgElement('rect', {
    x, y, width: w, height: h, rx: 8, ry: 8,
    fill: colors.fill, stroke: colors.border, 'stroke-width': 2,
  }));

  // AND/OR badge
  const labelStartX = x + labelStartXOffset;
  if (hasBadge) {
    const badgeText = node.data.operator!;
    const badgeBg = badgeText === 'AND' ? '#1976d2' : '#bf6c00';
    const badgeW = badgeText === 'AND' ? 28 : 20;
    const badgeH = 16;
    const badgeX = x + 4; // matches paddingLeft for badge nodes
    const badgeY = y + h / 2 - badgeH / 2;

    g.appendChild(createSvgElement('rect', {
      x: badgeX, y: badgeY, width: badgeW, height: badgeH,
      rx: 3, ry: 3, fill: badgeBg,
    }));
    g.appendChild(createSvgText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2, {
      fontSize: 9, fontWeight: 'bold', fill: '#fff', textAnchor: 'middle',
    }));
  }

  // Node label
  const fontSize = 13;
  const lineHeight = fontSize * 1.4;
  const totalTextHeight = lines.length * lineHeight;
  const textStartY = y + (h - totalTextHeight) / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    g.appendChild(createSvgText(lines[i], labelStartX, textStartY + i * lineHeight, {
      fontSize, fontWeight: 500, fill: '#333',
    }));
  }

  // Non-observable warning indicator (amber dot, top-right)
  if (node.data.observable === false) {
    const dotR = 8;
    const dotCx = x + w - 1;
    const dotCy = y + 1;
    g.appendChild(createSvgElement('circle', {
      cx: dotCx, cy: dotCy, r: dotR,
      fill: '#ffa726', stroke: 'white', 'stroke-width': 2,
    }));
    // Closed eye: arc + lashes
    const eye = createSvgElement('g', { transform: `translate(${dotCx - 5}, ${dotCy - 5})` });
    eye.appendChild(createSvgElement('path', {
      d: 'M1 5 Q5 2 9 5', stroke: 'white', 'stroke-width': 1.5, fill: 'none',
    }));
    eye.appendChild(createSvgElement('line', { x1: 3, y1: 5, x2: 2.5, y2: 7, stroke: 'white', 'stroke-width': 1 }));
    eye.appendChild(createSvgElement('line', { x1: 5, y1: 4.5, x2: 5, y2: 7, stroke: 'white', 'stroke-width': 1 }));
    eye.appendChild(createSvgElement('line', { x1: 7, y1: 5, x2: 7.5, y2: 7, stroke: 'white', 'stroke-width': 1 }));
    g.appendChild(eye);
  }

  return g;
}

/** Render a constraint node as pure SVG elements */
function renderConstraintNode(
  node: ConstraintNode, domEl: HTMLElement | null,
): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
  const x = node.position.x;
  const y = node.position.y;
  const w = domEl?.offsetWidth ?? 50;
  const h = domEl?.offsetHeight ?? 40;
  const cType = node.data.constraintType;
  const color = CONSTRAINT_COLORS[cType];
  const label = CONSTRAINT_LABELS[cType];
  const isDirectional = cType === 'REQ' || cType === 'MASK';

  if (isDirectional) {
    // Rectangular shape for REQ/MASK
    g.appendChild(createSvgElement('rect', {
      x, y, width: w, height: h, rx: 4, ry: 4,
      fill: color, stroke: color, 'stroke-width': 2,
    }));
  } else {
    // Circular shape for ONE/EXCL/INCL
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    g.appendChild(createSvgElement('circle', {
      cx, cy, r, fill: color, stroke: color, 'stroke-width': 2,
    }));
  }

  // Constraint label (centered)
  const cx = x + w / 2;
  const cy = y + h / 2;
  g.appendChild(createSvgText(label, cx, cy, {
    fontSize: 12, fontWeight: 600, fill: '#fff', textAnchor: 'middle',
  }));

  return g;
}

// =============================================================================
// Edge Rendering (Pure SVG — no DOM cloning)
// =============================================================================

/** Dimension info for a node, used for edge endpoint calculation */
interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Build a map of node ID → position/size for edge endpoint calculation.
 * CEG node dimensions are calculated from text wrapping (same as renderCEGNode).
 * Constraint node dimensions use DOM measurement or defaults.
 */
function buildNodeRects(
  nodes: CEGNode[],
  constraintNodes: ConstraintNode[],
  edges: CEGEdge[],
  domElements: Map<string, HTMLElement>,
): Map<string, NodeRect> {
  const rects = new Map<string, NodeRect>();
  for (const n of nodes) {
    const role = calculateNodeRole(n.id, edges);
    const { w, h } = calcNodeDimensions(n, role);
    rects.set(n.id, { x: n.position.x, y: n.position.y, w, h });
  }
  for (const n of constraintNodes) {
    const dom = domElements.get(n.id);
    rects.set(n.id, {
      x: n.position.x,
      y: n.position.y,
      w: dom?.offsetWidth ?? 50,
      h: dom?.offsetHeight ?? 40,
    });
  }
  return rects;
}

/**
 * Calculate a cubic bezier path for a logical edge.
 * Source handle: right-center of source node.
 * Target handle: left-center of target node.
 */
function calcLogicalEdgePath(
  sourceRect: NodeRect,
  targetRect: NodeRect,
): { path: string; labelX: number; labelY: number; targetAngle: number } {
  const sx = sourceRect.x + sourceRect.w;
  const sy = sourceRect.y + sourceRect.h / 2;
  const tx = targetRect.x;
  const ty = targetRect.y + targetRect.h / 2;

  // Control point offset: proportional to horizontal distance, clamped
  const dx = Math.abs(tx - sx);
  const offset = Math.max(50, dx * 0.4);
  const c1x = sx + offset;
  const c1y = sy;
  const c2x = tx - offset;
  const c2y = ty;

  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  // NOT label at t=0.7 on the cubic bezier curve (shifted toward target)
  const t = 0.7;
  const mt = 1 - t;
  const labelX = mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * tx;
  const labelY = mt * mt * mt * sy + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ty;

  // Tangent angle at target end (derivative of bezier at t=1)
  const targetAngle = Math.atan2(ty - c2y, tx - c2x);

  return { path, labelX, labelY, targetAngle };
}

/**
 * Calculate a floating source point on a constraint node boundary.
 * Circle for ONE/EXCL/INCL, rectangle for REQ/MASK.
 */
function calcFloatingSourcePoint(
  rect: NodeRect,
  targetX: number,
  targetY: number,
  isDirectional: boolean,
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

/**
 * Calculate the target handle position on a CEG node for a constraint edge.
 * Supports all 4 constraint handles: top, bottom, left, right.
 */
function calcConstraintTargetPoint(
  targetRect: NodeRect,
  targetHandle: string | undefined,
): { x: number; y: number } {
  switch (targetHandle) {
    case 'constraint-bottom':
      return { x: targetRect.x + targetRect.w / 2, y: targetRect.y + targetRect.h };
    case 'constraint-left':
      return { x: targetRect.x, y: targetRect.y + targetRect.h / 2 - 8 };
    case 'constraint-right':
      return { x: targetRect.x + targetRect.w, y: targetRect.y + targetRect.h / 2 + 8 };
    default: // 'constraint' = top
      return { x: targetRect.x + targetRect.w / 2, y: targetRect.y };
  }
}

/** Render an arrowhead polygon */
function createArrowHead(
  tipX: number, tipY: number, angle: number, size: number, fill: string,
): Element {
  const points = [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - Math.PI / 6), tipY - size * Math.sin(angle - Math.PI / 6)],
    [tipX - size * Math.cos(angle + Math.PI / 6), tipY - size * Math.sin(angle + Math.PI / 6)],
  ];
  return createSvgElement('polygon', {
    points: points.map(p => p.join(',')).join(' '),
    fill,
  });
}

/**
 * Render a single edge as flat SVG elements (no wrapping <g>).
 * Arrowheads are explicit <polygon> elements (no <defs>/<marker>).
 * Returns an array of elements to append directly to <svg>.
 */
function renderEdge(
  edge: CEGEdge,
  nodeRects: Map<string, NodeRect>,
): Element[] {
  const sourceRect = nodeRects.get(edge.source);
  const targetRect = nodeRects.get(edge.target);
  if (!sourceRect || !targetRect) return [];

  const elements: Element[] = [];

  if (edge.data.edgeType === 'logical') {
    const color = edge.data.negated
      ? EDGE_COLORS.logical.negative
      : EDGE_COLORS.logical.positive;
    const { path, labelX, labelY, targetAngle } = calcLogicalEdgePath(sourceRect, targetRect);

    elements.push(createSvgElement('path', {
      d: path, fill: 'none', stroke: color, 'stroke-width': 2,
    }));

    // Arrowhead as explicit polygon at target end
    const tx = targetRect.x;
    const ty = targetRect.y + targetRect.h / 2;
    elements.push(createArrowHead(tx, ty, targetAngle, 10, color));

    if (edge.data.negated) {
      // Inline Not label as rect + text (no wrapping <g>)
      const fontSize = 11;
      const text = 'Not';
      const labelW = estimateTextWidth(text, fontSize) + 12;
      const labelH = fontSize + 6;
      elements.push(createSvgElement('rect', {
        x: labelX - labelW / 2, y: labelY - labelH / 2,
        width: labelW, height: labelH, rx: 4, ry: 4,
        fill: '#fff', stroke: color, 'stroke-width': 1,
      }));
      elements.push(createSvgText(text, labelX, labelY, {
        fontSize, fontWeight: 500, fill: color, textAnchor: 'middle',
      }));
    }
  } else {
    const cData = edge.data;
    const color = cData.negated
      ? EDGE_COLORS.constraint.negative
      : EDGE_COLORS.constraint.positive;
    const isDirectional = cData.isDirectional ?? false;
    const isSource = cData.isSource ?? false;

    const target = calcConstraintTargetPoint(targetRect, edge.targetHandle);
    const source = calcFloatingSourcePoint(sourceRect, target.x, target.y, isDirectional);

    elements.push(createSvgElement('line', {
      x1: source.x, y1: source.y, x2: target.x, y2: target.y,
      stroke: color, 'stroke-width': 2, 'stroke-dasharray': '3,3',
    }));

    if (isDirectional) {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      if (isSource) {
        elements.push(createArrowHead(source.x, source.y, angle + Math.PI, 10, color));
      } else {
        elements.push(createArrowHead(target.x, target.y, angle, 10, color));
      }
    }

    if (cData.negated) {
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      const fontSize = 10;
      const text = 'Not';
      const labelW = estimateTextWidth(text, fontSize) + 12;
      const labelH = fontSize + 6;
      elements.push(createSvgElement('rect', {
        x: mx - labelW / 2, y: my - labelH / 2,
        width: labelW, height: labelH, rx: 3, ry: 3,
        fill: '#fff', stroke: EDGE_COLORS.constraint.negative, 'stroke-width': 1,
      }));
      elements.push(createSvgText(text, mx, my, {
        fontSize, fontWeight: 600, fill: EDGE_COLORS.constraint.negative, textAnchor: 'middle',
      }));
    }
  }

  return elements;
}

// =============================================================================
// Main SVG Capture
// =============================================================================

export function captureGraphSVG(): string | null {
  const state = useGraphStore.getState();
  const { nodes, constraintNodes, edges } = state;
  if (nodes.length === 0 && constraintNodes.length === 0) return null;

  // 1. DOM measurement — only needed for constraint nodes (CEG nodes are self-calculated)
  const domElements = new Map<string, HTMLElement>();
  for (const node of constraintNodes) {
    const domEl = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement | null;
    if (domEl) domElements.set(node.id, domEl);
  }

  // 2. Build node rectangles (CEG: from text wrapping, constraints: from DOM)
  const nodeRects = buildNodeRects(nodes, constraintNodes, edges, domElements);

  // 3. Calculate bounds and normalize to (0,0) origin to avoid negative viewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, rect] of nodeRects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  if (!isFinite(minX)) return null;

  const padding = 50;
  const offsetX = minX - padding;
  const offsetY = minY - padding;
  const svgW = Math.ceil(maxX - minX + 2 * padding);
  const svgH = Math.ceil(maxY - minY + 2 * padding);

  // Shift all node rects to (0,0)-based coordinates
  const shiftedRects = new Map<string, NodeRect>();
  for (const [id, rect] of nodeRects) {
    shiftedRects.set(id, {
      x: rect.x - offsetX,
      y: rect.y - offsetY,
      w: rect.w,
      h: rect.h,
    });
  }

  // 4. Build output SVG — flat structure, no nesting layers
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.setAttribute('width', String(svgW));
  svg.setAttribute('height', String(svgH));

  // Edges — each element directly under <svg>
  for (const edge of edges) {
    for (const el of renderEdge(edge, shiftedRects)) {
      svg.appendChild(el);
    }
  }

  // CEG nodes — each node <g> directly under <svg>
  for (const node of nodes) {
    const role = calculateNodeRole(node.id, edges);
    // Shift node position for rendering
    const shifted = { ...node, position: { x: node.position.x - offsetX, y: node.position.y - offsetY } };
    svg.appendChild(renderCEGNode(shifted as CEGNode, role));
  }

  // Constraint nodes — each node <g> directly under <svg>
  for (const node of constraintNodes) {
    const shifted = { ...node, position: { x: node.position.x - offsetX, y: node.position.y - offsetY } };
    const domEl = domElements.get(node.id) ?? null;
    svg.appendChild(renderConstraintNode(shifted as ConstraintNode, domEl));
  }

  return new XMLSerializer().serializeToString(svg);
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Download the graph as an SVG file.
 */
export function downloadGraphSVG(filename: string = 'graph.svg'): void {
  const svg = captureGraphSVG();
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy graph SVG to clipboard.
 *
 * Writes as text/plain (SVG source) for paste into text editors and
 * vector tools (Inkscape, draw.io, etc.). The ClipboardItem API with
 * 'image/svg+xml' is not supported by browsers, so text/plain is the
 * most compatible approach for SVG clipboard operations.
 */
export async function copyGraphSVGToClipboard(): Promise<void> {
  const svg = captureGraphSVG();
  if (!svg) return;
  await navigator.clipboard.writeText(svg);
}

// =============================================================================
// PNG Export (SVG → Canvas → PNG)
// =============================================================================

const PNG_SCALE = 2; // 2x for Retina displays

/**
 * Convert captured SVG to a PNG blob via Canvas.
 */
function svgToPngBlob(svgString: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Parse viewBox to get dimensions
    const match = svgString.match(/viewBox="[^"]*"\s+width="(\d+)"\s+height="(\d+)"/);
    if (!match) { resolve(null); return; }
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);

    const canvas = document.createElement('canvas');
    canvas.width = w * PNG_SCALE;
    canvas.height = h * PNG_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }

    // White background (SVG has transparent background)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(null);

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Download the graph as a PNG file.
 */
export async function downloadGraphPNG(filename: string = 'graph.png'): Promise<void> {
  const svg = captureGraphSVG();
  if (!svg) return;
  const blob = await svgToPngBlob(svg);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy graph as PNG image to clipboard.
 */
export async function copyGraphPNGToClipboard(): Promise<void> {
  const svg = captureGraphSVG();
  if (!svg) return;
  const blob = await svgToPngBlob(svg);
  if (!blob) return;
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}
