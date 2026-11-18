const OFFLINE_ONLY = import.meta.env.VITE_OFFLINE_ONLY === 'true';
const OFFLINE_BLOCKED_MULTI_TOOLS = new Set([
  'pdf-to-markdown',
  'word-to-pdf',
  'txt-to-pdf',
  'jpg-to-pdf',
  'image-to-pdf',
  'compress',
]);
const offlineTools = (tools: string[]): string[] =>
  OFFLINE_ONLY
    ? tools.filter((tool) => !OFFLINE_BLOCKED_MULTI_TOOLS.has(tool))
    : tools;

export const singlePdfLoadTools = offlineTools([
  'split',
  'organize',
  'rotate',
  'add-page-numbers',
  'pdf-to-jpg',
  'pdf-to-png',
  'pdf-to-webp',
  'pdf-to-greyscale',
  'edit',
  'edit-metadata',
  'remove-metadata',

  'delete-pages',
  'add-blank-page',
  'extract-pages',
  'add-watermark',
  'add-header-footer',
  'invert-colors',
  'view-metadata',
  'crop',
  'redact',
  'pdf-to-bmp',
  'pdf-to-tiff',
  'split-in-half',
  'page-dimensions',
  'n-up',
  'duplicate-organize',
  'combine-single-page',
  'fix-dimensions',
  'change-background-color',
  'change-text-color',
  'ocr-pdf',
  'sign-pdf',
  'remove-annotations',
  'cropper',
  'form-filler',
  'posterize',
  'remove-blank-pages',
  'add-attachments',
  'edit-attachments',
  'sanitize-pdf',
  'remove-restrictions',
  'bookmark-pdf',
]);

export const simpleTools = offlineTools([
  'encrypt',
  'decrypt',
  'change-permissions',
  'pdf-to-markdown',
  'word-to-pdf',
]);

export const multiFileTools = offlineTools([
  'merge',
  'pdf-to-zip',
  'jpg-to-pdf',
  'png-to-pdf',
  'webp-to-pdf',
  'image-to-pdf',
  'svg-to-pdf',
  'bmp-to-pdf',
  'heic-to-pdf',
  'tiff-to-pdf',
  'alternate-merge',
  'linearize',
  'reverse-pages',
  'txt-to-pdf',
  'compress',
  'extract-attachments',
  'flatten',
  'repair-pdf',
]);
