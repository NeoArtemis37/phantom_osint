# Task 5 — STIX 2.1 and GeoJSON Export Formats

## Summary
Added STIX 2.1 and GeoJSON export format support to the Phantom Cases OSINT platform.

## Files Modified

### 1. `/src/app/api/export/route.ts`
- Added format validation (`json`, `stix`, `geojson`)
- **STIX 2.1 generator** (`generateStixBundle`):
  - Creates a `type: "bundle"` with `spec_version: "2.1"`
  - Entity → STIX Domain/Cyber-observable Object mapping:
    - `person` → `individual` (identity SDO)
    - `organization` → `organization` (identity SDO)
    - `location` → `location` (SDO with lat/lng from metadata)
    - `email` → `email-address` (SCO)
    - `phone` → `phone-number` (SCO)
    - `url` → `url` (SCO)
    - `username` → `user-account` (SCO)
    - `cryptocurrency` → `cryptocurrency-wallet` (SCO)
    - `device` → `x-phantom-device` (SCO)
    - `image` → `file` (SCO)
    - `media` → `artifact` (SCO)
  - Relationship → STIX Relationship Object (SRO) with `relationship_type`, `source_ref`, `target_ref`
  - Timeline events → STIX Sighting objects
  - Case-level Identity object as `created_by_ref`
  - STIX IDs in `type--uuid` format
  - Tags → `labels`, metadata → `x_phantom_*` extensions
  - Confidence scores preserved

- **GeoJSON generator** (`generateGeoJSON`):
  - Creates `FeatureCollection` with `Point` features
  - Extracts lat/lng from entity metadata (supports `latitude`/`lat` and `longitude`/`lng`)
  - Falls back to graph x/y positions (scaled) for entities without coordinates
  - `approximated: true` flag on features using fallback coordinates
  - Properties: id, name, entityType, value, caseId, confidence, threatLevel, verified, notes

### 2. `/src/lib/api-client.ts`
- Updated `exportApi.exportJson` to accept `format` parameter with default `'json'`

### 3. `/src/components/ReportGenerator.tsx`
- Added format selector dropdown using shadcn `Select` component
- Three format options with icons, labels, descriptions, and file extensions:
  - **JSON**: `FileJson` icon, "Full case data export for backup/import", `.json`
  - **STIX 2.1**: `Network` icon, "Threat intelligence standard for MISP, OpenCTI, and other TIPs", `.stix.json`
  - **GeoJSON**: `Globe` icon, "Geographic data for mapping tools like QGIS, Mapbox", `.geojson`
- Format description card showing selected format details
- Dynamic download filename with correct extension
- Format-aware success messages (STIX objects count, GeoJSON features count)
- Reset generated state when format changes

## Verification
- ESLint passes clean
- Dev server compiles without errors
- STIX output follows STIX 2.1 spec (bundle, spec_version, type--uuid IDs, proper SDO/SCO/SRO types)
- GeoJSON output follows RFC 7946 (FeatureCollection, Feature, Point geometry, [lng, lat] coordinate order)
