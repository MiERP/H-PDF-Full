import { ClassicPreset } from 'rete';

export class PDFSocket extends ClassicPreset.Socket {
  constructor() {
    super('PDF');
  }
}

export class ImageSocket extends ClassicPreset.Socket {
  constructor() {
    super('Image');
  }
}

export class MultiPDFSocket extends ClassicPreset.Socket {
  constructor() {
    super('MultiPDF');
  }
}

export const pdfSocket = new PDFSocket();
export const imageSocket = new ImageSocket();
export const multiPdfSocket = new MultiPDFSocket();

export const socketColors: Record<string, string> = {
  PDF: '#0b9444',
  Image: '#0b9444',
  MultiPDF: '#f59e0b',
};
