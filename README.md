# cutlist

Browser-only SPA for generating optimized wood cutting plans. Import GLTF assemblies or enter parts manually, assign stock materials, and generate board layouts with PDF export.

## Development

To install dependencies:

```bash
bun install
```

To start the website in dev mode:

```sh
bun dev
```

## Build

Build the production server bundle:

```sh
bun run build
```

Build a static site (for static hosting like GitHub Pages):

```sh
bun run build:static
```

Static output is written to `web/.output/public`.

## GitHub Pages

This app can be deployed to GitHub Pages as a static SPA.

- Use `bun run build:static` (Nuxt generate) to produce `web/.output/public`.
- For a project pages site (`https://<user>.github.io/<repo>/`), set `NUXT_APP_BASE_URL=/<repo>/` at build time.
- For a user/organization pages site (`https://<user>.github.io/`), use `NUXT_APP_BASE_URL=/`.

## CI

Basic CI is configured in `.github/workflows/ci.yml` and runs:

- `bun run lint`
- `bun run check`
- `bun run test`

GitHub Pages deployment is configured in `.github/workflows/pages-deploy.yml` and runs when:

- A release is published
- The workflow is dispatched manually
