import { describe, expect, it } from 'vitest';
import { looksLikePdf } from '../../desktop/src/pdf-bytes';

describe('looksLikePdf', () => {
  it('accepts a PDF header', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('accepts a header after a BOM or writer prefix', () => {
    expect(looksLikePdf(Buffer.from('\uFEFF%PDF-1.4\n...', 'utf8'))).toBe(true);
  });

  it('rejects empty and non-PDF data', () => {
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
    expect(looksLikePdf(Buffer.from('<html>error</html>'))).toBe(false);
    expect(looksLikePdf(Buffer.from('PK\u0003\u0004'))).toBe(false);
  });
});
