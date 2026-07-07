import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, label, metadata, weight } = body;

    const existing = await db.relationship.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (label !== undefined) updateData.label = label;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
    if (weight !== undefined) updateData.weight = weight;

    const updatedRelationship = await db.relationship.update({
      where: { id },
      data: updateData,
      include: {
        source: true,
        target: true,
      },
    });

    await createAuditLog('update', 'Relationship', {
      relationshipId: id,
      caseId: existing.caseId,
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updatedRelationship);
  } catch (error) {
    console.error('Failed to update relationship:', error);
    return NextResponse.json(
      { error: 'Failed to update relationship' },
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

    const existing = await db.relationship.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    await db.relationship.delete({ where: { id } });

    await createAuditLog('delete', 'Relationship', {
      relationshipId: id,
      caseId: existing.caseId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
}
