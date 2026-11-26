#!/usr/bin/env node
// Downloads the engines that the Full installer carries, so the app never
// needs to fetch them on the user's computer. Files are verified against the
// hashes in desktop/app/modules-manifest.json and unpacked into
// desktop/bundled-modules/<name>/.
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x as extractTar } from 'tar';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'desktop', 'app', 'modules-manifest.json'), 'utf8')
);
const bundledDir = resolve(root, 'desktop', 'bundled-modules');

const sha512 = (bytes) => createHash('sha512').update(bytes).digest('base64');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url, dest) {
  console.log(`   Fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  return bytes;
}

for (const [name, item] of Object.entries(manifest.modules)) {
  if (!item.bundled) continue;
  const target = resolve(bundledDir, name);
  const probe = resolve(target, item.probe);
  // A probe alone cannot tell an old engine from the one the manifest now
  // pins. The stamp makes a version bump re-fetch instead of shipping the old
  // engine under the new version's label.
  const stampFile = resolve(target, '.manifest-version');
  const stamp = existsSync(stampFile)
    ? readFileSync(stampFile, 'utf8').trim()
    : null;
  const version = String(item.version ?? '');
  if (existsSync(probe) && (stamp === null || stamp === version)) {
    if (stamp === null) writeFileSync(stampFile, `${version}\n`);
    console.log(`   ${name}: already bundled`);
    continue;
  }

  const preserved = existsSync(target)
    ? readdirSync(target).filter((file) => file.startsWith('LICENSE'))
    : [];
  const preservedBytes = preserved.map((file) => [
    file,
    readFileSync(resolve(target, file)),
  ]);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const [file, bytes] of preservedBytes) {
    writeFileSync(resolve(target, file), bytes);
  }

  if (item.kind === 'npm-tarball') {
    if (!item.url) throw new Error(`${name}: missing tarball URL`);
    const tarPath = resolve(root, 'release', `${name}.tgz`);
    mkdirSync(dirname(tarPath), { recursive: true });
    const bytes = await download(item.url, tarPath);
    if (item.integrity?.startsWith('sha512-')) {
      const expected = item.integrity.slice('sha512-'.length);
      const actual = sha512(bytes);
      if (actual !== expected) {
        throw new Error(`${name}: integrity mismatch (${actual})`);
      }
    }
    await extractTar({ file: tarPath, cwd: target, strip: 1 });
    rmSync(tarPath, { force: true });
  } else if (item.kind === 'files' && item.files) {
    for (const file of item.files) {
      const dest = resolve(target, file.path);
      mkdirSync(dirname(dest), { recursive: true });
      // LibreOffice files ship in public/libreoffice-wasm; reuse them.
      const local = resolve(root, 'public', 'libreoffice-wasm', file.path);
      if (existsSync(local)) {
        copyFileSync(local, dest);
        console.log(`   ${name}/${file.path}: copied from public`);
      } else {
        const bytes = await download(file.url, dest);
        if (file.sha256 && sha256(bytes) !== file.sha256) {
          throw new Error(`${name}/${file.path}: SHA-256 mismatch`);
        }
      }
    }
  }

  if (!existsSync(probe)) {
    throw new Error(`${name}: ${item.probe} missing after bundling`);
  }
  writeFileSync(stampFile, `${version}\n`);
  console.log(`   ${name}: bundled`);
}

console.log('   All bundled engines are ready.');
