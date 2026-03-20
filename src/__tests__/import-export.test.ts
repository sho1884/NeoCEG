/**
 * Test import/export round-trip
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { parseLogicalDSL } from '../services/logicalDslParser';
import { logicalToGraph, resetIdCounters, graphToLogical } from '../services/modelConverter';
import { serializeLogicalModel } from '../services/logicalDslSerializer';

const sampleDSL = `
# Causes
n1: "入力A"
n2: "入力B"
n3: "入力C"

# Effects
n4: "結果"
n4 := n1 AND n2 AND n3

n5: "エラー"
n5 := NOT n2 OR NOT n3
`;

// New format with proposition symbols
const newFormatDSL = `
# Propositions (命題)
p1: "ユーザーがログインボタンをクリック" [observable]
p2: "ネットワーク接続あり" [observable]
p3: "認証サーバー応答"
p4: "ログイン成功"
p5: "エラーメッセージ表示" [observable]

# Logical Relations (論理式)
p4 := p1 AND p2 AND p3
p5 := NOT p2 OR NOT p3

# Constraints
EXCL(p4, p5)
REQ(p1 -> p3)

@layout {
  p1: (100, 100)
  p2: (100, 220)
  p3: (100, 340)
  p4: (400, 170)
  p5: (400, 290)
}
`;

describe('Import/Export', () => {
  beforeEach(() => {
    resetIdCounters();
  });

  test('should parse DSL correctly', () => {
    const result = parseLogicalDSL(sampleDSL);
    console.log('Parse errors:', result.errors);
    console.log('Nodes:', Array.from(result.model.nodes.entries()));

    expect(result.success).toBe(true);
    expect(result.model.nodes.size).toBe(5);

    const n4 = result.model.nodes.get('n4');
    expect(n4?.expression).toBeDefined();
    console.log('n4 expression:', JSON.stringify(n4?.expression, null, 2));

    const n5 = result.model.nodes.get('n5');
    expect(n5?.expression).toBeDefined();
    console.log('n5 expression:', JSON.stringify(n5?.expression, null, 2));
  });

  test('should convert to graph with correct edges', () => {
    const result = parseLogicalDSL(sampleDSL);
    const graphData = logicalToGraph(result.model);

    console.log('Nodes:', graphData.nodes.map(n => ({ id: n.id, label: n.data.label })));
    console.log('Edges:', graphData.edges.map(e => ({
      source: e.source,
      target: e.target,
      negated: e.data.negated,
      type: e.data.edgeType
    })));

    // Should have 5 logical edges: n1->n4, n2->n4, n3->n4, n2->n5, n3->n5
    const logicalEdges = graphData.edges.filter(e => e.data.edgeType === 'logical');
    expect(logicalEdges.length).toBe(5);

    // Check n4 edges (3 non-negated)
    const n4Edges = logicalEdges.filter(e => e.target.includes('4'));
    expect(n4Edges.length).toBe(3);
    n4Edges.forEach(e => expect(e.data.negated).toBe(false));

    // Check n5 edges (2 negated)
    const n5Edges = logicalEdges.filter(e => e.target.includes('5'));
    expect(n5Edges.length).toBe(2);
    n5Edges.forEach(e => expect(e.data.negated).toBe(true));
  });

  test('should parse new format with proposition symbols', () => {
    resetIdCounters();
    const result = parseLogicalDSL(newFormatDSL);

    expect(result.success).toBe(true);
    expect(result.model.nodes.size).toBe(5);
    expect(result.model.constraints.length).toBe(2);

    // Check p4 expression (AND of 3)
    const p4 = result.model.nodes.get('p4');
    expect(p4?.expression?.type).toBe('and');

    // Check p5 expression (OR of 2 NOTs)
    const p5 = result.model.nodes.get('p5');
    expect(p5?.expression?.type).toBe('or');

    // Check positions from layout
    expect(result.model.nodes.get('p1')?.position).toEqual({ x: 100, y: 100 });
    expect(result.model.nodes.get('p4')?.position).toEqual({ x: 400, y: 170 });
  });

  test('should convert new format to graph with all edges', () => {
    resetIdCounters();
    const result = parseLogicalDSL(newFormatDSL);
    const graphData = logicalToGraph(result.model);

    // 5 logical edges: p1->p4, p2->p4, p3->p4, p2->p5 (negated), p3->p5 (negated)
    const logicalEdges = graphData.edges.filter(e => e.data.edgeType === 'logical');
    expect(logicalEdges.length).toBe(5);

    // 4 constraint edges: 2 for EXCL(p4, p5), 2 for REQ(p1 -> p3)
    const constraintEdges = graphData.edges.filter(e => e.data.edgeType === 'constraint');
    expect(constraintEdges.length).toBe(4);

    // Constraint nodes
    expect(graphData.constraintNodes.length).toBe(2);
    expect(graphData.constraints.length).toBe(2);
  });

  test('should round-trip: graph -> logical -> DSL -> parse -> graph', () => {
    resetIdCounters();

    // Parse original DSL
    const result1 = parseLogicalDSL(newFormatDSL);
    const graphData1 = logicalToGraph(result1.model);

    // Convert graph to logical model (for export)
    const logical2 = graphToLogical(graphData1);

    // Serialize to DSL
    const dsl2 = serializeLogicalModel(logical2, { includeComments: false, includeLayout: true });

    // Parse the serialized DSL
    resetIdCounters();
    const result3 = parseLogicalDSL(dsl2);
    const graphData3 = logicalToGraph(result3.model);

    // Verify node count preserved
    expect(graphData3.nodes.length).toBe(graphData1.nodes.length);

    // Verify edge count preserved
    const logicalEdges1 = graphData1.edges.filter(e => e.data.edgeType === 'logical');
    const logicalEdges3 = graphData3.edges.filter(e => e.data.edgeType === 'logical');
    expect(logicalEdges3.length).toBe(logicalEdges1.length);

    // Verify constraint count preserved
    expect(graphData3.constraints.length).toBe(graphData1.constraints.length);
  });
});
