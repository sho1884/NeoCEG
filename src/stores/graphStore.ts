/**
 * Graph State Store using Zustand
 * Manages CEG nodes, edges, and constraints
 * Manual undo/redo implementation (50 history states)
 */

import { create } from 'zustand';
import type {
  CEGNode,
  CEGEdge,
  ConstraintNode,
  Constraint,
  ConstraintType,
  ConstraintMember,
  CEGNodeData,
  LogicalOperator,
  NodeRole,
} from '../types/graph';

// Snapshot of tracked state for undo/redo
interface HistorySnapshot {
  nodes: CEGNode[];
  constraintNodes: ConstraintNode[];
  edges: CEGEdge[];
  constraints: Constraint[];
}

interface GraphStore extends HistorySnapshot {
  // Undo/redo state
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Selection state (UI-only, not tracked by undo/redo)
  selectedNodeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  selectedConstraintNodeId: string | null;
  setSelectedConstraintNodeId: (id: string | null) => void;

  // Node actions
  addNode: (label: string, position: { x: number; y: number }, operator?: LogicalOperator) => string;
  updateNode: (id: string, data: Partial<CEGNodeData>) => void;
  deleteNode: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;

  // Edge actions
  addEdge: (source: string, target: string, negated?: boolean) => string;
  toggleEdgeNegation: (id: string) => void;
  deleteEdge: (id: string) => void;

  // Constraint actions
  addConstraint: (
    type: ConstraintType,
    members: ConstraintMember[],
    position: { x: number; y: number }
  ) => string;
  addConstraintEdge: (constraintNodeId: string, targetNodeId: string, targetHandle?: string) => string | null;
  deleteConstraint: (constraintId: string) => void;
  toggleConstraintMemberNegation: (edgeId: string) => void;
  updateConstraintNodePosition: (id: string, position: { x: number; y: number }) => void;
  changeConstraintType: (constraintId: string, newType: ConstraintType) => void;
  setConstraintEdgeAsSource: (edgeId: string) => boolean;
  deleteConstraintEdge: (edgeId: string) => void;

  // Viewport
  getViewportTopLeft: () => { x: number; y: number };
  setViewportTopLeftGetter: (fn: () => { x: number; y: number }) => void;

  // Utility
  getNodeRole: (nodeId: string) => NodeRole;
  getConstraintEdges: () => CEGEdge[];
  clear: () => void;
}

// History management (module-level, outside store to avoid triggering selectors)
const HISTORY_LIMIT = 50;
const _past: HistorySnapshot[] = [];
const _future: HistorySnapshot[] = [];

function _captureSnapshot(state: GraphStore): HistorySnapshot {
  return {
    nodes: state.nodes,
    constraintNodes: state.constraintNodes,
    edges: state.edges,
    constraints: state.constraints,
  };
}

let nodeIdCounter = 0;
let edgeIdCounter = 0;
let constraintIdCounter = 0;
let nodeNameCounter = 0;

const generateNodeId = () => `node_${++nodeIdCounter}`;
const generateEdgeId = () => `edge_${++edgeIdCounter}`;
const generateConstraintId = () => `constraint_${++constraintIdCounter}`;
const generateConstraintNodeId = () => `cnode_${constraintIdCounter}`;

export const generateDefaultNodeName = () => `Logical Statement ${++nodeNameCounter}`;

export const useGraphStore = create<GraphStore>()(
  (set, get) => {
    // Push current state to undo history (call before each tracked mutation)
    const pushHistory = () => {
      const snapshot = _captureSnapshot(get());
      _past.push(snapshot);
      if (_past.length > HISTORY_LIMIT) _past.shift();
      _future.length = 0; // Clear redo stack on new action
    };

    // Select constraint handle on CEG node that gives shortest edge
    const selectConstraintTargetHandle = (
      constraintPos: { x: number; y: number },
      cegPos: { x: number; y: number },
      cegWidth?: number,
      cegHeight?: number,
    ): string => {
      const w = cegWidth ?? 150;
      const h = cegHeight ?? 36;
      // Handle positions: center of each side
      const handles: { id: string; x: number; y: number }[] = [
        { id: 'constraint', x: cegPos.x + w / 2, y: cegPos.y },           // top
        { id: 'constraint-bottom', x: cegPos.x + w / 2, y: cegPos.y + h }, // bottom
        { id: 'constraint-left', x: cegPos.x, y: cegPos.y + h / 2 - 8 },   // left (8px above center)
        { id: 'constraint-right', x: cegPos.x + w, y: cegPos.y + h / 2 + 8 }, // right (8px below center)
      ];
      const cx = constraintPos.x;
      const cy = constraintPos.y;
      let best = handles[0];
      let bestDist = Infinity;
      for (const handle of handles) {
        const dx = handle.x - cx;
        const dy = handle.y - cy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = handle;
        }
      }
      return best.id;
    };

    // Recalculate targetHandle for all constraint edges based on current positions
    const recalcConstraintTargetHandles = (
      edges: CEGEdge[],
      nodes: CEGNode[],
      constraintNodes: ConstraintNode[],
    ): CEGEdge[] => {
      return edges.map((edge) => {
        if (edge.data.edgeType !== 'constraint') return edge;
        const cnode = constraintNodes.find((cn) => cn.id === edge.source);
        const cegNode = nodes.find((n) => n.id === edge.target);
        if (!cnode || !cegNode) return edge;
        const cegWidth = cegNode.data.width ?? 150;
        const tHandle = selectConstraintTargetHandle(cnode.position, cegNode.position, cegWidth);
        if (edge.targetHandle === tHandle) return edge;
        return { ...edge, targetHandle: tHandle };
      });
    };

    return {
      nodes: [],
      constraintNodes: [],
      edges: [],
      constraints: [],

      // Undo/redo state (in store so selectors trigger re-renders)
      canUndo: false,
      canRedo: false,

      undo: () => {
        if (_past.length === 0) return;
        const snapshot = _captureSnapshot(get());
        _future.push(snapshot);
        const prev = _past.pop()!;
        set({
          ...prev,
          canUndo: _past.length > 0,
          canRedo: true,
        });
      },

      redo: () => {
        if (_future.length === 0) return;
        const snapshot = _captureSnapshot(get());
        _past.push(snapshot);
        const next = _future.pop()!;
        set({
          ...next,
          canUndo: true,
          canRedo: _future.length > 0,
        });
      },

      // Selection (UI state, not tracked)
      selectedNodeIds: [],
      setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
      selectedConstraintNodeId: null,
      setSelectedConstraintNodeId: (id) => set({ selectedConstraintNodeId: id }),

      addNode: (label, position, operator) => {
        pushHistory();
        const id = generateNodeId();
        const newNode: CEGNode = {
          id,
          type: 'cegNode',
          position,
          data: {
            label,
            operator,
            observable: true,
          },
        };
        set((state) => ({
          nodes: [...state.nodes, newNode],
          canUndo: true,
          canRedo: false,
        }));
        return id;
      },

      updateNode: (id, data) => {
        pushHistory();
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
          canUndo: true,
          canRedo: false,
        }));
      },

      deleteNode: (id) => {
        pushHistory();
        set((state) => {
          const newNodes = state.nodes.filter((node) => node.id !== id);
          const newEdges = state.edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          );

          // Cascade: update or delete constraints referencing the deleted node
          const constraintsToDelete: string[] = [];
          const updatedConstraints: Constraint[] = [];

          for (const constraint of state.constraints) {
            if (constraint.type === 'ONE' || constraint.type === 'EXCL' || constraint.type === 'INCL') {
              const newMembers = constraint.members.filter((m) => m.nodeId !== id);
              if (newMembers.length === constraint.members.length) {
                updatedConstraints.push(constraint);
              } else if (newMembers.length >= 2) {
                updatedConstraints.push({ ...constraint, members: newMembers });
              } else {
                constraintsToDelete.push(constraint.id);
              }
            } else if (constraint.type === 'REQ') {
              if (constraint.source.nodeId === id) {
                constraintsToDelete.push(constraint.id);
              } else {
                const newTargets = constraint.targets.filter((t) => t.nodeId !== id);
                if (newTargets.length === constraint.targets.length) {
                  updatedConstraints.push(constraint);
                } else if (newTargets.length > 0) {
                  updatedConstraints.push({ ...constraint, targets: newTargets });
                } else {
                  constraintsToDelete.push(constraint.id);
                }
              }
            } else if (constraint.type === 'MASK') {
              if (constraint.trigger.nodeId === id) {
                constraintsToDelete.push(constraint.id);
              } else {
                const newTargets = constraint.targets.filter((t) => t.nodeId !== id);
                if (newTargets.length === constraint.targets.length) {
                  updatedConstraints.push(constraint);
                } else if (newTargets.length > 0) {
                  updatedConstraints.push({ ...constraint, targets: newTargets });
                } else {
                  constraintsToDelete.push(constraint.id);
                }
              }
            }
          }

          const newConstraintNodes = state.constraintNodes.filter(
            (cn) => !constraintsToDelete.includes(cn.data.constraintId)
          );
          const finalEdges = newEdges.filter((e) => {
            for (const cid of constraintsToDelete) {
              if (e.id.startsWith(`cedge_${cid}_`)) return false;
            }
            return true;
          });

          return {
            nodes: newNodes,
            constraintNodes: newConstraintNodes,
            edges: finalEdges,
            constraints: updatedConstraints,
            canUndo: true,
            canRedo: false,
          };
        });
      },

      updateNodePosition: (id, position) => {
        pushHistory();
        set((state) => {
          const updatedNodes = state.nodes.map((node) =>
            node.id === id ? { ...node, position } : node
          );
          return {
            nodes: updatedNodes,
            edges: recalcConstraintTargetHandles(state.edges, updatedNodes, state.constraintNodes),
            canUndo: true,
            canRedo: false,
          };
        });
      },

      addEdge: (source, target, negated = false) => {
        pushHistory();
        const id = generateEdgeId();
        const newEdge: CEGEdge = {
          id,
          source,
          target,
          sourceHandle: 'logical-out',
          targetHandle: 'logical-in',
          data: {
            edgeType: 'logical',
            negated,
          },
        };
        set((state) => {
          const targetNode = state.nodes.find((n) => n.id === target);
          const targetHadIncoming = state.edges.some(
            (e) => e.target === target && e.data.edgeType === 'logical'
          );

          const updatedNodes = !targetHadIncoming && targetNode && !targetNode.data.operator
            ? state.nodes.map((node) =>
                node.id === target
                  ? { ...node, data: { ...node.data, operator: 'AND' as const } }
                  : node
              )
            : state.nodes;

          return {
            edges: [...state.edges, newEdge],
            nodes: updatedNodes,
            canUndo: true,
            canRedo: false,
          };
        });
        return id;
      },

      toggleEdgeNegation: (id) => {
        pushHistory();
        set((state) => ({
          edges: state.edges.map((edge) =>
            edge.id === id
              ? { ...edge, data: { ...edge.data, negated: !edge.data.negated } }
              : edge
          ),
          canUndo: true,
          canRedo: false,
        }));
      },

      deleteEdge: (id) => {
        pushHistory();
        set((state) => {
          const edgeToDelete = state.edges.find((e) => e.id === id);
          if (!edgeToDelete || edgeToDelete.data.edgeType !== 'logical') {
            return {
              edges: state.edges.filter((edge) => edge.id !== id),
              canUndo: true,
              canRedo: false,
            };
          }

          const newEdges = state.edges.filter((edge) => edge.id !== id);
          const target = edgeToDelete.target;

          const willHaveNoIncoming = !newEdges.some(
            (e) => e.target === target && e.data.edgeType === 'logical'
          );

          const updatedNodes = willHaveNoIncoming
            ? state.nodes.map((node) =>
                node.id === target
                  ? { ...node, data: { ...node.data, operator: undefined } }
                  : node
              )
            : state.nodes;

          return {
            edges: newEdges,
            nodes: updatedNodes,
            canUndo: true,
            canRedo: false,
          };
        });
      },

      getViewportTopLeft: () => ({ x: 0, y: 0 }),
      setViewportTopLeftGetter: (fn) => {
        set({ getViewportTopLeft: fn });
      },

      getNodeRole: (nodeId) => {
        const { edges } = get();
        const hasIncoming = edges.some((e) => e.target === nodeId && e.data.edgeType === 'logical');
        const hasOutgoing = edges.some((e) => e.source === nodeId && e.data.edgeType === 'logical');

        if (!hasIncoming) return 'cause';
        if (!hasOutgoing) return 'effect';
        return 'intermediate';
      },

      addConstraint: (type, members, position) => {
        pushHistory();
        const constraintId = generateConstraintId();
        const constraintNodeId = generateConstraintNodeId();

        let constraint: Constraint;
        if (type === 'REQ' || type === 'MASK') {
          if (members.length === 0) {
            // Unconnected constraint node
            if (type === 'REQ') {
              constraint = { id: constraintId, type: 'REQ', source: { nodeId: '', negated: false }, targets: [] };
            } else {
              constraint = { id: constraintId, type: 'MASK', trigger: { nodeId: '', negated: false }, targets: [] };
            }
          } else {
            const [first, ...targets] = members;
            if (type === 'REQ') {
              // REQ: preserve negation on source and targets (caller ensures not both)
              constraint = { id: constraintId, type: 'REQ', source: first, targets };
            } else {
              // MASK: trigger preserves negation; targets cleared
              const cleanTargets = targets.map(t => t.negated ? { ...t, negated: false } : t);
              constraint = { id: constraintId, type: 'MASK', trigger: first, targets: cleanTargets };
            }
          }
        } else {
          constraint = {
            id: constraintId,
            type,
            members,
          } as Constraint;
        }

        const constraintNode: ConstraintNode = {
          id: constraintNodeId,
          type: 'constraintNode',
          position,
          data: {
            constraintType: type,
            constraintId,
          },
        };

        const isDirectional = type === 'REQ' || type === 'MASK';
        const state = get();
        const newEdges: CEGEdge[] = members.map((member, index) => {
          const cegNode = state.nodes.find((n) => n.id === member.nodeId);
          const tHandle = cegNode
            ? selectConstraintTargetHandle(position, cegNode.position, cegNode.data.width)
            : 'constraint';
          const isSrc = isDirectional && index === 0;
          return {
            id: `cedge_${constraintId}_${index}`,
            source: constraintNodeId,
            target: member.nodeId,
            targetHandle: tHandle,
            data: {
              edgeType: 'constraint' as const,
              negated: member.negated,
              isDirectional,
              isSource: isSrc,
              isMask: type === 'MASK',
            },
          };
        });

        set((s) => ({
          constraints: [...s.constraints, constraint],
          constraintNodes: [...s.constraintNodes, constraintNode],
          edges: [...s.edges, ...newEdges],
          canUndo: true,
          canRedo: false,
        }));

        return constraintId;
      },

      addConstraintEdge: (constraintNodeId, targetNodeId, explicitTargetHandle?) => {
        const state = get();
        const constraintNode = state.constraintNodes.find((cn) => cn.id === constraintNodeId);
        if (!constraintNode) return null;

        const constraintId = constraintNode.data.constraintId;
        const constraint = state.constraints.find((c) => c.id === constraintId);
        if (!constraint) return null;

        const existingEdges = state.edges.filter((e) => e.id.startsWith(`cedge_${constraintId}_`));
        const isAlreadyMember = existingEdges.some((e) => e.target === targetNodeId);
        if (isAlreadyMember) return null;

        pushHistory();
        const newIndex = existingEdges.length;
        const edgeId = `cedge_${constraintId}_${newIndex}`;
        const isDirectional = constraint.type === 'REQ' || constraint.type === 'MASK';

        // Use explicit handle from drag, or auto-select based on position
        const tHandle = explicitTargetHandle
          ?? (() => {
            const cegNode = state.nodes.find((n) => n.id === targetNodeId);
            return cegNode
              ? selectConstraintTargetHandle(constraintNode.position, cegNode.position, cegNode.data.width)
              : 'constraint';
          })();

        // For REQ/MASK: if source/trigger is empty, first connection becomes source
        const shouldBeSource = isDirectional && (
          (constraint.type === 'REQ' && constraint.source.nodeId === '') ||
          (constraint.type === 'MASK' && constraint.trigger.nodeId === '')
        );

        const newEdge: CEGEdge = {
          id: edgeId,
          source: constraintNodeId,
          target: targetNodeId,
          targetHandle: tHandle,
          data: {
            edgeType: 'constraint',
            negated: false,
            isDirectional,
            isSource: shouldBeSource,
            isMask: constraint.type === 'MASK',
          },
        };

        const newMember: ConstraintMember = { nodeId: targetNodeId, negated: false };

        set((state) => {
          const updatedConstraints = state.constraints.map((c) => {
            if (c.id !== constraintId) return c;

            if (c.type === 'REQ') {
              if (shouldBeSource) {
                return { ...c, source: newMember };
              }
              return { ...c, targets: [...c.targets, newMember] };
            } else if (c.type === 'MASK') {
              if (shouldBeSource) {
                return { ...c, trigger: newMember };
              }
              return { ...c, targets: [...c.targets, newMember] };
            } else {
              const sym = c as { members: ConstraintMember[] } & typeof c;
              return { ...c, members: [...sym.members, newMember] };
            }
          });

          return {
            edges: [...state.edges, newEdge],
            constraints: updatedConstraints,
            canUndo: true,
            canRedo: false,
          };
        });

        return edgeId;
      },

      deleteConstraint: (constraintId) => {
        pushHistory();
        set((state) => {
          const constraintNode = state.constraintNodes.find(
            (cn) => cn.data.constraintId === constraintId
          );
          if (!constraintNode) return state;

          return {
            constraints: state.constraints.filter((c) => c.id !== constraintId),
            constraintNodes: state.constraintNodes.filter(
              (cn) => cn.data.constraintId !== constraintId
            ),
            edges: state.edges.filter(
              (e) => !e.id.startsWith(`cedge_${constraintId}_`)
            ),
            canUndo: true,
            canRedo: false,
          };
        });
      },

      toggleConstraintMemberNegation: (edgeId) => {
        const state = get();
        const edge = state.edges.find((e) => e.id === edgeId);
        if (!edge || edge.data.edgeType !== 'constraint') return;

        const match = edgeId.match(/^cedge_(.+)_(\d+)$/);
        if (!match) return;

        const constraintId = match[1];
        const memberIndex = parseInt(match[2], 10);

        // Block NOT toggle based on constraint type:
        // - MASK: trigger (index 0) only, targets prohibited
        // - REQ: source or targets (not both simultaneously)
        const constraint = state.constraints.find((c) => c.id === constraintId);
        if (constraint) {
          if (constraint.type === 'MASK' && memberIndex !== 0) return;
          if (constraint.type === 'REQ') {
            const isTogglingSource = memberIndex === 0;
            if (isTogglingSource) {
              // Block if any target already has NOT
              if (constraint.targets.some(t => t.negated)) return;
            } else {
              // Block if source already has NOT
              if (constraint.source.negated) return;
            }
          }
        }

        pushHistory();
        set((state) => {
          const updatedEdges = state.edges.map((e) =>
            e.id === edgeId && e.data.edgeType === 'constraint'
              ? { ...e, data: { ...e.data, negated: !e.data.negated } }
              : e
          );

          const updatedConstraints = state.constraints.map((constraint) => {
            if (constraint.id !== constraintId) return constraint;

            if (constraint.type === 'REQ') {
              if (memberIndex === 0) {
                // Toggle NOT on source
                return { ...constraint, source: { ...constraint.source, negated: !constraint.source.negated } };
              }
              const newTargets = [...constraint.targets];
              newTargets[memberIndex - 1] = {
                ...newTargets[memberIndex - 1],
                negated: !newTargets[memberIndex - 1].negated,
              };
              return { ...constraint, targets: newTargets };
            } else if (constraint.type === 'MASK') {
              if (memberIndex === 0) {
                // Toggle NOT on trigger
                return { ...constraint, trigger: { ...constraint.trigger, negated: !constraint.trigger.negated } };
              }
              const newTargets = [...constraint.targets];
              newTargets[memberIndex - 1] = {
                ...newTargets[memberIndex - 1],
                negated: !newTargets[memberIndex - 1].negated,
              };
              return { ...constraint, targets: newTargets };
            } else {
              const c = constraint as { members: ConstraintMember[] } & typeof constraint;
              const newMembers = [...c.members];
              newMembers[memberIndex] = {
                ...newMembers[memberIndex],
                negated: !newMembers[memberIndex].negated,
              };
              return { ...constraint, members: newMembers };
            }
          });

          return { edges: updatedEdges, constraints: updatedConstraints, canUndo: true, canRedo: false };
        });
      },

      updateConstraintNodePosition: (id, position) => {
        pushHistory();
        set((state) => {
          const updatedConstraintNodes = state.constraintNodes.map((node) =>
            node.id === id ? { ...node, position } : node
          );
          return {
            constraintNodes: updatedConstraintNodes,
            edges: recalcConstraintTargetHandles(state.edges, state.nodes, updatedConstraintNodes),
            canUndo: true,
            canRedo: false,
          };
        });
      },

      changeConstraintType: (constraintId, newType) => {
        const state = get();
        const constraint = state.constraints.find((c) => c.id === constraintId);
        if (!constraint || constraint.type === newType) return;

        pushHistory();

        // Extract all members in order
        let allMembers: ConstraintMember[];
        if (constraint.type === 'REQ') {
          allMembers = [constraint.source, ...constraint.targets];
        } else if (constraint.type === 'MASK') {
          allMembers = [constraint.trigger, ...constraint.targets];
        } else {
          allMembers = (constraint as { members: ConstraintMember[] } & typeof constraint).members;
        }

        // Build new constraint
        const isNewDirectional = newType === 'REQ' || newType === 'MASK';
        let newConstraint: Constraint;

        if (isNewDirectional) {
          const [first, ...rest] = allMembers;
          if (newType === 'REQ') {
            // REQ: preserve negation, but clear if both sides have NOT
            const source = first ?? { nodeId: '', negated: false };
            const hasTargetNot = rest.some(t => t.negated);
            const targets = (source.negated && hasTargetNot)
              ? rest.map(t => t.negated ? { ...t, negated: false } : t)
              : rest;
            newConstraint = {
              id: constraintId,
              type: 'REQ',
              source,
              targets,
            };
          } else {
            // MASK trigger: NOT allowed; targets: NOT prohibited
            const trigger = first ?? { nodeId: '', negated: false };
            const maskCleanTargets = rest.map(t => t.negated ? { ...t, negated: false } : t);
            newConstraint = {
              id: constraintId,
              type: 'MASK',
              trigger,
              targets: maskCleanTargets,
            };
          }
        } else {
          newConstraint = {
            id: constraintId,
            type: newType,
            members: allMembers,
          } as Constraint;
        }

        // Find constraint node
        const cnode = state.constraintNodes.find(
          (cn) => cn.data.constraintId === constraintId
        );
        if (!cnode) return;

        // Rebuild edges with correct flags
        const remainingEdges = state.edges.filter(
          (e) => !e.id.startsWith(`cedge_${constraintId}_`)
        );
        const newEdges: CEGEdge[] = allMembers
          .filter((m) => m.nodeId !== '')
          .map((member, index) => {
            const cegNode = state.nodes.find((n) => n.id === member.nodeId);
            const tHandle = cegNode
              ? selectConstraintTargetHandle(cnode.position, cegNode.position, cegNode.data.width)
              : 'constraint';
            const isSrc = isNewDirectional && index === 0;
            const isMask = newType === 'MASK';
            return {
              id: `cedge_${constraintId}_${index}`,
              source: cnode.id,
              target: member.nodeId,
              targetHandle: tHandle,
              data: {
                edgeType: 'constraint' as const,
                negated: isSrc ? member.negated : (isMask ? false : member.negated),
                isDirectional: isNewDirectional,
                isSource: isSrc,
                isMask,
              },
            };
          });

        set({
          constraints: state.constraints.map((c) =>
            c.id === constraintId ? newConstraint : c
          ),
          constraintNodes: state.constraintNodes.map((cn) =>
            cn.data.constraintId === constraintId
              ? { ...cn, data: { ...cn.data, constraintType: newType } }
              : cn
          ),
          edges: [...remainingEdges, ...newEdges],
          canUndo: true,
          canRedo: false,
        });
      },

      setConstraintEdgeAsSource: (edgeId) => {
        const state = get();
        const match = edgeId.match(/^cedge_(.+)_(\d+)$/);
        if (!match) return false;

        const constraintId = match[1];
        const memberIndex = parseInt(match[2], 10);
        const constraint = state.constraints.find((c) => c.id === constraintId);
        if (!constraint) return false;
        if (constraint.type !== 'REQ' && constraint.type !== 'MASK') return false;
        if (memberIndex === 0) return false; // Already source/trigger

        pushHistory();

        // Get all members in order
        let allMembers: ConstraintMember[];
        if (constraint.type === 'REQ') {
          allMembers = [constraint.source, ...constraint.targets];
        } else {
          allMembers = [constraint.trigger, ...constraint.targets];
        }

        // Swap: move memberIndex to position 0
        const newMembers = [...allMembers];
        const promoted = newMembers[memberIndex];
        newMembers[memberIndex] = newMembers[0];
        newMembers[0] = promoted;

        // Rebuild constraint
        const [first, ...rest] = newMembers;
        let notCleared = false;
        let newConstraint: Constraint;
        if (constraint.type === 'REQ') {
          // REQ: both sides NOT not allowed simultaneously
          // If new source has NOT and any target has NOT, clear target NOTs
          const hasTargetNot = rest.some(t => t.negated);
          const targets = (first.negated && hasTargetNot)
            ? rest.map(t => { if (t.negated) { notCleared = true; return { ...t, negated: false }; } return t; })
            : rest;
          newConstraint = { id: constraintId, type: 'REQ', source: first, targets };
        } else {
          // MASK trigger: NOT allowed, preserve negation; targets: NOT prohibited
          const cleanTargets = rest.map(t => {
            if (t.negated) { notCleared = true; return { ...t, negated: false }; }
            return t;
          });
          newConstraint = { id: constraintId, type: 'MASK', trigger: first, targets: cleanTargets };
        }

        // Rebuild edges
        const cnode = state.constraintNodes.find(
          (cn) => cn.data.constraintId === constraintId
        );
        if (!cnode) return false;

        const remainingEdges = state.edges.filter(
          (e) => !e.id.startsWith(`cedge_${constraintId}_`)
        );
        const isMask = constraint.type === 'MASK';
        const newEdges: CEGEdge[] = newMembers.map((member, index) => {
          const cegNode = state.nodes.find((n) => n.id === member.nodeId);
          const tHandle = cegNode
            ? selectConstraintTargetHandle(cnode.position, cegNode.position, cegNode.data.width)
            : 'constraint';
          const isSource = index === 0;
          return {
            id: `cedge_${constraintId}_${index}`,
            source: cnode.id,
            target: member.nodeId,
            targetHandle: tHandle,
            data: {
              edgeType: 'constraint' as const,
              negated: isMask ? (isSource ? member.negated : false) : member.negated,
              isDirectional: true,
              isSource,
              isMask,
            },
          };
        });

        set({
          constraints: state.constraints.map((c) =>
            c.id === constraintId ? newConstraint : c
          ),
          edges: [...remainingEdges, ...newEdges],
          canUndo: true,
          canRedo: false,
        });

        return notCleared;
      },

      deleteConstraintEdge: (edgeId) => {
        const state = get();
        const match = edgeId.match(/^cedge_(.+)_(\d+)$/);
        if (!match) return;

        const constraintId = match[1];
        const memberIndex = parseInt(match[2], 10);
        const constraint = state.constraints.find((c) => c.id === constraintId);
        if (!constraint) return;

        pushHistory();

        // Get all members
        let allMembers: ConstraintMember[];
        if (constraint.type === 'REQ') {
          allMembers = [constraint.source, ...constraint.targets];
        } else if (constraint.type === 'MASK') {
          allMembers = [constraint.trigger, ...constraint.targets];
        } else {
          allMembers = (constraint as { members: ConstraintMember[] } & typeof constraint).members;
        }

        // Remove the member at memberIndex
        const newAllMembers = allMembers.filter((_, i) => i !== memberIndex);
        const isDirectional = constraint.type === 'REQ' || constraint.type === 'MASK';

        let newConstraint: Constraint;
        if (isDirectional) {
          if (newAllMembers.length === 0) {
            if (constraint.type === 'REQ') {
              newConstraint = { id: constraintId, type: 'REQ', source: { nodeId: '', negated: false }, targets: [] };
            } else {
              newConstraint = { id: constraintId, type: 'MASK', trigger: { nodeId: '', negated: false }, targets: [] };
            }
          } else {
            const [first, ...rest] = newAllMembers;
            if (constraint.type === 'REQ') {
              // REQ source: NOT allowed, preserve negation
              newConstraint = { id: constraintId, type: 'REQ', source: first, targets: rest };
            } else {
              // MASK trigger: NOT allowed, preserve negation
              newConstraint = { id: constraintId, type: 'MASK', trigger: first, targets: rest };
            }
          }
        } else {
          newConstraint = { id: constraintId, type: constraint.type, members: newAllMembers } as Constraint;
        }

        // Rebuild edges
        const cnode = state.constraintNodes.find(
          (cn) => cn.data.constraintId === constraintId
        );
        if (!cnode) return;

        const remainingEdges = state.edges.filter(
          (e) => !e.id.startsWith(`cedge_${constraintId}_`)
        );
        const newEdges: CEGEdge[] = newAllMembers
          .filter((m) => m.nodeId !== '')
          .map((member, index) => {
            const cegNode = state.nodes.find((n) => n.id === member.nodeId);
            const tHandle = cegNode
              ? selectConstraintTargetHandle(cnode.position, cegNode.position, cegNode.data.width)
              : 'constraint';
            const isSrc = isDirectional && index === 0;
            const isMask = constraint.type === 'MASK';
            return {
              id: `cedge_${constraintId}_${index}`,
              source: cnode.id,
              target: member.nodeId,
              targetHandle: tHandle,
              data: {
                edgeType: 'constraint' as const,
                negated: (isMask && !isSrc) ? false : member.negated,
                isDirectional,
                isSource: isSrc,
                isMask,
              },
            };
          });

        set({
          constraints: state.constraints.map((c) =>
            c.id === constraintId ? newConstraint : c
          ),
          edges: [...remainingEdges, ...newEdges],
          canUndo: true,
          canRedo: false,
        });
      },

      getConstraintEdges: () => {
        return get().edges.filter((e) => e.data.edgeType === 'constraint');
      },

      clear: () => {
        // Clear history when clearing the graph
        _past.length = 0;
        _future.length = 0;
        nodeIdCounter = 0;
        edgeIdCounter = 0;
        constraintIdCounter = 0;
        nodeNameCounter = 0;
        set({
          nodes: [],
          constraintNodes: [],
          edges: [],
          constraints: [],
          canUndo: false,
          canRedo: false,
        });
      },
    };
  }
);
