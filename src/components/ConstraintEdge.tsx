/**
 * Constraint Edge Component for React Flow
 * Renders edges from constraint nodes to member nodes
 * - Source side (constraint node): floating — edge originates from node boundary
 * - Target side (CEG node): fixed — connects to top/bottom constraint handle
 * - Supports NOT indication (light blue color, "Not" label)
 * - Shows arrows for directional constraints (REQ/MASK)
 *   - Source/trigger edge: arrow points FROM CEG node TO constraint node (at source end)
 *   - Target edge: arrow points FROM constraint node TO CEG node (at target end)
 */

import { memo, useCallback } from 'react';
import { BaseEdge, getStraightPath, EdgeLabelRenderer, useInternalNode } from '@xyflow/react';
import type { ConstraintEdgeData } from '../types/graph';
import { EDGE_COLORS } from '../types/graph';
import { useGraphStore } from '../stores/graphStore';

interface ConstraintEdgeProps {
  id: string;
  source: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data?: ConstraintEdgeData;
  selected?: boolean;
}

// Calculate arrow head points
function getArrowPoints(x: number, y: number, angle: number, size: number = 8): string {
  const points = [
    [x, y],
    [x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6)],
    [x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6)],
  ];
  return points.map(p => p.join(',')).join(' ');
}

// Calculate floating source point on constraint node boundary
// For circular nodes (ONE/EXCL/INCL): intersection with circle
// For rectangular nodes (REQ/MASK): intersection with rectangle
function getFloatingSourcePoint(
  node: { positionAbsolute?: { x: number; y: number }; position: { x: number; y: number }; measured?: { width?: number; height?: number } },
  targetX: number,
  targetY: number,
  isDirectional: boolean,
): { x: number; y: number } {
  const nodeX = (node.positionAbsolute?.x ?? node.position.x);
  const nodeY = (node.positionAbsolute?.y ?? node.position.y);
  const w = node.measured?.width ?? 40;
  const h = node.measured?.height ?? 40;
  const centerX = nodeX + w / 2;
  const centerY = nodeY + h / 2;

  const dx = targetX - centerX;
  const dy = targetY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return { x: centerX, y: centerY };

  if (isDirectional) {
    // Rectangle: parametric intersection
    const halfW = w / 2;
    const halfH = h / 2;
    const t = Math.min(
      Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity,
    );
    return {
      x: centerX + dx * t,
      y: centerY + dy * t,
    };
  } else {
    // Circle: radius = half of smaller dimension
    const radius = Math.min(w, h) / 2;
    return {
      x: centerX + (dx / dist) * radius,
      y: centerY + (dy / dist) * radius,
    };
  }
}

const ConstraintEdge = memo(({
  id,
  source,
  sourceX: defaultSourceX,
  sourceY: defaultSourceY,
  targetX,
  targetY,
  data,
  selected,
}: ConstraintEdgeProps) => {
  const toggleConstraintMemberNegation = useGraphStore(
    (state) => state.toggleConstraintMemberNegation
  );

  const sourceNode = useInternalNode(source);

  const negated = data?.negated ?? false;
  const isDirectional = data?.isDirectional ?? false;
  const isSource = data?.isSource ?? false;
  const color = negated
    ? EDGE_COLORS.constraint.negative
    : EDGE_COLORS.constraint.positive;

  // Calculate floating source position (constraint node boundary)
  let sourceX = defaultSourceX;
  let sourceY = defaultSourceY;
  if (sourceNode) {
    const floating = getFloatingSourcePoint(sourceNode, targetX, targetY, isDirectional);
    sourceX = floating.x;
    sourceY = floating.y;
  }

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Calculate angle for arrow heads
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);

  // REQ: source or targets (not both) — store-level guard prevents both-sides-NOT
  // MASK: trigger only, targets prohibited
  const isMask = data?.isMask ?? false;
  const canToggleNot = !isDirectional || isSource || !isMask;

  // Click to toggle NOT
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canToggleNot) {
      toggleConstraintMemberNegation(id);
    }
  }, [id, toggleConstraintMemberNegation, canToggleNot]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: '5,5',
          cursor: canToggleNot ? 'pointer' : 'default',
        }}
        interactionWidth={20}
      />
      {/* Arrow head for directional constraints */}
      {isDirectional && !isSource && (
        <polygon
          points={getArrowPoints(targetX, targetY, angle, 10)}
          fill={color}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        />
      )}
      {isDirectional && isSource && (
        <polygon
          points={getArrowPoints(sourceX, sourceY, angle + Math.PI, 10)}
          fill={color}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        />
      )}
      {/* NOT label */}
      {negated && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
              color: EDGE_COLORS.constraint.negative,
              backgroundColor: '#fff',
              padding: '1px 4px',
              borderRadius: '3px',
              border: `1px solid ${EDGE_COLORS.constraint.negative}`,
            }}
            onClick={handleClick}
            title="Click to toggle NOT"
          >
            Not
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ConstraintEdge.displayName = 'ConstraintEdge';

export default ConstraintEdge;
