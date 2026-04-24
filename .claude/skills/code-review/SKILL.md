---
name: code-review
description: >
  Run a multi-agent code review on recent changes. Dispatches parallel
  sub-agents to investigate composables, components, utils/config, and
  tests — then consolidates findings into a prioritized report. Use
  when user says "review", "code review", "audit code", or "/code-review".
disable-model-invocation: true
argument-hint: "[scope — e.g. 'last 5 commits', 'composables only', 'PR #12']"
---

# Code Review Skill

You are the lead reviewer. Your job is to identify the **scope** of changes,
dispatch focused sub-agents in parallel, then synthesise their findings into
a single prioritized report.

## 1. Determine scope

If `$ARGUMENTS` specifies a scope (e.g. "last 5 commits", "PR #12",
"composables only"), use that. Otherwise, default to all changes since
the last merge commit or the last 10 commits, whichever is smaller:

```bash
git log --oneline -10
git diff --stat HEAD~10
```

## 2. Dispatch sub-agents

Launch **up to four** sub-agents in parallel using `subagent_type: Explore`
with `"very thorough"` exploration. Each agent should read every file it's
assigned and report specific file paths, line numbers, and code snippets.

Split the changed files into these review buckets (skip any bucket with
zero changed files):

### Agent A — Composables & state management

Files matching `web/composables/**`. Check for:

- Reactive state leaks (watchers/intervals not cleaned up)
- Race conditions in async operations
- Dead code or unused imports left after refactors
- Inconsistent error handling patterns
- Vue reactivity pitfalls (lost reactivity, unnecessary toValue/unref)
- Memory leaks (event listeners, subscriptions)

### Agent B — Components & templates

Files matching `web/components/**`. Check for:

- Unnecessary re-renders / missing or index-only `:key` props
- Event handler closures recreated every render
- Accessibility gaps (ARIA, keyboard navigation on interactive elements)
- Template logic that should be in computed properties
- Hardcoded style values that should use the design system
- Unused props, emits, or scoped styles

### Agent C — Utils, config & infrastructure

Files matching `web/utils/**`, `web/workers/**`, config files
(`nuxt.config.ts`, `app.config.ts`, `tailwind.config.ts`, `*.yaml`),
and any root-level changes. Check for:

- Security issues (XSS, injection, sensitive data in source)
- Error handling gaps (silent catches, missing context)
- Migration edge cases
- Import/export validation bypasses
- Config issues (env vars, wrong defaults)

### Agent D — Tests

Files matching `**/__tests__/**`. Cross-reference against the source
files they test. Check for:

- Missing test cases for important code paths
- Weak assertions that pass with broken code
- Flaky patterns (shared state, timing, order-dependence)
- Mock setup issues that could cause false positives
- Test isolation problems

## 3. Sub-agent prompt template

Each sub-agent prompt MUST include:

1. The list of specific files to review (absolute paths).
2. The checklist from the relevant bucket above.
3. The instruction: _"Report specific file paths, line numbers, and code
   snippets for each issue. Classify severity as HIGH / MEDIUM / LOW."_

## 4. Synthesise the report

Once all agents return, consolidate into a single report for the user:

### Format

```
## Code Review Summary

### High Priority
**1. Short title (file:line)**
Explanation — what's wrong, why it matters, suggested fix.

### Medium Priority
...

### Low Priority
...

### Good Patterns Found
- Brief callouts for well-implemented patterns worth preserving.
```

### Rules

- Deduplicate: if two agents flag the same issue, merge them.
- Verify claims: if a sub-agent says a type doesn't exist or code is dead,
  double-check before including it. False positives erode trust.
- Be concrete: every finding must have a file path and line reference.
- Skip nitpicks: formatting, naming preferences, and style issues caught
  by linters are not worth reporting.
- Offer to fix: end with _"Want me to start fixing any of these?"_
