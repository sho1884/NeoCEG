/**
 * Logical Edge Component for React Flow
 * Renders edges with NOT (negative logic) support
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Position,
} from '@xyflow/react';
import type { LogicalEdgeData } from '../types/graph';
import { EDGE_COLORS } from '../types/graph';

interface LogicalEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: LogicalEdgeData;
  selected?: boolean;
  markerEnd?: string;
}

const LogicalEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: LogicalEdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate NOT label position at t=0.7 on the cubic bezier curve
  // to avoid overlap at crossing points when nodes are vertically aligned.
  // Match React Flow's calculateControlOffset + getControlWithCurvature exactly:
  //   Position.Right source: c1x = sourceX + offset(targetX - sourceX)
  //   Position.Left target:  c2x = targetX - offset(targetX - sourceX)
  //   offset(d) = d >= 0 ? 0.5 * d : curvature * 25 * sqrt(-d)
  const t = 0.7;
  const curvature = 0.25;
  const hDist = targetX - sourceX;
  const offset = hDist >= 0 ? 0.5 * hDist : curvature * 25 * Math.sqrt(-hDist);
  const c1x = sourceX + offset;
  const c1y = sourceY;
  const c2x = targetX - offset;
  const c2y = targetY;
  const mt = 1 - t;
  const notLabelX = mt * mt * mt * sourceX + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * targetX;
  const notLabelY = mt * mt * mt * sourceY + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * targetY;

  const isNegated = data?.negated ?? false;
  const strokeColor = isNegated
    ? EDGE_COLORS.logical.negative
    : EDGE_COLORS.logical.positive;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 2,
          ...(selected && { strokeWidth: 3 }),
        }}
        markerEnd={markerEnd}
      />
      {isNegated && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${notLabelX}px,${notLabelY}px)`,
              background: '#fff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              color: EDGE_COLORS.logical.negative,
              border: `1px solid ${EDGE_COLORS.logical.negative}`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            Not
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

LogicalEdge.displayName = 'LogicalEdge';

export default LogicalEdge;
