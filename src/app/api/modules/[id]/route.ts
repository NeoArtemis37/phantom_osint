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
    const { enabled, config, status } = body;

    const updateData: Record<string, unknown> = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (config !== undefined) updateData.config = JSON.stringify(config);
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'running') {
        // keep lastRun unchanged until completed
      } else if (status === 'completed') {
        updateData.lastRun = new Date();
      }
    }

    const caseModule = await db.caseModule.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog('update', 'CaseModule', { id, updates: body });

    return NextResponse.json({
      ...caseModule,
      config: JSON.parse(caseModule.config || '{}'),
      lastRun: caseModule.lastRun?.toISOString() || null,
      createdAt: caseModule.createdAt.toISOString(),
      updatedAt: caseModule.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to update module:', error);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.caseModule.delete({ where: { id } });

    await createAuditLog('delete', 'CaseModule', { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete module:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
