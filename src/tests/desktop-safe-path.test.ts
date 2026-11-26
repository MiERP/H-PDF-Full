import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isSafeArchiveEntry,
  resolveFileInside,
  resolveInside,
  resolveUrlPath,
} from '../../desktop/src/safe-path';

const base = path.resolve('app', 'dist');

describe('resolveInside', () => {
  it('resolves a normal nested path under the base directory', () => {
    expect(resolveInside(base, path.join('assets', 'app.js'))).toBe(
      path.join(base, 'assets', 'app.js')
    );
  });

  it('normalises harmless segments without escaping', () => {
    expect(resolveInside(base, path.join('assets', '..', 'index.html'))).toBe(
      path.join(base, 'index.html')
    );
  });

  it('refuses a parent-directory segment', () => {
    expect(resolveInside(base, path.join('..', 'secret.txt'))).toBeNull();
    expect(
      resolveInside(base, path.join('assets', '..', '..', 'secret.txt'))
    ).toBeNull();
  });

  it('refuses an absolute path', () => {
    const absolute = path.resolve(path.sep, 'Windows', 'win.ini');
    expect(resolveInside(base, absolute)).toBeNull();
  });

  it('refuses the base directory itself', () => {
    expect(resolveInside(base, '.')).toBeNull();
    expect(resolveInside(base, '')).toBeNull();
  });
});

describe('resolveUrlPath', () => {
  it('treats a leading slash as the base directory, not the drive root', () => {
    expect(resolveUrlPath(base, '/assets/app.js')).toBe(
      path.join(base, 'assets', 'app.js')
    );
    expect(resolveUrlPath(base, '///index.html')).toBe(
      path.join(base, 'index.html')
    );
  });

  it('still refuses traversal', () => {
    expect(resolveUrlPath(base, '/../secret.txt')).toBeNull();
    expect(resolveUrlPath(base, '/assets/../../secret.txt')).toBeNull();
  });
});

describe('resolveFileInside', () => {
  let root: string;
  let base: string;
  let outside: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hpdf-safe-path-'));
    base = path.join(root, 'base');
    outside = path.join(root, 'outside');
    fs.mkdirSync(base);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(base, 'inside.txt'), 'inside');
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('allows a real file inside the base directory', () => {
    expect(resolveFileInside(base, 'inside.txt')).toBe(
      path.join(base, 'inside.txt')
    );
  });

  it('refuses traversal and a missing file', () => {
    expect(resolveFileInside(base, '../outside/secret.txt')).toBeNull();
    expect(resolveFileInside(base, 'missing.txt')).toBeNull();
  });

  it('refuses a file behind a symlinked parent directory', () => {
    const link = path.join(base, 'linked');
    fs.symlinkSync(
      outside,
      link,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    expect(
      resolveFileInside(base, path.join('linked', 'secret.txt'))
    ).toBeNull();
  });
});

describe('isSafeArchiveEntry', () => {
  it('allows normal files and directories', () => {
    expect(isSafeArchiveEntry('package/dist/index.js', 'File')).toBe(true);
    expect(isSafeArchiveEntry('package/dist', 'Directory')).toBe(true);
  });

  it('refuses links and paths that escape', () => {
    expect(isSafeArchiveEntry('package/link', 'SymbolicLink')).toBe(false);
    expect(isSafeArchiveEntry('package/link', 'Link')).toBe(false);
    expect(isSafeArchiveEntry('../secret.txt', 'File')).toBe(false);
    expect(isSafeArchiveEntry('package/../../secret.txt', 'File')).toBe(false);
    expect(isSafeArchiveEntry(path.resolve('outside.txt'), 'File')).toBe(false);
    expect(isSafeArchiveEntry('package/file.js')).toBe(false);
    expect(isSafeArchiveEntry('C:temp/file.js', 'File')).toBe(false);
  });
});
