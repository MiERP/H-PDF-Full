import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initUpdateBanner, showUpdateDialog } from '../js/desktop/update-check';

const RESULT = {
  current: '1.0.5',
  latest: '1.0.6',
  newer: true,
  url: 'https://github.com/MiERP/H-PDF-Full/releases/tag/1.0.6',
};

const dialog = () => document.getElementById('desktop-update-dialog');

describe('desktop update dialog', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.bentoDesktop;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('names both versions and links the release notes', () => {
    showUpdateDialog(RESULT);
    expect(dialog()!.textContent).toContain('1.0.5 → 1.0.6');
    expect(dialog()!.querySelector('a')!.getAttribute('href')).toBe(RESULT.url);
  });

  it('puts the dialog off for a day on Later', () => {
    showUpdateDialog(RESULT);
    dialog()!.querySelector<HTMLElement>('.desktop-update-later')!.click();
    expect(dialog()).toBeNull();
    const until = Number(localStorage.getItem('cit:update-snoozed-until'));
    expect(until - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it('opens the download page when the app cannot install itself', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    showUpdateDialog({ ...RESULT, canInstall: false });
    dialog()!.querySelector<HTMLElement>('.desktop-update-primary')!.click();
    expect(open).toHaveBeenCalledWith(RESULT.url, '_blank', 'noopener');
  });

  it('does not resurrect a stale result when the check fails', async () => {
    document.body.innerHTML = '<span id="app-version">1.0.5</span>';
    localStorage.setItem(
      'cit:update-check',
      JSON.stringify({
        time: Date.now() - 2 * 24 * 60 * 60 * 1000,
        current: '1.0.5',
        latest: '1.0.6',
        newer: true,
        url: RESULT.url,
      })
    );
    window.bentoDesktop = {
      checkForUpdate: vi.fn(async () => ({
        ok: false,
        current: '1.0.5',
        error: 'network',
      })),
    } as unknown as NonNullable<typeof window.bentoDesktop>;

    await initUpdateBanner();

    expect(dialog()).toBeNull();
    expect(document.getElementById('desktop-update-status')).toBeNull();
  });

  it('backs off after an automatic attempt when offline', async () => {
    document.body.innerHTML = '<span id="app-version">1.0.5</span>';
    localStorage.setItem('cit:update-check-attempt', String(Date.now()));
    const checkForUpdate = vi.fn(async () => ({ ok: true, ...RESULT }));
    window.bentoDesktop = {
      checkForUpdate,
    } as unknown as NonNullable<typeof window.bentoDesktop>;

    await initUpdateBanner();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('installs when it can, and says so', async () => {
    let resolveInstall: (v: { ok: true }) => void = () => {};
    const installUpdate = vi.fn(
      () => new Promise<{ ok: true }>((r) => (resolveInstall = r))
    );
    window.bentoDesktop = {
      checkForUpdate: vi.fn(async () => ({ ok: true, ...RESULT })),
      installUpdate,
      onUpdateProgress: () => () => {},
    } as unknown as NonNullable<typeof window.bentoDesktop>;
    showUpdateDialog({ ...RESULT, canInstall: true });
    const primary = dialog()!.querySelector<HTMLButtonElement>(
      '.desktop-update-primary'
    )!;
    primary.click();
    await vi.waitFor(() => expect(installUpdate).toHaveBeenCalled());
    expect(primary.disabled).toBe(true);
    resolveInstall({ ok: true });
    await vi.waitFor(() =>
      expect(
        dialog()!.querySelector('.desktop-update-status')!.textContent
      ).not.toMatch(/%/)
    );
  });
});
