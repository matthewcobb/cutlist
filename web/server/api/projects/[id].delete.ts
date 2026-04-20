import { db } from '~/server/db';
import { projects } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;

  const [deleted] = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning({ id: projects.id });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' });
  }

  return { ok: true };
});
