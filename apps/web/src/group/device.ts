/**
 * What a phone holds after opening the group link: the device token, under `keep.device`
 * (docs/phases/04-group.md "Decided during implementation"). Guarded like the refresh
 * token: absent or throwing storage means the device is a guest for the tab.
 */
export const DEVICE_KEY = 'keep.device';

export const device = {
  load(): string | null {
    try {
      return window.localStorage.getItem(DEVICE_KEY);
    } catch {
      return null;
    }
  },
  save(token: string): void {
    try {
      window.localStorage.setItem(DEVICE_KEY, token);
    } catch {
      // The slice works for the tab; the next visit asks for the link again.
    }
  },
  /** A cleared or expired device, or a rotated-and-cleared link: forget it and ask for the link. */
  forget(): void {
    try {
      window.localStorage.removeItem(DEVICE_KEY);
    } catch {
      // Nothing to forget.
    }
  },
};
