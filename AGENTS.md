# AGENTS.md

## Purpose

- Guidance for agentic coding tools working in `C:\Dev\Project\readlingo`
- Prefer `pnpm` and PowerShell-friendly commands; match existing repo patterns before adding abstractions or refactors

## External Rule Files

- No `.cursor/rules/` directory was found
- No `.cursorrules` file was found
- No `.github/copilot-instructions.md` file was found
- `AGENTS.md` is the canonical agent instruction file in this repo

## Stack Snapshot

- Next.js 15 App Router + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + `prettier-plugin-tailwindcss`
- Prisma + PostgreSQL in local dev
- NextAuth v5 beta with credentials plus Google provider wiring
- Vercel AI SDK, `epubjs`, and Zod-based validation in `src/lib/*-validation.ts`
- Tests use Node's built-in runner in `scripts/*.test.mjs`

## Setup And Core Commands

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:migrate
pnpm db:generate
pnpm dev

pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm format
pnpm format:check
pnpm phase1:smoke
pnpm phase2:test
pnpm phase4:test
pnpm db:studio
```

## Single-File And Single-Test Commands

```powershell
# Lint or format one file
pnpm exec eslint src/lib/utils.ts
pnpm exec prettier --check src/lib/utils.ts
pnpm exec prettier --write src/lib/utils.ts

# There is no per-file typecheck command
pnpm typecheck

# Run one regression file directly
node --test scripts/phase2_reader_regressions.test.mjs
node --test scripts/phase3_ai_regressions.test.mjs
node --test scripts/phase4_srs_regressions.test.mjs

# Run one test by name
node --test --test-name-pattern="getReaderNavigationDirection" scripts/phase2_reader_regressions.test.mjs
node --test --test-name-pattern="buildExplainPrompt follows the learner-assistant template from planning" scripts/phase3_ai_regressions.test.mjs
node --test --test-name-pattern="computeSRSUpdate applies the Good transition from defaults" scripts/phase4_srs_regressions.test.mjs

# Smoke test against a running local app
$env:READLINGO_BASE_URL = "http://localhost:3000"
pnpm phase1:smoke
```

## Project Layout

- `src/app/` - App Router pages, layouts, route groups, and API handlers
- `src/app/api/**/route.ts` - JSON endpoints and auth handlers
- `src/components/` and `src/components/ui/` - feature UI and primitives
- `src/lib/` - domain helpers, validation, Prisma access, reader logic, AI helpers
- `prisma/schema.prisma`, `scripts/`, and `uploads/` are the schema, regression tests, and generated EPUB storage
- `PLANNING.md` and `TASKS.md` exist at the repo root; keep them visible and consistent if your work affects planning state

## Imports And Modules

- Use ES modules everywhere
- Group imports as: Node/React/Next/third-party, blank line, internal `@/` imports
- Prefer `@/` aliases for `src/*` over long relative paths
- Use `import type` for type-only imports when possible
- Prefer named exports for shared helpers and reusable modules; keep default exports for Next `page.tsx` and `layout.tsx`
- Tests may import `.ts` files directly; `tsconfig.json` uses `moduleResolution: "bundler"` and strict mode

## Formatting And Styling Rules

- Follow Prettier exactly: double quotes, semicolons, trailing commas
- Let `prettier-plugin-tailwindcss` sort Tailwind classes; do not hand-sort them
- Run Prettier instead of manual formatting for touched files
- Keep comments sparse; ignore generated/runtime paths such as `.next/`, `out/`, `build/`, `uploads/`, and `next-env.d.ts`

## TypeScript Rules

- `strict` is enabled; do not weaken types casually
- Avoid `any` unless unavoidable and tightly scoped
- Derive request and form payload types from Zod via `z.infer<typeof schema>`
- Use `satisfies` to preserve inference for config objects and Prisma selects
- Narrow unknown errors with `instanceof Error`; keep shared helper return shapes explicit

## Naming Conventions

- Components, Prisma models, and shared types use `PascalCase`
- Functions, variables, hooks, and schema values use `camelCase`
- Constants use `UPPER_SNAKE_CASE`
- Boolean names should read naturally: `isReady`, `hasSelection`, `canGoNext`
- Validation schemas use the `*Schema` suffix; tests should use sentence-style behavior names

## Next.js And React Conventions

- Prefer Server Components; add `"use client"` only for hooks, browser APIs, refs, or event handlers
- Keep server-side data fetching in pages/layouts when practical; use `redirect()` there for auth gating
- Use `useRouter()` only in client components
- API handlers should return `NextResponse`
- Type route params explicitly; this repo uses patterns like `{ params }: { params: Promise<{ bookId: string }> }`
- Preserve the current route-group split between `(auth)` and `(main)`

## Validation, Data Access, And Auth

- Validate external input with Zod before touching Prisma or storage helpers; prefer `safeParse()`
- For JSON requests, use `await request.json().catch(() => null)` before validation
- Normalize strings with `.trim()` and `.toLowerCase()` where appropriate
- Centralize Prisma access through `src/lib/prisma.ts` and focused helpers like `src/lib/books.ts`
- Scope every book read/write by authenticated user ownership; auth checks usually follow `const session = await auth()` and return `401` JSON when absent
- Do not bypass `assertEpubFile()`, `validateEpubArchive()`, or `resolveStoredUploadFilePath()`

## Error Handling Guidelines

- For expected API failures, return `NextResponse.json({ error: "..." }, { status })`
- Use `400`, `401`, `404`, and `500` appropriately for validation, auth, missing-resource, and unexpected failures
- Prefer returning `null` for expected absence in helpers instead of throwing
- Keep messages user-safe; do not leak stacks, SQL errors, or internal paths
- Handle expected filesystem cases explicitly, including `ENOENT`, and clean up partial side effects on failure

## Testing Guidelines

- Current tests use `node:test` with `node:assert/strict`
- Regression tests import TypeScript source directly from `src/`
- Keep smoke scripts deterministic with explicit assertions on status and error messages
- If you change reader flows or upload logic, run `node --test scripts/phase2_reader_regressions.test.mjs`
- If you change AI response shaping or prompt contracts, run `node --test scripts/phase3_ai_regressions.test.mjs`
- If you change flashcard or SRS logic, run `node --test scripts/phase4_srs_regressions.test.mjs`
- Before finishing substantial TypeScript work, run `pnpm typecheck`; when touching routes, auth, Prisma, or other build-sensitive code, run `pnpm build`

## Agent Workflow Expectations

- Prefer the local PostgreSQL instance referenced by `DATABASE_URL`; do not assume Docker is required
- Treat `uploads/` and `.next/` as generated runtime data
- Beads is available via `bd` for persistent multi-step task tracking when work spans multiple sessions or agents; keep the repo in stealth mode and do not commit `.beads/` state
- Run file-scoped lint and format checks first for targeted edits when practical
- Prefer incremental changes over broad refactors unless the task explicitly asks for cleanup
- Follow existing validation, auth, and API patterns before inventing new abstractions; do not commit `.env`, uploaded EPUBs, `.next/`, or local logs

## High-Value Reference Files

- `package.json` - canonical scripts and `lint-staged` config
- `eslint.config.mjs` and `tsconfig.json` - lint, strict typing, and `@/*` alias behavior
- `prisma/schema.prisma` - source of truth for models and indexes
- `src/auth.ts` - current NextAuth configuration pattern
- `src/app/api/books/route.ts` and `src/app/api/books/[bookId]/progress/route.ts` - route validation and error-handling patterns
- `src/lib/books.ts` - owned-resource Prisma helper pattern

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **readlingo** (841 symbols, 1764 relationships, 66 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/readlingo/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool             | When to use                   | Command                                                                 |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `query`          | Find code by concept          | `gitnexus_query({query: "auth validation"})`                            |
| `context`        | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})`                              |
| `impact`         | Blast radius before editing   | `gitnexus_impact({target: "X", direction: "upstream"})`                 |
| `detect_changes` | Pre-commit scope check        | `gitnexus_detect_changes({scope: "staged"})`                            |
| `rename`         | Safe multi-file rename        | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher`         | Custom graph queries          | `gitnexus_cypher({query: "MATCH ..."})`                                 |

## Impact Risk Levels

| Depth | Meaning                               | Action                |
| ----- | ------------------------------------- | --------------------- |
| d=1   | WILL BREAK — direct callers/importers | MUST update these     |
| d=2   | LIKELY AFFECTED — indirect deps       | Should test           |
| d=3   | MAY NEED TESTING — transitive         | Test if critical path |

## Resources

| Resource                                   | Use for                                  |
| ------------------------------------------ | ---------------------------------------- |
| `gitnexus://repo/readlingo/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/readlingo/clusters`       | All functional areas                     |
| `gitnexus://repo/readlingo/processes`      | All execution flows                      |
| `gitnexus://repo/readlingo/process/{name}` | Step-by-step execution trace             |

## Self-Check Before Finishing

Before completing any code modification task, verify:

1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
