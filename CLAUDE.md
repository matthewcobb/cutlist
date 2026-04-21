# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from repo root via Bun workspaces. The web app lives in `web/`.

```bash
bun dev          # Start dev server
bun build        # Production build
bun test         # Run all tests
bun test:watch   # Watch mode
bun check        # Vue + TypeScript type check (vue-tsc --noEmit)
```

Run a single test file:

```bash
cd web && bun test lib/__tests__/generateBoardLayouts.edge.test.ts
```

Formatting runs automatically via lint-staged on commit (Prettier).

## Architecture

**Cutlist** is a browser-only SPA (Nuxt 3, SSR disabled) for generating optimized wood cutting plans. Users import GLTF assemblies or enter parts manually, assign stock materials, and the app produces board layouts with a PDF export.

### Core Data Flow

```
GLTF / manual parts
  → parseGltf (web/utils/parseGltf.ts) → PartDraft[]
  → useProjects (composable) → IndexedDB (useIdb)
  → user assigns colorMap (material per color)
  → generateBoardLayouts (web/lib/index.ts) → BoardLayout[]
  → BomTab / board preview display
  → exportPdf (web/utils/exportPdf.ts) or useExportProject (.cutlist.json)
```

### Packing Engine (`web/lib/`)

The heart of the app. `generateBoardLayouts` runs multiple **search passes** — each pass tries a different algorithm and configuration — then scores and ranks results.

Three packers:

- **ShelfPacker** — fast, shelf-based baseline
- **GuillotinePacker** — guillotine-constrained cuts (target user workflow)
- **TightPacker** — iterative/exact placement for small boards

Search passes include shelf variants, guillotine variants (with/without rotation, CNC vs manual cuts), and randomized permutations. The packer returning the fewest boards / least waste wins.

Types live in `web/lib/types.ts` (`Stock`, `PartToCut`, `BoardLayout`, `SearchPass`).

### Composables (`web/composables/`)

State is composable-based (no Pinia). Key composables:

- `useProjects` — project CRUD + active project state
- `useIdb` — IndexedDB persistence (projects, GLTF models, settings)
- `useProjectSettings` — per-project settings (blade width, optimization mode)
- `useProjectTabMap` — tab state per project
- `useBoardLayoutsQuery` — runs packing engine reactively
- `useBuildSteps` — assembly instruction generation
- `useThreeViewer` — Three.js 3D viewer (GLTF rendering, camera controls)
- `useExportProject` / `useImportProject` — `.cutlist.json` file I/O

### UI (`web/components/`, `web/pages/index.vue`)

Single page (`index.vue`) with a project sidebar and tabbed main area. Tabs: Model (3D viewer), Stock, BOM, Instructions, Warnings, Settings.

Styling: Tailwind CSS v4 + Nuxt UI, dark mode by default, custom "mist" color palette (`tailwind.config.ts`), teal accent (`app.config.ts`).

### NPM Package (`npm/`)

Standalone packing library (not actively published). Contains Onshape API integration (`onshape.ts`) not present in the web app. Ignore unless working on library publishing.

## Testing

Tests use Bun's built-in test runner. Test files live alongside source in `__tests__/` subdirectories:

- `web/lib/__tests__/` — packing algorithm tests
- `web/lib/packers/__tests__/` — individual packer unit tests
- `web/lib/utils/__tests__/` — utility tests
- `web/utils/__tests__/` — web utility tests

## Data Migrations (`web/utils/migrations.ts`)

Record shapes in IndexedDB evolve over time. A lightweight migration system handles this:

- **`SCHEMA_VERSION`** — bump when any record type's fields change (independent of IDB database version, which only changes for store/index structure).
- **Startup sweep** — on app init, migrates all stored records to current schema. Cursor-based for models (avoids loading gltfJson blobs).
- **`applyDefaults`** in `useIdb.ts` — safety net on read paths in case sweep was interrupted.
- **`migrateExport`** — applies same migrations to imported `.cutlist.json` files.

### When adding a new field to a record type

1. Update the TypeScript interface in `useIdb.ts`
2. Bump `SCHEMA_VERSION` in `migrations.ts`
3. Add a migration entry with a sensible default
4. Update the matching `applyDefaults` function in `useIdb.ts`
5. Update `createX` to set the field for new records
6. Add a test in `utils/__tests__/migrations.test.ts`

### Migration rules

1. **New required fields must have a default** — every non-optional field needs a migration providing one.
2. **Never delete a field** — mark it optional (`?`) and stop writing it.
3. **Never change a field's type in place** — add a new field, deprecate the old one.
4. **Migrations are pure functions** — no side effects, no DB access, no async.
5. **Migrations are append-only** — never edit or delete a shipped migration.
6. **`applyDefaults` is the safety net** — even if sweep is interrupted, reads won't crash.

## Key Config Files

- `web/nuxt.config.ts` — Nuxt config (SSR off, modules)
- `web/tailwind.config.ts` — custom color palette
- `web/app.config.ts` — Nuxt UI theme
- `cutlist.config.yaml` — user-facing defaults (stock materials, blade width, optimization modes)
