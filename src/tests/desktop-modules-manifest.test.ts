import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ManifestItem {
  kind?: string;
  bundled?: boolean;
  mount?: string;
  probe?: string;
  url?: string;
  integrity?: string;
  files?: Array<{ path?: string; url?: string; sha256?: string }>;
}

const manifest = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), 'desktop/app/modules-manifest.json'),
    'utf8'
  )
) as { modules: Record<string, ManifestItem> };

const entries = Object.entries(manifest.modules);

describe('desktop engine manifest', () => {
  it('has modules', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s declares a safe mount and probe', (_name, item) => {
    expect(item.mount?.startsWith('/')).toBe(true);
    expect(item.probe).toBeTruthy();
    expect(path.isAbsolute(item.probe!)).toBe(false);
    expect(item.probe!.split(/[\\/]/)).not.toContain('..');
  });

  it.each(entries)('%s pins its download', (_name, item) => {
    if (item.kind === 'npm-tarball') {
      expect(item.url).toMatch(/^https:\/\//);
      expect(item.integrity).toMatch(/^sha512-[A-Za-z0-9+/=]+$/);
      return;
    }
    expect(item.kind).toBe('files');
    expect(item.files?.length).toBeGreaterThan(0);
    for (const file of item.files ?? []) {
      expect(file.path).toBeTruthy();
      expect(path.isAbsolute(file.path!)).toBe(false);
      expect(file.path!.split(/[\\/]/)).not.toContain('..');
      expect(file.url).toMatch(/^https:\/\//);
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
