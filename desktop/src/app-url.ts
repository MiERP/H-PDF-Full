/** The only origin the Electron window may navigate to or load from. */
export const APP_HOST = 'bentopdf';

export function isAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'app:' && url.host === APP_HOST;
  } catch {
    return false;
  }
}
