/**
 * Path containment for the app:// protocol and the engine mounts. Every path
 * that comes from a URL is resolved under a fixed base directory and refused
 * when it would escape that directory (absolute paths, `..` segments, a
 * different drive on Windows).
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves `candidate` under `baseDir` and returns the absolute path, or
 * null when it points at `baseDir` itself or outside it.
 *
 * `candidate` may be absolute-looking: `path.resolve` would let that replace
 * `baseDir`, so the result is checked with `path.relative` instead.
 */
export function resolveInside(
  baseDir: string,
  candidate: string
): string | null {
  const base = path.resolve(baseDir);
  const full = path.resolve(base, candidate);
  const relative = path.relative(base, full);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return full;
}

/**
 * Resolves a URL path such as `/tools/merge-pdf.html` under `baseDir`.
 * URL paths start with a slash; on Windows `path.resolve(base, '/x')` would
 * jump to the drive root, so the leading separators are dropped first.
 * `..` segments still cannot escape the base directory.
 */
export function resolveUrlPath(
  baseDir: string,
  urlPath: string
): string | null {
  return resolveInside(baseDir, urlPath.replace(/^[/\\]+/, ''));
}

/**
 * Resolves an existing file under `baseDir` and keeps only paths whose real
 * location is still inside it. This rejects a symlink or junction anywhere in
 * the path (the final file or one of its parent directories).
 */
export function resolveFileInside(
  baseDir: string,
  candidate: string
): string | null {
  const full = resolveUrlPath(baseDir, candidate);
  if (!full) return null;
  try {
    if (!fs.statSync(full).isFile()) return null;
  } catch {
    return null;
  }
  try {
    const root = fs.realpathSync(baseDir);
    const real = fs.realpathSync(full);
    const relative = path.relative(root, real);
    if (
      relative === '' ||
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return null;
    }
  } catch {
    // asar archives may not implement realpath; the lexical check above is
    // already containment-safe.
  }
  return full;
}

/** An archive entry that cannot write outside the extraction directory. */
export function isSafeArchiveEntry(
  entryPath: string,
  entryType?: string
): boolean {
  // Default-deny: only regular files and directories may be extracted.
  if (entryType !== 'File' && entryType !== 'Directory') return false;
  // A drive prefix (`C:foo`) is relative to that drive on Windows.
  if (entryPath.includes(':')) return false;
  return (
    !path.isAbsolute(entryPath) && !entryPath.split(/[\\/]/).includes('..')
  );
}
