import { db } from '~/server/db';
import { projects } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  const body = await readBody<{
    name?: string;
    colorMap?: Record<string, string>;
  }>(event);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.name !== undefined) updates.name = body.name;
  if (body?.colorMap !== undefined) updates.colorMap = body.colorMap;

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }

  return updated;
});
