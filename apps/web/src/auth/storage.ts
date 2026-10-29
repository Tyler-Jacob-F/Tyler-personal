/**
 * What survives a reload: the refresh token and the email it belongs to. The id and access
 * tokens stay in memory. Storage can be absent or throw (private windows, cleared data),
 * so every call is guarded and the app works without it.
 */
const KEYS = { refreshToken: 'keep.refreshToken', email: 'keep.email' } as const;

export interface Remembered {
  refreshToken: string;
  email: string;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the session simply will not survive a reload.
  }
}

export const remembered = {
  load(): Remembered | null {
    const refreshToken = read(KEYS.refreshToken);
    const email = read(KEYS.email);
    return refreshToken && email ? { refreshToken, email } : null;
  },
  email(): string | null {
    return read(KEYS.email);
  },
  save({ refreshToken, email }: Remembered): void {
    write(KEYS.refreshToken, refreshToken);
    write(KEYS.email, email);
  },
  /** Forget the token but keep the email, so the sign-in form is prefilled next time. */
  forgetToken(): void {
    write(KEYS.refreshToken, null);
  },
};
