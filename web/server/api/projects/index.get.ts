import { db } from '~/server/db';
import { projects } from '~/server/db/schema';
import { desc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt));
});
