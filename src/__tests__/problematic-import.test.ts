/**
 * Test for problematic import file
 */
import { describe, test, expect } from 'vitest';
import { parseLogicalDSL } from '../services/logicalDslParser';

const problematicDSL = `# NeoCEG Graph Definition
# Exported: 2026-02-04T11:10:56.248Z

# Propositions (命題)
p1: "あ" [observable]
p2: "い" [observable]
p3: "う" [observable]
p4: "\\"あ\\" OR \\"い\\"" [observable]
p5: "\\"う\\" AND \\"\\"あ\\" OR \\"い\\"\\"\\"" [observable]

# Logical Relations (論理式)
p4 := p1 OR p4 OR p2
p5 := p3 AND p4

# Layout
@layout {
  p1: (255, 360)
  p2: (210, 480)
  p3: (390, 645)
  p4: (540, 375)
  p5: (750, 525)
}`;

describe('Problematic Import', () => {
  test('should detect circular reference in p4 := p1 OR p4 OR p2', () => {
    const result = parseLogicalDSL(problematicDSL);

    // Parser should fail due to circular reference
    expect(result.success).toBe(false);

    // Error message should indicate circular reference
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('Circular reference detected');
    expect(result.errors[0].message).toContain('p4');
  });

  test('should detect indirect circular reference', () => {
    const indirectCycleDSL = `
      a := b
      b := c
      c := a
    `;

    const result = parseLogicalDSL(indirectCycleDSL);

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('Circular reference detected');
    expect(result.errors[0].message).toContain('a -> b -> c -> a');
  });

  test('should allow valid non-circular references', () => {
    const validDSL = `
      p1: "cause 1" [observable]
      p2: "cause 2" [observable]
      p3 := p1 AND p2
      p4 := p3 OR p1
    `;

    const result = parseLogicalDSL(validDSL);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
