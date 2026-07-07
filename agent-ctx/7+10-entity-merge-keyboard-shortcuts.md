# Task 7+10: Entity Merge/Deduplication & Keyboard Shortcuts

## Agent: Entity Merge & Keyboard Shortcuts Agent

## Summary
Successfully implemented entity merge/deduplication and global keyboard shortcuts for the Phantom Cases OSINT platform.

## Files Created
1. `/src/app/api/entities/merge/route.ts` — POST endpoint for entity merging
2. `/src/components/EntityMergeDialog.tsx` — Dialog UI for selecting source/target and previewing merge
3. `/src/components/KeyboardShortcuts.tsx` — Global keyboard shortcut hook component

## Files Modified
1. `/src/lib/api-client.ts` — Added `merge` method to `entitiesApi`
2. `/src/components/EntityPanel.tsx` — Added merge button, aliases section, and EntityMergeDialog integration
3. `/src/app/page.tsx` — Added KeyboardShortcuts component
4. `/src/components/TopBar.tsx` — Added keyboard shortcuts help popover with Keyboard icon button

## Key Design Decisions
- Merge preserves target entity, deletes source after reassigning all references
- Source entity name is tracked in `_aliases` metadata array on target for dedup history
- Keyboard shortcuts ignore input/textarea/contentEditable to prevent conflicts
- Number keys 1-9/0 map to views but skip Ctrl combinations to avoid browser conflicts
- KeyboardShortcuts renders null (hook-only component) — no DOM footprint
- Merge preview shows relationship and evidence counts before confirming
