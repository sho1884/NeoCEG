/**
 * Graph Canvas Component
 * Main React Flow canvas for CEG editing
 */

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  getBezierPath,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  type Edge,
  type ConnectionLineComponentProps,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CEGNode from './CEGNode';
import ConstraintNode from './ConstraintNode';
import LogicalEdge from './LogicalEdge';
import ConstraintEdge from './ConstraintEdge';
import ContextMenu, { type MenuItem } from './ContextMenu';
import WelcomePanel from './WelcomePanel';
import { useGraphStore, generateDefaultNodeName } from '../stores/graphStore';
import { NODE_COLORS, CONSTRAINT_LABELS } from '../types/graph';
import type { NodeRole, CEGEdge, ConstraintType } from '../types/graph';

// Context menu state type
type ContextMenuState = {
  x: number;
  y: number;
  items: MenuItem[];
} | null;

// Custom node types
const nodeTypes = {
  cegNode: CEGNode,
  constraintNode: ConstraintNode,
};

// Custom edge types
const edgeTypes = {
  logical: LogicalEdge,
  constraint: ConstraintEdge,
};

// Custom connection line: bezier for logical edges, straight for constraint edges
function CustomConnectionLine({ fromX, fromY, toX, toY, fromHandle }: ConnectionLineComponentProps) {
  if (fromHandle?.id === 'logical-out') {
    // Bezier for logical edges
    const [path] = getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      sourcePosition: Position.Right,
      targetX: toX,
      targetY: toY,
      targetPosition: Position.Left,
    });
    return <path d={path} fill="none" stroke="#999" strokeWidth={2} />;
  }
  // Straight line for constraint edges
  return <path d={`M ${fromX} ${fromY} L ${toX} ${toY}`} fill="none" stroke="#999" strokeWidth={2} strokeDasharray="5,5" />;
}

// Default edge options
const defaultEdgeOptions = {
  type: 'logical',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 12,
    height: 12,
    color: '#333',
  },
  data: {
    edgeType: 'logical' as const,
    negated: false,
  },
};

// Helper function to calculate node role from edges
function calculateNodeRole(nodeId: string, edges: { source: string; target: string; data: { edgeType: string } }[]): NodeRole {
  const hasIncoming = edges.some((e) => e.target === nodeId && e.data.edgeType === 'logical');
  const hasOutgoing = edges.some((e) => e.source === nodeId && e.data.edgeType === 'logical');

  if (!hasIncoming) return 'cause';
  if (!hasOutgoing) return 'effect';
  return 'intermediate';
}

// Helper function to build expression string from incoming edges
// Labels are quoted to handle special characters safely
function buildExpressionFromEdges(
  nodeId: string,
  operator: 'AND' | 'OR' | undefined,
  edges: CEGEdge[],
  nodeLabels: Map<string, string>
): string | null {
  const incomingEdges = edges.filter(
    (e) => e.target === nodeId && e.data.edgeType === 'logical'
  );

  if (incomingEdges.length === 0) {
    return null; // Cause node, no expression
  }

  // Build operand strings with quoted labels
  const operands = incomingEdges.map((edge) => {
    const sourceLabel = nodeLabels.get(edge.source) || edge.source;
    const quoted = `"${sourceLabel}"`;
    const edgeData = edge.data as { negated?: boolean };
    return edgeData.negated ? `NOT ${quoted}` : quoted;
  });

  if (operands.length === 1) {
    return operands[0];
  }

  const op = operator || 'AND';
  return operands.join(` ${op} `);
}

// All constraint type options for context menu
const CONSTRAINT_TYPE_OPTIONS: ConstraintType[] = ['ONE', 'EXCL', 'INCL', 'REQ', 'MASK'];

function GraphCanvasInner() {
  // Get store state directly
  const storeNodes = useGraphStore((state) => state.nodes);
  const storeConstraintNodes = useGraphStore((state) => state.constraintNodes);
  const storeEdges = useGraphStore((state) => state.edges);
  const storeConstraints = useGraphStore((state) => state.constraints);

  // Store actions
  const addStoreEdge = useGraphStore((state) => state.addEdge);
  const addConstraintEdge = useGraphStore((state) => state.addConstraintEdge);
  const updateNodePosition = useGraphStore((state) => state.updateNodePosition);
  const updateConstraintNodePosition = useGraphStore((state) => state.updateConstraintNodePosition);
  const addStoreNode = useGraphStore((state) => state.addNode);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const deleteEdge = useGraphStore((state) => state.deleteEdge);
  const toggleEdgeNegation = useGraphStore((state) => state.toggleEdgeNegation);
  const toggleConstraintMemberNegation = useGraphStore((state) => state.toggleConstraintMemberNegation);
  const deleteConstraint = useGraphStore((state) => state.deleteConstraint);
  const updateNode = useGraphStore((state) => state.updateNode);
  const setStoreSelectedNodeIds = useGraphStore((state) => state.setSelectedNodeIds);
  const setStoreSelectedConstraintNodeId = useGraphStore((state) => state.setSelectedConstraintNodeId);
  const changeConstraintType = useGraphStore((state) => state.changeConstraintType);
  const setConstraintEdgeAsSource = useGraphStore((state) => state.setConstraintEdgeAsSource);
  const deleteConstraintEdge = useGraphStore((state) => state.deleteConstraintEdge);

  const { screenToFlowPosition, getViewport } = useReactFlow();
  const setViewportTopLeftGetter = useGraphStore((state) => state.setViewportTopLeftGetter);

  // Register viewport top-left getter so MainToolbar can get flow coordinates
  useEffect(() => {
    setViewportTopLeftGetter(() => {
      const { x, y, zoom } = getViewport();
      // Flow coordinate of viewport top-left with 40px margin
      return { x: -x / zoom + 40, y: -y / zoom + 40 };
    });
  }, [setViewportTopLeftGetter, getViewport]);

  // Double-click detection
  const lastClickTime = useRef<number>(0);
  const lastClickPosition = useRef<{ x: number; y: number } | null>(null);

  // Track selection state (using state to trigger re-renders for toolbar updates)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Welcome panel: show when canvas is empty on mount
  const [showWelcome, setShowWelcome] = useState(() => storeNodes.length === 0);

  // Track node positions during drag to keep nodes visible
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Build node label map for expression generation
  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of storeNodes) {
      map.set(n.id, n.data.label || n.id);
    }
    return map;
  }, [storeNodes]);

  // Convert store nodes/edges to React Flow format
  // Include role calculation based on edges - this ensures role updates when edges change
  const nodes = useMemo(() => {
    const cegNodes = storeNodes.map((n) => {
      const role = calculateNodeRole(n.id, storeEdges);
      const nodeWidth = n.data.width ?? 150;
      const dragPos = dragPositions.get(n.id);
      return {
        ...n,
        ...(dragPos ? { position: dragPos } : {}),
        type: 'cegNode' as const,
        selected: selectedNodes.has(n.id),
        width: nodeWidth,
        initialHeight: 40,
        data: {
          ...n.data,
          role, // Pass calculated role to the node
        },
      };
    });
    const constraintNodes = storeConstraintNodes.map((n) => {
      const dragPos = dragPositions.get(n.id);
      return {
        ...n,
        ...(dragPos ? { position: dragPos } : {}),
        type: 'constraintNode' as const,
        selected: selectedNodes.has(n.id),
        width: 50,
        initialHeight: 40,
      };
    });
    return [...cegNodes, ...constraintNodes] as unknown as Node[];
  }, [storeNodes, storeConstraintNodes, storeEdges, selectedNodes, dragPositions]);

  const edges = useMemo(() =>
    storeEdges.map((e) => ({
      ...e,
      type: e.data.edgeType as 'logical' | 'constraint',
      selected: selectedEdges.has(e.id),
    })) as unknown as Edge[],
    [storeEdges, selectedEdges]
  );

  // Handle node changes (selection, position during drag)
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Close context menu on any node interaction
      const hasInteraction = changes.some((c) => c.type === 'select' || c.type === 'position');
      if (hasInteraction) {
        setContextMenu(null);
      }

      // Track position changes during drag so nodes remain visible
      const positionChanges = changes.filter(
        (c) => c.type === 'position' && c.position
      );
      if (positionChanges.length > 0) {
        setDragPositions((prev) => {
          const next = new Map(prev);
          for (const change of positionChanges) {
            if (change.type === 'position' && change.position) {
              next.set(change.id, change.position);
            }
          }
          return next;
        });
      }

      // Update selection state
      const selectChanges = changes.filter((c) => c.type === 'select');
      if (selectChanges.length > 0) {
        setSelectedNodes((prev) => {
          const next = new Set(prev);
          selectChanges.forEach((change) => {
            if (change.type === 'select') {
              if (change.selected) {
                next.add(change.id);
              } else {
                next.delete(change.id);
              }
            }
          });
          return next;
        });
      }
    },
    []
  );

  // Handle edge changes (selection)
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      // Close context menu on any edge interaction
      const hasInteraction = changes.some((c) => c.type === 'select');
      if (hasInteraction) {
        setContextMenu(null);
      }

      // Update selection state
      const selectChanges = changes.filter((c) => c.type === 'select');
      if (selectChanges.length > 0) {
        setSelectedEdges((prev) => {
          const next = new Set(prev);
          selectChanges.forEach((change) => {
            if (change.type === 'select') {
              if (change.selected) {
                next.add(change.id);
              } else {
                next.delete(change.id);
              }
            }
          });
          return next;
        });
      }
    },
    []
  );

  // Control which handles light up as valid targets during drag
  const isValidConnection = useCallback(
    (connection: { source?: string | null; target?: string | null; sourceHandle?: string | null; targetHandle?: string | null }) => {
      if (!connection.source || !connection.target) return false;
      const isSourceConstraint = storeConstraintNodes.some((cn) => cn.id === connection.source);
      if (isSourceConstraint) {
        // Constraint -> CEG: only constraint handles are valid
        return connection.targetHandle?.startsWith('constraint') ?? false;
      }
      // CEG -> CEG: only logical-in is valid
      return connection.targetHandle === 'logical-in';
    },
    [storeConstraintNodes]
  );

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return;

      // Check if source is a constraint node
      const isSourceConstraint = storeConstraintNodes.some((cn) => cn.id === params.source);
      // Check if target is a constraint node
      const isTargetConstraint = storeConstraintNodes.some((cn) => cn.id === params.target);

      if (isSourceConstraint && !isTargetConstraint) {
        // Constraint node -> CEG node: create constraint edge
        addConstraintEdge(params.source, params.target, params.targetHandle ?? undefined);
      } else if (!isSourceConstraint && !isTargetConstraint) {
        // CEG node -> CEG node: create logical edge (only from logical handles)
        if (params.sourceHandle === 'logical-out' || !params.sourceHandle) {
          if (params.targetHandle === 'logical-in' || !params.targetHandle) {
            addStoreEdge(params.source, params.target, false);
          }
        }
      }
      // Other cases (CEG -> constraint, constraint -> constraint) are not allowed
    },
    [addStoreEdge, addConstraintEdge, storeConstraintNodes]
  );

  // Handle node drag end - sync position to store and clear drag state
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'constraintNode') {
        updateConstraintNodePosition(node.id, node.position);
      } else {
        updateNodePosition(node.id, node.position);
      }
      // Clear drag position now that store has the final position
      setDragPositions((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        next.delete(node.id);
        return next;
      });
    },
    [updateNodePosition, updateConstraintNodePosition]
  );

  // Handle pane click with double-click detection
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      const position = { x: event.clientX, y: event.clientY };

      // Check if this is a double-click (within 300ms and 10px)
      const timeDiff = now - lastClickTime.current;
      const lastPos = lastClickPosition.current;
      const isDoubleClick = timeDiff < 300 && lastPos &&
        Math.abs(position.x - lastPos.x) < 10 &&
        Math.abs(position.y - lastPos.y) < 10;

      // Close context menu on any pane click
      setContextMenu(null);

      if (isDoubleClick) {
        // Create node at click position
        const flowPosition = screenToFlowPosition(position);
        addStoreNode(generateDefaultNodeName(), flowPosition, 'AND');
        setShowWelcome(false);
        // Reset to prevent triple-click creating another node
        lastClickTime.current = 0;
        lastClickPosition.current = null;
      } else {
        lastClickTime.current = now;
        lastClickPosition.current = position;
      }
    },
    [addStoreNode, screenToFlowPosition]
  );

  // Handle edge click - toggle NOT for both logical and constraint edges
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const edgeData = edge.data as { edgeType?: string; isDirectional?: boolean; isSource?: boolean; isMask?: boolean };
      if (edgeData?.edgeType === 'logical') {
        toggleEdgeNegation(edge.id);
      } else if (edgeData?.edgeType === 'constraint') {
        // MASK target: NOT prohibited. REQ: store-level guard handles both-sides-NOT.
        if (edgeData.isMask && edgeData.isDirectional && !edgeData.isSource) return;
        toggleConstraintMemberNegation(edge.id);
      }
    },
    [toggleEdgeNegation, toggleConstraintMemberNegation]
  );

  // Handle node right-click - show context menu
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const items: MenuItem[] = [];

      if (node.type === 'cegNode') {
        // CEG Node menu items
        const nodeData = node.data as { observable?: boolean; operator?: 'AND' | 'OR' };
        const isObservable = nodeData.observable ?? true; // Default is true (ON)

        // Check if node has incoming edges (can set label to expression)
        const hasIncoming = storeEdges.some(
          (e) => e.target === node.id && e.data.edgeType === 'logical'
        );

        if (hasIncoming) {
          items.push({
            label: 'Set label to expression',
            onClick: () => {
              const expression = buildExpressionFromEdges(
                node.id,
                nodeData.operator,
                storeEdges,
                nodeLabelMap
              );
              if (expression) {
                updateNode(node.id, { label: expression });
              }
            },
          });
        }

        items.push({
          label: isObservable ? 'Mark as Non-Observable' : 'Mark as Observable',
          onClick: () => updateNode(node.id, { observable: !isObservable }),
        });
        items.push({
          label: 'Delete Node',
          onClick: () => deleteNode(node.id),
          danger: true,
        });
      } else if (node.type === 'constraintNode') {
        // Constraint Node menu items: Type change + Delete
        const constraintId = (node.data as { constraintId?: string })?.constraintId;
        if (constraintId) {
          const constraint = storeConstraints.find((c) => c.id === constraintId);
          const currentType = constraint?.type;

          // Type options (flat list with checkmark for current)
          for (const t of CONSTRAINT_TYPE_OPTIONS) {
            items.push({
              label: CONSTRAINT_LABELS[t],
              onClick: () => changeConstraintType(constraintId, t),
              disabled: t === currentType,
              checked: t === currentType,
            });
          }

          // Separator
          items.push({ label: '', onClick: () => {}, separator: true });

          // Delete
          items.push({
            label: 'Delete Constraint',
            onClick: () => deleteConstraint(constraintId),
            danger: true,
          });
        }
      }

      setContextMenu({ x: event.clientX, y: event.clientY, items });
    },
    [deleteNode, deleteConstraint, updateNode, storeEdges, nodeLabelMap, storeConstraints, changeConstraintType]
  );

  // Handle edge right-click - show context menu
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      const edgeData = edge.data as { edgeType?: string; negated?: boolean; isDirectional?: boolean; isSource?: boolean; isMask?: boolean };
      const items: MenuItem[] = [];

      if (edgeData?.edgeType === 'logical') {
        items.push({
          label: edgeData.negated ? 'Remove NOT' : 'Add NOT',
          onClick: () => toggleEdgeNegation(edge.id),
        });
        items.push({
          label: 'Delete Edge',
          onClick: () => deleteEdge(edge.id),
          danger: true,
        });
      } else if (edgeData?.edgeType === 'constraint') {
        // NOT toggle: MASK targets=no, REQ source/targets=yes (store guards both-sides-NOT), symmetric=yes
        const canToggleNot = !(edgeData.isMask && edgeData.isDirectional && !edgeData.isSource);
        if (canToggleNot) {
          items.push({
            label: edgeData.negated ? 'Remove NOT' : 'Add NOT',
            onClick: () => toggleConstraintMemberNegation(edge.id),
          });
        }

        // Set as Source/Trigger (only for directional, only on non-source edges)
        if (edgeData.isDirectional && !edgeData.isSource) {
          const match = edge.id.match(/^cedge_(.+)_(\d+)$/);
          if (match) {
            const constraintId = match[1];
            const constraint = storeConstraints.find((c) => c.id === constraintId);
            if (constraint?.type === 'REQ') {
              items.push({
                label: 'Set as Source',
                onClick: () => {
                  setConstraintEdgeAsSource(edge.id);
                },
              });
            } else if (constraint?.type === 'MASK') {
              items.push({
                label: 'Set as Trigger',
                onClick: () => {
                  const notCleared = setConstraintEdgeAsSource(edge.id);
                  if (notCleared) {
                    window.alert('NOT was removed from the promoted trigger.\nUse Ctrl+Z to undo.');
                  }
                },
              });
            }
          }
        }

        // Delete Edge
        items.push({
          label: 'Delete Edge',
          onClick: () => deleteConstraintEdge(edge.id),
          danger: true,
        });
      }

      if (items.length > 0) {
        setContextMenu({ x: event.clientX, y: event.clientY, items });
      }
    },
    [toggleEdgeNegation, toggleConstraintMemberNegation, deleteEdge, storeConstraints, setConstraintEdgeAsSource, deleteConstraintEdge]
  );

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Don't delete if user is typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        // Delete selected nodes
        selectedNodes.forEach((nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.type === 'constraintNode') {
            const constraintId = (node.data as { constraintId?: string })?.constraintId;
            if (constraintId) {
              deleteConstraint(constraintId);
            }
          } else {
            deleteNode(nodeId);
          }
        });
        setSelectedNodes(new Set());

        // Delete selected edges (logical and constraint)
        selectedEdges.forEach((edgeId) => {
          const edge = edges.find((e) => e.id === edgeId);
          const edData = edge?.data as { edgeType?: string };
          if (edData?.edgeType === 'logical') {
            deleteEdge(edgeId);
          } else if (edData?.edgeType === 'constraint') {
            deleteConstraintEdge(edgeId);
          }
        });
        setSelectedEdges(new Set());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, selectedNodes, selectedEdges, deleteNode, deleteEdge, deleteConstraint, deleteConstraintEdge]);

  // MiniMap node color based on role or constraint type
  const nodeColor = useCallback((node: Node) => {
    if (node.type === 'constraintNode') {
      return '#757575'; // Gray for constraint nodes
    }
    const role = (node.data as { role?: NodeRole })?.role || 'cause';
    return NODE_COLORS[role].border;
  }, []);

  // Sync selected CEG node IDs (not constraint nodes) to store for toolbar
  const selectedCegNodeIds = useMemo(() =>
    Array.from(selectedNodes).filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node?.type === 'cegNode';
    }),
    [selectedNodes, nodes]
  );

  useEffect(() => {
    setStoreSelectedNodeIds(selectedCegNodeIds);
  }, [selectedCegNodeIds, setStoreSelectedNodeIds]);

  // Sync selected constraint node ID (single) to store for toolbar
  const selectedConstraintNodeId = useMemo(() => {
    const constraintIds = Array.from(selectedNodes).filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node?.type === 'constraintNode';
    });
    return constraintIds.length === 1 ? constraintIds[0] : null;
  }, [selectedNodes, nodes]);

  useEffect(() => {
    setStoreSelectedConstraintNodeId(selectedConstraintNodeId);
  }, [selectedConstraintNodeId, setStoreSelectedConstraintNodeId]);


  return (
    <div style={{ height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          connectionLineComponent={CustomConnectionLine}
          connectionRadius={5}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
        >
          <Background color="#aaa" gap={15} />
          <Controls />
          <MiniMap
            nodeColor={nodeColor}
            nodeStrokeWidth={3}
            nodeBorderRadius={4}
            maskColor="rgba(200, 200, 200, 0.6)"
            style={{ backgroundColor: '#f8f8f8' }}
            zoomable
            pannable
          />
        </ReactFlow>
      {/* Welcome panel */}
      {showWelcome && <WelcomePanel onClose={() => setShowWelcome(false)} />}
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

// Wrapper component to provide ReactFlowProvider context
import { ReactFlowProvider } from '@xyflow/react';

export default function GraphCanvas() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <GraphCanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
