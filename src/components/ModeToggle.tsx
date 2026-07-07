'use client';

import { usePhantomStore } from '@/store/phantom-store';
import { Zap, Radar } from 'lucide-react';

/**
 * ModeToggle — Active/Passive search mode switch.
 *
 * Per the user's request: "on the top left side only two options to switch
 * between active and passive mode, for global search, deep search".
 *
 * - ACTIVE  (cyan glow)  : global quick search — fast, broad, cached results
 * - PASSIVE (purple glow) : deep thorough search — exhaustive, slower, more
 *                           queries, deeper platform probing
 *
 * Floats as a small pill below the compact action bar (top-left). The bar
 * itself owns the PHANTOM logo + case selector so this component is just the
 * two-option toggle plus a one-line mode description.
 */
export default function ModeToggle() {
  const searchMode = usePhantomStore((s) => s.searchMode);
  const setSearchMode = usePhantomStore((s) => s.setSearchMode);

  return (
    <div className="fixed top-14 left-3 z-50 flex items-center gap-2 pointer-events-auto">
      {/* Two-option toggle */}
      <div className="flex items-center bg-background/80 border border-cyan-500/20 rounded-full p-0.5 backdrop-blur-sm shadow-[0_0_12px_rgba(0,0,0,0.4)]">
        <button
          onClick={() => setSearchMode('active')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide transition-all ${
            searchMode === 'active'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 mode-toggle-active'
              : 'text-muted-foreground hover:text-cyan-400/70'
          }`}
          title="Active mode: global quick search — fast, broad, cached results"
        >
          <Zap className="size-3" />
          <span className="hidden sm:inline">ACTIVE</span>
          <span className="sm:hidden">A</span>
        </button>
        <button
          onClick={() => setSearchMode('passive')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide transition-all ${
            searchMode === 'passive'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/40'
              : 'text-muted-foreground hover:text-purple-400/70'
          }`}
          title="Passive mode: deep thorough search — exhaustive, slower, deeper probing"
        >
          <Radar className="size-3" />
          <span className="hidden sm:inline">PASSIVE</span>
          <span className="sm:hidden">P</span>
        </button>
      </div>

      {/* Mode description (subtle, right of toggle) */}
      <div className="hidden md:block text-[9px] text-muted-foreground/60 tracking-wide">
        {searchMode === 'active' ? 'global search' : 'deep search'}
      </div>
    </div>
  );
}
