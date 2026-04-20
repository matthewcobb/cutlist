import { db } from '~/server/db';
import { projects, models } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .then((rows) => rows[0]);

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }

  const projectModels = await db
    .select({
      id: models.id,
      projectId: models.projectId,
      filename: models.filename,
      drafts: models.drafts,
      colors: models.colors,
      enabled: models.enabled,
      nodePartMap: models.nodePartMap,
      createdAt: models.createdAt,
    })
    .from(models)
    .where(eq(models.projectId, id));

  return { ...project, models: projectModels };
});
