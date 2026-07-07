import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;

    const transforms = await db.transformFlow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(transforms);
  } catch (error) {
    console.error('Failed to fetch transform flows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transform flows' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, name, description, steps, status, results } = body;

    if (!caseId || !name) {
      return NextResponse.json(
        { error: 'caseId and name are required' },
        { status: 400 }
      );
    }

    const transform = await db.transformFlow.create({
      data: {
        caseId,
        name,
        description: description || '',
        steps: steps ? JSON.stringify(steps) : '[]',
        status: status || 'draft',
        results: results ? JSON.stringify(results) : '{}',
      },
    });

    await createAuditLog('create', 'TransformFlow', {
      transformId: transform.id,
      caseId,
      name,
    });

    return NextResponse.json(transform, { status: 201 });
  } catch (error) {
    console.error('Failed to create transform flow:', error);
    return NextResponse.json(
      { error: 'Failed to create transform flow' },
      { status: 500 }
    );
  }
}
