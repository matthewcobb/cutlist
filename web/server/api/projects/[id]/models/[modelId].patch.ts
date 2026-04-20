import { db } from '~/server/db';
import { models, projects } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')!;
  const modelId = getRouterParam(event, 'modelId')!;
  const body = await readBody<{ enabled?: boolean }>(event);

  const updates: Record<string, unknown> = {};
  if (body?.enabled !== undefined) updates.enabled = body.enabled;

  const [updated] = await db
    .update(models)
    .set(updates)
    .where(and(eq(models.id, modelId), eq(models.projectId, projectId)))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  }

  // Touch project updatedAt
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return updated;
});
