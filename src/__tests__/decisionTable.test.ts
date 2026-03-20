/**
 * Decision Table Tests
 *
 * Tests truth value operations and optimized decision table generation.
 */
import { describe, test, expect } from 'vitest';
import { parseLogicalDSL } from '../services/logicalDslParser';
import {
  generateOptimizedDecisionTable,
  generateLearningModeTable,
  getFeasibleConditions,
} from '../services/decisionTableCalculator';
import {
  truthAnd,
  truthOr,
  truthNot,
  isTrue,
} from '../types/decisionTable';
import { isCause, isEffect } from '../types/logical';

// =============================================================================
// Truth Value Operations Tests
// =============================================================================

describe('Truth Value Operations', () => {
  describe('truthAnd', () => {
    // Basic cases with explicit T/F
    test('T AND T = t', () => {
      expect(truthAnd('T', 'T')).toBe('t');
    });

    test('T AND F = f', () => {
      expect(truthAnd('T', 'F')).toBe('f');
    });

    test('F AND T = f', () => {
      expect(truthAnd('F', 'T')).toBe('f');
    });

    test('F AND F = f', () => {
      expect(truthAnd('F', 'F')).toBe('f');
    });

    // Derived values (t/f) - should work the same as T/F
    test('t AND t = t', () => {
      expect(truthAnd('t', 't')).toBe('t');
    });

    test('t AND f = f', () => {
      expect(truthAnd('t', 'f')).toBe('f');
    });

    test('T AND t = t', () => {
      expect(truthAnd('T', 't')).toBe('t');
    });

    test('T AND f = f', () => {
      expect(truthAnd('T', 'f')).toBe('f');
    });

    // M (Masked) handling - CEGTest 1.6 bug fix
    test('M AND M = I (both indeterminate)', () => {
      expect(truthAnd('M', 'M')).toBe('I');
    });

    test('M AND T = I (one indeterminate)', () => {
      expect(truthAnd('M', 'T')).toBe('I');
    });

    test('T AND M = I (symmetry)', () => {
      expect(truthAnd('T', 'M')).toBe('I');
    });

    test('M AND F = f (F is certain)', () => {
      expect(truthAnd('M', 'F')).toBe('f');
    });

    test('F AND M = f (symmetry)', () => {
      expect(truthAnd('F', 'M')).toBe('f');
    });

    test('M AND t = I', () => {
      expect(truthAnd('M', 't')).toBe('I');
    });

    test('M AND f = f', () => {
      expect(truthAnd('M', 'f')).toBe('f');
    });

    // I (Indeterminate) handling
    test('I AND T = I', () => {
      expect(truthAnd('I', 'T')).toBe('I');
    });

    test('I AND F = f (F is absorbing for AND)', () => {
      expect(truthAnd('I', 'F')).toBe('f');
    });

    test('I AND M = I', () => {
      expect(truthAnd('I', 'M')).toBe('I');
    });

    test('I AND I = I', () => {
      expect(truthAnd('I', 'I')).toBe('I');
    });
  });

  describe('truthOr', () => {
    // Basic cases with explicit T/F
    test('T OR T = t', () => {
      expect(truthOr('T', 'T')).toBe('t');
    });

    test('T OR F = t', () => {
      expect(truthOr('T', 'F')).toBe('t');
    });

    test('F OR T = t', () => {
      expect(truthOr('F', 'T')).toBe('t');
    });

    test('F OR F = f', () => {
      expect(truthOr('F', 'F')).toBe('f');
    });

    // Derived values (t/f)
    test('t OR t = t', () => {
      expect(truthOr('t', 't')).toBe('t');
    });

    test('t OR f = t', () => {
      expect(truthOr('t', 'f')).toBe('t');
    });

    test('f OR f = f', () => {
      expect(truthOr('f', 'f')).toBe('f');
    });

    // M handling
    test('M OR M = I', () => {
      expect(truthOr('M', 'M')).toBe('I');
    });

    test('M OR T = t (T is certain)', () => {
      expect(truthOr('M', 'T')).toBe('t');
    });

    test('T OR M = t (symmetry)', () => {
      expect(truthOr('T', 'M')).toBe('t');
    });

    test('M OR F = I', () => {
      expect(truthOr('M', 'F')).toBe('I');
    });

    test('F OR M = I (symmetry)', () => {
      expect(truthOr('F', 'M')).toBe('I');
    });

    test('M OR t = t', () => {
      expect(truthOr('M', 't')).toBe('t');
    });

    test('M OR f = I', () => {
      expect(truthOr('M', 'f')).toBe('I');
    });

    // I handling
    test('I OR T = t (T is certain for OR)', () => {
      expect(truthOr('I', 'T')).toBe('t');
    });

    test('I OR F = I', () => {
      expect(truthOr('I', 'F')).toBe('I');
    });

    test('I OR M = I', () => {
      expect(truthOr('I', 'M')).toBe('I');
    });

    test('I OR I = I', () => {
      expect(truthOr('I', 'I')).toBe('I');
    });
  });

  describe('truthNot', () => {
    test('NOT T = f', () => {
      expect(truthNot('T')).toBe('f');
    });

    test('NOT t = f', () => {
      expect(truthNot('t')).toBe('f');
    });

    test('NOT F = t', () => {
      expect(truthNot('F')).toBe('t');
    });

    test('NOT f = t', () => {
      expect(truthNot('f')).toBe('t');
    });

    test('NOT M = M', () => {
      expect(truthNot('M')).toBe('M');
    });

    test('NOT I = I', () => {
      expect(truthNot('I')).toBe('I');
    });
  });
});

// =============================================================================
// Optimized Decision Table Generation Tests
// =============================================================================

describe('Decision Table Generation', () => {
  test('simple AND: 2 causes, 1 effect → 3 conditions', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    expect(result.success).toBe(true);

    const table = generateOptimizedDecisionTable(result.model);

    expect(table.causeIds).toEqual(['p1', 'p2']);
    expect(table.effectIds).toEqual(['p3']);

    // AND(p1, p2) → p3: n+1 = 3 conditions
    expect(table.conditions.length).toBe(3);

    // Verify logic: p3 = p1 AND p2
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      const p3T = isTrue(c.values.get('p3')!);
      expect(p3T).toBe(p1T && p2T);
    }
  });

  test('simple OR: 2 causes, 1 effect → 3 conditions', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 OR p2
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // OR(p1, p2) → p3: n+1 = 3 conditions
    expect(table.conditions.length).toBe(3);

    // Verify logic: p3 = p1 OR p2
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      const p3T = isTrue(c.values.get('p3')!);
      expect(p3T).toBe(p1T || p2T);
    }
  });

  test('NOT expression: 1 cause, 1 effect → 2 conditions', () => {
    const dsl = `
p1: "入力A"
p2: "結果"
p2 := NOT p1
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    expect(table.conditions.length).toBe(2);

    // Verify logic: p2 = NOT p1
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      expect(p2T).toBe(!p1T);
    }
  });
});

// =============================================================================
// Constraint Handling Tests
// =============================================================================

describe('Constraint Handling', () => {
  test('EXCL: no condition has both causes true', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 AND p2
EXCL(p1, p2)
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // EXCL(p1, p2) with AND(p1, p2): "both true" expression is infeasible
    expect(table.conditions.length).toBe(2);

    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      // EXCL: at most one true
      expect(p1T && p2T).toBe(false);
    }
  });

  test('ONE: exactly one cause is true in each condition', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 OR p2
ONE(p1, p2)
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // ONE: all-false expression is infeasible → 2 conditions
    expect(table.conditions.length).toBe(2);

    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      // ONE: exactly one true
      expect(p1T !== p2T).toBe(true);
    }
  });

  test('INCL: at least one cause is true in each condition', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 OR p2
INCL(p1, p2)
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // INCL with OR: all-false expression is infeasible → 2 conditions
    expect(table.conditions.length).toBe(2);

    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      // INCL: at least one true
      expect(p1T || p2T).toBe(true);
    }
  });

  test('REQ: when source is true, target is also true', () => {
    const dsl = `
p1: "入力A"
p2: "入力B"
p3: "結果"
p3 := p1 AND p2
REQ(p1 -> p2)
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // REQ(p1 -> p2): if p1=T then p2=T
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      if (p1T) {
        expect(p2T).toBe(true);
      }
    }
  });

  test('MASK: masked targets shown as M', () => {
    const dsl = `
p1: "トリガー"
p2: "マスク対象"
p3: "結果"
p3 := p2
MASK(p1 -> p2)
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // When p1=T, p2 should be M
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      if (p1T) {
        expect(c.values.get('p2')).toBe('M');
      }
    }
  });
});

// =============================================================================
// Complex Graph Tests
// =============================================================================

describe('Complex Graphs', () => {
  test('complex graph with EXCL constraint', () => {
    const dsl = `
p1: "ログインボタン"
p2: "ネットワーク接続"
p3: "サーバー応答"
p4: "ログイン成功"
p5: "エラー表示"

p4 := p1 AND p2 AND p3
p5 := NOT p2 OR NOT p3

EXCL(p4, p5)
`;
    const result = parseLogicalDSL(dsl);
    expect(result.success).toBe(true);

    const table = generateOptimizedDecisionTable(result.model);

    expect(table.causeIds).toContain('p1');
    expect(table.causeIds).toContain('p2');
    expect(table.causeIds).toContain('p3');
    expect(table.effectIds).toContain('p4');
    expect(table.effectIds).toContain('p5');

    // EXCL(p4, p5): no condition should have both true
    for (const c of table.conditions) {
      const p4T = isTrue(c.values.get('p4')!);
      const p5T = isTrue(c.values.get('p5')!);
      expect(p4T && p5T).toBe(false);
    }

    // p4 = p1 AND p2 AND p3 must be correctly derived
    for (const c of table.conditions) {
      const p1T = isTrue(c.values.get('p1')!);
      const p2T = isTrue(c.values.get('p2')!);
      const p3T = isTrue(c.values.get('p3')!);
      const p4T = isTrue(c.values.get('p4')!);
      expect(p4T).toBe(p1T && p2T && p3T);
    }

    // p5 = NOT p2 OR NOT p3 must be correctly derived
    for (const c of table.conditions) {
      const p2T = isTrue(c.values.get('p2')!);
      const p3T = isTrue(c.values.get('p3')!);
      const p5T = isTrue(c.values.get('p5')!);
      expect(p5T).toBe(!p2T || !p3T);
    }
  });

  test('intermediate nodes are computed correctly', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "中間"
p4: "結果"

p3 := p1 AND p2
p4 := p3
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    expect(table.intermediateIds).toContain('p3');
    expect(table.effectIds).toContain('p4');

    // p4 should equal p3 in all conditions
    for (const c of table.conditions) {
      const p3T = isTrue(c.values.get('p3')!);
      const p4T = isTrue(c.values.get('p4')!);
      expect(p4T).toBe(p3T);
    }
  });
});

// =============================================================================
// Admission Fee Example (CEGTest Comparison)
// =============================================================================

describe('Admission Fee Example', () => {
  const admissionFeeDsl = `
# 入場料計算 (CEGTestからの変換)

# Causes (原因)
n1: "区分1は個人である"
n2: "区分1は団体である"
n3: "区分2は65歳以上である"
n4: "区分2は一般である"
n5: "区分2は小学生である"
n6: "区分2は6歳未満である"
n7: "県内在住Yesである"
n8: "県内在住Noである"

# Intermediates (中間ノード)
n9: "県内在住の小学生"
n10: "県内在住ではない小学生"

n9 := n5 AND n7
n10 := n5 AND n8

# Effects (結果)
e1: "入場料は無料である"
e2: "入場料は1200円である"
e3: "入場料は1000円である"
e4: "入場料は600円である"
e5: "入場料は500円である"

e1 := n3 OR n6 OR n9
e2 := n1 AND n4
e3 := n2 AND n4
e4 := n1 AND n10
e5 := n2 AND n10

# Constraints (制約)
ONE(n1, n2)
ONE(n3, n4, n5, n6)
ONE(n7, n8)
`;

  test('parses admission fee graph correctly', () => {
    const result = parseLogicalDSL(admissionFeeDsl);
    expect(result.success).toBe(true);

    const model = result.model;
    const causeCount = Array.from(model.nodes.values()).filter(
      (n) => isCause(n)
    ).length;
    const effectCount = Array.from(model.nodes.values()).filter(
      (n) => isEffect(n, model)
    ).length;

    expect(causeCount).toBe(8);
    expect(effectCount).toBe(5);
  });

  test('generates 7 optimized conditions', () => {
    const result = parseLogicalDSL(admissionFeeDsl);
    const table = generateOptimizedDecisionTable(result.model);

    // CEG algorithm: 7 feasible conditions (vs 16 brute-force)
    const feasible = getFeasibleConditions(table);
    expect(feasible.length).toBe(7);
    expect(table.stats.feasibleConditions).toBe(7);
    expect(table.causeIds).toHaveLength(8);
    expect(table.intermediateIds).toHaveLength(2);
    expect(table.effectIds).toHaveLength(5);
  });

  test('ONE constraints satisfied in all conditions', () => {
    const result = parseLogicalDSL(admissionFeeDsl);
    const table = generateOptimizedDecisionTable(result.model);

    for (const condition of table.conditions) {
      // ONE(n1, n2): exactly one must be true
      const n1T = isTrue(condition.values.get('n1')!);
      const n2T = isTrue(condition.values.get('n2')!);
      expect(n1T !== n2T).toBe(true);

      // ONE(n3, n4, n5, n6): exactly one must be true
      const group2 = ['n3', 'n4', 'n5', 'n6']
        .map((n) => condition.values.get(n)!)
        .filter((v) => isTrue(v)).length;
      expect(group2).toBe(1);

      // ONE(n7, n8): exactly one must be true
      const n7T = isTrue(condition.values.get('n7')!);
      const n8T = isTrue(condition.values.get('n8')!);
      expect(n7T !== n8T).toBe(true);
    }
  });

  test('effects are computed correctly for key scenarios', () => {
    const result = parseLogicalDSL(admissionFeeDsl);
    const table = generateOptimizedDecisionTable(result.model);
    const conditions = table.conditions;

    // At least one condition should produce each fee tier
    expect(conditions.some((c) => isTrue(c.values.get('e1')!))).toBe(true); // 無料
    expect(conditions.some((c) => isTrue(c.values.get('e2')!))).toBe(true); // 1200円
    expect(conditions.some((c) => isTrue(c.values.get('e3')!))).toBe(true); // 1000円
    expect(conditions.some((c) => isTrue(c.values.get('e4')!))).toBe(true); // 600円
    expect(conditions.some((c) => isTrue(c.values.get('e5')!))).toBe(true); // 500円
  });

  test('learning mode: feasible conditions match practice mode', () => {
    const result = parseLogicalDSL(admissionFeeDsl);
    const table = generateOptimizedDecisionTable(result.model);

    // All conditions (learning mode view)
    expect(table.conditions.length).toBe(table.stats.totalConditions);

    // Feasible conditions (practice mode view)
    const feasible = getFeasibleConditions(table);
    expect(feasible.length).toBe(7);
    expect(table.stats.feasibleConditions).toBe(7);

    // Stats consistency
    expect(table.stats.feasibleConditions + table.stats.weakCount).toBe(
      table.stats.totalConditions
    );
  });
});

// =============================================================================
// Learning Mode (Display Mode) Tests
// =============================================================================

describe('Learning Mode', () => {
  test('getFeasibleConditions filters out excluded (weak) conditions', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // All conditions should be present
    expect(table.conditions.length).toBe(table.stats.totalConditions);

    // Feasible = total - weak
    const feasible = getFeasibleConditions(table);
    expect(feasible.length).toBe(table.stats.feasibleConditions);

    // No feasible condition should be excluded
    for (const c of feasible) {
      expect(c.excluded).toBe(false);
    }

    // All excluded conditions should have exclusionReason
    const excluded = table.conditions.filter((c) => c.excluded);
    for (const c of excluded) {
      expect(c.exclusionReason).toBeDefined();
      expect(c.exclusionReason!.type).toBe('weak');
      expect(c.exclusionReason!.explanation.length).toBeGreaterThan(0);
    }

    // Stats should be consistent
    expect(table.stats.weakCount).toBe(excluded.length);
    expect(table.stats.feasibleConditions + table.stats.weakCount).toBe(
      table.stats.totalConditions
    );
  });

  test('condition IDs are sequential across all conditions', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const table = generateOptimizedDecisionTable(result.model);

    // IDs should be 1, 2, 3, ... (sequential)
    for (let i = 0; i < table.conditions.length; i++) {
      expect(table.conditions[i].id).toBe(i + 1);
    }
  });
});

// =============================================================================
// Learning Mode: Brute-Force 2^n Enumeration Tests
// =============================================================================

describe('Learning Mode (Brute-Force)', () => {
  test('AND(A,B)->C: generates 4 columns in binary counting order', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();
    expect(learning!.conditions.length).toBe(4); // 2^2 = 4

    // Verify descending binary counting order: TT, TF, FT, FF (T-first convention)
    const causeNames = learning!.causeIds;
    const patterns = learning!.conditions.map((c) =>
      causeNames.map((name) => c.values.get(name)).join('')
    );
    expect(patterns).toEqual(['TT', 'TF', 'FT', 'FF']);
  });

  test('AND(A,B)->C: correct exclusion reasons', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();

    // Check each condition has a proper state
    for (const c of learning!.conditions) {
      if (c.excluded) {
        expect(c.exclusionReason).toBeDefined();
        expect(['infeasible', 'redundant', 'untestable']).toContain(c.exclusionReason!.type);
        expect(c.exclusionReason!.explanation.length).toBeGreaterThan(0);
      } else {
        expect(c.exclusionReason).toBeUndefined();
      }
    }
  });

  test('feasible conditions match optimized table cause patterns', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();

    // The number of feasible conditions in learning table should match
    // the number of non-excluded conditions in optimized table
    const optimizedFeasible = getFeasibleConditions(optimized);
    expect(learning!.stats.feasibleConditions).toBe(optimizedFeasible.length);
  });

  test('EXCL constraint: marks infeasible columns', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
EXCL(p1, p2)
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();
    expect(learning!.conditions.length).toBe(4); // 2^2 = 4

    // The TT combination (A=T, B=T) should be infeasible due to EXCL
    const ttCondition = learning!.conditions[0]; // TT is now first (T-first order)
    expect(ttCondition.excluded).toBe(true);
    expect(ttCondition.exclusionReason!.type).toBe('infeasible');
    expect(ttCondition.exclusionReason!.explanation).toContain('EXCL');

    expect(learning!.stats.infeasibleCount).toBeGreaterThanOrEqual(1);
  });

  test('returns null when 2^n > 256 (9 causes)', () => {
    // Build a model with 9 causes
    const causes = Array.from({ length: 9 }, (_, i) => `p${i + 1}: "C${i + 1}"`).join('\n');
    const dsl = `
${causes}
p10: "Effect"
p10 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    // 2^9 = 512 > 256 → null
    expect(learning).toBeNull();
  });

  test('returns table when 2^n = 256 (8 causes)', () => {
    // Build a model with 8 causes
    const causes = Array.from({ length: 8 }, (_, i) => `p${i + 1}: "C${i + 1}"`).join('\n');
    const dsl = `
${causes}
p9: "Effect"
p9 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    // 2^8 = 256 <= 256 → valid table
    expect(learning).not.toBeNull();
    expect(learning!.conditions.length).toBe(256);
  });

  test('stats consistency: total = feasible + infeasible + redundant + untestable', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 AND p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();
    const s = learning!.stats;
    // weakCount stores redundant count in learning mode
    expect(s.feasibleConditions + s.infeasibleCount + s.weakCount + s.untestableCount)
      .toBe(s.totalConditions);
  });

  test('condition IDs are sequential 1..2^n', () => {
    const dsl = `
p1: "A"
p2: "B"
p3: "C"
p3 := p1 OR p2
`;
    const result = parseLogicalDSL(dsl);
    const optimized = generateOptimizedDecisionTable(result.model);
    const learning = generateLearningModeTable(result.model, optimized);

    expect(learning).not.toBeNull();
    for (let i = 0; i < learning!.conditions.length; i++) {
      expect(learning!.conditions[i].id).toBe(i + 1);
    }
  });
});
