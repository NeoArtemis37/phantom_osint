'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi, type LocaleParams } from '@/lib/api-client';
import { usePhantomStore } from '@/store/phantom-store';
import type { SearchResult } from '@/types';

interface UseLiveSearchOptions {
  caseId?: string;
  debounceMs?: number;
  minQueryLength?: number;
  enabled?: boolean;
  /** Optional locale override; defaults to the global investigation locale from the store. */
  locale?: LocaleParams;
}

interface LiveSearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  cached: boolean;
}

/**
 * Debounced live search hook — fires automatically as the user types.
 * Results stream in with fade-in animations on the UI side.
 */
export function useLiveSearch({
  caseId,
  debounceMs = 500,
  minQueryLength = 2,
  enabled = true,
  locale,
}: UseLiveSearchOptions = {}) {
  // ===== INVESTIGATION LOCALE (defaults to the global store locale when caller doesn't override) =====
  const storeCountry = usePhantomStore((s) => s.investigationCountry);
  const storeLanguage = usePhantomStore((s) => s.investigationLanguage);
  const storeRegionalOnly = usePhantomStore((s) => s.investigationRegionalOnly);
  const activeLocale: LocaleParams = locale ?? {
    country: storeCountry,
    language: storeLanguage,
    regionalOnly: storeRegionalOnly,
  };

  const [query, setQuery] = useState('');
  const [state, setState] = useState<LiveSearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    cached: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const search = useCallback(
    async (q: string) => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const trimmed = q.trim();
      if (!enabled || trimmed.length < minQueryLength) {
        setState({
          query: trimmed,
          results: [],
          loading: false,
          error: null,
          cached: false,
        });
        return;
      }

      setState((s) => ({ ...s, query: trimmed, loading: true, error: null }));

      const currentReqId = ++reqId.current;

      try {
        const result = await searchApi.live(trimmed, caseId, activeLocale);
        // Only apply if this is still the latest request
        if (currentReqId === reqId.current) {
          setState({
            query: trimmed,
            results: result.results || [],
            loading: false,
            error: null,
            cached: !!result.cached,
          });
        }
      } catch (err) {
        if (currentReqId === reqId.current) {
          setState({
            query: trimmed,
            results: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Search failed',
            cached: false,
          });
        }
      }
    },
    [caseId, enabled, minQueryLength, activeLocale]
  );

  // Debounce effect — fires when query changes.
  // All setState calls happen inside the async `search` callback (never
  // synchronously in the effect body) to avoid cascading renders.
  // Short queries are cleared instantly (0ms); valid queries are debounced.
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const trimmed = query.trim();
    const delay = trimmed.length < minQueryLength ? 0 : debounceMs;

    debounceTimer.current = setTimeout(() => {
      search(query);
    }, delay);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, search, debounceMs, minQueryLength]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setState({
      query: '',
      results: [],
      loading: false,
      error: null,
      cached: false,
    });
  }, []);

  return {
    query,
    setQuery,
    results: state.results,
    loading: state.loading,
    error: state.error,
    cached: state.cached,
    clear,
  };
}
