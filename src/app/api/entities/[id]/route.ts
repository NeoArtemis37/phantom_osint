import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const entity = await db.entity.findUnique({
      where: { id },
      include: {
        sourceEdges: {
          include: { target: true },
        },
        targetEdges: {
          include: { source: true },
        },
        evidence: true,
        timelineEvents: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    return NextResponse.json(entity);
  } catch (error) {
    console.error('Failed to fetch entity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
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

    const existing = await db.entity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (value !== undefined) updateData.value = value;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    if (avatar !== undefined) updateData.avatar = avatar;
    if (color !== undefined) updateData.color = color;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (notes !== undefined) updateData.notes = notes;
    if (confidence !== undefined) updateData.confidence = confidence;
    if (threatLevel !== undefined) updateData.threatLevel = threatLevel;
    if (verified !== undefined) updateData.verified = verified;

    const updatedEntity = await db.entity.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog('update', 'Entity', {
      entityId: id,
      caseId: existing.caseId,
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updatedEntity);
  } catch (error) {
    console.error('Failed to update entity:', error);
    return NextResponse.json(
      { error: 'Failed to update entity' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.entity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    await db.entity.delete({ where: { id } });

    await createAuditLog('delete', 'Entity', {
      entityId: id,
      caseId: existing.caseId,
      name: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete entity:', error);
    return NextResponse.json(
      { error: 'Failed to delete entity' },
      { status: 500 }
    );
  }
}
