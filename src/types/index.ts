// =============================================================================
// Phantom Cases — OSINT Case Management Types
// =============================================================================

// ---------------------------------------------------------------------------
// Entity & Relationship Enums
// ---------------------------------------------------------------------------

export type EntityType =
  | "person"
  | "username"
  | "location"
  | "device"
  | "organization"
  | "email"
  | "phone"
  | "url"
  | "image"
  | "cryptocurrency"
  | "media";

export type RelationshipType =
  | "owns"
  | "communicated"
  | "located_at"
  | "associated"
  | "member_of"
  | "operates"
  | "linked"
  | "reported"
  | "finances"
  | "familial"
  | "operational"
  | "geographic";

// ---------------------------------------------------------------------------
// Case Enums
// ---------------------------------------------------------------------------

export type CaseStatus = "active" | "closed" | "archived" | "cold";
export type CaseSensitivity =
  | "unclassified"
  | "confidential"
  | "secret"
  | "top-secret";
export type EventType =
  | "info"
  | "alert"
  | "action"
  | "discovery"
  | "communication"
  | "capture"
  | "relocation"
  | "financial";
export type TransformStatus = "draft" | "running" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Core Domain Models
// ---------------------------------------------------------------------------

export interface Case {
  id: string;
  name: string;
  description: string;
  status: CaseStatus;
  sensitivity: CaseSensitivity;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { entities: number; relationships: number; timeline: number };
}

export interface Entity {
  id: string;
  caseId: string;
  name: string;
  type: EntityType;
  value: string;
  metadata: Record<string, unknown>;
  avatar: string;
  color: string;
  x: number;
  y: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  caseId: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label: string;
  metadata: Record<string, unknown>;
  weight: number;
  createdAt: string;
  updatedAt: string;
  source?: Entity;
  target?: Entity;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  entityId: string | null;
  title: string;
  description: string;
  eventType: EventType;
  timestamp: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  entity?: Entity;
}

// ---------------------------------------------------------------------------
// Transform / Pipeline Models
// ---------------------------------------------------------------------------

export interface TransformStep {
  id: string;
  transform: string;
  input: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface TransformFlow {
  id: string;
  caseId: string;
  name: string;
  description: string;
  steps: TransformStep[];
  status: TransformStatus;
  results: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  id: string;
  caseId: string;
  term: string;
  type: string;
  active: boolean;
  lastHit: string | null;
  hitCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Graph Visualization (Cytoscape)
// ---------------------------------------------------------------------------

export interface GraphNode {
  data: {
    id: string;
    label: string;
    type: EntityType;
    value: string;
    color?: string;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: RelationshipType;
    label: string;
    weight: number;
    [key: string]: unknown;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  caseId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportConfig {
  caseId: string;
  title: string;
  includeEntities: boolean;
  includeRelationships: boolean;
  includeTimeline: boolean;
  includeGraph: boolean;
  format: "pdf" | "html" | "markdown";
}

// ---------------------------------------------------------------------------
// Visual Mappings
// ---------------------------------------------------------------------------

export const ENTITY_COLORS: Record<EntityType, string> = {
  person: "#ff2d6f",
  username: "#00e5ff",
  location: "#00ff9d",
  device: "#a855f7",
  organization: "#ff6b35",
  email: "#1abc9c",
  phone: "#ff6b35",
  url: "#6b7ba8",
  image: "#ff2d6f",
  cryptocurrency: "#f1c40f",
  media: "#a855f7",
};

export const ENTITY_SHAPES: Record<EntityType, string> = {
  person: "ellipse",
  username: "rectangle",
  location: "triangle",
  device: "diamond",
  organization: "hexagon",
  email: "round-rectangle",
  phone: "round-rectangle",
  url: "round-rectangle",
  image: "round-rectangle",
  cryptocurrency: "hexagon",
  media: "round-rectangle",
};

export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  owns: "#27ae60",
  communicated: "#e67e22",
  located_at: "#2980b9",
  associated: "#8e44ad",
  member_of: "#c0392b",
  operates: "#16a085",
  linked: "#7f8c8d",
  reported: "#f1c40f",
  finances: "#2ecc71",
  familial: "#e91e63",
  operational: "#ff5722",
  geographic: "#00bcd4",
};

// ---------------------------------------------------------------------------
// Label helpers (human-readable)
// ---------------------------------------------------------------------------

export const ENTITY_LABELS: Record<EntityType, string> = {
  person: "Person",
  username: "Username",
  location: "Location",
  device: "Device",
  organization: "Organization",
  email: "Email",
  phone: "Phone",
  url: "URL",
  image: "Image",
  cryptocurrency: "Cryptocurrency",
  media: "Media",
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  owns: "Owns",
  communicated: "Communicated",
  located_at: "Located At",
  associated: "Associated",
  member_of: "Member Of",
  operates: "Operates",
  linked: "Linked",
  reported: "Reported",
  finances: "Finances",
  familial: "Familial",
  operational: "Operational",
  geographic: "Geographic",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Active",
  closed: "Closed",
  archived: "Archived",
  cold: "Cold Case",
};

export const CASE_SENSITIVITY_LABELS: Record<CaseSensitivity, string> = {
  unclassified: "Unclassified",
  confidential: "Confidential",
  secret: "Secret",
  "top-secret": "Top Secret",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  info: "Info",
  alert: "Alert",
  action: "Action",
  discovery: "Discovery",
  communication: "Communication",
  capture: "Capture",
  relocation: "Relocation",
  financial: "Financial",
};

export const TRANSFORM_STATUS_LABELS: Record<TransformStatus, string> = {
  draft: "Draft",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

// ---------------------------------------------------------------------------
// Intelligence, Alerts, Evidence, Modules, Auth
// ---------------------------------------------------------------------------

export type IntelligenceLevel = 'ALPHA' | 'BETA' | 'GAMMA';
export type AlertTier = 'critical' | 'urgent' | 'routine';
export type AlertCategory = 'location_confirmed' | 'imminent_threat' | 'opsec_breach' | 'associate_arrested' | 'new_account' | 'travel_pattern' | 'financial' | 'pattern_match' | 'platform_migration';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'false_positive';
export type EvidenceConfidence = 'verified' | 'probable' | 'unconfirmed' | 'disputed';
export type ModuleKey = 'social_searcher' | 'qwant_gibiru' | 'osint_industries' | 'idcrawl' | 'maigret' | 'sherlock' | 'ghost' | 'specter' | 'wraith' | 'revenant' | 'custom_scraper';
export type UserRole = 'admin' | 'senior_analyst' | 'analyst' | 'viewer';

export interface CaseModule {
  id: string;
  caseId: string;
  moduleKey: ModuleKey;
  enabled: boolean;
  config: Record<string, unknown>;
  lastRun: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  caseId: string;
  title: string;
  description: string;
  tier: AlertTier;
  category: AlertCategory;
  status: AlertStatus;
  entityId: string | null;
  metadata: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
}

export interface Evidence {
  id: string;
  caseId: string;
  entityId: string | null;
  title: string;
  description: string;
  sourceUrl: string;
  sourceType: string;
  contentHash: string;
  data: Record<string, unknown>;
  confidence: EvidenceConfidence;
  legalReviewFlag: boolean;
  chainOfCustody: Array<{ userId: string; action: string; timestamp: string }>;
  collectedAt: string;
  collectedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clearance: string;
}

// Module definitions with icons and descriptions
export const MODULE_DEFINITIONS: Record<ModuleKey, { name: string; description: string; icon: string; color: string }> = {
  social_searcher: { name: 'SocialSearcher Bridge', description: 'Hashtag/mention monitoring across social platforms', icon: 'Hash', color: '#3498db' },
  qwant_gibiru: { name: 'Qwant/Gibiru Aggregator', description: 'Uncensored search indexing', icon: 'Search', color: '#e74c3c' },
  osint_industries: { name: 'OSINT Industries Connector', description: 'Breach database queries', icon: 'Database', color: '#9b59b6' },
  idcrawl: { name: 'IDCrawl/ThatsThem/WhatMyName', description: 'Username-to-PII correlation', icon: 'UserSearch', color: '#2ecc71' },
  maigret: { name: 'Maigret Module', description: 'Deep username investigation (3000+ sites)', icon: 'Radar', color: '#f39c12' },
  sherlock: { name: 'Sherlock Module', description: 'Rapid social media discovery', icon: 'Eye', color: '#1abc9c' },
  ghost: { name: 'GHOST Module', description: 'Phone number reverse lookup', icon: 'Phone', color: '#e67e22' },
  specter: { name: 'SPECTER Module', description: 'Facial recognition across platforms', icon: 'ScanFace', color: '#c0392b' },
  wraith: { name: 'WRAITH Module', description: 'Cryptocurrency transaction clustering', icon: 'Bitcoin', color: '#f1c40f' },
  revenant: { name: 'REVENANT Module', description: 'Deep web archive excavation', icon: 'Archive', color: '#34495e' },
  custom_scraper: { name: 'Custom Scrapers', description: 'Target-specific platform scrapers', icon: 'Code', color: '#7f8c8d' },
};

export const ALERT_TIER_CONFIG: Record<AlertTier, { label: string; color: string; bgColor: string; icon: string }> = {
  critical: { label: 'CRITICAL', color: '#dc2626', bgColor: 'bg-red-500/10', icon: 'AlertTriangle' },
  urgent: { label: 'URGENT', color: '#f59e0b', bgColor: 'bg-amber-500/10', icon: 'AlertCircle' },
  routine: { label: 'ROUTINE', color: '#3b82f6', bgColor: 'bg-blue-500/10', icon: 'Info' },
};

export const INTELLIGENCE_LEVEL_CONFIG: Record<IntelligenceLevel, { label: string; color: string; description: string }> = {
  ALPHA: { label: 'ALPHA', color: '#dc2626', description: 'High-Value Target' },
  BETA: { label: 'BETA', color: '#f59e0b', description: 'Associate' },
  GAMMA: { label: 'GAMMA', color: '#3b82f6', description: 'Historical' },
};

// ---------------------------------------------------------------------------
// Source Reliability & Information Credibility (NATO intelligence rating)
// ---------------------------------------------------------------------------

export type SourceReliability = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type InformationCredibility = '1' | '2' | '3' | '4' | '5' | '6';

export const SOURCE_RELIABILITY_LABELS: Record<SourceReliability, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Reliability Cannot Be Judged',
};

export const INFORMATION_CREDIBILITY_LABELS: Record<InformationCredibility, string> = {
  '1': 'Confirmed by Other Sources',
  '2': 'Probably True',
  '3': 'Possibly True',
  '4': 'Doubtful',
  '5': 'Improbable',
  '6': 'Truthfulness Cannot Be Judged',
};
