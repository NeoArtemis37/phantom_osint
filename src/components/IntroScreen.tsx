'use client';

import { useEffect, useState } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import { Ghost } from 'lucide-react';

/**
 * IntroScreen — fade-in/fade-out animation shown once after authentication.
 * Displays the artemis37 quote: "Borrow the world, learn about mysteries;
 * something new by artemis37" while fades run, then reveals the main system.
 */
export default function IntroScreen() {
  const introSeen = usePhantomStore((s) => s.introSeen);
  const setIntroSeen = usePhantomStore((s) => s.setIntroSeen);
  const [fadingOut, setFadingOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Derive visibility: show when not yet seen AND not dismissed
  const visible = !introSeen && !dismissed;

  useEffect(() => {
    if (introSeen || dismissed) return;

    // Hold the quote for 3.2s, then fade out over 0.8s, then dismiss
    const fadeTimer = setTimeout(() => setFadingOut(true), 3200);
    const dismissTimer = setTimeout(() => {
      setIntroSeen(true);
      setDismissed(true);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [introSeen, dismissed, setIntroSeen]);

  if (!visible) return null;

  return (
    <div className={`intro-screen ${fadingOut ? 'fading-out' : ''}`}>
      {/* Expanding rings */}
      <div className="intro-ring" style={{ width: 120, height: 120, animationDelay: '0s' }} />
      <div className="intro-ring" style={{ width: 120, height: 120, animationDelay: '1s' }} />
      <div className="intro-ring" style={{ width: 120, height: 120, animationDelay: '2s' }} />

      {/* Scan line */}
      <div className="intro-scan" />

      {/* Center content */}
      <div className="intro-text flex flex-col items-center gap-6 text-center px-8">
        <div className="relative">
          <Ghost className="size-16 neon-cyan" style={{ filter: 'drop-shadow(0 0 12px rgba(0, 229, 255, 0.6))' }} />
          <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full" />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-light tracking-[0.3em] neon-cyan uppercase">
            PHANTOM
          </h1>
          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          <p className="text-base md:text-lg text-foreground/80 italic font-light max-w-md leading-relaxed">
            &ldquo;Borrow the world, learn about mysteries;
            <br />
            something new by artemis37&rdquo;
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-cyan-400/50 tracking-[0.4em] uppercase mt-4">
          <div className="size-1 rounded-full bg-cyan-400 animate-pulse" />
          <span>Initializing system</span>
          <div className="size-1 rounded-full bg-cyan-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
