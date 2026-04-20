import { db } from '~/server/db';
import { models } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')!;
  const modelId = getRouterParam(event, 'modelId')!;

  const [model] = await db
    .select({
      gltfJson: models.gltfJson,
      nodePartMap: models.nodePartMap,
    })
    .from(models)
    .where(and(eq(models.id, modelId), eq(models.projectId, projectId)));

  if (!model) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  }

  return model;
});
