/**
 * DSL Grammar reference (offline, embedded) — see GUI spec §9.2.
 *
 * The app hands its DSL grammar to an AI assistant so the AI can generate
 * `.nceg` graphs. Because the app is installable and runs offline, the grammar
 * is EMBEDDED at build time rather than fetched from the network: Vite inlines
 * the spec file via the `?raw` import below, so the shipped grammar always
 * equals the repository at build time (no hand-copied duplicate to drift).
 *
 * The distributed artifact is the single fenced `ebnf` block of the spec — the
 * curated, self-contained brief — not the whole document.
 *
 * `grammarSpec.test.ts` guards extraction: a doc change that breaks the block
 * fails CI instead of silently shipping stale or empty grammar.
 */

import grammarMarkdown from '../../Doc/DSL_Grammar_Specification.md?raw';

/** Pull the single ```ebnf ... ``` fenced block out of the spec markdown. */
function extractEbnfBlock(md: string): string {
  const match = md.match(/```ebnf\r?\n([\s\S]*?)\r?\n```/);
  if (!match) {
    throw new Error('DSL grammar: no ```ebnf fenced block found in DSL_Grammar_Specification.md');
  }
  return match[1].trim() + '\n';
}

let cached: string | null = null;

/** The embedded DSL grammar text (the EBNF block) — for Copy/Download. */
export function getGrammarText(): string {
  if (cached === null) cached = extractEbnfBlock(grammarMarkdown);
  return cached;
}

/** Grammar version from the block header comment, e.g. "v1.5" (null if absent). */
export function getGrammarVersion(): string | null {
  const m = getGrammarText().match(/NeoCEG DSL Grammar\s+(v[\d.]+)/);
  return m ? m[1] : null;
}

/** Default download filename for the grammar (GUI spec §9.2). */
export const GRAMMAR_FILENAME = 'NeoCEG_DSL_Grammar.txt';
