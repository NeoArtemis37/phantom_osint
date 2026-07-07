'use client';

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { Lock, ShieldCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// <CodeBlock /> — PROTECTED code / IOC display block.
// -----------------------------------------------------------------------------
// Defences:
//   1. ANTI-COPY:   user-select:none, onCopy/onCut/onContextMenu/onDragStart
//                    all call preventDefault(). Keyboard Ctrl+C is also blocked
//                    while focus is inside the block.
//   2. ANTI-XSS:    all input is escaped before render — `<`, `>`, `&`, `"`,
//                    `'` become HTML entities. We never use dangerouslySetInnerHTML.
//   3. ANTI-INJECTION: a sanitiser strips dangerous token patterns from the
//                    *displayed* string:
//                      - <script ...>          → &lt;script ...&gt; (escaped)
//                      - javascript:           → removed
//                      - data:text/html        → removed
//                      - on\w+="..." handlers  → removed
//                      - <iframe / <object / <embed → escaped
//                    The raw value is also rejected entirely if it contains a
//                    `<script` tag — the block renders a "blocked" notice instead.
//   4. BLUR ON IDLE: content is blurred by default; analyst must click "reveal"
//                    to read it. This prevents shoulder-surfing and casual
//                    copy via screenshots of the visible text.
//
// Used by the CyberWatch panel to render IOCs (CVEs, hashes, IPs, domains,
// malicious URLs) safely.
// =============================================================================

interface CodeBlockProps {
  /** Raw content to display. Will be escaped + sanitised. */
  code: string;
  /** Optional language label (CVE / SHA256 / IP / URL / etc.) */
  label?: string;
  /** Show line numbers (default true) */
  lineNumbers?: boolean;
  /** Visual variant */
  variant?: 'default' | 'danger' | 'warning' | 'success';
  /** Optional title above the block */
  title?: string;
  /** Extra className on the wrapper */
  className?: string;
  /** When false, the blur-on-idle is disabled (e.g. for non-sensitive snippets) */
  sensitive?: boolean;
}

// --- sanitiser ---------------------------------------------------------------

const INJECTION_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /javascript:/gi, replace: '' },
  { re: /data:text\/html/gi, replace: '' },
  { re: /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, replace: '' },
  { re: /<script\b[^>]*>[\s\S]*?<\/script>/gi, replace: '' },
  { re: /<iframe\b/gi, replace: '&lt;iframe ' },
  { re: /<object\b/gi, replace: '&lt;object ' },
  { re: /<embed\b/gi, replace: '&lt;embed ' },
  { re: /<script\b/gi, replace: '&lt;script ' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitise raw input for safe *text* display.
 * Returns { safe: boolean, display: string }.
 * If `safe === false` the raw input contained a script tag — caller should
 * render the "blocked" notice instead.
 */
function sanitise(raw: string): { safe: boolean; display: string } {
  if (raw == null) return { safe: true, display: '' };
  let str = String(raw);
  // Reject outright if it still contains a live script tag after stripping
  const hasScript = /<script\b/i.test(str);
  for (const p of INJECTION_PATTERNS) {
    str = str.replace(p.re, p.replace);
  }
  const display = escapeHtml(str);
  return { safe: !hasScript, display };
}

// --- component ---------------------------------------------------------------

const VARIANT_STYLES: Record<NonNullable<CodeBlockProps['variant']>, { border: string; glow: string; label: string; badge: string }> = {
  default: {
    border: 'border-cyan-500/25',
    glow: 'shadow-[0_0_18px_rgba(0,229,255,0.08)]',
    label: 'text-cyan-400',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
  danger: {
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_18px_rgba(255,45,111,0.12)]',
    label: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  warning: {
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_18px_rgba(255,107,53,0.12)]',
    label: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  success: {
    border: 'border-green-500/30',
    glow: 'shadow-[0_0_18px_rgba(0,255,157,0.12)]',
    label: 'text-green-400',
    badge: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
};

export function CodeBlock({
  code,
  label,
  lineNumbers = true,
  variant = 'default',
  title,
  className,
  sensitive = true,
}: CodeBlockProps) {
  const [revealed, setRevealed] = useState(!sensitive);
  const [copyAttempt, setCopyAttempt] = useState(false);

  const { safe, display } = useMemo(() => sanitise(code), [code]);
  const lines = useMemo(() => display.split('\n'), [display]);
  const vs = VARIANT_STYLES[variant];

  // Block every copy / cut / context-menu / drag attempt
  const blockEvent = useCallback((e: React.ClipboardEvent | React.MouseEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCopyAttempt(true);
    window.setTimeout(() => setCopyAttempt(false), 1200);
  }, []);

  const blockKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Block Ctrl+C / Cmd+C / Ctrl+X / Ctrl+A inside the block
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      setCopyAttempt(true);
      window.setTimeout(() => setCopyAttempt(false), 1200);
    }
  }, []);

  if (!safe) {
    // Input contained a live script tag — refuse to render it
    return (
      <div
        className={cn(
          'rounded-md border bg-red-950/30 p-3 flex items-start gap-2',
          'border-red-500/40 shadow-[0_0_18px_rgba(255,45,111,0.15)]',
          className
        )}
        role="alert"
      >
        <AlertTriangle className="size-4 text-red-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-red-400 tracking-wide">CONTENT BLOCKED</p>
          <p className="text-[10px] text-red-300/70 mt-0.5">
            Input contained an active <code className="font-mono">&lt;script&gt;</code> tag and was
            refused by the CodeBlock sanitiser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border bg-black/40 backdrop-blur-sm overflow-hidden',
        vs.border,
        vs.glow,
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-500/10 bg-cyan-950/20">
        <div className="flex items-center gap-2 min-w-0">
          <Lock className={cn('size-3 shrink-0', vs.label)} />
          {label && (
            <span className={cn('text-[10px] font-mono font-semibold tracking-wider', vs.label)}>
              {label.toUpperCase()}
            </span>
          )}
          {title && (
            <span className="text-[10px] text-muted-foreground truncate font-mono">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border',
              vs.badge
            )}
          >
            <ShieldCheck className="size-2.5" />
            NO-COPY
          </span>
          {sensitive && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wider border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15 transition-colors"
              aria-label={revealed ? 'Hide content' : 'Reveal content'}
            >
              {revealed ? <EyeOff className="size-2.5" /> : <Eye className="size-2.5" />}
              {revealed ? 'HIDE' : 'REVEAL'}
            </button>
          )}
        </div>
      </div>

      {/* Code body — copy-protected, blur-on-idle */}
      <div
        className="relative"
        onCopy={blockEvent}
        onCut={blockEvent}
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
      >
        <pre
          className={cn(
            'p-3 text-[11px] leading-relaxed font-mono overflow-x-auto transition-[filter] duration-200',
            'select-none',
            !revealed && 'blur-sm'
          )}
          style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
          onKeyDown={blockKeyDown}
          tabIndex={0}
        >
          {lineNumbers ? (
            <code className="block">
              {lines.map((line, i) => (
                <span key={i} className="block hover:bg-cyan-500/[0.04]">
                  <span
                    className="inline-block w-8 mr-3 text-right text-cyan-500/30 select-none"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-cyan-100/90 whitespace-pre">{line || ' '}</span>
                </span>
              ))}
            </code>
          ) : (
            <code className="text-cyan-100/90 whitespace-pre-wrap break-all">{display}</code>
          )}
        </pre>

        {/* Blur overlay hint */}
        {!revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
            aria-label="Click to reveal content"
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-950/60 text-[10px] font-mono text-cyan-400 tracking-wider">
              <Eye className="size-3" />
              CLICK TO REVEAL
            </span>
          </button>
        )}

        {/* Copy-attempt toast */}
        {copyAttempt && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded border border-red-500/40 bg-red-950/80 text-[9px] font-mono text-red-400 tracking-wider animate-fade-in-up">
            <AlertTriangle className="size-2.5 inline mr-1" />
            COPY DISABLED
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeBlock;

// Convenience wrapper for rendering a list of IOC strings as stacked blocks
export function CodeBlockList({
  items,
  label,
  variant = 'default',
  sensitive = true,
}: {
  items: string[];
  label?: string;
  variant?: CodeBlockProps['variant'];
  sensitive?: boolean;
}): ReactNode {
  if (items.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground/60 italic px-2 py-1">None detected</p>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <CodeBlock
          key={`${item}-${i}`}
          code={item}
          label={label}
          variant={variant}
          lineNumbers={false}
          sensitive={sensitive}
          className="py-1"
        />
      ))}
    </div>
  );
}
