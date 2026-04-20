import { db } from '~/server/db';
import { projects } from '~/server/db/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string }>(event);
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' });
  }

  const [project] = await db
    .insert(projects)
    .values({ name: body.name.trim() })
    .returning();

  return project;
});
