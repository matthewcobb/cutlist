import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { PartDraft, ColorInfo, NodePartMapping } from '~/utils/parseGltf';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  colorMap: jsonb('color_map')
    .notNull()
    .$type<Record<string, string>>()
    .default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const models = pgTable('models', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  drafts: jsonb('drafts').notNull().$type<PartDraft[]>(),
  colors: jsonb('colors').notNull().$type<ColorInfo[]>(),
  enabled: boolean('enabled').notNull().default(true),
  gltfJson: jsonb('gltf_json').$type<object>(),
  nodePartMap: jsonb('node_part_map').$type<NodePartMapping[]>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
