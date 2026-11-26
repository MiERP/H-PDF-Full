/**
 * Minimal check that a downloaded result is really a PDF before it replaces
 * the user's document. The header may sit after a BOM or other writer prefix,
 * so it only has to appear in the inspected bytes.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 0 && Buffer.from(bytes).includes('%PDF-');
}
