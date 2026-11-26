import { describe, expect, it } from 'vitest';
import { isAppUrl } from '../../desktop/src/app-url';

describe('isAppUrl', () => {
  it('accepts the application origin', () => {
    expect(isAppUrl('app://bentopdf/index.html')).toBe(true);
    expect(isAppUrl('app://bentopdf')).toBe(true);
  });

  it('rejects other hosts on the app scheme', () => {
    expect(isAppUrl('app://evil/index.html')).toBe(false);
    expect(isAppUrl('app://bentopdf.evil/index.html')).toBe(false);
    expect(isAppUrl('app://bentopdf@evil/index.html')).toBe(false);
  });

  it('rejects other schemes and malformed URLs', () => {
    expect(isAppUrl('https://bentopdf/index.html')).toBe(false);
    expect(isAppUrl('file:///C:/secret.txt')).toBe(false);
    expect(isAppUrl('javascript:alert(1)')).toBe(false);
    expect(isAppUrl('not a url')).toBe(false);
  });
});
