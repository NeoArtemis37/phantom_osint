---
Task ID: 2
Agent: Auth Fix Agent
Task: Fix 3 critical auth system issues in Phantom Cases OSINT platform

Work Log:
- Fixed /api/auth/me/route.ts: Replaced `db.user.findFirst({ where: { active: true } })` with `getServerSession(authOptions)` to properly check the actual JWT session instead of returning the first active user
- Fixed /api/auth/logout/route.ts: Added `getServerSession(authOptions)` check so logout properly acknowledges the session exists, enabling client-side NextAuth signOut to work correctly
- Updated /app/login/page.tsx: Replaced custom `fetch('/api/auth/login')` with NextAuth's `signIn('credentials', { redirect: false, email, password })` which properly sets the session cookie. After successful signIn, fetches full user data via `authApi.me()`
- Created /src/middleware.ts: Added `withAuth` middleware from `next-auth/middleware` to protect all routes except login, api/auth, and static assets. Matcher pattern: `/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)`
- Updated TopBar.tsx: Replaced `fetch('/api/auth/logout')` with NextAuth's `signOut({ redirect: false })` for proper client-side session cleanup
- Verified existing NextAuth type declarations at /src/types/next-auth.d.ts already include `id`, `role`, and `clearance` fields on Session and JWT interfaces
- Lint passes clean with no errors
- Dev server compiles successfully (middleware deprecation warning is expected in Next.js 16 but still functional)

Files Modified:
- /src/app/api/auth/me/route.ts
- /src/app/api/auth/logout/route.ts
- /src/app/login/page.tsx
- /src/components/TopBar.tsx

Files Created:
- /src/middleware.ts

Stage Summary:
- Auth system now uses proper NextAuth JWT session verification instead of database queries
- Login flow uses NextAuth signIn() which properly sets the session cookie
- Logout flow uses NextAuth signOut() which properly clears the session
- All routes are now protected by middleware that redirects unauthenticated users to /login
- No lint errors, dev server compiles successfully
