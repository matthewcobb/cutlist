import { db } from '~/server/db';
import { models, projects } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')!;
  const modelId = getRouterParam(event, 'modelId')!;

  const [deleted] = await db
    .delete(models)
    .where(and(eq(models.id, modelId), eq(models.projectId, projectId)))
    .returning({ id: models.id });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  }

  // Touch project updatedAt
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return { ok: true };
});
