import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, targetId, caseId } = body;

    if (!sourceId || !targetId || !caseId) {
      return NextResponse.json({ error: 'sourceId, targetId, and caseId are required' }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: 'Cannot merge entity with itself' }, { status: 400 });
    }

    const source = await db.entity.findUnique({ where: { id: sourceId } });
    const target = await db.entity.findUnique({ where: { id: targetId } });

    if (!source || !target) {
      return NextResponse.json({ error: 'Source or target entity not found' }, { status: 404 });
    }

    if (source.caseId !== caseId || target.caseId !== caseId) {
      return NextResponse.json({ error: 'Entities must be in the same case' }, { status: 400 });
    }

    // Reassign all relationships from source to target
    await db.relationship.updateMany({
      where: { sourceId: sourceId },
      data: { sourceId: targetId },
    });
    await db.relationship.updateMany({
      where: { targetId: sourceId },
      data: { targetId: targetId },
    });

    // Reassign timeline events
    await db.timelineEvent.updateMany({
      where: { entityId: sourceId },
      data: { entityId: targetId },
    });

    // Reassign evidence
    await db.evidence.updateMany({
      where: { entityId: sourceId },
      data: { entityId: targetId },
    });

    // Merge metadata: combine source metadata into target
    const sourceMeta = JSON.parse(source.metadata || '{}');
    const targetMeta = JSON.parse(target.metadata || '{}');
    const mergedMeta = {
      ...targetMeta,
      ...sourceMeta,
      _aliases: [...(targetMeta._aliases || []), source.name, ...(sourceMeta._aliases || [])],
    };

    // Merge notes
    const mergedNotes = target.notes
      ? `${target.notes}\n\n[Merged from: ${source.name}]\n${source.notes}`
      : source.notes;

    // Update target with merged data
    await db.entity.update({
      where: { id: targetId },
      data: {
        metadata: JSON.stringify(mergedMeta),
        notes: mergedNotes,
        verified: target.verified || source.verified,
        confidence: Math.max(target.confidence, source.confidence),
      },
    });

    // Remove duplicate self-relationships
    const rels = await db.relationship.findMany({
      where: { sourceId: targetId, targetId: targetId },
    });
    for (const rel of rels.slice(1)) {
      await db.relationship.delete({ where: { id: rel.id } });
    }

    // Delete source entity
    await db.entity.delete({ where: { id: sourceId } });

    await createAuditLog(
      'entity_merged',
      'entity',
      { sourceId, sourceName: source.name, targetId, targetName: target.name },
    );

    const merged = await db.entity.findUnique({
      where: { id: targetId },
      include: { sourceEdges: true, targetEdges: true, evidence: true, timelineEvents: true },
    });

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Merge failed:', error);
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 });
  }
}
