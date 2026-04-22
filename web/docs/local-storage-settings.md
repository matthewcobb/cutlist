# LocalStorage Settings Conventions

Use localStorage for browser-only preferences. Do not use it for shared project data.

## Scope

- Use global keys for cross-project user preferences (for example, UI theme).
- Use project-scoped keys for layout/preferences that should differ by project (for example, BOM preview width).

## Key naming

- Use: `@cutlist/<domain>/<scope>/<setting>/v<version>`.
- Global example: `@cutlist/ui/global/theme/v1`.
- Project example: `@cutlist/ui/project/<projectId>/bom-preview-width/v1`.
- Define keys in one place: [`localStorage.ts`](/Users/matthewcobb/Code/cutlist/web/utils/localStorage.ts).

## Read/write rules

- Guard with `import.meta.client`.
- Wrap reads/writes in `try/catch`.
- Validate and clamp values after reading.
- Fall back safely to defaults on missing/invalid values.

## Versioning

- Bump the `vN` suffix when changing semantics or value format.
- Prefer writing new keys over mutating old-key meaning.
