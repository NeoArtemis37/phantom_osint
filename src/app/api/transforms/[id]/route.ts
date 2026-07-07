import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transform = await db.transformFlow.findUnique({
      where: { id },
    });

    if (!transform) {
      return NextResponse.json(
        { error: 'Transform flow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transform);
  } catch (error) {
    console.error('Failed to fetch transform flow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transform flow' },
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
    const { name, description, steps, status, results } = body;

    const existing = await db.transformFlow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transform flow not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (steps !== undefined) updateData.steps = JSON.stringify(steps);
    if (status !== undefined) updateData.status = status;
    if (results !== undefined) updateData.results = JSON.stringify(results);

    const updatedTransform = await db.transformFlow.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog('update', 'TransformFlow', {
      transformId: id,
      caseId: existing.caseId,
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updatedTransform);
  } catch (error) {
    console.error('Failed to update transform flow:', error);
    return NextResponse.json(
      { error: 'Failed to update transform flow' },
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

    const existing = await db.transformFlow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transform flow not found' },
        { status: 404 }
      );
    }

    await db.transformFlow.delete({ where: { id } });

    await createAuditLog('delete', 'TransformFlow', {
      transformId: id,
      caseId: existing.caseId,
      name: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete transform flow:', error);
    return NextResponse.json(
      { error: 'Failed to delete transform flow' },
      { status: 500 }
    );
  }
}
