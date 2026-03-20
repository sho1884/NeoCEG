/**
 * CEG Node Component for React Flow
 * Renders nodes with role-based coloring and inline editing
 * - AND/OR badge positioned at left-center
 * - Width: default 150, min 80, max 400 (per requirements spec)
 * - Text wrapping within node width
 * - Resizable by dragging node border
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { CEGNodeData, NodeRole, LogicalOperator } from '../types/graph';
import { NODE_COLORS, NODE_RENDERING } from '../types/graph';
import { useGraphStore } from '../stores/graphStore';

// Extended data type that includes role (passed from parent)
interface CEGNodeDataWithRole extends CEGNodeData {
  role?: NodeRole;
}

interface CEGNodeProps {
  id: string;
  data: CEGNodeDataWithRole;
  selected?: boolean;
}

const CEGNode = memo(({ id, data, selected }: CEGNodeProps) => {
  const updateNode = useGraphStore((state) => state.updateNode);

  // Use role from props (calculated in GraphCanvas based on edges)
  const role: NodeRole = data.role || 'cause';
  const colors = NODE_COLORS[role];

  // Width from data or default
  const nodeWidth = data.width ?? NODE_RENDERING.DEFAULT_WIDTH;

  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  // Focus and select when editing starts
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.innerText = data.label || '';
      editRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing, data.label]);

  // Handle double-click to start editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  // Handle blur - save changes
  const handleBlur = useCallback(() => {
    if (editRef.current) {
      const newLabel = editRef.current.innerText.trim();
      if (newLabel !== data.label) {
        updateNode(id, { label: newLabel });
      }
    }
    setIsEditing(false);
  }, [id, data.label, updateNode]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      if (editRef.current) {
        editRef.current.innerText = data.label || '';
      }
      setIsEditing(false);
    }
  }, [handleBlur, data.label]);

  // Toggle operator (AND <-> OR)
  // Use onMouseDown to fire before React Flow's selection/drag handling
  const handleOperatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);
  const handleOperatorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newOperator: LogicalOperator = data.operator === 'AND' ? 'OR' : 'AND';
    updateNode(id, { operator: newOperator });
  }, [id, data.operator, updateNode]);

  // Handle resize - clamp to min/max width
  const handleResize = useCallback(
    (_: unknown, params: { width: number }) => {
      const newWidth = Math.max(
        NODE_RENDERING.MIN_WIDTH,
        Math.min(NODE_RENDERING.MAX_WIDTH, params.width)
      );
      updateNode(id, { width: newWidth });
    },
    [id, updateNode]
  );

  // Determine if node needs operator (has incoming edges = not a cause)
  const needsOperator = role !== 'cause';

  return (
    <>
      <NodeResizer
        minWidth={NODE_RENDERING.MIN_WIDTH}
        maxWidth={NODE_RENDERING.MAX_WIDTH}
        minHeight={36}
        isVisible={selected}
        onResize={handleResize}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: needsOperator ? '8px 12px 8px 4px' : '8px 12px',
          borderRadius: '8px',
          backgroundColor: colors.fill,
          border: `2px solid ${colors.border}`,
          boxShadow: selected ? `0 0 0 2px ${colors.border}` : 'none',
          width: nodeWidth,
          minHeight: '36px',
          cursor: 'default',
          position: 'relative',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* Input handle (logical) */}
        <Handle
          type="target"
          position={Position.Left}
          id="logical-in"
          style={{
            background: colors.border,
            width: 8,
            height: 8,
          }}
        />

        {/* Operator badge (AND/OR) - positioned at left-center */}
        {needsOperator && (
          <div
            onMouseDown={handleOperatorMouseDown}
            onClick={handleOperatorClick}
            className="nodrag nopan"
            style={{
              fontSize: '9px',
              color: '#fff',
              backgroundColor: data.operator === 'AND' ? '#1976d2' : '#bf6c00',
              padding: '3px 6px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              flexShrink: 0,
              marginRight: '6px',
              lineHeight: 1,
            }}
            title="Click to toggle AND/OR"
          >
            {data.operator || 'AND'}
          </div>
        )}

        {/* Node label - contenteditable for inline editing, with text wrapping */}
        <div
          ref={editRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={isEditing ? handleKeyDown : undefined}
          className={isEditing ? 'nodrag nowheel' : ''}
          style={{
            flex: 1,
            fontWeight: 500,
            color: '#333',
            fontSize: '13px',
            textAlign: 'left',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            outline: 'none',
            minWidth: 0,
            padding: isEditing ? '2px 4px' : 0,
            backgroundColor: isEditing ? '#fff' : 'transparent',
            borderRadius: isEditing ? '3px' : 0,
            border: isEditing ? '1px solid #ccc' : 'none',
          }}
        >
          {data.label}
        </div>

        {/* Output handle (logical) */}
        <Handle
          type="source"
          position={Position.Right}
          id="logical-out"
          style={{
            background: colors.border,
            width: 8,
            height: 8,
          }}
        />

        {/* Constraint handles (all 4 sides) - for connecting to constraint nodes */}
        <Handle
          type="target"
          position={Position.Top}
          id="constraint"
          style={{
            background: '#757575',
            width: 6,
            height: 6,
            top: -3,
          }}
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="constraint-bottom"
          style={{
            background: '#757575',
            width: 6,
            height: 6,
            bottom: -3,
          }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="constraint-left"
          style={{
            background: '#757575',
            width: 6,
            height: 6,
            left: -3,
            top: 'calc(50% - 8px)',
          }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="constraint-right"
          style={{
            background: '#757575',
            width: 6,
            height: 6,
            right: -3,
            top: 'calc(50% + 8px)',
          }}
        />

        {/* Non-observable warning indicator - shown only when node is NOT observable */}
        {data.observable === false && (
          <div
            style={{
              position: 'absolute',
              top: -7,
              right: -7,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: '#ffa726',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Not Observable (観測不可)"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 5 Q5 2 9 5" stroke="white" strokeWidth="1.5" fill="none" />
              <line x1="3" y1="5" x2="2.5" y2="7" stroke="white" strokeWidth="1" />
              <line x1="5" y1="4.5" x2="5" y2="7" stroke="white" strokeWidth="1" />
              <line x1="7" y1="5" x2="7.5" y2="7" stroke="white" strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
});

CEGNode.displayName = 'CEGNode';

export default CEGNode;
