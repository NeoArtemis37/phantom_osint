import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const eventType = searchParams.get('eventType');

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (eventType) where.eventType = eventType;

    const events = await db.timelineEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        entity: true,
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch timeline events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, entityId, title, description, eventType, timestamp, metadata } = body;

    if (!caseId || !title) {
      return NextResponse.json(
        { error: 'caseId and title are required' },
        { status: 400 }
      );
    }

    const event = await db.timelineEvent.create({
      data: {
        caseId,
        entityId: entityId || null,
        title,
        description: description || '',
        eventType: eventType || 'info',
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
      include: {
        entity: true,
      },
    });

    await createAuditLog('create', 'TimelineEvent', {
      eventId: event.id,
      caseId,
      title,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Failed to create timeline event:', error);
    return NextResponse.json(
      { error: 'Failed to create timeline event' },
      { status: 500 }
    );
  }
}
