---
Task ID: 3-a, 3-b
Agent: full-stack-developer
Task: Build all API routes for Phantom Cases OSINT application

Work Log:
- Read worklog.md (did not exist yet) and Prisma schema to understand the data models
- Checked z-ai-web-dev-sdk exports and discovered web search is via `ZAI.create()` then `zai.functions.invoke('web_search', { query })`
- Created audit log helper at `src/lib/audit.ts`
- Created Cases API at `src/app/api/cases/route.ts` (GET list with status filter, POST create)
- Created Case Detail API at `src/app/api/cases/[id]/route.ts` (GET with counts, PUT update, DELETE)
- Created Entities API at `src/app/api/entities/route.ts` (GET list with caseId/type filter, POST create)
- Created Entity Detail API at `src/app/api/entities/[id]/route.ts` (GET with relationships, PUT update, DELETE)
- Created Relationships API at `src/app/api/relationships/route.ts` (GET list with caseId filter, POST create with source/target validation)
- Created Relationship Detail API at `src/app/api/relationships/[id]/route.ts` (PUT update, DELETE)
- Created Timeline API at `src/app/api/timeline/route.ts` (GET list with caseId/eventType filter, POST create)
- Created Transforms API at `src/app/api/transforms/route.ts` (GET list with caseId/status filter, POST create)
- Created Transform Detail API at `src/app/api/transforms/[id]/route.ts` (GET, PUT update, DELETE)
- Created Watchlist API at `src/app/api/watchlist/route.ts` (GET list with caseId/type/active filter, POST create)
- Created Search API at `src/app/api/search/route.ts` (POST using z-ai-web-dev-sdk web_search, auto-creates timeline event if caseId provided)
- Created Export API at `src/app/api/export/route.ts` (POST exports full case data with parsed JSON fields)
- Created Audit Log API at `src/app/api/audit/route.ts` (GET with pagination, action/resource filters)
- Created Graph Data API at `src/app/api/graph/[caseId]/route.ts` (GET returns Cytoscape.js compatible {nodes, edges} format)
- Ran lint - all clean
- Tested all routes via curl: cases CRUD, entities CRUD, timeline, watchlist, transforms, audit log, graph data, export - all working

Stage Summary:
- 14 API route files created under src/app/api/ covering all required endpoints
- 1 helper file created at src/lib/audit.ts for audit logging
- All routes use Prisma ORM via `import { db } from '@/lib/db'`
- All significant operations (create, update, delete, search) generate audit log entries
- Search API integrates z-ai-web-dev-sdk web_search function
- Graph API returns Cytoscape.js compatible format with nodes (position + data) and edges
- Lint passes clean, all endpoints tested and verified working
