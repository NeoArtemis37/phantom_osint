import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const modules = await db.caseModule.findMany({
      where: { caseId },
      orderBy: { moduleKey: 'asc' },
    });

    const serialized = modules.map((m) => ({
      ...m,
      config: JSON.parse(m.config || '{}'),
      lastRun: m.lastRun?.toISOString() || null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Failed to fetch modules:', error);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, moduleKey, enabled, config } = body;

    if (!caseId || !moduleKey) {
      return NextResponse.json({ error: 'caseId and moduleKey are required' }, { status: 400 });
    }

    const caseModule = await db.caseModule.upsert({
      where: {
        caseId_moduleKey: { caseId, moduleKey },
      },
      create: {
        caseId,
        moduleKey,
        enabled: enabled ?? false,
        config: JSON.stringify(config || {}),
      },
      update: {
        enabled: enabled ?? false,
        config: JSON.stringify(config || {}),
      },
    });

    await createAuditLog('create', 'CaseModule', { caseId, moduleKey });

    return NextResponse.json({
      ...caseModule,
      config: JSON.parse(caseModule.config || '{}'),
      lastRun: caseModule.lastRun?.toISOString() || null,
      createdAt: caseModule.createdAt.toISOString(),
      updatedAt: caseModule.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create module:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}
