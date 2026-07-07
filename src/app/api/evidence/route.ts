import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createHash } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const entityId = searchParams.get('entityId');
    const sourceType = searchParams.get('sourceType');

    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { caseId };
    if (entityId) where.entityId = entityId;
    if (sourceType) where.sourceType = sourceType;

    const evidence = await db.evidence.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
    });

    const serialized = evidence.map((e) => ({
      ...e,
      data: JSON.parse(e.data || '{}'),
      chainOfCustody: JSON.parse(e.chainOfCustody || '[]'),
      collectedAt: e.collectedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Failed to fetch evidence:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, entityId, title, description, sourceUrl, sourceType, data, confidence, collectedBy } = body;

    if (!caseId || !title) {
      return NextResponse.json({ error: 'caseId and title are required' }, { status: 400 });
    }

    // Generate content hash
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ title, sourceUrl, data }))
      .digest('hex');

    const chainOfCustody = [{
      userId: collectedBy || 'system',
      action: 'collected',
      timestamp: new Date().toISOString(),
    }];

    const evidence = await db.evidence.create({
      data: {
        caseId,
        entityId: entityId || null,
        title,
        description: description || '',
        sourceUrl: sourceUrl || '',
        sourceType: sourceType || 'web',
        contentHash,
        data: JSON.stringify(data || {}),
        confidence: confidence || 'probable',
        legalReviewFlag: false,
        chainOfCustody: JSON.stringify(chainOfCustody),
        collectedBy: collectedBy || '',
      },
    });

    await createAuditLog('create', 'Evidence', { caseId, title });

    return NextResponse.json({
      ...evidence,
      data: JSON.parse(evidence.data || '{}'),
      chainOfCustody: JSON.parse(evidence.chainOfCustody || '[]'),
      collectedAt: evidence.collectedAt.toISOString(),
      createdAt: evidence.createdAt.toISOString(),
      updatedAt: evidence.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create evidence:', error);
    return NextResponse.json({ error: 'Failed to create evidence' }, { status: 500 });
  }
}
