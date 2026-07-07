import { create } from "zustand";
import type {
  Case,
  Entity,
  Relationship,
  SearchResult,
  Alert,
  AuthUser,
} from "@/types";

// ---------------------------------------------------------------------------
// Side panel content type
// ---------------------------------------------------------------------------

export type SidePanelContent =
  | "entity-detail"
  | "add-entity"
  | "add-relationship"
  | "search"
  | "none";

// ---------------------------------------------------------------------------
// Active view tabs
// ---------------------------------------------------------------------------

export type ActiveView =
  | "graph"
  | "timeline"
  | "transforms"
  | "watchlist"
  | "report"
  | "alerts"
  | "evidence"
  | "modules"
  | "osint"
  | "analysis"
  | "notebook"
  | "cyberwatch";

// ---------------------------------------------------------------------------
// Graph layout options (maps to Cytoscape layout names)
// ---------------------------------------------------------------------------

export type GraphLayout =
  | "cose"
  | "breadthfirst"
  | "circle"
  | "concentric"
  | "grid";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface PhantomState {
  // ---- Current case ----
  currentCase: Case | null;
  setCurrentCase: (c: Case | null) => void;

  // ---- Investigation locale (global OSINT targeting) ----
  investigationCountry: string; // ISO 3166-1 alpha-2
  investigationLanguage: string; // ISO 639-1 (auto-derived from country if empty)
  investigationRegionalOnly: boolean; // restrict to regional platforms only
  setInvestigationCountry: (code: string) => void;
  setInvestigationLanguage: (lang: string) => void;
  setInvestigationRegionalOnly: (v: boolean) => void;
  setInvestigationLocale: (locale: { country?: string; language?: string; regionalOnly?: boolean }) => void;

  // ---- Selected entity (on graph) ----
  selectedEntity: Entity | null;
  setSelectedEntity: (e: Entity | null) => void;

  // ---- Selected relationship ----
  selectedRelationship: Relationship | null;
  setSelectedRelationship: (r: Relationship | null) => void;

  // ---- Active view tab ----
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;

  // ---- Side panel ----
  sidePanelOpen: boolean;
  setSidePanelOpen: (open: boolean) => void;
  sidePanelContent: SidePanelContent;
  setSidePanelContent: (c: SidePanelContent) => void;

  // ---- Search ----
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchResult[];
  setSearchResults: (r: SearchResult[]) => void;
  isSearching: boolean;
  setIsSearching: (s: boolean) => void;

  // ---- Graph layout ----
  graphLayout: GraphLayout;
  setGraphLayout: (l: GraphLayout) => void;

  // ---- Case manager dialog ----
  caseManagerOpen: boolean;
  setCaseManagerOpen: (open: boolean) => void;

  // ---- Multi-select on graph (for batch operations) ----
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
  toggleEntitySelection: (id: string) => void;
  clearEntitySelection: () => void;

  // ---- Graph fit / zoom ----
  graphFitRequested: number;
  requestGraphFit: () => void;

  // ---- Quick-add mode (when adding entity from graph right-click) ----
  quickAddPosition: { x: number; y: number } | null;
  setQuickAddPosition: (pos: { x: number; y: number } | null) => void;

  // ---- Global loading overlay ----
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // ---- Graph Filters ----
  graphFilters: {
    entityTypes: string[];
    relationshipTypes: string[];
    minConfidence: number;
    threatLevels: string[];
    timeRange: { start: string | null; end: string | null };
  };
  setGraphFilters: (filters: Partial<PhantomState['graphFilters']>) => void;
  resetGraphFilters: () => void;

  // ---- Auth ----
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  isAuthenticated: boolean;

  // ---- Alerts ----
  alerts: Alert[];
  setAlerts: (a: Alert[]) => void;
  unreadAlerts: number;

  // ---- OPSEC ----
  opsecMode: 'passive' | 'active';
  setOpsecMode: (mode: 'passive' | 'active') => void;
  proxyRotation: boolean;
  setProxyRotation: (v: boolean) => void;
  fingerprintRandomization: boolean;
  setFingerprintRandomization: (v: boolean) => void;

  // ---- Search Mode (top-left toggle: Active=global quick, Passive=deep thorough) ----
  searchMode: 'active' | 'passive';
  setSearchMode: (mode: 'active' | 'passive') => void;

  // ---- Intro screen (fade-in/fade-out artemis37 quote on first load after auth) ----
  introSeen: boolean;
  setIntroSeen: (v: boolean) => void;

  // ---- Radial menu expansion state ----
  radialMenuOpen: boolean;
  setRadialMenuOpen: (v: boolean) => void;

  // ---- Reset all state (e.g., when switching cases) ----
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Default graph filters
// ---------------------------------------------------------------------------

const defaultGraphFilters = {
  entityTypes: [] as string[],
  relationshipTypes: [] as string[],
  minConfidence: 0,
  threatLevels: [] as string[],
  timeRange: { start: null as string | null, end: null as string | null },
};

// ---------------------------------------------------------------------------
// Initial state factory (for reset)
// ---------------------------------------------------------------------------

const initialState = {
  currentCase: null as Case | null,
  selectedEntity: null as Entity | null,
  selectedRelationship: null as Relationship | null,
  activeView: "graph" as ActiveView,
  sidePanelOpen: false,
  sidePanelContent: "none" as SidePanelContent,
  searchQuery: "",
  searchResults: [] as SearchResult[],
  isSearching: false,
  graphLayout: "cose" as GraphLayout,
  caseManagerOpen: false,
  selectedEntityIds: [] as string[],
  graphFitRequested: 0,
  quickAddPosition: null as { x: number; y: number } | null,
  globalLoading: false,
  graphFilters: { ...defaultGraphFilters },
  user: null as AuthUser | null,
  isAuthenticated: false,
  alerts: [] as Alert[],
  unreadAlerts: 0,
  opsecMode: 'passive' as 'passive' | 'active',
  proxyRotation: true,
  fingerprintRandomization: true,
  // Search mode: 'active' = global quick search, 'passive' = deep thorough search
  searchMode: 'active' as 'active' | 'passive',
  introSeen: false,
  radialMenuOpen: false,
  // Investigation locale defaults — global (US) until the analyst picks a target country
  investigationCountry: "US",
  investigationLanguage: "en",
  investigationRegionalOnly: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePhantomStore = create<PhantomState>((set, get) => ({
  ...initialState,

  // ---- Current case ----
  setCurrentCase: (c) =>
    set({
      currentCase: c,
      // Reset selections when switching cases
      selectedEntity: null,
      selectedRelationship: null,
      selectedEntityIds: [],
      sidePanelOpen: false,
      sidePanelContent: "none",
    }),

  // ---- Investigation locale ----
  setInvestigationCountry: (code) =>
    set({ investigationCountry: code }),
  setInvestigationLanguage: (lang) =>
    set({ investigationLanguage: lang }),
  setInvestigationRegionalOnly: (v) =>
    set({ investigationRegionalOnly: v }),
  setInvestigationLocale: (locale) =>
    set((state) => ({
      investigationCountry: locale.country ?? state.investigationCountry,
      investigationLanguage: locale.language ?? state.investigationLanguage,
      investigationRegionalOnly: locale.regionalOnly ?? state.investigationRegionalOnly,
    })),

  // ---- Selected entity ----
  setSelectedEntity: (e) =>
    set((state) => ({
      selectedEntity: e,
      // Auto-open detail panel when selecting an entity
      sidePanelOpen: e !== null ? true : state.sidePanelContent === "none" ? false : state.sidePanelOpen,
      sidePanelContent: e !== null ? "entity-detail" : state.sidePanelContent,
    })),

  // ---- Selected relationship ----
  setSelectedRelationship: (r) => set({ selectedRelationship: r }),

  // ---- Active view tab ----
  setActiveView: (v) => set({ activeView: v }),

  // ---- Side panel ----
  setSidePanelOpen: (open) =>
    set((state) => ({
      sidePanelOpen: open,
      sidePanelContent: open
        ? state.sidePanelContent === "none"
          ? "search"
          : state.sidePanelContent
        : "none",
    })),

  setSidePanelContent: (c) =>
    set({
      sidePanelContent: c,
      sidePanelOpen: c !== "none",
    }),

  // ---- Search ----
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setIsSearching: (s) => set({ isSearching: s }),

  // ---- Graph layout ----
  setGraphLayout: (l) => set({ graphLayout: l }),

  // ---- Case manager dialog ----
  setCaseManagerOpen: (open) => set({ caseManagerOpen: open }),

  // ---- Multi-select ----
  setSelectedEntityIds: (ids) => set({ selectedEntityIds: ids }),

  toggleEntitySelection: (id) =>
    set((state) => {
      const selected = state.selectedEntityIds.includes(id)
        ? state.selectedEntityIds.filter((i) => i !== id)
        : [...state.selectedEntityIds, id];
      return { selectedEntityIds: selected };
    }),

  clearEntitySelection: () => set({ selectedEntityIds: [] }),

  // ---- Graph fit ----
  requestGraphFit: () =>
    set((state) => ({ graphFitRequested: state.graphFitRequested + 1 })),

  // ---- Quick-add position ----
  setQuickAddPosition: (pos) =>
    set({
      quickAddPosition: pos,
      sidePanelOpen: pos !== null,
      sidePanelContent: pos !== null ? "add-entity" : "none",
    }),

  // ---- Global loading ----
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  // ---- Graph Filters ----
  setGraphFilters: (filters) =>
    set((state) => ({
      graphFilters: { ...state.graphFilters, ...filters },
    })),

  resetGraphFilters: () =>
    set({
      graphFilters: { ...defaultGraphFilters },
    }),

  // ---- Auth ----
  setUser: (u) =>
    set({
      user: u,
      isAuthenticated: u !== null,
    }),

  // ---- Alerts ----
  setAlerts: (a) =>
    set({
      alerts: a,
      unreadAlerts: a.filter((alert) => alert.status === "active").length,
    }),

  // ---- OPSEC ----
  setOpsecMode: (mode) => set({ opsecMode: mode }),
  setProxyRotation: (v) => set({ proxyRotation: v }),
  setFingerprintRandomization: (v) => set({ fingerprintRandomization: v }),

  // ---- Search Mode ----
  setSearchMode: (mode) => set({ searchMode: mode }),

  // ---- Intro screen ----
  setIntroSeen: (v) => set({ introSeen: v }),

  // ---- Radial menu ----
  setRadialMenuOpen: (v) => set({ radialMenuOpen: v }),

  // ---- Reset ----
  reset: () => set({ ...initialState, graphFilters: { ...defaultGraphFilters } }),
}));
