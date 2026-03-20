/**
 * Tests for Logical DSL Parser and Serializer
 */

import { describe, it, expect } from 'vitest';
import { parseLogicalDSL } from '../services/logicalDslParser';
import { serializeLogicalModel } from '../services/logicalDslSerializer';
import { graphToLogical, logicalToGraph } from '../services/modelConverter';
import { getNodeDisplayText, getNodeExpressionText, hasUserLabel } from '../utils/nodeDisplay';
import { ref, and, not } from '../types/logical';

describe('Logical DSL Parser', () => {
  it('should parse cause definitions', () => {
    const input = `
n1: "入力A"
n2: "入力B"
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.model.nodes.size).toBe(2);

    const n1 = result.model.nodes.get('n1');
    expect(n1?.name).toBe('n1');
    expect(n1?.label).toBe('入力A');
    expect(n1?.expression).toBeUndefined(); // Cause has no expression

    const n2 = result.model.nodes.get('n2');
    expect(n2?.name).toBe('n2');
    expect(n2?.label).toBe('入力B');
  });

  it('should parse effect definitions with AND', () => {
    const input = `
n1: "入力A"
n2: "入力B"
n3 := n1 AND n2
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.nodes.size).toBe(3);

    const n3 = result.model.nodes.get('n3');
    expect(n3?.expression).toBeDefined();
    expect(n3?.expression?.type).toBe('and');
    if (n3?.expression?.type === 'and') {
      expect(n3.expression.operands).toHaveLength(2);
    }
  });

  it('should parse effect definitions with OR', () => {
    const input = `
n1: "入力A"
n2: "入力B"
n3 := n1 OR n2
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    const n3 = result.model.nodes.get('n3');
    expect(n3?.expression?.type).toBe('or');
  });

  it('should parse NOT expressions', () => {
    const input = `
n1: "入力A"
n2 := NOT n1
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    const n2 = result.model.nodes.get('n2');
    expect(n2?.expression?.type).toBe('not');
    if (n2?.expression?.type === 'not') {
      expect(n2.expression.operand.type).toBe('ref');
    }
  });

  it('should parse complex expressions with precedence', () => {
    const input = `
n1: "A"
n2: "B"
n3: "C"
n4 := n1 AND n2 OR n3
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    const n4 = result.model.nodes.get('n4');
    // OR has lower precedence, so this should be: (n1 AND n2) OR n3
    expect(n4?.expression?.type).toBe('or');
  });

  it('should parse EXCL constraint', () => {
    const input = `
n1: "A"
n2: "B"
EXCL(n1, n2)
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.constraints).toHaveLength(1);
    expect(result.model.constraints[0].type).toBe('EXCL');
    if (result.model.constraints[0].type === 'EXCL') {
      expect(result.model.constraints[0].members).toHaveLength(2);
    }
  });

  it('should parse REQ constraint with arrow', () => {
    const input = `
n1: "A"
n2: "B"
REQ(n1 -> n2)
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.constraints).toHaveLength(1);
    expect(result.model.constraints[0].type).toBe('REQ');
    if (result.model.constraints[0].type === 'REQ') {
      expect(result.model.constraints[0].source.name).toBe('n1');
      expect(result.model.constraints[0].targets).toHaveLength(1);
    }
  });

  it('should accept NOT on REQ source', () => {
    const input = `
n1: "A"
n2: "B"
REQ(NOT n1 -> n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);
    const reqConstraint = result.model.constraints.find(c => c.type === 'REQ');
    expect(reqConstraint).toBeDefined();
    if (reqConstraint?.type === 'REQ') {
      expect(reqConstraint.source.negated).toBe(true);
      expect(reqConstraint.source.name).toBe('n1');
    }
  });

  it('should accept NOT on REQ target', () => {
    const input = `
n1: "A"
n2: "B"
REQ(n1 -> NOT n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);
    const reqConstraint = result.model.constraints.find(c => c.type === 'REQ');
    expect(reqConstraint).toBeDefined();
    if (reqConstraint?.type === 'REQ') {
      expect(reqConstraint.source.negated).toBe(false);
      expect(reqConstraint.targets[0].negated).toBe(true);
    }
  });

  it('should reject NOT on both REQ source and target', () => {
    const input = `
n1: "A"
n2: "B"
REQ(NOT n1 -> NOT n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('both source and target');
  });

  it('should accept NOT on MASK trigger', () => {
    const input = `
n1: "A"
n2: "B"
MASK(NOT n1 -> n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);
    const maskConstraint = result.model.constraints.find(c => c.type === 'MASK');
    expect(maskConstraint).toBeDefined();
    if (maskConstraint?.type === 'MASK') {
      expect(maskConstraint.trigger.negated).toBe(true);
      expect(maskConstraint.trigger.name).toBe('n1');
    }
  });

  it('should reject NOT on MASK target', () => {
    const input = `
n1: "A"
n2: "B"
MASK(n1 -> NOT n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('NOT is not allowed on target');
  });

  it('should parse layout section', () => {
    const input = `
n1: "A"
@layout {
  n1: (100, 200)
}
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    const n1 = result.model.nodes.get('n1');
    expect(n1?.position).toEqual({ x: 100, y: 200 });
  });

  it('should handle comments', () => {
    const input = `
# This is a comment
n1: "A"
# Another comment
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.nodes.size).toBe(1);
  });
});

describe('Logical DSL Serializer', () => {
  it('should serialize a simple model', () => {
    const input = `
n1: "入力A"
n2: "入力B"
n3 := n1 AND n2
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false });

    expect(dsl).toContain('n1: "入力A"');
    expect(dsl).toContain('n2: "入力B"');
    expect(dsl).toContain('n3 := n1 AND n2');
  });

  it('should serialize constraints', () => {
    const input = `
n1: "A"
n2: "B"
EXCL(n1, n2)
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false });

    expect(dsl).toContain('EXCL(n1, n2)');
  });
});

describe('Model Converter Round-trip', () => {
  it('should convert logical model to graph and back', () => {
    const input = `
n1: "ログインボタンクリック"
n2: "ネットワーク接続あり"
n3 := n1 AND n2
EXCL(n1, n2)
@layout {
  n1: (100, 100)
  n2: (100, 200)
  n3: (300, 150)
}
`;
    const parseResult = parseLogicalDSL(input);
    expect(parseResult.success).toBe(true);

    // Convert to graph
    const graphData = logicalToGraph(parseResult.model);

    expect(graphData.nodes).toHaveLength(3);
    expect(graphData.edges.length).toBeGreaterThan(0);
    expect(graphData.constraints).toHaveLength(1);

    // Convert back to logical
    const logicalModel = graphToLogical(graphData);

    expect(logicalModel.nodes.size).toBe(3);
    expect(logicalModel.constraints).toHaveLength(1);
  });
});

describe('Sample File Parsing', () => {
  it('should parse the sample_graph.nceg format with labeled effects', () => {
    const sampleContent = `# NeoCEG Graph Definition
# This is a test file for import/export functionality

# Causes (inputs)
n1: "ユーザーがログインボタンをクリック"
n2: "ネットワーク接続あり"
n3: "認証サーバー応答"

# Effects / Intermediates
n4: "ログイン成功"
n4 := n1 AND n2 AND n3

n5: "エラーメッセージ表示"
n5 := NOT n2 OR NOT n3

# Constraints
EXCL(n4, n5)
REQ(n1 -> n3)

# Layout
@layout {
  n1: (100, 100)
  n2: (100, 220)
  n3: (100, 340)
  n4: (400, 170)
  n5: (400, 290)
}
`;

    const result = parseLogicalDSL(sampleContent);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.model.nodes.size).toBe(5);
    expect(result.model.constraints).toHaveLength(2);

    // Check causes
    const n1 = result.model.nodes.get('n1');
    expect(n1?.label).toBe('ユーザーがログインボタンをクリック');
    expect(n1?.expression).toBeUndefined();
    expect(n1?.position).toEqual({ x: 100, y: 100 });

    // Check effects - they should have proper labels
    const n4 = result.model.nodes.get('n4');
    expect(n4?.label).toBe('ログイン成功');
    expect(n4?.expression?.type).toBe('and');
    expect(n4?.position).toEqual({ x: 400, y: 170 });

    const n5 = result.model.nodes.get('n5');
    expect(n5?.label).toBe('エラーメッセージ表示');
    expect(n5?.expression?.type).toBe('or');

    // Check constraints
    expect(result.model.constraints[0].type).toBe('EXCL');
    expect(result.model.constraints[1].type).toBe('REQ');
  });
});

describe('Serializer preserves labels', () => {
  it('should preserve effect node labels during round-trip', () => {
    const input = `
n1: "入力A"
n2: "結果B"
n2 := n1
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    // Verify label is preserved
    const n2 = result.model.nodes.get('n2');
    expect(n2?.label).toBe('結果B');
    expect(n2?.expression).toBeDefined();

    // Serialize and re-parse
    const dsl = serializeLogicalModel(result.model, { includeComments: false, includeLayout: false });
    expect(dsl).toContain('n2: "結果B"');
    expect(dsl).toContain('n2 := n1');

    // Round-trip
    const result2 = parseLogicalDSL(dsl);
    expect(result2.success).toBe(true);

    const n2Again = result2.model.nodes.get('n2');
    expect(n2Again?.label).toBe('結果B');
    expect(n2Again?.expression).toBeDefined();
  });
});

describe('Observable flag', () => {
  it('should parse [unobservable] flag on cause nodes', () => {
    const input = `
n1: "入力A" [unobservable]
n2: "入力B"
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.nodes.get('n1')?.observable).toBe(false);
    expect(result.model.nodes.get('n2')?.observable).toBeUndefined();
  });

  it('should accept [observable] for backward compatibility', () => {
    const input = `
n1: "入力A" [observable]
n2: "入力B"
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.nodes.get('n1')?.observable).toBe(true);
    expect(result.model.nodes.get('n2')?.observable).toBeUndefined();
  });

  it('should serialize [unobservable] for non-observable nodes', () => {
    const input = `
n1: "入力A" [unobservable]
n2: "入力B"
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false, includeLayout: false });
    expect(dsl).toContain('n1: "入力A" [unobservable]');
    expect(dsl).not.toContain('n2: "入力B" [unobservable]');
  });

  it('should NOT serialize [observable] (backward compat input round-trips without tag)', () => {
    const input = `
n1: "入力A" [observable]
n2: "入力B"
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false, includeLayout: false });
    // [observable] from old files should not be re-serialized
    expect(dsl).not.toContain('[observable]');
    // Both nodes are observable (default), so no tags
    expect(dsl).toContain('n1: "入力A"');
    expect(dsl).toContain('n2: "入力B"');
  });
});

describe('Constraint positions', () => {
  it('should parse constraint positions from layout', () => {
    const input = `
n1: "A"
n2: "B"
EXCL(n1, n2)
@layout {
  n1: (100, 100)
  n2: (200, 100)
  c0: (150, 50)
}
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    expect(result.model.constraints[0].position).toEqual({ x: 150, y: 50 });
  });

  it('should serialize constraint positions', () => {
    const input = `
n1: "A"
n2: "B"
EXCL(n1, n2)
@layout {
  n1: (100, 100)
  c0: (150, 50)
}
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false });
    expect(dsl).toContain('c0: (150, 50)');
  });
});

describe('Nullable labels', () => {
  it('should handle effect nodes without labels', () => {
    const input = `
n1: "入力A"
n2 := n1
`;
    const result = parseLogicalDSL(input);

    expect(result.success).toBe(true);
    // Effect node without explicit label should have null label
    expect(result.model.nodes.get('n2')?.label).toBeNull();
  });

  it('should use name as fallback label for effects without user label', () => {
    const input = `
n1: "入力A"
n2 := n1
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false, includeLayout: false });
    // New format: all propositions are defined first, using name as fallback label
    expect(dsl).toContain('n1: "入力A"');
    expect(dsl).toContain('n2: "n2"'); // Name used as fallback
    expect(dsl).toContain('n2 := n1');
  });
});

describe('Node display utilities', () => {
  it('should return user label when provided', () => {
    const node = {
      name: 'n1',
      label: 'ユーザーラベル',
      expression: and(ref('a'), ref('b')),
    };

    expect(getNodeDisplayText(node)).toBe('ユーザーラベル');
    expect(hasUserLabel(node)).toBe(true);
  });

  it('should return expression when label is null', () => {
    const node = {
      name: 'n1',
      label: null,
      expression: and(ref('a'), ref('b')),
    };

    expect(getNodeDisplayText(node)).toBe('a AND b');
    expect(hasUserLabel(node)).toBe(false);
  });

  it('should return expression when label is empty', () => {
    const node = {
      name: 'n1',
      label: '  ',
      expression: and(ref('a'), not(ref('b'))),
    };

    expect(getNodeDisplayText(node)).toBe('a AND NOT b');
    expect(hasUserLabel(node)).toBe(false);
  });

  it('should return name when no label and no expression', () => {
    const node = {
      name: 'n1',
      label: null,
    };

    expect(getNodeDisplayText(node)).toBe('n1');
    expect(hasUserLabel(node)).toBe(false);
  });

  it('should return expression text for tooltip', () => {
    const node = {
      name: 'n1',
      label: 'ログイン成功',
      expression: and(ref('a'), ref('b'), ref('c')),
    };

    expect(getNodeExpressionText(node)).toBe('a AND b AND c');
  });

  it('should return null for cause nodes (no expression)', () => {
    const node = {
      name: 'n1',
      label: '入力A',
    };

    expect(getNodeExpressionText(node)).toBeNull();
  });
});

describe('Layout width persistence', () => {
  it('should parse width from layout entry', () => {
    const input = `
n1: "A"
n2: "B"
n3 := n1 AND n2
@layout {
  n1: (100, 100, 200)
  n2: (100, 200)
  n3: (300, 150, 250)
}
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);
    expect(result.model.nodes.get('n1')?.width).toBe(200);
    expect(result.model.nodes.get('n2')?.width).toBeUndefined();
    expect(result.model.nodes.get('n3')?.width).toBe(250);
  });

  it('should serialize width in layout entry', () => {
    const input = `
n1: "A"
n2: "B"
@layout {
  n1: (100, 100, 180)
  n2: (200, 100)
}
`;
    const result = parseLogicalDSL(input);
    expect(result.success).toBe(true);

    const dsl = serializeLogicalModel(result.model, { includeComments: false });
    expect(dsl).toContain('n1: (100, 100, 180)');
    expect(dsl).toContain('n2: (200, 100)');
    expect(dsl).not.toContain('n2: (200, 100,');
  });

  it('should round-trip width through parse and serialize', () => {
    const input = `
n1: "A"
n2 := n1
@layout {
  n1: (50, 60, 220)
  n2: (300, 60)
}
`;
    const result1 = parseLogicalDSL(input);
    expect(result1.success).toBe(true);

    const dsl = serializeLogicalModel(result1.model, { includeComments: false });
    const result2 = parseLogicalDSL(dsl);
    expect(result2.success).toBe(true);

    expect(result2.model.nodes.get('n1')?.width).toBe(220);
    expect(result2.model.nodes.get('n2')?.width).toBeUndefined();
  });
});
