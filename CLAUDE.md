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
  → GLTF models: use derivedCache if DERIVE_VERSION matches,
                 otherwise deriveFromGltf(gltfJson) and cache result
  → Manual models: reads stored Part[] directly
  → Both: applies partOverrides (user edits like grainLock)
  → user assigns colorMap (material per color)
  → useBoardLayoutsQuery resolves Part → PartToCut (adds material)
  → fingerprint(parts + stock + config) — match against IDB layoutCache
  → on cache hit: skip worker; on miss: generateBoardLayouts in worker
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
- `useUrlSync` — bidirectional sync between app state (activeId, tab) and URL route
- `useExportProject` / `useImportProject` — `.cutlist.json` file I/O

### Routing (`web/pages/`)

File-based routing with dynamic segments:

- `/` — landing page (`index.vue`), shown when no project is active
- `/:projectId` — project view (`[projectId]/[[tab]].vue`), default tab is BOM
- `/:projectId/:tab` — project view on a specific tab
- `/about`, `/terms` — static pages

`useUrlSync` (called once in `app.vue`) keeps the URL and app state in sync bidirectionally. Existing code (`setActive`, `tab.value =`) doesn't need to know about routing — the watcher handles navigation automatically.

### UI (`web/components/`)

Project sidebar and tabbed main area. Tabs: Model (3D viewer), Stock, BOM, Instructions, Warnings, Settings.

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

GLTF models store `gltfJson` (raw), `partOverrides` (user edits), and a `derivedCache` field holding the last `deriveFromGltf` output plus the `DERIVE_VERSION` it was produced at. On load, the cache is reused if its version matches the current `DERIVE_VERSION`; otherwise derive runs in the worker and refills the cache.

**Bump `DERIVE_VERSION`** (exported from [web/utils/parseGltf.ts](web/utils/parseGltf.ts)) whenever `deriveFromGltf`'s output shape or values change — otherwise stale caches will be served.

Manual models store `parts` directly (source of truth). They have no `gltfJson` or `derivedCache`.

Both model types use `partOverrides: Record<number, PartOverride>` for user edits (keyed by partNumber). To add a new per-part override, just add an optional field to `PartOverride` — no migration needed.

### Layout cache

Board layouts are cached per-project in the `layoutCache` IDB store, keyed by `projectId`. Each entry stores a versioned fingerprint over `{parts, stock, config}` (FNV-1a hash via [web/utils/fingerprint.ts](web/utils/fingerprint.ts)) plus a `cacheVersion` field matching `LAYOUT_CACHE_VERSION`. On read, entries with a mismatched `cacheVersion` are treated as cache misses. Exact fingerprint match skips the worker entirely; mismatch triggers a recompute (with the stale result shown SWR-style during compute).

### Versioning policy (three independent version numbers)

| Version constant       | File                                             | Bump when                                                       |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `SCHEMA_VERSION`       | [web/utils/versions.ts](web/utils/versions.ts)   | Any IDB record type's fields change                             |
| `LAYOUT_CACHE_VERSION` | [web/utils/versions.ts](web/utils/versions.ts)   | Packing algorithm output, scoring, or ConfigInput shape changes |
| `DERIVE_VERSION`       | [web/utils/parseGltf.ts](web/utils/parseGltf.ts) | `deriveFromGltf` output shape or semantics change               |

`FutureSchemaError` also lives in `versions.ts` — it's the shared error raised when the stored DB or imported export file was written by a newer Cutlist than the one running.

### Migrations

**IDB schema** is owned by the `CutlistDB` class in [web/composables/useIdb/db.ts](web/composables/useIdb/db.ts), which uses [Dexie](https://dexie.org). Each schema version is declared with a chained `this.version(N).stores({...}).upgrade(tx => ...)` call. Dexie opens the DB and runs any pending `.upgrade()` callbacks atomically; a mid-upgrade failure rolls the whole transaction back.

**Export-file compatibility** is a separate concern, handled by [web/utils/migrations.ts](web/utils/migrations.ts). A `.cutlist.gz` emitted at schema v(N-1) still needs its record shapes brought up to vN when imported by a newer client — Dexie can't help with that since the file isn't in IDB yet. That module keeps:

- **`migrations[]`** — pure, append-only entries applied to raw export records. Mirrors any Dexie `.upgrade()` record transformation.
- **`migrateExport()`** — runs the above over an imported payload.

**Read-path safety net**: `applyDefaults` helpers in [web/composables/useIdb/defaults.ts](web/composables/useIdb/defaults.ts) fill missing fields on every record read, so partial records from older writes still hydrate cleanly.

### When adding a new field to a record type

1. Update the TypeScript interface in `useIdb/types.ts`.
2. Add a new Dexie version block in `db.ts`:
   ```ts
   this.version(N)
     .stores({
       /* only stores whose indexes changed */
     })
     .upgrade(async (tx) => {
       await tx
         .table('projects')
         .toCollection()
         .modify((p) => {
           p.newField = defaultValue;
         });
     });
   ```
3. Bump `SCHEMA_VERSION` in `versions.ts` and add the matching pure-function entry to `migrations[]` in `migrations.ts` for the export path.
4. Update the relevant `applyDefaults` helper.
5. Update `createX` to set the field for new records.
6. Add a test in `utils/__tests__/migrations.test.ts`.

### IDB error handling

- **QuotaExceededError**: all writes go through `safeWrite()` which catches quota errors and sets `useIdbErrors().error` so the UI can show a toast.
- **Multi-tab**: a `BroadcastChannel('cutlist-idb')` notifies other tabs of data changes. Last-write-wins semantics.
- **Import validation**: all `.cutlist.gz` imports are validated against strict Zod schemas in `projectImport.ts` before touching IDB.

## Key Config Files

- `web/nuxt.config.ts` — Nuxt config (SSR off, modules)
- `web/tailwind.config.ts` — custom color palette
- `web/app.config.ts` — Nuxt UI theme
- `cutlist.config.yaml` — user-facing defaults (stock materials, blade width, optimization modes)
