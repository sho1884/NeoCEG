/**
 * Constraint Node Component for React Flow
 * Renders constraint nodes (ONE, EXCL, INCL, REQ, MASK)
 * Right-click menu is handled by GraphCanvas
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ConstraintNodeData } from '../types/graph';
import { CONSTRAINT_COLORS, CONSTRAINT_LABELS } from '../types/graph';

interface ConstraintNodeProps {
  id: string;
  data: ConstraintNodeData;
  selected?: boolean;
}

const ConstraintNode = memo(({ data, selected }: ConstraintNodeProps) => {
  const color = CONSTRAINT_COLORS[data.constraintType];
  const label = CONSTRAINT_LABELS[data.constraintType];

  // Determine shape based on constraint type
  const isDirectional = data.constraintType === 'REQ' || data.constraintType === 'MASK';

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: isDirectional ? '4px' : '50%',
        backgroundColor: color,
        border: `2px solid ${selected ? '#fff' : color}`,
        boxShadow: selected ? `0 0 0 2px ${color}` : '0 2px 4px rgba(0,0,0,0.2)',
        minWidth: isDirectional ? '50px' : '40px',
        minHeight: isDirectional ? 'auto' : '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        color: '#fff',
        fontWeight: 600,
        fontSize: '12px',
        textTransform: 'uppercase',
      }}
    >
      {/* All constraint types use 4-direction source handles.
          Actual edge rendering uses floating calculation (ConstraintEdge),
          so handle positions serve as drag-start points. */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={{ background: '#fff', width: 6, height: 6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: '#fff', width: 6, height: 6 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: '#fff', width: 6, height: 6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#fff', width: 6, height: 6 }}
      />

      {label}
    </div>
  );
});

ConstraintNode.displayName = 'ConstraintNode';

export default ConstraintNode;
