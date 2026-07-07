import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { parseLocale, type LocaleContext } from '@/lib/osint-query';

// =============================================================================
// POST /api/osint/wayback
// Wayback Machine (web.archive.org) integration — establishes a timeline of
// how a URL/domain's web presence evolved over time (past → now).
//
// Uses three public Wayback APIs (no API key required):
//   1. CDX Server API       — list of up to 50 archived snapshots (status 200)
//   2. Sparkline API        — snapshot counts per year (density overview)
//   3. Availability API     — closest snapshot to a target timestamp
//
// All external fetches are wrapped in try/catch — if Wayback is unavailable
// the route still returns 200 with an empty result set (never a 500).
// =============================================================================

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------
interface WaybackSnapshot {
  timestamp: string;
  originalUrl: string;
  statusCode: number;
  digest: string;
  archiveUrl: string;
}

interface YearlyCount {
  year: number;
  count: number;
}

interface TimelineEntry {
  date: string;
  event: string;
  archiveUrl?: string;
}

interface WaybackResponse {
  url: string;
  totalSnapshots: number;
  firstSnapshot: { timestamp: string; url: string } | null;
  latestSnapshot: { timestamp: string; url: string; status: number } | null;
  snapshots: WaybackSnapshot[];
  yearlyCounts: YearlyCount[];
  timeline: TimelineEntry[];
  error?: string;
}

// ---------------------------------------------------------------------------
// URL validation — accept both `example.com` and `https://example.com`
// ---------------------------------------------------------------------------
function normalizeTarget(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If it has a scheme, validate as URL.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (!u.hostname) return null;
      return trimmed;
    } catch {
      return null;
    }
  }
  // Bare domain / path — prepend https:// and re-validate.
  try {
    const candidate = `https://${trimmed}`;
    const u = new URL(candidate);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return candidate;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Format a YYYYMMDDHHMMSS Wayback timestamp as a human-readable date
// ---------------------------------------------------------------------------
function formatTimestamp(ts: string): string {
  if (!ts || ts.length < 8) return ts || 'Unknown';
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthIdx = Math.max(0, Math.min(11, parseInt(month, 10) - 1));
  const dayNum = parseInt(day, 10) || 1;
  return `${monthNames[monthIdx]} ${dayNum}, ${year}`;
}

// ---------------------------------------------------------------------------
// Build the public archive URL for a snapshot
// ---------------------------------------------------------------------------
function buildArchiveUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
}

// ---------------------------------------------------------------------------
// Parse the CDX JSON response (array of arrays; first row is the header)
// ---------------------------------------------------------------------------
function parseCdxResponse(data: unknown): WaybackSnapshot[] {
  if (!Array.isArray(data) || data.length < 2) return [];
  const header = data[0] as string[];
  if (!Array.isArray(header)) return [];

  const idx = {
    timestamp: header.indexOf('timestamp'),
    original: header.indexOf('original'),
    statuscode: header.indexOf('statuscode'),
    digest: header.indexOf('digest'),
  };

  const out: WaybackSnapshot[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 4) continue;
    const ts = String(row[idx.timestamp] ?? '').trim();
    const original = String(row[idx.original] ?? '').trim();
    const statusStr = String(row[idx.statuscode] ?? '').trim();
    const digest = String(row[idx.digest] ?? '').trim();
    if (!ts || !original) continue;
    const status = parseInt(statusStr, 10) || 0;
    out.push({
      timestamp: ts,
      originalUrl: original,
      statusCode: status,
      digest,
      archiveUrl: buildArchiveUrl(ts, original),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parse the sparkline JSON response: { years: { "2008": {"1": 3, "2": 5, ...} } }
// ---------------------------------------------------------------------------
function parseSparklineResponse(data: unknown): YearlyCount[] {
  if (!data || typeof data !== 'object') return [];
  const yearsObj = (data as { years?: Record<string, Record<string, number>> }).years;
  if (!yearsObj || typeof yearsObj !== 'object') return [];

  const out: YearlyCount[] = [];
  for (const [year, months] of Object.entries(yearsObj)) {
    const yearNum = parseInt(year, 10);
    if (!Number.isFinite(yearNum)) continue;
    let count = 0;
    if (months && typeof months === 'object') {
      for (const v of Object.values(months)) {
        if (typeof v === 'number') count += v;
        else if (typeof v === 'string') count += parseInt(v, 10) || 0;
      }
    }
    if (count > 0) out.push({ year: yearNum, count });
  }
  return out.sort((a, b) => a.year - b.year);
}

// ---------------------------------------------------------------------------
// Parse the availability JSON response: { archived_snapshots: { closest: {...} } }
// ---------------------------------------------------------------------------
function parseAvailabilityResponse(
  data: unknown
): { timestamp: string; url: string; status: number } | null {
  if (!data || typeof data !== 'object') return null;
  const snapshots = (data as { archived_snapshots?: { closest?: { timestamp?: string; url?: string; status?: string | number } } }).archived_snapshots;
  if (!snapshots?.closest) return null;
  const c = snapshots.closest;
  if (!c.timestamp || !c.url) return null;
  const status = typeof c.status === 'number' ? c.status : parseInt(String(c.status ?? '0'), 10) || 0;
  return { timestamp: c.timestamp, url: c.url, status };
}

// ---------------------------------------------------------------------------
// Build a human-readable timeline of major events from the snapshot list
// ---------------------------------------------------------------------------
function buildTimeline(snapshots: WaybackSnapshot[]): TimelineEntry[] {
  if (snapshots.length === 0) return [];
  const timeline: TimelineEntry[] = [];
  // Sort oldest-first by timestamp
  const sorted = [...snapshots].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // First capture
  const first = sorted[0];
  timeline.push({
    date: formatTimestamp(first.timestamp),
    event: `First capture archived · ${first.originalUrl}`,
    archiveUrl: first.archiveUrl,
  });

  // Content changes (digest differs from previous snapshot)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.digest && curr.digest && prev.digest !== curr.digest) {
      timeline.push({
        date: formatTimestamp(curr.timestamp),
        event: `Content change detected (digest diff) · ${curr.originalUrl}`,
        archiveUrl: curr.archiveUrl,
      });
    }
  }

  // Latest capture (only add if different from first)
  const last = sorted[sorted.length - 1];
  if (sorted.length > 1) {
    timeline.push({
      date: formatTimestamp(last.timestamp),
      event: `Latest capture archived · ${last.originalUrl}`,
      archiveUrl: last.archiveUrl,
    });
  }

  return timeline;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const payload = authenticateRequest(request);
  if (!payload?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // 2. Parse body
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Locale (for audit logging only — Wayback API doesn't need locale)
  const locale: LocaleContext = parseLocale(body);

  const { caseId } = body;
  const rawUrl = typeof body.url === 'string' ? body.url : '';
  const target = normalizeTarget(rawUrl);

  if (!target) {
    return NextResponse.json(
      { error: 'url is required — provide a valid URL or domain (e.g. example.com or https://example.com)' },
      { status: 400 }
    );
  }

  // 3. Fetch CDX API (list of snapshots, status 200 only, limit 50)
  let snapshots: WaybackSnapshot[] = [];
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=50&fl=timestamp,original,statuscode,digest&filter=statuscode:200`;
    const cdxRes = await fetch(cdxUrl, {
      headers: { 'User-Agent': 'PHANTOM-OSINT/1.0 (+https://phantom.local)' },
      signal: AbortSignal.timeout(15000),
    });
    if (cdxRes.ok) {
      const cdxData: unknown = await cdxRes.json();
      snapshots = parseCdxResponse(cdxData);
    }
  } catch (err) {
    console.error('Wayback CDX fetch failed:', err);
  }

  // 4. Fetch sparkline API (yearly counts)
  let yearlyCounts: YearlyCount[] = [];
  try {
    const sparkUrl = `https://web.archive.org/__wb/sparkline?output=json&url=${encodeURIComponent(target)}&collection=web`;
    const sparkRes = await fetch(sparkUrl, {
      headers: { 'User-Agent': 'PHANTOM-OSINT/1.0 (+https://phantom.local)' },
      signal: AbortSignal.timeout(15000),
    });
    if (sparkRes.ok) {
      const sparkData: unknown = await sparkRes.json();
      yearlyCounts = parseSparklineResponse(sparkData);
    }
  } catch (err) {
    console.error('Wayback sparkline fetch failed:', err);
  }

  // 5. Fetch availability API for the most recent snapshot
  let latestSnapshot: { timestamp: string; url: string; status: number } | null = null;
  try {
    // Use today's date as the timestamp to get the closest-to-now snapshot.
    const now = new Date();
    const ts =
      now.getUTCFullYear().toString() +
      String(now.getUTCMonth() + 1).padStart(2, '0') +
      String(now.getUTCDate()).padStart(2, '0');
    const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(target)}&timestamp=${ts}`;
    const availRes = await fetch(availUrl, {
      headers: { 'User-Agent': 'PHANTOM-OSINT/1.0 (+https://phantom.local)' },
      signal: AbortSignal.timeout(15000),
    });
    if (availRes.ok) {
      const availData: unknown = await availRes.json();
      latestSnapshot = parseAvailabilityResponse(availData);
    }
  } catch (err) {
    console.error('Wayback availability fetch failed:', err);
  }

  // 6. Build the structured response
  // Sort snapshots oldest-first for consistent display
  snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const firstSnapshot = snapshots.length > 0
    ? { timestamp: snapshots[0].timestamp, url: snapshots[0].archiveUrl }
    : null;

  // Prefer the availability API's most-recent snapshot; fall back to CDX's last
  const latest = latestSnapshot ?? (snapshots.length > 0
    ? {
        timestamp: snapshots[snapshots.length - 1].timestamp,
        url: snapshots[snapshots.length - 1].archiveUrl,
        status: snapshots[snapshots.length - 1].statusCode,
      }
    : null);

  const timeline = buildTimeline(snapshots);

  // If everything failed (no snapshots, no yearly counts, no latest), flag error.
  const allFailed = snapshots.length === 0 && yearlyCounts.length === 0 && !latest;

  const response: WaybackResponse = {
    url: target,
    totalSnapshots: snapshots.length,
    firstSnapshot,
    latestSnapshot: latest,
    snapshots,
    yearlyCounts,
    timeline,
    ...(allFailed ? { error: 'Wayback API unavailable' } : {}),
  };

  // 7. If caseId provided and case exists, create a TimelineEvent
  if (caseId && typeof caseId === 'string') {
    try {
      const caseExists = await db.case.findUnique({ where: { id: caseId } });
      if (caseExists) {
        const firstTs = firstSnapshot ? formatTimestamp(firstSnapshot.timestamp) : 'N/A';
        const latestTs = latest ? formatTimestamp(latest.timestamp) : 'N/A';
        await db.timelineEvent.create({
          data: {
            caseId,
            title: `Wayback Scan: ${target}`,
            description: `Archived web presence timeline for ${target}. ${snapshots.length} snapshots captured · First: ${firstTs} · Latest: ${latestTs}${locale.country ? ` (locale: ${locale.country})` : ''}.`,
            eventType: 'action',
            metadata: JSON.stringify({
              url: target,
              totalSnapshots: snapshots.length,
              firstSnapshot: firstSnapshot?.timestamp ?? null,
              latestSnapshot: latest?.timestamp ?? null,
              yearsActive: yearlyCounts.length,
              country: locale.country ?? null,
            }),
          },
        });
      }
    } catch (err) {
      console.error('Wayback timeline event creation failed:', err);
    }
  }

  // 8. Audit log (catch errors)
  await createAuditLog('osint_scan', 'WaybackLookup', {
    url: target,
    caseId: typeof caseId === 'string' ? caseId : null,
    snapshotCount: snapshots.length,
    userId: payload.id,
    country: locale.country ?? null,
    language: locale.language ?? null,
  }).catch(() => {});

  return NextResponse.json(response, { status: 200 });
}
