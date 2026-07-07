import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { authenticateRequest } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // If userId is provided, only return cases the user has access to
    if (userId) {
      const accessRecords = await db.caseAccess.findMany({
        where: { userId },
        select: { caseId: true },
      });
      const caseIds = accessRecords.map((a) => a.caseId);
      where.id = { in: caseIds };
    }

    const cases = await db.case.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { entities: true, relationships: true, timeline: true, modules: true, alerts: true, evidence: true },
        },
      },
    });

    // Parse JSON fields for frontend compatibility
    const parsed = cases.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      targetProfile: JSON.parse(c.targetProfile || '{}'),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Failed to fetch cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = authenticateRequest(request);
    const body = await request.json();
    const {
      name,
      description,
      status,
      sensitivity,
      tags,
      intelligenceLevel,
      targetProfile,
      resolution,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Case name is required' },
        { status: 400 }
      );
    }

    const newCase = await db.case.create({
      data: {
        name,
        description: description || '',
        status: status || 'active',
        sensitivity: sensitivity || 'confidential',
        tags: tags ? JSON.stringify(tags) : '[]',
        intelligenceLevel: intelligenceLevel || 'BETA',
        targetProfile: targetProfile ? JSON.stringify(targetProfile) : '{}',
        resolution: resolution || '',
        createdById: payload?.id || null,
        createdByName: payload?.name || '',
      },
    });

    // If user is authenticated, give them lead access to the case
    if (payload?.id) {
      await db.caseAccess.create({
        data: {
          caseId: newCase.id,
          userId: payload.id,
          role: 'lead',
        },
      });
    }

    await createAuditLog('create', 'Case', {
      caseId: newCase.id,
      name: newCase.name,
      intelligenceLevel: newCase.intelligenceLevel,
    });

    return NextResponse.json({
      ...newCase,
      tags: JSON.parse(newCase.tags || '[]'),
      targetProfile: JSON.parse(newCase.targetProfile || '{}'),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create case:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}
