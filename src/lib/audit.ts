import { db } from '@/lib/db';

export async function createAuditLog(action: string, resource: string, details: Record<string, unknown> = {}) {
  try {
    await db.auditLog.create({
      data: {
        action,
        resource,
        details: JSON.stringify(details),
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
