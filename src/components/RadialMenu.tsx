'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePhantomStore, type ActiveView } from '@/store/phantom-store';
import {
  Network,
  Clock,
  Workflow,
  Shield,
  Bell,
  FileSearch,
  Cpu,
  Crosshair,
  Satellite,
  BarChart3,
  BookOpen,
  FileText,
  Ghost,
  Plus,
  RotateCw,
} from 'lucide-react';

/**
 * RadialMenu — ROTATIVE circular module selector fixed on the right side.
 *
 * Per the user's request: "the circular command center is rotative by the way"
 *
 * Behaviour:
 *   • Closed  — center "disk" hub with a slow idle rotation ring + the active
 *               module's icon on top. Click to open.
 *   • Open    — 12 modules radiate out in a circle. The whole ring can be
 *               rotated by:
 *                 - mouse wheel (Δ rotates the ring)
 *                 - drag (pointer-down + move rotates the ring)
 *                 - clicking the small ⟳ icon at the hub (auto-rotate one step)
 *               Hovering a segment shows a ~10-word description tooltip.
 *               Clicking a segment switches the active view + closes the menu.
 *   • Active  — the active module stays highlighted and pulses.
 *
 * The disk-changing effect is achieved by rotating the entire ring container
 * (CSS transform) while keeping the segment icons counter-rotated so they
 * remain upright.
 */

interface RadialModule {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
  description: string;  // ~10 words
  color: string;        // tailwind text color class
  bgColor: string;      // tailwind bg/border classes for active state
}

const MODULES: RadialModule[] = [
  { id: 'graph', label: 'Graph', icon: <Network className="size-5" />, description: 'Visual entity relationship network map', color: 'text-cyan-400', bgColor: 'border-cyan-500/50 bg-cyan-500/10' },
  { id: 'osint', label: 'OSINT', icon: <Crosshair className="size-5" />, description: 'Open-source intelligence scanning toolkit', color: 'text-purple-400', bgColor: 'border-purple-500/50 bg-purple-500/10' },
  { id: 'cyberwatch', label: 'CyberWatch', icon: <Satellite className="size-5" />, description: 'Live cyber threat intelligence feed monitor', color: 'text-green-400', bgColor: 'border-green-500/50 bg-green-500/10' },
  { id: 'timeline', label: 'Timeline', icon: <Clock className="size-5" />, description: 'Chronological case event timeline view', color: 'text-cyan-400', bgColor: 'border-cyan-500/50 bg-cyan-500/10' },
  { id: 'transforms', label: 'Transforms', icon: <Workflow className="size-5" />, description: 'Data transformation and entity expansion tools', color: 'text-purple-400', bgColor: 'border-purple-500/50 bg-purple-500/10' },
  { id: 'analysis', label: 'Analysis', icon: <BarChart3 className="size-5" />, description: 'Network analysis and graph centrality metrics', color: 'text-green-400', bgColor: 'border-green-500/50 bg-green-500/10' },
  { id: 'notebook', label: 'Notebook', icon: <BookOpen className="size-5" />, description: 'Analyst investigation notebook and notes', color: 'text-cyan-400', bgColor: 'border-cyan-500/50 bg-cyan-500/10' },
  { id: 'evidence', label: 'Evidence', icon: <FileSearch className="size-5" />, description: 'Case evidence collection and chain of custody', color: 'text-purple-400', bgColor: 'border-purple-500/50 bg-purple-500/10' },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="size-5" />, description: 'Real-time watchlist alert notifications', color: 'text-green-400', bgColor: 'border-green-500/50 bg-green-500/10' },
  { id: 'watchlist', label: 'Watchlist', icon: <Shield className="size-5" />, description: 'Monitored entities and trigger conditions', color: 'text-cyan-400', bgColor: 'border-cyan-500/50 bg-cyan-500/10' },
  { id: 'modules', label: 'Modules', icon: <Cpu className="size-5" />, description: 'Custom investigation module marketplace', color: 'text-purple-400', bgColor: 'border-purple-500/50 bg-purple-500/10' },
  { id: 'report', label: 'Report', icon: <FileText className="size-5" />, description: 'Case report generation and export', color: 'text-green-400', bgColor: 'border-green-500/50 bg-green-500/10' },
];

const RADIUS = 110;
const SEGMENT_COUNT = MODULES.length;
const ANGLE_STEP = 360 / SEGMENT_COUNT;

export default function RadialMenu() {
  const activeView = usePhantomStore((s) => s.activeView);
  const setActiveView = usePhantomStore((s) => s.setActiveView);
  const radialMenuOpen = usePhantomStore((s) => s.radialMenuOpen);
  const setRadialMenuOpen = usePhantomStore((s) => s.setRadialMenuOpen);

  // Rotative state — degrees the ring is rotated by (user-controlled)
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);

  // Compute pointer angle relative to the center (in degrees, 0 = top)
  const pointerAngle = useCallback((clientX: number, clientY: number, centerX: number, centerY: number) => {
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const rad = Math.atan2(dx, -dy); // 0 = up, increases clockwise
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }, []);

  // Wheel rotates the ring
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!radialMenuOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? ANGLE_STEP : -ANGLE_STEP;
    setRotation((r) => r + delta);
  }, [radialMenuOpen]);

  // Drag-to-rotate — only starts when the pointer lands on the orbit ring or
  // the menu background (NOT on a button, so hub/segment clicks still work).
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!radialMenuOpen) return;
    // Only initiate drag from the ring/orbit background — never from buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = pointerAngle(e.clientX, e.clientY, cx, cy);
    dragRef.current = { startAngle, startRotation: rotation };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [radialMenuOpen, pointerAngle, rotation]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = pointerAngle(e.clientX, e.clientY, cx, cy);
    const delta = currentAngle - dragRef.current.startAngle;
    setRotation(dragRef.current.startRotation + delta);
  }, [dragging, pointerAngle]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  // Snap to nearest segment on close (nice "click" feel)
  useEffect(() => {
    if (!radialMenuOpen && rotation !== 0) {
      // Don't auto-reset — keep the rotation the user chose.
      // (Snapping is intentionally disabled to feel less rigid.)
    }
  }, [radialMenuOpen, rotation]);

  // Rotate one step (clockwise) — bound to the hub ⟳ button
  const rotateOneStep = useCallback(() => {
    setRotation((r) => r + ANGLE_STEP);
  }, []);

  const activeIdx = MODULES.findIndex((m) => m.id === activeView);

  return (
    <div
      className={`radial-menu ${dragging ? 'dragging' : ''}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Rotating ring container — holds all segments + decorative orbit ring */}
      <div
        className="radial-ring"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Decorative orbit ring */}
        <div className="radial-orbit" />

        {/* Radial segments — only visible when open */}
        {radialMenuOpen && MODULES.map((mod, i) => {
          const baseAngle = i * ANGLE_STEP - 90; // start from top
          const rad = (baseAngle * Math.PI) / 180;
          const x = Math.cos(rad) * RADIUS;
          const y = Math.sin(rad) * RADIUS;
          const isActive = activeView === mod.id;
          const isHovered = hoveredIdx === i;
          const delay = i * 0.025;

          return (
            <button
              key={mod.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveView(mod.id);
                setRadialMenuOpen(false);
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`radial-segment transition-all ${
                isActive
                  ? `${mod.bgColor} ${mod.color} border`
                  : 'bg-background/80 border-cyan-500/20 text-cyan-400/60 hover:border-cyan-500/50 hover:text-cyan-400'
              } backdrop-blur-sm ${isHovered ? 'scale-125 z-10' : ''}`}
              style={{
                left: `calc(50% + ${x}px - 24px)`,
                top: `calc(50% + ${y}px - 24px)`,
                animationDelay: `${delay}s`,
                // Counter-rotate so icons stay upright while the ring rotates
                transform: `rotate(${-rotation}deg)`,
              } as React.CSSProperties}
              aria-label={mod.label}
            >
              {mod.icon}
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-400 pulse-dot" />
              )}
            </button>
          );
        })}
      </div>

      {/* Center hub (the "disk") — NOT rotated so it stays stable for clicking */}
      <button
        onClick={() => setRadialMenuOpen(!radialMenuOpen)}
        className={`radial-center ${radialMenuOpen ? 'expanded' : ''}`}
        aria-label={radialMenuOpen ? 'Close module menu' : 'Open module menu'}
        title={radialMenuOpen ? 'Close' : 'Modules'}
      >
        {radialMenuOpen ? (
          <Plus className="size-6 neon-cyan rotate-45" />
        ) : (
          <>
            {/* Active module icon on the hub when closed */}
            {activeIdx >= 0 && (
              <div className="flex flex-col items-center">
                {MODULES[activeIdx].icon}
                <span className="text-[8px] mt-0.5 text-cyan-400/60 tracking-wide uppercase">
                  {MODULES[activeIdx].label}
                </span>
              </div>
            )}
          </>
        )}
      </button>

      {/* Rotate-one-step button (only when open) */}
      {radialMenuOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); rotateOneStep(); }}
          className="radial-rotate-btn"
          aria-label="Rotate ring one step"
          title="Rotate ring (or use mouse wheel / drag)"
        >
          <RotateCw className="size-3" />
        </button>
      )}

      {/* Description tooltip — positioned to the left of the menu */}
      {radialMenuOpen && hoveredIdx !== null && (
        <div className="radial-description-floating">
          <span className={MODULES[hoveredIdx].color}>{MODULES[hoveredIdx].label}</span>
          <span className="text-muted-foreground ml-2 text-[11px]">{MODULES[hoveredIdx].description}</span>
        </div>
      )}

      {/* Active module label (always visible when menu is closed) */}
      {!radialMenuOpen && (
        <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none">
          <span className="text-[10px] text-cyan-400/50 tracking-widest uppercase">
            {MODULES.find(m => m.id === activeView)?.label || 'Graph'}
          </span>
          <div className="text-[8px] text-muted-foreground/50 tracking-wide mt-0.5">
            scroll · drag · click ⟳
          </div>
        </div>
      )}
    </div>
  );
}
