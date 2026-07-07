import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

const VALID_TYPES = [
  'owns',
  'communicated',
  'located_at',
  'associated',
  'member_of',
  'operates',
  'linked',
  'reported',
  'finances',
  'familial',
  'operational',
  'geographic',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (type) where.type = type;

    const relationships = await db.relationship.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        source: true,
        target: true,
      },
    });

    return NextResponse.json(relationships);
  } catch (error) {
    console.error('Failed to fetch relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, sourceId, targetId, type, label, metadata, weight } = body;

    if (!caseId || !sourceId || !targetId || !type) {
      return NextResponse.json(
        { error: 'caseId, sourceId, targetId, and type are required' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Valid types: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify source and target entities exist
    const [source, target] = await Promise.all([
      db.entity.findUnique({ where: { id: sourceId } }),
      db.entity.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) {
      return NextResponse.json(
        { error: 'Source entity not found' },
        { status: 404 }
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: 'Target entity not found' },
        { status: 404 }
      );
    }

    const relationship = await db.relationship.create({
      data: {
        caseId,
        sourceId,
        targetId,
        type,
        label: label || '',
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        weight: weight ?? 1,
      },
      include: {
        source: true,
        target: true,
      },
    });

    await createAuditLog('create', 'Relationship', {
      relationshipId: relationship.id,
      caseId,
      sourceId,
      targetId,
      type,
    });

    return NextResponse.json(relationship, { status: 201 });
  } catch (error) {
    console.error('Failed to create relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}
