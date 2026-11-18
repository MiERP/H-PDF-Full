import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCpdf,
  mockIsCpdfAvailable,
  mockLoadPyMuPDF,
  mockIsPyMuPDFAvailable,
  mockPdfDocumentLoad,
  mockReadFileAsArrayBuffer,
} = vi.hoisted(() => ({
  mockGetCpdf: vi.fn(),
  mockIsCpdfAvailable: vi.fn(),
  mockLoadPyMuPDF: vi.fn(),
  mockIsPyMuPDFAvailable: vi.fn(),
  mockPdfDocumentLoad: vi.fn(),
  mockReadFileAsArrayBuffer: vi.fn(),
}));

vi.mock('../js/utils/cpdf-helper', () => ({
  getCpdf: mockGetCpdf,
  isCpdfAvailable: mockIsCpdfAvailable,
}));

vi.mock('../js/utils/pymupdf-loader', () => ({
  loadPyMuPDFMainThread: mockLoadPyMuPDF,
  isPyMuPDFAvailable: mockIsPyMuPDFAvailable,
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: mockPdfDocumentLoad,
  },
}));

vi.mock('../js/utils/helpers.js', () => ({
  readFileAsArrayBuffer: mockReadFileAsArrayBuffer,
}));

import * as pdfDecryptModule from '../js/utils/pdf-decrypt';

describe('pdf decrypt', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockIsCpdfAvailable.mockReturnValue(true);
    mockIsPyMuPDFAvailable.mockReturnValue(true);
    mockPdfDocumentLoad.mockResolvedValue({ loaded: true });
    mockReadFileAsArrayBuffer.mockResolvedValue(
      new Uint8Array([1, 2, 3]).buffer
    );
  });

  it('uses CoherentPDF first when it succeeds', async () => {
    const cpdf = {
      setSlow: vi.fn(),
      fromMemory: vi.fn().mockReturnValue({ pdf: true }),
      isEncrypted: vi.fn().mockReturnValue(true),
      decryptPdf: vi.fn(),
      decryptPdfOwner: vi.fn(),
      toMemory: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
      deletePdf: vi.fn(),
    };
    mockGetCpdf.mockResolvedValue(cpdf);

    const result = await pdfDecryptModule.decryptPdfBytes(
      new Uint8Array([9]),
      '1234'
    );

    expect(result).toEqual({
      bytes: new Uint8Array([4, 5, 6]),
      engine: 'cpdf',
    });
    expect(infoSpy).toHaveBeenCalledWith(
      '[PDF Decrypt] Decryption succeeded with CoherentPDF'
    );
    expect(cpdf.decryptPdf).toHaveBeenCalledWith({ pdf: true }, '1234');
    expect(mockLoadPyMuPDF).not.toHaveBeenCalled();
  });

  it('reports the CoherentPDF error when CoherentPDF fails', async () => {
    const cpdf = {
      setSlow: vi.fn(),
      fromMemory: vi.fn().mockImplementation(() => {
        throw new Error('cpdf failed');
      }),
      isEncrypted: vi.fn(),
      decryptPdf: vi.fn(),
      decryptPdfOwner: vi.fn(),
      toMemory: vi.fn(),
      deletePdf: vi.fn(),
    };

    mockGetCpdf.mockResolvedValue(cpdf);

    await expect(
      pdfDecryptModule.decryptPdfBytes(new Uint8Array([9]), '1234')
    ).rejects.toThrow('cpdf failed');
    expect(mockLoadPyMuPDF).not.toHaveBeenCalled();
  });

  it('normalizes raw CoherentPDF error strings', async () => {
    const cpdf = {
      setSlow: vi.fn(),
      fromMemory: vi.fn().mockImplementation(() => {
        throw '0,248,Exports.CPDFError,32,ERROR: decryptPdfOwner: Pdf.PDFError("Bad or missing /P entry")';
      }),
      isEncrypted: vi.fn(),
      decryptPdf: vi.fn(),
      decryptPdfOwner: vi.fn(),
      toMemory: vi.fn(),
      deletePdf: vi.fn(),
    };

    mockGetCpdf.mockResolvedValue(cpdf);

    await expect(
      pdfDecryptModule.decryptPdfBytes(new Uint8Array([9]), '1234')
    ).rejects.toThrow('Bad or missing /P entry');
  });

  it('reports the CoherentPDF error when decryption fails', async () => {
    const cpdf = {
      setSlow: vi.fn(),
      fromMemory: vi.fn().mockImplementation(() => {
        throw new Error('cpdf failed');
      }),
      isEncrypted: vi.fn(),
      decryptPdf: vi.fn(),
      decryptPdfOwner: vi.fn(),
      toMemory: vi.fn(),
      deletePdf: vi.fn(),
    };

    mockGetCpdf.mockResolvedValue(cpdf);

    await expect(
      pdfDecryptModule.decryptPdfBytes(new Uint8Array([9]), '1234')
    ).rejects.toThrow('cpdf failed');
    expect(mockLoadPyMuPDF).not.toHaveBeenCalled();
  });

  it('uses the shared decrypt helper in the workflow decrypt node', async () => {
    const decryptSpy = vi
      .spyOn(pdfDecryptModule, 'decryptPdfBytes')
      .mockResolvedValue({
        bytes: new Uint8Array([8, 8, 8]),
        engine: 'cpdf',
      });

    const { DecryptNode } = await import('../js/workflow/nodes/decrypt-node');

    const node = new DecryptNode();
    const passwordControl = node.controls['password'] as { value?: string };
    passwordControl.value = 'secret';

    const result = await node.data({
      pdf: [
        {
          type: 'pdf',
          document: {} as never,
          bytes: new Uint8Array([1, 2, 3]),
          filename: 'locked.pdf',
        },
      ],
    });

    expect(decryptSpy).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      'secret'
    );
    expect(mockPdfDocumentLoad).toHaveBeenCalledWith(
      new Uint8Array([8, 8, 8]),
      {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      }
    );
    expect(result.pdf).toEqual({
      type: 'pdf',
      document: { loaded: true },
      bytes: new Uint8Array([8, 8, 8]),
      filename: 'locked_decrypted.pdf',
    });
  });

  it('uses the shared decrypt helper when adding a decrypted workflow input file', async () => {
    const decryptSpy = vi
      .spyOn(pdfDecryptModule, 'decryptPdfBytes')
      .mockResolvedValue({
        bytes: new Uint8Array([6, 6, 6]),
        engine: 'cpdf',
      });

    const { PDFInputNode } =
      await import('../js/workflow/nodes/pdf-input-node');

    const node = new PDFInputNode();
    const file = new File([new Uint8Array([1, 2, 3])], 'locked.pdf', {
      type: 'application/pdf',
    });

    await node.addDecryptedFile(file, 'secret');

    expect(mockReadFileAsArrayBuffer).toHaveBeenCalledWith(file);
    expect(decryptSpy).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      'secret'
    );
    expect(mockPdfDocumentLoad).toHaveBeenCalledWith(
      new Uint8Array([6, 6, 6]),
      {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      }
    );
    expect(node.getFileCount()).toBe(1);
    expect(node.getFilenames()).toEqual(['locked.pdf']);
  });
});
