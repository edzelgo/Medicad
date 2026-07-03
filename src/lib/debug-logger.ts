// Lightweight debug logger. No-op in production unless explicitly enabled.
// Enable at runtime with `localStorage.setItem("lovable:debug", "1")` or
// `window.__LOVABLE_DEBUG__ = true`. Build-time flag: `VITE_DEBUG_LOG=1`.

function isEnabled(): boolean {
  try {
    if (typeof window !== "undefined") {
      if ((window as unknown as { __LOVABLE_DEBUG__?: boolean }).__LOVABLE_DEBUG__) return true;
      const ls = window.localStorage?.getItem("lovable:debug");
      if (ls === "1" || ls === "true") return true;
    }
  } catch { /* storage may be blocked */ }
  try {
    if (import.meta.env?.VITE_DEBUG_LOG === "1" || import.meta.env?.DEV) return true;
  } catch { /* ignore */ }
  return false;
}

export function createDebugLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    debug: (...args: unknown[]) => { if (isEnabled()) console.debug(prefix, ...args); },
    warn: (...args: unknown[]) => { if (isEnabled()) console.warn(prefix, ...args); },
    // Errors always logged — they matter regardless of the debug flag.
    error: (...args: unknown[]) => { console.error(prefix, ...args); },
  };
}