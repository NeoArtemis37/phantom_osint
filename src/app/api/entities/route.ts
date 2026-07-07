import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const type = searchParams.get('type');
    const threatLevel = searchParams.get('threatLevel');
    const verified = searchParams.get('verified');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (type) where.type = type;
    if (threatLevel) where.threatLevel = threatLevel;
    if (verified !== null && verified !== undefined)
      where.verified = verified === 'true';

    const entities = await db.entity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(entities);
  } catch (error) {
    console.error('Failed to fetch entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      caseId,
      name,
      type,
      value,
      metadata,
      avatar,
      color,
      x,
      y,
      notes,
      confidence,
      threatLevel,
      verified,
    } = body;

    if (!caseId || !name || !type) {
      return NextResponse.json(
        { error: 'caseId, name, and type are required' },
        { status: 400 }
      );
    }

    const entity = await db.entity.create({
      data: {
        caseId,
        name,
        type,
        value: value || '',
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        avatar: avatar || '',
        color: color || '',
        x: x ?? 0,
        y: y ?? 0,
        notes: notes || '',
        confidence: confidence ?? 0,
        threatLevel: threatLevel || 'unknown',
        verified: verified ?? false,
      },
    });

    await createAuditLog('create', 'Entity', {
      entityId: entity.id,
      caseId,
      name,
      type,
      confidence: entity.confidence,
      threatLevel: entity.threatLevel,
    });

    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    console.error('Failed to create entity:', error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}
