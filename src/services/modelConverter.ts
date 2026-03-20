/**
 * Model Converter
 *
 * Converts between the graph representation (for React Flow UI)
 * and the logical representation (for DSL and evaluation).
 */

import type {
  CEGNode,
  CEGEdge,
  ConstraintNode,
  Constraint,
  ConstraintMember,
} from '../types/graph';

import type {
  LogicalModel,
  LogicalNode,
  LogicalConstraint,
  ConstraintMemberRef,
  Expression,
} from '../types/logical';

import { ref, not, and, or } from '../types/logical';
import { getNodeDisplayText } from '../utils/nodeDisplay';
import { useGraphStore } from '../stores/graphStore';

// =============================================================================
// Graph → Logical Model Conversion
// =============================================================================

export interface GraphData {
  nodes: CEGNode[];
  constraintNodes: ConstraintNode[];
  edges: CEGEdge[];
  constraints: Constraint[];
}

/**
 * Convert graph representation to logical model
 *
 * This extracts the logical structure from the visual graph.
 * Node names use proposition symbols (p1, p2, ...) for cleaner logical notation.
 */
export function graphToLogical(graph: GraphData): LogicalModel {
  const logicalNodes = new Map<string, LogicalNode>();

  // Map from node ID to proposition name (p1, p2, ...)
  const idToName = new Map<string, string>();
  let propCounter = 0;

  // First pass: Create all nodes with proposition names
  for (const node of graph.nodes) {
    const propName = `p${++propCounter}`;
    idToName.set(node.id, propName);

    logicalNodes.set(propName, {
      name: propName,
      label: node.data.label,
      position: node.position,
      width: node.data.width,
      observable: node.data.observable,
    });
  }

  // Second pass: Build expressions from edges
  // Group incoming edges by target node
  const incomingEdges = new Map<string, CEGEdge[]>();
  for (const edge of graph.edges) {
    if (edge.data.edgeType !== 'logical') continue;

    const existing = incomingEdges.get(edge.target) || [];
    existing.push(edge);
    incomingEdges.set(edge.target, existing);
  }

  // Build expression for each node with incoming edges
  for (const [targetId, edges] of incomingEdges) {
    const targetName = idToName.get(targetId);
    if (!targetName) continue;

    const node = logicalNodes.get(targetName);
    if (!node) continue;

    const targetGraphNode = graph.nodes.find((n) => n.id === targetId);
    const operator = targetGraphNode?.data.operator || 'AND';

    // Build operands from incoming edges (using proposition names)
    const operands: Expression[] = edges.map((edge) => {
      const sourceName = idToName.get(edge.source) || edge.source;
      const sourceRef = ref(sourceName);
      return edge.data.negated ? not(sourceRef) : sourceRef;
    });

    // Create expression based on operator
    if (operands.length === 1) {
      node.expression = operands[0];
    } else if (operator === 'AND') {
      node.expression = and(...operands);
    } else {
      node.expression = or(...operands);
    }
  }

  // Convert constraints (using idToName mapping)
  const logicalConstraints: LogicalConstraint[] = graph.constraints.map((c) =>
    convertConstraintWithNames(c, graph.constraintNodes, idToName)
  );

  return {
    nodes: logicalNodes,
    constraints: logicalConstraints,
  };
}

function convertConstraintWithNames(
  constraint: Constraint,
  constraintNodes: ConstraintNode[],
  idToName: Map<string, string>
): LogicalConstraint {
  // Find the constraint node for position
  const cnode = constraintNodes.find((cn) => cn.data.constraintId === constraint.id);
  const position = cnode?.position;

  const convertMember = (m: ConstraintMember): ConstraintMemberRef => ({
    name: idToName.get(m.nodeId) || m.nodeId,
    negated: m.negated,
  });

  switch (constraint.type) {
    case 'ONE':
      return {
        type: 'ONE',
        members: constraint.members.map(convertMember),
        position,
      };
    case 'EXCL':
      return {
        type: 'EXCL',
        members: constraint.members.map(convertMember),
        position,
      };
    case 'INCL':
      return {
        type: 'INCL',
        members: constraint.members.map(convertMember),
        position,
      };
    case 'REQ':
      return {
        type: 'REQ',
        source: convertMember(constraint.source),
        targets: constraint.targets.map(convertMember),
        position,
      };
    case 'MASK':
      return {
        type: 'MASK',
        trigger: convertMember(constraint.trigger),
        targets: constraint.targets.map(convertMember),
        position,
      };
  }
}

// =============================================================================
// Logical Model → Graph Conversion
// =============================================================================

let nodeIdCounter = 0;
let edgeIdCounter = 0;
let constraintIdCounter = 0;

/**
 * Reset ID counters (useful for testing or fresh imports)
 */
export function resetIdCounters(): void {
  nodeIdCounter = 0;
  edgeIdCounter = 0;
  constraintIdCounter = 0;
}

/**
 * Convert logical model to graph representation
 *
 * This creates the visual graph structure from the logical model.
 */
export function logicalToGraph(model: LogicalModel): GraphData {
  const nodes: CEGNode[] = [];
  const edges: CEGEdge[] = [];
  const constraintNodes: ConstraintNode[] = [];
  const constraints: Constraint[] = [];

  // Name → generated ID mapping
  const nameToId = new Map<string, string>();

  // Create nodes
  for (const [name, logicalNode] of model.nodes) {
    const id = `node_${++nodeIdCounter}`;
    nameToId.set(name, id);

    // Determine operator from expression
    let operator: 'AND' | 'OR' | undefined;
    if (logicalNode.expression) {
      if (logicalNode.expression.type === 'and') {
        operator = 'AND';
      } else if (logicalNode.expression.type === 'or') {
        operator = 'OR';
      } else if (logicalNode.expression.type === 'not' || logicalNode.expression.type === 'ref') {
        // Single input, default to AND
        operator = 'AND';
      }
    }

    nodes.push({
      id,
      type: 'cegNode',
      position: logicalNode.position || { x: 0, y: 0 },
      data: {
        label: getNodeDisplayText(logicalNode),
        operator,
        width: logicalNode.width,
        // Note: expressionText is NOT imported here - it's computed dynamically in GraphCanvas
        // using node labels instead of node names (n1, n2, etc.)
        observable: logicalNode.observable,
      },
    });
  }

  // Create edges from expressions
  for (const [name, logicalNode] of model.nodes) {
    if (!logicalNode.expression) continue;

    const targetId = nameToId.get(name)!;
    const edgeInfos = extractEdgesFromExpression(logicalNode.expression, nameToId);

    for (const edgeInfo of edgeInfos) {
      edges.push({
        id: `edge_${++edgeIdCounter}`,
        source: edgeInfo.sourceId,
        target: targetId,
        data: {
          edgeType: 'logical',
          negated: edgeInfo.negated,
        },
      });
    }
  }

  // Create constraints
  for (const logicalConstraint of model.constraints) {
    const constraintId = `constraint_${++constraintIdCounter}`;
    const constraintNodeId = `cnode_${constraintIdCounter}`;

    // Create constraint data
    const constraint = convertLogicalConstraint(logicalConstraint, constraintId, nameToId);
    constraints.push(constraint);

    // Create constraint node
    constraintNodes.push({
      id: constraintNodeId,
      type: 'constraintNode',
      position: logicalConstraint.position || { x: 200, y: 200 },
      data: {
        constraintType: logicalConstraint.type,
        constraintId,
      },
    });

    // Create constraint edges
    const members = getConstraintMembers(logicalConstraint);
    const isDirectional = logicalConstraint.type === 'REQ' || logicalConstraint.type === 'MASK';

    const constraintPos = logicalConstraint.position || { x: 200, y: 200 };
    members.forEach((member, index) => {
      const targetNodeId = nameToId.get(member.name);
      if (!targetNodeId) return;

      // Auto-select top/bottom handle based on relative position
      const cegNode = nodes.find((n) => n.id === targetNodeId);
      const tHandle = cegNode
        ? (constraintPos.y > cegNode.position.y ? 'constraint-bottom' : 'constraint')
        : 'constraint';

      edges.push({
        id: `cedge_${constraintId}_${index}`,
        source: constraintNodeId,
        target: targetNodeId,
        targetHandle: tHandle,
        data: {
          edgeType: 'constraint',
          negated: member.negated,
          isDirectional,
          isSource: isDirectional && index === 0,
          isMask: logicalConstraint.type === 'MASK',
        },
      });
    });
  }

  // Apply auto-layout if positions are missing
  applyAutoLayout(nodes, edges);

  return { nodes, constraintNodes, edges, constraints };
}

interface EdgeInfo {
  sourceId: string;
  negated: boolean;
}

/**
 * Extract edge information from an expression
 */
function extractEdgesFromExpression(
  expr: Expression,
  nameToId: Map<string, string>
): EdgeInfo[] {
  const edges: EdgeInfo[] = [];

  function extract(e: Expression, negated: boolean) {
    switch (e.type) {
      case 'ref': {
        const sourceId = nameToId.get(e.name);
        if (sourceId) {
          edges.push({ sourceId, negated });
        }
        break;
      }
      case 'not':
        extract(e.operand, !negated);
        break;
      case 'and':
      case 'or':
        // For compound expressions, extract from each operand
        e.operands.forEach((op) => extract(op, negated));
        break;
    }
  }

  extract(expr, false);
  return edges;
}

function convertLogicalConstraint(
  lc: LogicalConstraint,
  constraintId: string,
  nameToId: Map<string, string>
): Constraint {
  const convertMember = (m: ConstraintMemberRef): ConstraintMember => ({
    nodeId: nameToId.get(m.name) || m.name,
    negated: m.negated,
  });

  switch (lc.type) {
    case 'ONE':
      return {
        id: constraintId,
        type: 'ONE',
        members: lc.members.map(convertMember),
      };
    case 'EXCL':
      return {
        id: constraintId,
        type: 'EXCL',
        members: lc.members.map(convertMember),
      };
    case 'INCL':
      return {
        id: constraintId,
        type: 'INCL',
        members: lc.members.map(convertMember),
      };
    case 'REQ':
      return {
        id: constraintId,
        type: 'REQ',
        source: convertMember(lc.source),
        targets: lc.targets.map(convertMember),
      };
    case 'MASK':
      return {
        id: constraintId,
        type: 'MASK',
        trigger: convertMember(lc.trigger),
        targets: lc.targets.map(convertMember),
      };
  }
}

// =============================================================================
// Import: Apply LogicalModel to Store
// =============================================================================

/**
 * Clear the current graph and replace it with the given LogicalModel.
 * Shared by MainToolbar (file import) and DecisionTablePanel (paste import).
 */
export function applyLogicalModelToStore(model: LogicalModel): void {
  const state = useGraphStore.getState();

  state.clear();
  resetIdCounters();

  const graphData = logicalToGraph(model);
  const nameToId = new Map<string, string>();
  const logicalNodes = Array.from(model.nodes.values());

  for (let i = 0; i < graphData.nodes.length; i++) {
    const node = graphData.nodes[i];
    const logicalNode = logicalNodes[i];
    const name = logicalNode?.name || node.id;

    const actualId = state.addNode(node.data.label, node.position, node.data.operator);
    nameToId.set(name, actualId);
    nameToId.set(node.id, actualId);

    if (node.position.x !== 0 || node.position.y !== 0) {
      state.updateNodePosition(actualId, node.position);
    }
    if (node.data.observable !== undefined) {
      state.updateNode(actualId, { observable: node.data.observable });
    }
    if (node.data.width !== undefined) {
      state.updateNode(actualId, { width: node.data.width });
    }
  }

  for (const edge of graphData.edges) {
    if (edge.data.edgeType === 'logical') {
      const sourceId = nameToId.get(edge.source) || edge.source;
      const targetId = nameToId.get(edge.target) || edge.target;
      state.addEdge(sourceId, targetId, edge.data.negated);
    }
  }

  for (let i = 0; i < graphData.constraints.length; i++) {
    const constraint = graphData.constraints[i];
    const constraintNode = graphData.constraintNodes[i];

    const mapMember = (m: ConstraintMember): ConstraintMember => ({
      nodeId: nameToId.get(m.nodeId) || m.nodeId,
      negated: m.negated,
    });

    let members: ConstraintMember[] = [];
    switch (constraint.type) {
      case 'ONE':
      case 'EXCL':
      case 'INCL':
        members = constraint.members.map(mapMember);
        break;
      case 'REQ':
        members = [mapMember(constraint.source), ...constraint.targets.map(mapMember)];
        break;
      case 'MASK':
        members = [mapMember(constraint.trigger), ...constraint.targets.map(mapMember)];
        break;
    }

    let position = constraintNode?.position || { x: 200, y: 100 };
    if (!constraintNode?.position) {
      const memberPositions = members
        .map(m => {
          const nodeId = m.nodeId;
          const gNode = graphData.nodes.find(n => nameToId.get(n.id) === nodeId || n.id === nodeId);
          return gNode?.position;
        })
        .filter((p): p is { x: number; y: number } => p !== undefined);

      if (memberPositions.length > 0) {
        const avgX = memberPositions.reduce((sum, p) => sum + p.x, 0) / memberPositions.length;
        const avgY = memberPositions.reduce((sum, p) => sum + p.y, 0) / memberPositions.length;
        position = { x: avgX, y: avgY - 80 };
      }
    }

    state.addConstraint(constraint.type, members, position);
  }
}

function getConstraintMembers(lc: LogicalConstraint): ConstraintMemberRef[] {
  switch (lc.type) {
    case 'ONE':
    case 'EXCL':
    case 'INCL':
      return lc.members;
    case 'REQ':
      return [lc.source, ...lc.targets];
    case 'MASK':
      return [lc.trigger, ...lc.targets];
  }
}

/**
 * Apply simple auto-layout to nodes without positions
 */
function applyAutoLayout(nodes: CEGNode[], edges: CEGEdge[]): void {
  const needsLayout = nodes.filter((n) => n.position.x === 0 && n.position.y === 0);
  if (needsLayout.length === 0) return;

  // Determine node roles for layout
  const logicalEdges = edges.filter((e) => e.data.edgeType === 'logical');
  const hasIncoming = new Set(logicalEdges.map((e) => e.target));
  const hasOutgoing = new Set(logicalEdges.map((e) => e.source));

  // Categorize nodes
  const causes: CEGNode[] = [];
  const effects: CEGNode[] = [];
  const intermediates: CEGNode[] = [];

  for (const node of needsLayout) {
    const incoming = hasIncoming.has(node.id);
    const outgoing = hasOutgoing.has(node.id);

    if (!incoming) {
      causes.push(node);
    } else if (!outgoing) {
      effects.push(node);
    } else {
      intermediates.push(node);
    }
  }

  // Layout: causes on left, effects on right, intermediates in middle
  const spacing = { x: 250, y: 100 };
  const startX = 100;
  const startY = 100;

  causes.forEach((node, i) => {
    node.position = { x: startX, y: startY + i * spacing.y };
  });

  intermediates.forEach((node, i) => {
    node.position = { x: startX + spacing.x, y: startY + i * spacing.y };
  });

  effects.forEach((node, i) => {
    node.position = { x: startX + spacing.x * 2, y: startY + i * spacing.y };
  });
}
