import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const evidence = await db.evidence.findUnique({
      where: { id },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Parse chain of custody for easier consumption
    const result = {
      ...evidence,
      chainOfCustody: JSON.parse(evidence.chainOfCustody),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch evidence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
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
    const { confidence, legalReviewFlag, chainOfCustodyEntry } = body;

    const existing = await db.evidence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (confidence !== undefined) updateData.confidence = confidence;
    if (legalReviewFlag !== undefined)
      updateData.legalReviewFlag = legalReviewFlag;

    // Add to chain of custody if entry provided
    if (chainOfCustodyEntry) {
      const currentChain = JSON.parse(existing.chainOfCustody);
      currentChain.push({
        ...chainOfCustodyEntry,
        timestamp: chainOfCustodyEntry.timestamp || new Date().toISOString(),
      });
      updateData.chainOfCustody = JSON.stringify(currentChain);
    }

    const updatedEvidence = await db.evidence.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog('update', 'Evidence', {
      evidenceId: id,
      caseId: existing.caseId,
      changes: Object.keys(updateData),
    });

    return NextResponse.json(updatedEvidence);
  } catch (error) {
    console.error('Failed to update evidence:', error);
    return NextResponse.json(
      { error: 'Failed to update evidence' },
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

    const existing = await db.evidence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Evidence not found' },
        { status: 404 }
      );
    }

    await db.evidence.delete({ where: { id } });

    await createAuditLog('delete', 'Evidence', {
      evidenceId: id,
      caseId: existing.caseId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete evidence:', error);
    return NextResponse.json(
      { error: 'Failed to delete evidence' },
      { status: 500 }
    );
  }
}
