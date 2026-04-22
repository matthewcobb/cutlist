# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from repo root. The web app source lives in `web/`.

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
GLTF file import
  → parseGltf (web/utils/parseGltf.ts)
  → stores raw gltfJson in IndexedDB

Manual parts
  → user enters via BOM tab
  → stores Part[] in IndexedDB (source of truth)

On project load (useProjects → hydrateModel)
  → GLTF models: deriveFromGltf(gltfJson) → Part[], colors, nodePartMap
  → Manual models: reads stored Part[] directly
  → Both: applies partOverrides (user edits like grainLock)
  → user assigns colorMap (material per color)
  → useBoardLayoutsQuery resolves Part → PartToCut (adds material)
  → generateBoardLayouts (web/lib/index.ts) → BoardLayout[]
  → BomTab / board preview display
  → exportPdf (web/utils/exportPdf.ts) or useExportProject (.cutlist.gz)
```

### Packing Engine (`web/lib/`)

The heart of the app. `generateBoardLayouts` runs multiple **search passes** — each pass tries a different algorithm and configuration — then scores and ranks results.

Three packers:

- **ShelfPacker** — fast, shelf-based baseline
- **GuillotinePacker** — guillotine-constrained cuts (target user workflow)
- **TightPacker** — iterative/exact placement for small boards

Search passes include shelf variants, guillotine variants (with/without rotation, CNC vs manual cuts), and randomized permutations. The packer returning the fewest boards / least waste wins.

Types: `Part` (web/utils/parseGltf.ts) is the storage/UI type (no material). `PartToCut` (web/lib/types.ts) is the packing engine input (has material). `PartOverride` (web/composables/useIdb.ts) holds per-part user edits (grainLock, extensible). Other packing types: `Stock`, `BoardLayout`, `SearchPass` in `web/lib/types.ts`.

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

### Theming

The app is always dark. The **mist palette** (cool blue-gray ramp) is the single color source, set as `neutral: 'mist'` in `app.config.ts` so Nuxt UI generates all its semantic colors from it automatically. Dark mode is forced via `colorMode: { preference: 'dark' }` in `nuxt.config.ts`.

**How it works**: Nuxt UI maps the neutral palette to CSS variables (`--ui-bg`, `--ui-bg-elevated`, `--ui-text-muted`, etc.) which power its built-in semantic classes (`bg-default`, `bg-elevated`, `text-muted`, `text-dimmed`, etc.). Setting `neutral: 'mist'` means all those resolve to mist values. Custom utilities in `typography.css` fill gaps Nuxt UI doesn't cover.

**Surface hierarchy** (elevation levels):

| Class         | Source         | Mist value         | Use for                                          |
| ------------- | -------------- | ------------------ | ------------------------------------------------ |
| `bg-base`     | custom utility | mist-950 `#090b0c` | Page background, base layer                      |
| `bg-default`  | Nuxt UI        | mist-900 `#161b1d` | Default component backgrounds                    |
| `bg-surface`  | custom utility | mist-900 `#161b1d` | Inputs, cards, subtle elevation                  |
| `bg-elevated` | Nuxt UI        | mist-800 `#22292b` | Dropdowns, popovers, tooltips, modal content     |
| `bg-overlay`  | custom utility | `black/80%`        | Modal backdrops only (intentionally transparent) |

**Text hierarchy**:

| Class        | Source         | Mist value         | Use for                    |
| ------------ | -------------- | ------------------ | -------------------------- |
| `text-hi`    | custom utility | white              | Headings, primary labels   |
| `text-body`  | custom utility | mist-200 `#e3e7e8` | Body copy, names           |
| `text-muted` | Nuxt UI        | mist-400 `#9ca8ab` | Secondary labels, metadata |
| `text-dim`   | custom utility | mist-500 `#67787c` | Hints, placeholders        |

**Borders**: `border-subtle` (custom, mist-800) for dividers, `border-default` (custom, mist-700 with `!important`) for outlines/rings.

**Rules**:

- Floating/overlapping elements **must** use `bg-elevated` so content underneath doesn't bleed through.
- Don't redefine `bg-elevated`, `text-muted`, or other Nuxt UI semantic classes as custom `@utility` — the names collide and cause specificity issues.
- Teal accent colors (`teal-400/30`, etc.) and `bg-overlay` are the only places transparency is correct. Don't introduce new `white/XX` patterns.
- Nuxt UI component defaults are in `app.config.ts` — update there, not per-component.

## Testing

Tests use Bun's built-in test runner. Test files live alongside source in `__tests__/` subdirectories:

- `web/lib/__tests__/` — packing algorithm tests
- `web/lib/packers/__tests__/` — individual packer unit tests
- `web/lib/utils/__tests__/` — utility tests
- `web/utils/__tests__/` — web utility tests

## Data Model (`web/composables/useIdb.ts`)

All data lives in IndexedDB. The app is still in development — breaking schema changes are acceptable (users can reset their database).

### IdbModel — what's stored vs derived

GLTF models store only `gltfJson` (raw) and `partOverrides` (user edits). Parts, colors, and nodePartMap are **re-derived on every project load** via `deriveFromGltf()` in `useProjects.ts`. This means changes to parse logic take effect immediately — no migration needed for derived data.

Manual models store `parts` directly (source of truth). They have no `gltfJson`.

Both model types use `partOverrides: Record<number, PartOverride>` for user edits (keyed by partNumber). To add a new per-part override, just add an optional field to `PartOverride` — no migration needed.

### Migrations (`web/utils/migrations.ts`)

Currently at a clean slate (`SCHEMA_VERSION = 1`, zero migrations). The infrastructure exists for future use:

- **`SCHEMA_VERSION`** — bump when any record type's fields change.
- **Startup sweep** — on app init, migrates all stored records to current schema.
- **`applyDefaults`** in `useIdb.ts` — safety net on read paths.
- **`migrateExport`** — applies same migrations to imported `.cutlist.gz` files.

### When adding a new field to a record type

1. Update the TypeScript interface in `useIdb.ts`
2. Bump `SCHEMA_VERSION` in `migrations.ts`
3. Add a migration entry with a sensible default
4. Update the matching `applyDefaults` function in `useIdb.ts`
5. Update `createX` to set the field for new records
6. Add a test in `utils/__tests__/migrations.test.ts`

## Key Config Files

- `web/nuxt.config.ts` — Nuxt config (SSR off, modules)
- `web/tailwind.config.ts` — custom color palette
- `web/app.config.ts` — Nuxt UI theme
- `cutlist.config.yaml` — user-facing defaults (stock materials, blade width, optimization modes)
