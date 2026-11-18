import { getCpdf, isCpdfAvailable } from './cpdf-helper';
import type { CpdfInstance } from '@/types';

export type PdfDecryptEngine = 'cpdf' | 'pymupdf';

export interface PdfDecryptResult {
  bytes: Uint8Array;
  engine: PdfDecryptEngine;
}

const DECRYPT_LOG_PREFIX = '[PDF Decrypt]';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function normalizeErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).trim();
  const cpdfReasonMatch = message.match(/Pdf\.PDFError\("([^"]+)"\)/);
  if (cpdfReasonMatch?.[1]) {
    return cpdfReasonMatch[1];
  }

  const trailingErrorMatch = message.match(/ERROR:\s*[^:]+:\s*(.+)$/);
  if (trailingErrorMatch?.[1]) {
    return trailingErrorMatch[1].trim();
  }

  return message;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

function cleanupCpdfDocument(cpdf: CpdfInstance, pdf: unknown): void {
  if (!cpdf || !pdf) {
    return;
  }

  try {
    cpdf.deletePdf(pdf);
  } catch (cleanupError) {
    console.warn(
      `${DECRYPT_LOG_PREFIX} Failed to cleanup CoherentPDF document: ${normalizeErrorMessage(cleanupError)}`
    );
  }
}

async function decryptWithCpdf(
  inputBytes: Uint8Array,
  password: string
): Promise<Uint8Array> {
  const cpdf = await getCpdf();
  cpdf.setSlow();

  let pdf: unknown | null = null;

  try {
    pdf = cpdf.fromMemory(new Uint8Array(inputBytes), password);

    if (cpdf.isEncrypted(pdf)) {
      try {
        cpdf.decryptPdf(pdf, password);
      } catch {
        cpdf.decryptPdfOwner(pdf, password);
      }
    }

    const outputBytes = cpdf.toMemory(pdf, false, false);
    pdf = null;

    if (!(outputBytes instanceof Uint8Array) || outputBytes.length === 0) {
      throw new Error('CoherentPDF produced an empty decrypted file.');
    }

    return copyBytes(outputBytes);
  } catch (error) {
    if (pdf) {
      cleanupCpdfDocument(cpdf, pdf);
    }

    throw new Error(normalizeErrorMessage(error), { cause: error });
  }
}

export async function decryptPdfBytes(
  inputBytes: Uint8Array,
  password: string
): Promise<PdfDecryptResult> {
  if (!isCpdfAvailable()) {
    throw new Error('CoherentPDF engine is not available.');
  }
  console.info(`${DECRYPT_LOG_PREFIX} Trying CoherentPDF decryption`);
  try {
    const result: PdfDecryptResult = {
      bytes: await decryptWithCpdf(inputBytes, password),
      engine: 'cpdf',
    };
    console.info(
      `${DECRYPT_LOG_PREFIX} Decryption succeeded with CoherentPDF`
    );
    return result;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error), { cause: error });
  }
}
