import { useEffect } from 'react';

/**
 * API.Bible's Fair Use Management System (https://docs.api.bible/, "FUMS"): their licence
 * for the NIV asks a page that shows their text to load one small script and report each
 * passage's token. Loaded once, the first time a passage of theirs is on the page; never
 * for the public-domain texts or the ESV.
 */
const FUMS_SRC = 'https://cdn.scripture.api.bible/fums/fumsv3.min.js';

declare global {
  interface Window {
    _BAPI?: { t: (id: string) => void };
  }
}

const reported = new Set<string>();
let queued: string[] = [];
let loading = false;

function flush() {
  if (!window._BAPI) return;
  for (const id of queued) window._BAPI.t(id);
  queued = [];
}

export function reportFums(id: string): void {
  if (reported.has(id)) return;
  reported.add(id);
  queued.push(id);
  if (window._BAPI) return flush();
  if (loading) return;
  loading = true;
  const script = document.createElement('script');
  script.src = FUMS_SRC;
  script.async = true;
  script.addEventListener('load', flush);
  document.head.appendChild(script);
}

/** Report a passage's token once it is on the page. */
export function useFums(id: string | undefined): void {
  useEffect(() => {
    if (id) reportFums(id);
  }, [id]);
}
