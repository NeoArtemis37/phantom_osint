import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caseData = await db.case.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            entities: true,
            relationships: true,
            timeline: true,
            transforms: true,
            watchlists: true,
            modules: true,
            alerts: true,
            evidence: true,
            access: true,
          },
        },
        access: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        modules: true,
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...caseData,
      tags: JSON.parse(caseData.tags || '[]'),
      targetProfile: JSON.parse(caseData.targetProfile || '{}'),
    });
  } catch (error) {
    console.error('Failed to fetch case:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
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
      description,
      status,
      sensitivity,
      tags,
      intelligenceLevel,
      targetProfile,
      resolution,
    } = body;

    const existing = await db.case.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (sensitivity !== undefined) updateData.sensitivity = sensitivity;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (intelligenceLevel !== undefined)
      updateData.intelligenceLevel = intelligenceLevel;
    if (targetProfile !== undefined)
      updateData.targetProfile = JSON.stringify(targetProfile);
    if (resolution !== undefined) updateData.resolution = resolution;

    const updatedCase = await db.case.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog('update', 'Case', {
      caseId: id,
      changes: Object.keys(updateData),
    });

    return NextResponse.json({
      ...updatedCase,
      tags: JSON.parse(updatedCase.tags || '[]'),
      targetProfile: JSON.parse(updatedCase.targetProfile || '{}'),
    });
  } catch (error) {
    console.error('Failed to update case:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
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

    const existing = await db.case.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    await db.case.delete({ where: { id } });

    await createAuditLog('delete', 'Case', {
      caseId: id,
      name: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete case:', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}
