// =============================================================================
// ZAI Invoke Helper — UNRESTRICTED (no rate limiting)
// =============================================================================
// Per the user's request: "remove the rate limiters for full use every time"
//
// This module previously throttled z-ai-web-dev-sdk calls (max 4 concurrency,
// 250ms interval, 60s cache, exponential backoff on 429). That throttling
// caused scans to feel sluggish when the SDK could handle the parallel load.
//
// This version is a thin pass-through:
//   • NO concurrency cap      — every call fires immediately in parallel
//   • NO minimum interval     — no drip-pace delay between calls
//   • NO result caching       — every call hits the SDK fresh (full use every time)
//   • NO retry/backoff        — if a call 429s, the caller's own try/catch handles it
//
// Existing exports (`rateLimitedInvoke`, `parallelWebSearch`, `clearInvokeCache`,
// `getInvokeCacheStats`) are preserved so call sites don't need to change, but
// they now execute without any throttling.
//
// Author: artemis37
// =============================================================================

type ZaiFunctions = {
  functions: {
    invoke: (name: string, args: unknown) => Promise<unknown>;
  };
};

let _zaiInstance: ZaiFunctions | null = null;
let _zaiPromise: Promise<ZaiFunctions> | null = null;

async function getZai(): Promise<ZaiFunctions> {
  if (_zaiInstance) return _zaiInstance;
  if (_zaiPromise) return _zaiPromise;
  _zaiPromise = (async () => {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    _zaiInstance = zai as unknown as ZaiFunctions;
    return _zaiInstance;
  })();
  return _zaiPromise;
}

// ---------------------------------------------------------------------------
// Public API — pass-through, no throttling
// ---------------------------------------------------------------------------

export interface InvokeOptions {
  /** Kept for backwards compat — IGNORED (no caching). */
  cacheTtlMs?: number;
  /** Kept for backwards compat — IGNORED (no retries). */
  maxRetries?: number;
  /** Kept for backwards compat — IGNORED. */
  functionName?: string;
}

/**
 * UNRESTRICTED invoke — calls zai.functions.invoke() directly with no
 * concurrency cap, no interval, no cache, no retry. Returns the SDK's raw
 * response, or `null` on failure (caller handles gracefully).
 *
 * The signature matches the old rate-limited version so existing call sites
 * keep working unchanged.
 */
export async function rateLimitedInvoke<T = unknown>(
  functionName: string,
  args: unknown,
  _options: InvokeOptions = {}
): Promise<T | null> {
  try {
    const zai = await getZai();
    const result = await zai.functions.invoke(functionName, args);
    return result as T;
  } catch (err) {
    // No retry — surface the failure as null and let the caller decide.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[invoke] ${functionName} failed:`, msg);
    return null;
  }
}

/**
 * UNRESTRICTED parallel web_search — fires all queries in parallel with no
 * concurrency cap. Returns array of { tag, results } aligned with the input
 * queries — never throws.
 */
export async function parallelWebSearch(
  queries: Array<{ query: string; num?: number; tag?: string }>,
  _options: InvokeOptions = {}
): Promise<Array<{ tag?: string; results: unknown[] }>> {
  const settled = await Promise.allSettled(
    queries.map(async (q) => {
      const r = await rateLimitedInvoke<unknown[]>('web_search', { query: q.query, num: q.num ?? 10 });
      return { tag: q.tag, results: Array.isArray(r) ? r : [] };
    })
  );
  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { tag: queries[i]?.tag, results: [] }
  );
}

/** No-op (no cache to clear). Kept for backwards compat. */
export function clearInvokeCache(): void {
  // No-op — unrestricted mode does not cache.
}

/** Returns zeroed stats (no cache in unrestricted mode). */
export function getInvokeCacheStats(): { size: number; hitRate: number } {
  return { size: 0, hitRate: 0 };
}
