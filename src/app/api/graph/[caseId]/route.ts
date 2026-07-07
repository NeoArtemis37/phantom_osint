import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    const caseData = await db.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const [entities, relationships] = await Promise.all([
      db.entity.findMany({ where: { caseId } }),
      db.relationship.findMany({
        where: { caseId },
      }),
    ]);

    // Format for Cytoscape.js compatibility
    const nodes = entities.map((entity) => ({
      data: {
        id: entity.id,
        label: entity.name,
        type: entity.type,
        value: entity.value,
        avatar: entity.avatar,
        color: entity.color,
        notes: entity.notes,
        metadata: JSON.parse(entity.metadata),
        confidence: entity.confidence,
        threatLevel: entity.threatLevel,
        verified: entity.verified,
        createdAt: entity.createdAt.toISOString(),
      },
      position: {
        x: entity.x,
        y: entity.y,
      },
    }));

    const edges = relationships.map((rel) => ({
      data: {
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        label: rel.label || rel.type,
        type: rel.type,
        weight: rel.weight,
        metadata: JSON.parse(rel.metadata),
        createdAt: rel.createdAt.toISOString(),
      },
    }));

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('Failed to fetch graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}
