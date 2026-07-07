import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/jwt';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);

    if (!payload?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: payload.id },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clearance: user.clearance,
    });
  } catch (error) {
    console.error('Auth check failed:', error);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
