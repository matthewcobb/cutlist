---
name: write-tests
description: Write or update Cutlist frontend tests with Vitest, TypeScript, Nuxt test utilities, fake IndexedDB, and project-specific conventions. Use when adding regression tests, increasing coverage, fixing flaky tests, or creating tests for helpers, packers, composables, workers, routes, or Vue components in this app.
---

# Write Tests

Write or update tests for the target file in the Cutlist app. Read the source before writing tests, then choose the narrowest test shape that proves the behavior.

## Step 1 - Identify The Module Type

- **Pure helper / utility** - deterministic TypeScript with no browser API or IndexedDB, usually in `web/utils/`, `web/lib/utils/`, or `web/lib/geometry/`.
- **Packing engine / packer** - board layout, rectangle, stock, scoring, or packer code in `web/lib/`.
- **Parser / import / export / migration** - GLTF, COLLADA, stock YAML, PDF export, project import, schema defaults, or version migration code.
- **IDB-backed module** - code using `useIdb`, Dexie records, project/model/build-step persistence, or write batching.
- **Composable** - Vue reactive state or behavior in `web/composables/`; this app does not use Vuex or Pinia.
- **Worker / browser API module** - `Worker`, file APIs, URL APIs, Sentry, Nuxt UI toast, or other globals.
- **Nuxt route / middleware / page / component** - `.vue`, `web/pages/`, `web/middleware/`, or code that needs Nuxt auto-imports/plugins.

## Step 2 - Read Context Files

Before writing tests, read:

1. The source file being tested.
2. The existing test file, if present.
3. Imported collaborators that need mocks or real setup.
4. `web/test-setup.ts` and `web/vitest.config.ts` if the test needs IndexedDB, Nuxt, globals, or unusual environment behavior.

## Project Test Basics

- Tests are TypeScript files named `*.test.ts` under a sibling `__tests__/` directory. Examples: `web/utils/foo.ts` -> `web/utils/__tests__/foo.test.ts`; `web/lib/packers/FooPacker.ts` -> `web/lib/packers/__tests__/FooPacker.test.ts`.
- Vitest globals are disabled. Always import what you use from `vitest`: `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`.
- The default environment is `happy-dom`. Add `// @vitest-environment nuxt` at the top only when a test needs Nuxt runtime behavior, Nuxt auto-imports, plugins, or `mountSuspended`.
- `web/test-setup.ts` installs `fake-indexeddb` and resets the Cutlist DB before every test. Do not depend on test order or records created by another test.
- Import Vue primitives explicitly (`ref`, `nextTick`, `effectScope`, etc.) even if the app source relies on Nuxt auto-imports.
- Prefer existing aliases: `~` for `web/` and `cutlist` for `web/lib`.

## General Rules

- Test public behavior: return values, thrown errors, emitted events, DOM output, persisted records, worker messages, and calls to mocked boundaries.
- Do not test private helpers that are not exported, implementation order that users cannot observe, Nuxt UI internals, or Dexie internals.
- For new or substantially rewritten suites, name tests with `Should ...`. For small updates to an existing suite, preserve local naming unless rewriting the block.
- Group by exported function, public method, lifecycle behavior, or rendered section. Put input validation/error cases before success cases; put integration and edge cases after basic behavior.
- Keep setup close to the tests. Use `beforeEach` only when several tests genuinely share setup.
- Use small typed factory helpers such as `makePart`, `makeProject`, `makeStock`, or `makeConfig` instead of large fixtures.
- Prefer exact assertions: `toBe`, `toEqual`, `toMatchObject`, `toBeCloseTo`, `resolves`, and `rejects`. Avoid broad `toContain` text checks and snapshots unless the structure is intentionally stable.
- Use `vi.restoreAllMocks()` in `afterEach` when using `vi.spyOn`. Use `mockClear()` for reusable `vi.fn()` mocks. Do not add mock cleanup that is not needed.

## Pure Helper / Utility Tests

Pattern:

```ts
import { describe, expect, it } from 'vitest';
import { myHelper } from '../myHelper';

describe('myHelper', () => {
  describe('#methodName', () => {
    it('Should throw when the required value is missing', () => {
      expect(() => myHelper(null)).toThrow('required value');
    });

    it('Should return the expected result for the base case', () => {
      expect(myHelper({ value: 1 })).toEqual({ result: 1 });
    });
  });
});
```

Rules:

- One `describe('#name')` per exported function or class method when the module has multiple exports.
- Cover invalid inputs first, then representative successes, then edge cases.
- Do not mock HTTP, IndexedDB, Vue, or Nuxt for pure modules.

## Packing Engine / Packer Tests

Use real geometry and real packer inputs. Focus on invariants that matter to wood-cutting behavior:

- Empty inputs return empty placements and leftovers.
- Oversize parts become leftovers.
- Placements stay inside the board, account for margin/kerf, and do not overlap.
- Rotation, grain lock, orientation, grouping, and scoring rules are observable in the result.
- Similar inputs produce deterministic output where the algorithm promises determinism.

Pattern:

```ts
import { describe, expect, it } from 'vitest';
import { Rectangle } from '../../geometry';
import { createStripPacker } from '../StripPacker';

describe('StripPacker', () => {
  it('Should return oversize rectangles as leftovers', () => {
    const packer = createStripPacker<string>();
    const bin = new Rectangle(null, 0, 0, 5, 5);
    const result = packer.pack(bin, [new Rectangle('too-wide', 0, 0, 6, 3)], {
      allowRotations: false,
      gap: 0,
      precision: 0,
    });

    expect(result.placements).toEqual([]);
    expect(result.leftovers).toEqual(['too-wide']);
  });
});
```

Rules:

- Use `toBeCloseTo` for floating-point geometry or unit conversion.
- Assert behavior, not a full layout array, unless the exact layout is the contract.
- Include no-overlap and inside-board checks for new packers or layout algorithms.

## Parser / Import / Export / Migration Tests

Cover both accepted and rejected data:

- Valid minimal input.
- Invalid or malformed input with a useful thrown error.
- Missing optional fields and defaults.
- Current-version no-op behavior and future-version rejection.
- Preservation of user data and unknown fields where the import path promises it.

Rules:

- Keep fixtures as small inline strings/objects unless a real format fixture is required.
- For schema changes, test both IDB defaults and project export migrations.
- When adding a stored field, add or update tests for `applyDefaults`, export-file migration, and new-record creation.

## IDB-Backed Module Tests

Use the real `useIdb()` API with fake IndexedDB. Every test starts with an empty DB via global setup.

Pattern:

```ts
import { describe, expect, it } from 'vitest';
import { useIdb } from '../useIdb';

const idb = useIdb();

describe('project CRUD', () => {
  it('Should create a project with defaults', async () => {
    const project = await idb.createProject('Test Project');

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.colorMap).toEqual({});
  });
});
```

Rules:

- Prefer real IDB records over faking persistence.
- After model write batching, call `await idb.flushPendingModelWrites()` before reading back persisted data.
- Test cascade behavior and read-path defaults by reading through public APIs such as `getProjectWithModels`.
- Do not manually delete IndexedDB unless the test is specifically about reset behavior.

## Composable Tests

For composables with injected dependencies, pass real refs and small mocks. For reactive watchers, use `effectScope()` and stop it in `afterEach`.

Pattern:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { useMyComposable } from '../useMyComposable';

describe('useMyComposable', () => {
  let scope: EffectScope;

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.restoreAllMocks();
  });

  it('Should react when the source ref changes', async () => {
    const source = ref('a');
    const result = scope.run(() => useMyComposable(source))!;

    source.value = 'b';
    await nextTick();

    expect(result.value.value).toBe('b');
  });
});
```

Rules:

- Use `nextTick()` for Vue reactive updates. Use `flushPromises()` only when promises are the thing being flushed.
- Use fake timers only for debounce, intervals, or timeouts; always restore real timers.
- Reset module-level caches with exported test helpers such as `__resetForTests()` when present.

## Worker / Browser API Tests

When a module touches globals at import time, set globals and mocks before importing the module. Use dynamic `await import(...)` after setup.

Pattern:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWorker {
  posts: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage(message: unknown) {
    this.posts.push(message);
  }
  terminate() {}
}

(globalThis as any).Worker = FakeWorker;

vi.mock('../useAppErrors', () => ({
  reportError: vi.fn(),
}));

const { computeLayouts, __resetForTests } =
  await import('../useComputationWorker');

beforeEach(() => {
  __resetForTests();
});
```

Rules:

- Drive fake browser APIs manually and assert captured messages/calls.
- Keep fake classes minimal and typed enough to make test intent clear.
- Use `vi.hoisted` when a `vi.mock` factory needs shared mock state initialized before imports.

## Nuxt / Vue Component Tests

Component tests are still a clean slate in this repo. Prefer user-visible behavior and accessible selectors over implementation details.

Pattern for components that need Nuxt runtime:

```ts
// @vitest-environment nuxt
import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import MyComponent from '../MyComponent.vue';

describe('MyComponent', () => {
  async function getComponent(
    props: Partial<InstanceType<typeof MyComponent>['$props']> = {},
  ) {
    return mountSuspended(MyComponent, {
      props: {
        requiredProp: 'default',
        ...props,
      },
    });
  }

  describe('Rendering', () => {
    it('Should render the primary action', async () => {
      const component = await getComponent();
      expect(component.find('[aria-label="Add part"]').exists()).toBe(true);
    });
  });
});
```

Rules:

- Use `mountSuspended` for Nuxt pages/components that rely on auto-imports, routing, Nuxt UI, plugins, or async setup.
- Use `shallowMount` from `@vue/test-utils` for plain Vue components that do not need Nuxt runtime.
- Put default required props first, then spread overrides.
- Prefer selectors in this order: accessible text/labels when stable, `data-testid` when available, then component names for intentionally stubbed child components.
- Do not assert Nuxt UI internals. Assert the props you pass, emitted events, visible text, disabled/loading states, and calls to public callbacks.
- Suggested block order: `Initialization`, `Props`, `Watchers`, public methods/actions, `Rendering`, then nested `On <event>` blocks for interactions.

## Verification

After writing or updating tests:

1. Run the targeted test file from `web/`:

   ```bash
   cd web && vitest run path/to/__tests__/file.test.ts
   ```

2. If types, Vue components, or mocks changed, run:

   ```bash
   bun run check
   ```

3. If files were created or formatting changed, run:

   ```bash
   bun run lint
   ```

Fix failures before considering the test work complete. If a command cannot be run, say why and list the remaining risk.
