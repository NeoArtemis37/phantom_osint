// =============================================================================
// Phantom Cases — Typed API Client
// =============================================================================
// All requests use relative paths so they work through the Caddy gateway.
// =============================================================================

import type {
  Case,
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
  TimelineEvent,
  EventType,
  TransformFlow,
  WatchlistItem,
  SearchResult,
  GraphData,
  CaseStatus,
  CaseSensitivity,
  AuthUser,
  CaseModule,
  ModuleKey,
  Alert,
  AlertTier,
  AlertStatus,
  AlertCategory,
  Evidence,
  EvidenceConfidence,
} from "@/types";

// ---------------------------------------------------------------------------
// Shared OSINT probe types (mirrors src/lib/osint-probe.ts)
// ---------------------------------------------------------------------------

export type ProbeStatus = 'confirmed' | 'false_positive' | 'possible' | 'error';

export interface ProbeHit {
  platform: string;
  category: string;
  url: string;
  status: ProbeStatus;
  httpStatus: number;
  finalUrl: string;
  confidence: number;
  reason: string;
  responseTimeMs?: number;
}

export type SherlockStatus = 'found' | 'available' | 'claimed';

export interface SherlockHit {
  platform: string;
  category: string;
  url: string;
  rank: number;
  errorType: string;
  status: SherlockStatus;
  confidence: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Get the stored access token */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/** Store the access token */
export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
}

/** Remove the access token */
export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
}

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Attach Bearer token for authenticated requests (skip auth endpoints)
  if (token && !url.startsWith("/api/auth/login") && !url.startsWith("/api/auth/register")) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    // If 401, clear the token so the user gets redirected to login
    if (res.status === 401) {
      clearAccessToken();
    }
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function put<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del<T = void>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" });
}

// ===========================================================================
// Cases
// ===========================================================================

export interface CreateCaseInput {
  name: string;
  description?: string;
  sensitivity?: CaseSensitivity;
  tags?: string[];
  intelligenceLevel?: string;
  targetProfile?: Record<string, unknown>;
}

export interface UpdateCaseInput {
  name?: string;
  description?: string;
  status?: CaseStatus;
  sensitivity?: CaseSensitivity;
  tags?: string[];
  intelligenceLevel?: string;
  targetProfile?: Record<string, unknown>;
  resolution?: string;
}

export const casesApi = {
  list: (status?: CaseStatus, userId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (userId) params.set("userId", userId);
    const qs = params.toString();
    return get<Case[]>(`/api/cases${qs ? `?${qs}` : ""}`);
  },

  getById: (id: string) => get<Case>(`/api/cases/${id}`),

  create: (input: CreateCaseInput) => post<Case>("/api/cases", input),

  update: (id: string, input: UpdateCaseInput) =>
    put<Case>(`/api/cases/${id}`, input),

  delete: (id: string) => del(`/api/cases/${id}`),
};

// ===========================================================================
// Entities
// ===========================================================================

export interface CreateEntityInput {
  caseId: string;
  name: string;
  type: EntityType;
  value?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  x?: number;
  y?: number;
  color?: string;
  confidence?: number;
  threatLevel?: string;
  verified?: boolean;
}

export interface UpdateEntityInput {
  name?: string;
  type?: EntityType;
  value?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  x?: number;
  y?: number;
  color?: string;
  avatar?: string;
  confidence?: number;
  threatLevel?: string;
  verified?: boolean;
}

export const entitiesApi = {
  list: (caseId: string, type?: EntityType) => {
    const params = new URLSearchParams();
    params.set("caseId", caseId);
    if (type) params.set("type", type);
    return get<Entity[]>(`/api/entities?${params.toString()}`);
  },

  getById: (id: string) => get<Entity>(`/api/entities/${id}`),

  create: (input: CreateEntityInput) => post<Entity>("/api/entities", input),

  update: (id: string, input: UpdateEntityInput) =>
    put<Entity>(`/api/entities/${id}`, input),

  delete: (id: string) => del(`/api/entities/${id}`),

  updatePositions: (positions: { id: string; x: number; y: number }[]) =>
    post<void>("/api/entities/positions", { positions }),

  merge: (sourceId: string, targetId: string, caseId: string) =>
    post<Entity>('/api/entities/merge', { sourceId, targetId, caseId }),
};

// ===========================================================================
// Relationships
// ===========================================================================

export interface CreateRelationshipInput {
  caseId: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
  metadata?: Record<string, unknown>;
  weight?: number;
}

export interface UpdateRelationshipInput {
  type?: RelationshipType;
  label?: string;
  metadata?: Record<string, unknown>;
  weight?: number;
}

export const relationshipsApi = {
  list: (caseId: string) =>
    get<Relationship[]>(`/api/relationships?caseId=${caseId}`),

  create: (input: CreateRelationshipInput) =>
    post<Relationship>("/api/relationships", input),

  update: (id: string, input: UpdateRelationshipInput) =>
    put<Relationship>(`/api/relationships/${id}`, input),

  delete: (id: string) => del(`/api/relationships/${id}`),
};

// ===========================================================================
// Timeline
// ===========================================================================

export interface CreateTimelineEventInput {
  caseId: string;
  entityId?: string | null;
  title: string;
  description?: string;
  eventType: EventType;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export const timelineApi = {
  list: (caseId: string) =>
    get<TimelineEvent[]>(`/api/timeline?caseId=${caseId}`),

  create: (input: CreateTimelineEventInput) =>
    post<TimelineEvent>("/api/timeline", input),
};

// ===========================================================================
// Transforms
// ===========================================================================

export interface CreateTransformFlowInput {
  caseId: string;
  name: string;
  description?: string;
  steps: {
    transform: string;
    input: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  }[];
}

export interface UpdateTransformFlowInput {
  name?: string;
  description?: string;
  steps?: CreateTransformFlowInput["steps"];
  status?: string;
  results?: Record<string, unknown>;
}

export const transformsApi = {
  list: (caseId: string) =>
    get<TransformFlow[]>(`/api/transforms?caseId=${caseId}`),

  getById: (id: string) => get<TransformFlow>(`/api/transforms/${id}`),

  create: (input: CreateTransformFlowInput) =>
    post<TransformFlow>("/api/transforms", input),

  update: (id: string, input: UpdateTransformFlowInput) =>
    put<TransformFlow>(`/api/transforms/${id}`, input),

  delete: (id: string) => del(`/api/transforms/${id}`),
};

// ===========================================================================
// Watchlist
// ===========================================================================

export interface CreateWatchlistItemInput {
  caseId: string;
  term: string;
  type: string;
  active?: boolean;
}

export const watchlistApi = {
  list: (caseId: string) =>
    get<WatchlistItem[]>(`/api/watchlist?caseId=${caseId}`),

  create: (input: CreateWatchlistItemInput) =>
    post<WatchlistItem>("/api/watchlist", input),

  delete: (id: string) => del(`/api/watchlist/${id}`),
};

// ===========================================================================
// Locale params (global OSINT targeting) — threaded through all OSINT/search/recon methods
// ===========================================================================

export interface LocaleParams {
  /** ISO 3166-1 alpha-2 country code (e.g. "FR", "JP", "BR") */
  country?: string;
  /** ISO 639-1 language override */
  language?: string;
  /** Restrict to regional platforms only */
  regionalOnly?: boolean;
}

// ===========================================================================
// Search
// ===========================================================================

export const searchApi = {
  search: (query: string, caseId?: string, locale?: LocaleParams) =>
    post<{ query: string; results: SearchResult[] }>("/api/search", {
      query,
      caseId,
      ...locale,
    }),
  // Live (debounced) search — returns faster, cached results
  live: (query: string, caseId?: string, locale?: LocaleParams) =>
    post<{ query: string; results: SearchResult[]; cached?: boolean }>("/api/search/live", {
      query,
      caseId,
      ...locale,
    }),
  // Image search via z-ai-web-dev-sdk image_search function
  image: (query: string, caseId?: string, num?: number, locale?: LocaleParams) =>
    post<{ query: string; images: Array<{ url: string; title: string; source: string; width?: number; height?: number; thumbnail?: string }>; cached?: boolean }>("/api/search/image", {
      query,
      caseId,
      num,
      ...locale,
    }),
};

// ===========================================================================
// Graph
// ===========================================================================

export const graphApi = {
  getData: (caseId: string) =>
    get<GraphData>(`/api/graph/${caseId}`),
};

// ===========================================================================
// Export
// ===========================================================================

export const exportApi = {
  exportJson: (caseId: string, format: string = 'json') =>
    post<Record<string, unknown>>("/api/export", { caseId, format }),
};

// ===========================================================================
// Auth
// ===========================================================================

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (data: { email: string; password: string }) => post<LoginResponse>('/api/auth/login', data),
  register: (data: { email: string; password: string; name: string }) => post<LoginResponse>('/api/auth/register', data),
  me: () => get<AuthUser>('/api/auth/me'),
  logout: () => post<{ success: boolean }>('/api/auth/logout'),
};

// ===========================================================================
// Modules
// ===========================================================================

export const modulesApi = {
  list: (caseId: string) => get<CaseModule[]>(`/api/modules?caseId=${caseId}`),
  create: (data: { caseId: string; moduleKey: ModuleKey; enabled: boolean; config?: Record<string, unknown> }) => post<CaseModule>('/api/modules', data),
  update: (id: string, data: { enabled?: boolean; config?: Record<string, unknown>; status?: string }) => put<CaseModule>(`/api/modules/${id}`, data),
  delete: (id: string) => del(`/api/modules/${id}`),
};

// ===========================================================================
// Alerts
// ===========================================================================

export const alertsApi = {
  list: (caseId: string, filters?: { tier?: AlertTier; status?: AlertStatus }) => {
    const params = new URLSearchParams();
    params.set('caseId', caseId);
    if (filters?.tier) params.set('tier', filters.tier);
    if (filters?.status) params.set('status', filters.status);
    return get<Alert[]>(`/api/alerts?${params.toString()}`);
  },
  create: (data: { caseId: string; title: string; description: string; tier: AlertTier; category: AlertCategory; entityId?: string; metadata?: Record<string, unknown> }) => post<Alert>('/api/alerts', data),
  update: (id: string, data: { status?: AlertStatus; acknowledgedBy?: string }) => put<Alert>(`/api/alerts/${id}`, data),
  delete: (id: string) => del(`/api/alerts/${id}`),
};

// ===========================================================================
// Evidence
// ===========================================================================

export const evidenceApi = {
  list: (caseId: string, filters?: { entityId?: string; sourceType?: string }) => {
    const params = new URLSearchParams();
    params.set('caseId', caseId);
    if (filters?.entityId) params.set('entityId', filters.entityId);
    if (filters?.sourceType) params.set('sourceType', filters.sourceType);
    return get<Evidence[]>(`/api/evidence?${params.toString()}`);
  },
  create: (data: { caseId: string; entityId?: string; title: string; description: string; sourceUrl: string; sourceType: string; data: Record<string, unknown>; confidence: EvidenceConfidence; collectedBy: string }) => post<Evidence>('/api/evidence', data),
  update: (id: string, data: { confidence?: EvidenceConfidence; legalReviewFlag?: boolean; chainOfCustodyEntry?: unknown }) => put<Evidence>(`/api/evidence/${id}`, data),
  delete: (id: string) => del(`/api/evidence/${id}`),
};

// ===========================================================================
// OSINT
// ===========================================================================

export const osintApi = {
  usernameSearch: (data: { username: string; caseId: string; platforms?: string[] } & LocaleParams) => post<{ username: string; discovered: Array<{ platform: string; url: string; username: string; confidence: number }>; entitiesCreated: number }>('/api/osint/username-search', data),
  socialSearch: (data: { query: string; caseId: string; type: 'hashtag' | 'mention' | 'keyword' } & LocaleParams) => post<{ query: string; results: Array<{ title: string; url: string; snippet: string; source: string }>; totalFound: number }>('/api/osint/social-search', data),
  uncensoredSearch: (data: { query: string; caseId: string } & LocaleParams) => post<{ query: string; results: Array<{ title: string; url: string; snippet: string; source: string }>; totalFound: number }>('/api/osint/uncensored-search', data),
  reverseLookup: (data: { type: 'phone' | 'email' | 'username'; value: string; caseId: string } & LocaleParams) => post<{ type: string; value: string; results: Array<{ title: string; url: string; snippet: string; confidence: number }>; totalFound: number }>('/api/osint/reverse-lookup', data),
  // Maigret-style comprehensive username enumeration with REAL HTTP probing
  // Returns confirmed (green) / falsePositive (red) / possible (yellow) / errors (gray)
  // — mirrors `maigret [username] --all --print-errors` CLI classification.
  maigret: (data: { username: string; caseId?: string; all?: boolean } & LocaleParams) => post<{
    username: string;
    mode: 'all' | 'top';
    confirmed: ProbeHit[];
    falsePositive: ProbeHit[];
    possible: ProbeHit[];
    errors: ProbeHit[];
    found: ProbeHit[];
    byCategory: Record<string, { confirmed: ProbeHit[]; false_positive: ProbeHit[]; possible: ProbeHit[]; errors: ProbeHit[]; }>;
    stats: { total: number; confirmed: number; falsePositive: number; possible: number; errors: number };
    totalScanned: number;
    totalFound: number;
  }>('/api/osint/maigret', data),

  // Sherlock-style username enumeration with REAL HTTP probing
  // Returns confirmed (green) / available=false_positive (red) / possible (yellow) / errors (gray)
  sherlock: (data: { username: string; caseId?: string; all?: boolean } & LocaleParams) => post<{
    username: string;
    tool: string;
    toolReference: string;
    mode: 'all' | 'top';
    found: SherlockHit[];
    confirmed: SherlockHit[];
    available: SherlockHit[];
    falsePositive: SherlockHit[];
    possible: SherlockHit[];
    errors: SherlockHit[];
    byCategory: Record<string, { confirmed: SherlockHit[]; false_positive: SherlockHit[]; possible: SherlockHit[]; errors: SherlockHit[]; }>;
    stats: { total: number; confirmed: number; falsePositive: number; possible: number; errors: number };
    totalScanned: number;
    totalFound: number;
    totalAvailable: number;
    generatedAt: string;
  }>('/api/osint/sherlock', data),

  // TikTok OSINT tracker — track a person's TikTok posts, reposts, messages, activity
  tiktokTrack: (data: { username: string; caseId?: string } & LocaleParams) => post<{
    username: string;
    profileUrl: string;
    generatedAt: string;
    author: string;
    tool: string;
    found: boolean;
    confidence: number;
    sources: Array<{ title: string; url: string; snippet: string; source: string }>;
    profile: {
      handle: string;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      verified: boolean;
      followerCount: number | null;
      followingCount: number | null;
      likeCount: number | null;
      videoCount: number | null;
      region: string | null;
      accountType: 'personal' | 'business' | 'creator' | 'unknown';
      joinedEstimate: string | null;
      extractedFrom: string[];
    };
    posts: Array<{
      id: string;
      caption: string;
      url: string;
      source: string;
      postedAt: string | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      views: number | null;
      hashtags: string[];
      mentions: string[];
      isRepost: boolean;
      verified: boolean;
    }>;
    reposts: Array<{
      originalAuthor: string | null;
      originalCaption: string;
      url: string;
      repostedAt: string | null;
      comment: string | null;
    }>;
    messages: Array<{
      fromUser: string | null;
      text: string;
      onVideo: string | null;
      postedAt: string | null;
      likes: number | null;
      source: string;
    }>;
    activity: {
      postingFrequency: string | null;
      peakHours: string[];
      topHashtags: Array<{ tag: string; count: number }>;
      topMentions: Array<{ handle: string; count: number }>;
      linkedAccounts: Array<{ platform: string; url: string; confidence: number }>;
    };
    riskIndicators: Array<{ level: 'low' | 'medium' | 'high'; label: string; detail: string }>;
    collisions: Array<{ handle: string; url: string; source: string }>;
    stats: {
      sources: number;
      posts: number;
      verifiedPosts: number;
      reposts: number;
      messages: number;
      hashtags: number;
      mentions: number;
      linkedAccounts: number;
      riskIndicators: number;
    };
    error?: string;
  }>('/api/osint/tiktok-tracker', data),

  // Unified social-media OSINT — 6 platforms (tiktok, facebook, telegram, slack, instagram, snapchat)
  // Returns public profile information harvested via web_search + page_reader.
  // Author: artemis37 · Tool: PHANTOM SocialMediaOSINT
  socialMedia: (data: { platform: 'tiktok' | 'facebook' | 'telegram' | 'slack' | 'instagram' | 'snapchat'; query: string; caseId?: string } & LocaleParams) => post<{
    platform: string;
    query: string;
    profiles: Array<{
      url: string;
      title: string;
      snippet: string;
      extractedBio?: string;
      followerCount?: string;
      profileImage?: string;
      recentPosts?: string[];
      confidence: number;
    }>;
    totalFound: number;
    rateLimited: boolean;
    pagesRead: number;
    author: string;
    tool: string;
    generatedAt: string;
  }>('/api/osint/social-media', data),

  // Reverse image search / image recon — upload an image for VLM analysis + similar-image search
  imageRecon: (data: { image: string; caseId?: string } & LocaleParams) => post<{
    author: string;
    tool: string;
    generatedAt: string;
    imageProvided: boolean;
    analysis: {
      description: string;
      people: Array<{ count: number; gender: string; ageRange: string; notableFeatures: string }>;
      objects: string[];
      sceneType: string;
      locationClues: string[];
      estimatedLocation: string;
      textDetected: string[];
      logos: string[];
      colors: string[];
      mood: string;
      isScreenshot: boolean;
      isDocument: boolean;
      isProfilePicture: boolean;
      searchKeywords: string[];
      searchQuery: string;
      riskFlags: string[];
    };
    similarImages: Array<{ url: string; title: string; source: string; width?: number; height?: number }>;
    webAppearances: Array<{ title: string; url: string; snippet: string; source: string }>;
    platformMatches: Array<{
      platform: 'facebook' | 'linkedin' | 'instagram' | 'yandex';
      title: string;
      url: string;
      snippet: string;
      source: string;
      matchType: 'profile' | 'photo' | 'mention' | 'image-search';
      confidence: number;
    }>;
    stats: {
      objects: number;
      people: number;
      textDetected: number;
      logos: number;
      similarImages: number;
      webAppearances: number;
      platformMatches: number;
      riskFlags: number;
    };
    error?: string;
  }>('/api/osint/image-recon', data),

  // Wayback Machine (web.archive.org) — archived snapshots + timeline of changes
  // Establishes a timeline of how a URL/domain's web presence evolved over time.
  // One-click scan (CDX API can be slow) — no live auto-search.
  wayback: (url: string, caseId?: string, locale?: LocaleParams) => post<{
    url: string;
    totalSnapshots: number;
    firstSnapshot: { timestamp: string; url: string } | null;
    latestSnapshot: { timestamp: string; url: string; status: number } | null;
    snapshots: Array<{
      timestamp: string;
      originalUrl: string;
      statusCode: number;
      digest: string;
      archiveUrl: string;
    }>;
    yearlyCounts: Array<{ year: number; count: number }>;
    timeline: Array<{ date: string; event: string; archiveUrl?: string }>;
    error?: string;
  }>('/api/osint/wayback', { url, caseId, ...locale }),

  // People Search — idcrawl-style meta-search across LinkedIn, Facebook,
  // Twitter/X, Instagram, public-records sites, people directories, and
  // news mentions. Fans out 7 parallel z-ai web_search calls and merges
  // the results into a categorized, deduped grid.
  // author: artemis37
  peopleSearch: (query: string, caseId?: string, locale?: LocaleParams) => post<{
    query: string;
    results: Array<{
      category: 'professional' | 'social' | 'public-records' | 'news';
      title: string;
      url: string;
      snippet: string;
      extractedPhone?: string;
      extractedEmail?: string;
      confidence: number;
    }>;
    byCategory: Record<string, Array<{
      category: string;
      title: string;
      url: string;
      snippet: string;
      extractedPhone?: string;
      extractedEmail?: string;
      confidence: number;
    }>>;
    totalFound: number;
    author: string;
    tool: string;
    generatedAt: string;
    error?: string;
  }>('/api/osint/people-search', { query, caseId, ...locale }),

  // OSINT Catalog — curated GitHub OSINT project directory (public reference
  // data, no auth required by the backend). Pass categories[] to filter to a
  // subset; omit to return all 45+ entries.
  // author: artemis37
  catalog: (categories?: string[]) => post<{
    author: string;
    tool: string;
    generatedAt: string;
    categories: string[];
    stats: { total: number; integrated: number; available: number };
    categoryLabels: Record<string, string>;
    total: number;
    entries: Array<{
      name: string;
      url: string;
      description: string;
      category: string;
      language: string;
      stars: string;
      phantomModule?: string | null;
    }>;
  }>('/api/osint/catalog', { categories }),

  // External OSINT Lookup — unified deep-link + parallel-search engine over
  // the 49 external GitHub OSINT projects tagged `phantomModule: 'External
  // Lookup'` in the catalog. For each tool that accepts the given input
  // type, fans out a localized web_search query and returns the deduped
  // results grouped by tool, plus the tool's direct deep-link URL.
  // author: artemis37
  externalLookup: (data: { type: 'username'|'email'|'phone'|'domain'|'ip'|'image'|'name'; value: string; caseId?: string } & LocaleParams) => post<{
    type: string;
    value: string;
    tools: Array<{
      tool: { id: string; name: string; category: string; url: string; description: string; githubRef?: string };
      deepLink: string | null;
      results: Array<{ title: string; url: string; snippet: string }>;
      totalFound: number;
    }>;
    totalResults: number;
    author: string;
    tool: string;
    generatedAt: string;
  }>('/api/osint/external-lookup', data),
};

// ===========================================================================
// CyberWatch — "Veilles Cyber" cyber threat intelligence feed (artemis37)
// ===========================================================================

export const cyberWatchApi = {
  // POST /api/cyberwatch — refresh / fetch the CTI feed (author: artemis37)
  refresh: (refresh = false, locale?: LocaleParams) => post<{
    author: string;
    tool: string;
    cached: boolean;
    generatedAt: string;
    totalItems: number;
    stats?: {
      total: number;
      critical: number;
      high: number;
      cves: number;
      hashes: number;
      ips: number;
      domains: number;
      // TikTok / social-platform stats
      tiktok: number;
      handles: number;
      hashtags: number;
      videos: number;
    };
    items: Array<{
      id: string;
      title: string;
      summary: string;
      url: string;
      source: string;
      category: 'Ransomware' | 'APT' | 'ZeroDay' | 'DataBreach' | 'Phishing' | 'Vulnerability' | 'Geopolitics' | 'Malware' | 'SocialPlatform';
      severity: 'critical' | 'high' | 'medium' | 'low';
      publishedAt: string | null;
      iocs: { cves: string[]; hashes: string[]; ips: string[]; domains: string[]; urls: string[]; handles: string[]; hashtags: string[]; videos: string[] };
      tags: string[];
    }>;
  }>('/api/cyberwatch', { refresh, ...locale }),
};

// ===========================================================================
// Recon — Auto Recon + Active Crawler
// ===========================================================================

export const reconApi = {
  // One-click automated reconnaissance — chains all scanners in parallel
  auto: (data: { target: string; caseId?: string; autoCreate?: boolean } & LocaleParams) => post<{
    target: string;
    detectedType: 'username' | 'email' | 'phone' | 'domain' | 'unknown';
    results: {
      username: Array<{ title: string; url: string; snippet: string; source: string; platform: string; confidence: number }>;
      social: Array<{ title: string; url: string; snippet: string; source: string }>;
      web: Array<{ title: string; url: string; snippet: string; source: string }>;
      reverse: Array<{ title: string; url: string; snippet: string; source: string }>;
      images: Array<{ url: string; title: string; source: string; width?: number; height?: number }>;
    };
    summary: { totalFound: number; sourcesScanned: number; entitiesCreated: number };
    entityIds: string[];
  }>('/api/recon/auto', data),

  // Active crawler — fetch a URL and extract entities (emails, phones, socials, images)
  crawl: (data: { url: string; caseId?: string; autoCreate?: boolean } & LocaleParams) => post<{
    url: string;
    title: string;
    description: string;
    emails: string[];
    phones: string[];
    socialLinks: Array<{ platform: string; url: string; username: string }>;
    usernames: Array<{ platform: string; username: string; url: string }>;
    images: string[];
    allUrls: string[];
    entitiesCreated: number;
    entityIds: string[];
  }>('/api/recon/crawl', data),
};

// ===========================================================================
// Network Analysis
// ===========================================================================

export const networkApi = {
  analyze: (data: { caseId: string; analysisType: 'centrality' | 'community' | 'disruption' }) => post<{
    caseId: string;
    analysisType: string;
    results: Record<string, unknown>;
    // The backend returns one of these depending on analysisType; callers should narrow.
    centrality?: unknown;
    communities?: unknown;
    disruption?: unknown;
  }>('/api/network/analysis', data),
};

// ===========================================================================
// Convenience: combined API object
// ===========================================================================

export const api = {
  cases: casesApi,
  entities: entitiesApi,
  relationships: relationshipsApi,
  timeline: timelineApi,
  transforms: transformsApi,
  watchlist: watchlistApi,
  search: searchApi,
  graph: graphApi,
  export: exportApi,
  auth: authApi,
  modules: modulesApi,
  alerts: alertsApi,
  evidence: evidenceApi,
  osint: osintApi,
  recon: reconApi,
  network: networkApi,
  cyberWatch: cyberWatchApi,
} as const;

export default api;
