// Renders public/images/h-pdf-logo.svg into the PNG icons used by the
// desktop app. Run with Electron (it provides the SVG rasterizer):
//   npx electron scripts/generate-desktop-icons.mjs
import { app, BrowserWindow, nativeImage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'public/images/h-pdf-logo.svg'));
const SIZE = 1024;

const outputs = [
  // electron-builder derives .ico / .icns / Linux icons from this one.
  { path: 'build-resources/icon.png', size: 1024 },
  // Window icon, served with the web bundle.
  { path: 'public/images/h-pdf-icon-512.png', size: 512 },
  // Web favicons and touch icon.
  { path: 'public/images/favicon-512x512.png', size: 512 },
  { path: 'public/images/favicon-192x192.png', size: 192 },
  { path: 'public/images/apple-touch-icon.png', size: 180 },
  { path: 'public/images/favicon.png', size: 64 },
];

// A PNG-compressed multi-size ICO, for browsers and shortcuts that ignore
// the SVG/PNG favicons. 256 is written as 0 in the directory entry.
function icoBuffer(image, sizes) {
  const pngs = sizes.map((size) =>
    image.resize({ width: size, height: size, quality: 'best' }).toPNG()
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  const entries = [];
  let offset = 6 + 16 * sizes.length;
  sizes.forEach((size, index) => {
    const png = pngs[index];
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  });

  return Buffer.concat([header, ...entries, ...pngs]);
}


app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  // The logo is drawn on a canvas inside the page rather than captured from
  // the window: a window cannot be taller than the screen, so a capture of a
  // 1024px window comes back cropped on smaller displays.
  const win = new BrowserWindow({ width: 200, height: 200, show: false });
  await win.loadURL('about:blank');

  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ${SIZE};
        canvas.getContext('2d').drawImage(img, 0, 0, ${SIZE}, ${SIZE});
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Could not load the logo SVG'));
      img.src = 'data:image/svg+xml;base64,${svg.toString('base64')}';
    })
  `);

  const image = nativeImage.createFromDataURL(dataUrl);
  for (const { path, size } of outputs) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      image.resize({ width: size, height: size, quality: 'best' }).toPNG()
    );
    console.log(`wrote ${path} (${size}x${size})`);
  }

  // Windows app/installer icon: a real multi-size ICO, so electron-builder
  // does not have to derive one from the PNG (and NSIS uses it for the
  // installer and uninstaller too).
  writeFileSync(
    resolve(root, 'build-resources/icon.ico'),
    icoBuffer(image, [16, 24, 32, 48, 64, 128, 256])
  );
  console.log('wrote build-resources/icon.ico (16, 24, 32, 48, 64, 128, 256)');

  writeFileSync(
    resolve(root, 'public/favicon.ico'),
    icoBuffer(image, [16, 32, 48, 64, 128, 256])
  );
  console.log('wrote public/favicon.ico (16, 32, 48, 64, 128, 256)');
  app.quit();
});
