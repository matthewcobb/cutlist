# @matthewcobb/cutlist

Website and NPM tool for generating cutlists for an Onshape assembly.

![Screenshot](./.github/assets/screenshot.png)

> [!WARNING]
> NPM package is not published yet. Might not publish it.

## Usage

1. Open the embedded Cutlist app from an Onshape assembly.
2. Sign in with Onshape OAuth (first launch only).
3. Assign materials in Onshape and review generated board layouts.
4. Optionally switch to selected-parts mode from the sidebar.

## Development

To install dependencies:

```bash
bun install
```

To start the website in dev mode, copy `.env.example` and fill out values from your Onshape OAuth app in the developer portal, then run:

```sh
bun dev
```

For local embedded testing, set `NUXT_OAUTH_BASE_URL` to your HTTPS tunnel URL and add that callback URL to your Onshape OAuth app settings (`{BASE_URL}/api/auth/callback`).

To publish docker image:

```bash
bun publish:web:docker
```

## Deploy Website

Bump the version. commit change, and tag:

```sh
vi web/package.json
git commit -am "chore(release): web-v1.0.7"
git tag web-v1.0.7
git push
git push --tags
# Run: https://github.com/matthewcobb/cutlist/actions/workflows/release-web.yml
```
