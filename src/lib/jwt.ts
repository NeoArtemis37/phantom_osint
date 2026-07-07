// =============================================================================
// JWT Token Utilities — Access Token Authentication
// =============================================================================

import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "phantom-osint-dev-secret-change-in-production";
const ACCESS_TOKEN_EXPIRES = "12h";

// ---------------------------------------------------------------------------
// Token payload shape
// ---------------------------------------------------------------------------

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  clearance: string;
}

// ---------------------------------------------------------------------------
// Sign a new access token
// ---------------------------------------------------------------------------

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

// ---------------------------------------------------------------------------
// Verify an access token — returns null if invalid/expired
// ---------------------------------------------------------------------------

export function verifyAccessToken(
  token: string
): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extract Bearer token from Authorization header
// ---------------------------------------------------------------------------

export function extractBearerToken(
  request: Request
): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

// ---------------------------------------------------------------------------
// Authenticate a request — returns the user payload or null
// ---------------------------------------------------------------------------

export function authenticateRequest(
  request: Request
): TokenPayload | null {
  const token = extractBearerToken(request);
  if (!token) return null;
  return verifyAccessToken(token);
}
