/**
 * Multi-format clipboard helper.
 *
 * Excel and Google Sheets prefer text/html on paste (they render the table
 * with formatting); plain text editors prefer text/plain. The modern
 * Clipboard API lets us put both representations in the clipboard at once,
 * so a single "Copy" button works for both audiences.
 *
 * Falls back to writeText() when ClipboardItem / navigator.clipboard.write
 * is unavailable (older browsers, restrictive contexts, http://).
 *
 * Mirrors the sister project NeoCombi's clipboardWrite.ts so the two tools
 * share identical copy behavior.
 */

export type CopyResult =
  | { ok: true; multiFormat: boolean }
  | { ok: false; reason: string };

export async function copyTableToClipboard(html: string, plain: string): Promise<CopyResult> {
  // Modern multi-format path.
  if (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return { ok: true, multiFormat: true };
    } catch (e) {
      // Fall through to writeText fallback rather than failing.
      const err = e instanceof Error ? e.message : String(e);
      try {
        await navigator.clipboard.writeText(plain);
        return { ok: true, multiFormat: false };
      } catch (e2) {
        return {
          ok: false,
          reason: 'Clipboard write failed: ' + (e2 instanceof Error ? e2.message : err),
        };
      }
    }
  }
  // Plain-text-only path.
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(plain);
      return { ok: true, multiFormat: false };
    } catch (e) {
      return {
        ok: false,
        reason: 'Clipboard writeText failed: ' + (e instanceof Error ? e.message : String(e)),
      };
    }
  }
  return { ok: false, reason: 'Clipboard API not available in this browser.' };
}
