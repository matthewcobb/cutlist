import { db } from '~/server/db';
import { models, projects } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  if (!body?.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'filename is required',
    });
  }

  const [model] = await db
    .insert(models)
    .values({
      id: body.id ?? undefined,
      projectId,
      filename: body.filename,
      drafts: body.drafts ?? [],
      colors: body.colors ?? [],
      enabled: body.enabled ?? true,
      gltfJson: body.gltfJson ?? null,
      nodePartMap: body.nodePartMap ?? null,
    })
    .returning();

  // Touch project updatedAt
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return model;
});
