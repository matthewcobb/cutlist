---
name: changelog
description: Generate a changelog between two git refs (tags, commits, branches). Use when the user asks to create, generate, or update a changelog.
argument-hint: '[from-ref] [to-ref]'
arguments: [from, to]
user-invocable: true
allowed-tools: Bash Read Write Edit Grep Glob
---

# Changelog Generator

Generate a well-organized changelog between two git refs.

## Resolve refs

**from**: `$from` (required — tag, branch, or commit)
**to**: `$to` (defaults to `HEAD` if empty)

If **from** is empty or the user didn't provide refs, list available tags to help them pick:

```
git tag -l --sort=-creatordate --format='%(refname:short)  %(creatordate:short)  %(subject)'
```

## Gather data

Run these in parallel:

1. **Commit log** between the two refs (oldest first):

   ```
   git log <from>..<to> --format='%ai %H %s' --reverse
   ```

2. **Tag date** of the starting ref:

   ```
   git show <from> --format='%ai %s' --no-patch
   ```

3. **Check the `changelog/` directory** at the repo root via Glob for existing version files (e.g. `changelog/v0.1.0.md`).

4. **Check for merged PRs** (if `gh` is available):
   ```
   gh pr list --state merged --search "merged:>=$(date of from-ref)" --limit 50 --json number,title,body,mergedAt
   ```
   If `gh` fails, proceed without PR data — commit messages are sufficient.

## Classify commits

Go through each commit and classify it. Skip merge commits and trivial chores (`.gitignore` updates, version bumps) unless they're the only changes.

Categories (use only those that have entries):

| Section              | What belongs here                                         |
| -------------------- | --------------------------------------------------------- |
| **Features**         | New user-facing functionality                             |
| **Performance**      | Speed, memory, resource usage improvements                |
| **Bug Fixes**        | Corrections to existing behavior                          |
| **Reliability**      | Error handling, data integrity, monitoring, observability |
| **Code Quality**     | Refactors, type improvements, test coverage               |
| **Accessibility**    | ARIA, keyboard nav, screen reader improvements            |
| **Infrastructure**   | CI/CD, build, deploy, env config changes                  |
| **Breaking Changes** | Anything that changes public API or requires migration    |

Guidelines:

- One bullet per logical change, not per commit. Group related commits into a single entry.
- Start each bullet with a **bold short label** followed by a dash and description.
- Reference PR numbers (`#N`) where applicable.
- Keep descriptions concise — one line per entry, two max for complex changes.
- Don't list file names or implementation details. Describe _what changed for the user or developer_.

## Write the changelog

Write a new file at `changelog/<version>.md` in the repo root, where `<version>` is the `<to>` ref (e.g. `changelog/v0.2.0.md`). If `<to>` is `HEAD` or a branch, use `changelog/unreleased.md`.

If the file already exists, overwrite it only after confirming with the user. Match the formatting conventions of any sibling files in `changelog/`.

### Format

```markdown
# <to-ref or "Unreleased"> — <YYYY-MM-DD>

_Since [<from-ref>] (<from-date>)._

## Features

- **Short label** — description (#PR)

## Performance

- **Short label** — description

...additional sections as needed...
```

Each version file is self-contained — no top-level `# Changelog` heading, since the directory itself is the index.

## Output

After writing, report:

- Number of commits covered
- Which sections were populated
- Any commits that were ambiguous or skipped
