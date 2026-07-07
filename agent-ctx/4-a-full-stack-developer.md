# Task 4-a: Zustand Store and TypeScript Types

## Summary
Built the foundational TypeScript types and state management layer for the Phantom Cases OSINT application.

## Files Created

### 1. `/src/types/index.ts`
Comprehensive type definitions including:
- **Enums**: `EntityType` (9 types), `RelationshipType` (8 types), `CaseStatus`, `CaseSensitivity`, `EventType`, `TransformStatus`
- **Core Models**: `Case`, `Entity`, `Relationship`, `TimelineEvent`, `TransformFlow` + `TransformStep`, `WatchlistItem`
- **Graph Models**: `GraphNode`, `GraphEdge`, `GraphData` (Cytoscape-compatible)
- **Supporting Models**: `SearchResult`, `AuditLogEntry`, `ReportConfig`
- **Visual Mappings**: `ENTITY_COLORS`, `ENTITY_SHAPES`, `RELATIONSHIP_COLORS`
- **Label Maps**: Human-readable labels for all enum types

### 2. `/src/store/phantom-store.ts`
Zustand store managing all UI state:
- **Case context**: `currentCase` with auto-reset on switch
- **Selection**: `selectedEntity`, `selectedRelationship`, `selectedEntityIds` (multi-select)
- **Navigation**: `activeView` (graph/timeline/transforms/watchlist/report)
- **Side panel**: open/close state + content type (entity-detail/add-entity/add-relationship/search)
- **Search**: query, results, loading state
- **Graph**: layout preference, fit requests, quick-add position
- **Dialogs**: case manager open state
- **Global**: loading overlay, full reset

### 3. `/src/lib/api-client.ts`
Fully typed API client:
- **CRUD operations** for: cases, entities, relationships, timeline, transforms, watchlist
- **Special endpoints**: search, graph data/layout, export/report, audit log
- **Input types**: `CreateCaseInput`, `UpdateCaseInput`, `CreateEntityInput`, etc.
- Uses relative paths (`/api/...`) for Caddy gateway compatibility
- Exports both namespaced APIs (`casesApi`, `entitiesApi`, etc.) and combined `api` object
