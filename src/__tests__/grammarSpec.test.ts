/**
 * Guard test for the embedded DSL grammar (GUI spec §9.2).
 *
 * The grammar shipped in the app is the `ebnf` block of
 * Doc/DSL_Grammar_Specification.md, inlined at build time. These assertions
 * fail CI if a doc change breaks extraction — preventing the app from silently
 * shipping stale or empty grammar (no version drift).
 */
import { describe, it, expect } from 'vitest';
import { getGrammarText, getGrammarVersion, GRAMMAR_FILENAME } from '../services/grammarSpec';

describe('embedded DSL grammar', () => {
  const text = getGrammarText();

  it('extracts a non-empty grammar block', () => {
    expect(text.length).toBeGreaterThan(200);
  });

  it('begins with the grammar header comment', () => {
    expect(text).toMatch(/^\(\* NeoCEG DSL Grammar v[\d.]+ \*\)/);
  });

  it('contains the core productions', () => {
    expect(text).toContain('expression      = or_gate | and_gate | literal ;');
    expect(text).toContain('node_definition = identifier ( cause_def | effect_def ) ;');
  });

  it('contains the factor=level naming digest (the AI brief)', () => {
    expect(text).toContain('factor = level');
  });

  it('does not contain the surrounding markdown (only the fenced block)', () => {
    expect(text).not.toContain('## EBNF Grammar');
    expect(text).not.toContain('```');
  });

  it('reports the grammar version', () => {
    expect(getGrammarVersion()).toMatch(/^v[\d.]+$/);
  });

  it('downloads as a .txt file', () => {
    expect(GRAMMAR_FILENAME).toBe('NeoCEG_DSL_Grammar.txt');
  });
});
