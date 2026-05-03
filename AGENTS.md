# AGENTS.md

## Purpose

- This is the always-on operating manual for coding agents working in `C:\Dev\Project\readlingo`.
- Keep guidance project-specific, durable, and actionable. If a detail is better inferred from code, `package.json`, or README-style documentation, do not duplicate it here.
- Prefer `pnpm` and PowerShell-friendly commands; match existing repo patterns before adding abstractions or refactors.

## Operating Philosophy

- Think Before Coding: If requirements are materially ambiguous or constraints conflict, state the ambiguity and ask one short clarifying question. For routine implementation choices, proceed with the smallest safe change.
- Simplicity First: Implement the minimum code that solves the task. Do not add speculative abstractions, configurability, fallback behavior, or compatibility layers without a concrete need.
- Surgical Changes: Touch only files and lines required by the request. Do not refactor adjacent code, rewrite unrelated comments, or remove pre-existing dead code unless asked.
- Goal-Driven Execution: For non-trivial work, identify verification steps up front, implement until the goal is met, and report what passed or could not be run.
- Tradeoff: Bias toward caution over speed for substantial work, but use judgment for trivial fixes.

## Stack Snapshot

- Next.js 15 App Router + React 19 + strict TypeScript
- Tailwind CSS v4 + shadcn/ui + `prettier-plugin-tailwindcss`
- Prisma + PostgreSQL in local development
- NextAuth v5 beta with credentials and Google provider wiring
- Vercel AI SDK, `epubjs`, and Zod-based validation in `src/lib/*-validation.ts`
- Tests use Node's built-in runner in `scripts/*.test.mjs`

## Common Commands

```powershell
# Setup and local development
Copy-Item .env.example .env
pnpm install
pnpm db:migrate
pnpm db:generate
pnpm dev

# Core checks
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check

# Targeted lint or format
pnpm exec eslint src/lib/utils.ts
pnpm exec prettier --check src/lib/utils.ts
pnpm exec prettier --write src/lib/utils.ts
```

## Verification Matrix

- Markdown-only edits: run `pnpm exec prettier --check AGENTS.md` or the specific Markdown file touched.
- Targeted TypeScript edits: run file-scoped `eslint` and `prettier --check` first when practical.
- Substantial TypeScript or shared-helper changes: run `pnpm typecheck`.
- Route, auth, Prisma, config, or build-sensitive changes: run `pnpm build` after typecheck-relevant checks.
- Reader or upload changes: run `node --test scripts/phase2_reader_regressions.test.mjs`.
- AI prompt, model, or response-shaping changes: run `node --test scripts/phase3_ai_regressions.test.mjs`.
- Flashcard or SRS changes: run `node --test scripts/phase4_srs_regressions.test.mjs`.
- Do not run `pnpm typecheck` in parallel with `pnpm build`; `.next/types/**/*.ts` can be regenerated during builds and cause transient TS6053 errors.

## Project Map

- `src/app/` - App Router pages, layouts, route groups, and API handlers
- `src/app/api/**/route.ts` - JSON endpoints and auth handlers
- `src/components/` and `src/components/ui/` - feature UI and primitives
- `src/lib/` - domain helpers, validation, Prisma access, reader logic, AI helpers
- `prisma/schema.prisma` - database schema and indexes
- `scripts/*.test.mjs` - Node regression tests
- `uploads/` and `.next/` - generated runtime data; do not treat as source
- `PLANNING.md` and `TASKS.md` - keep visible and consistent if work changes planning state

## Imports, Formatting, And Naming

- Use ES modules everywhere.
- Group imports as Node/React/Next/third-party, blank line, then internal `@/` imports.
- Prefer `@/` aliases for `src/*` over long relative paths.
- Use `import type` for type-only imports when possible.
- Prefer named exports for shared helpers and reusable modules; keep default exports for Next `page.tsx` and `layout.tsx`.
- Follow Prettier exactly: double quotes, semicolons, trailing commas, and Tailwind class sorting by `prettier-plugin-tailwindcss`.
- Components, Prisma models, and shared types use `PascalCase`; functions, variables, hooks, and schema values use `camelCase`; constants use `UPPER_SNAKE_CASE`.
- Boolean names should read naturally, such as `isReady`, `hasSelection`, and `canGoNext`.
- Validation schemas use the `*Schema` suffix; tests should use sentence-style behavior names.

## TypeScript And React

- `strict` is enabled; do not weaken types casually.
- Avoid `any` unless unavoidable and tightly scoped.
- Derive request and form payload types from Zod via `z.infer<typeof schema>`.
- Use `satisfies` to preserve inference for config objects and Prisma selects.
- Narrow unknown errors with `instanceof Error`; keep shared helper return shapes explicit.
- Prefer Server Components; add `"use client"` only for hooks, browser APIs, refs, or event handlers.
- Keep server-side data fetching in pages/layouts when practical; use `redirect()` there for auth gating.
- Use `useRouter()` only in client components.
- Type route params explicitly; this repo uses patterns like `{ params }: { params: Promise<{ bookId: string }> }`.
- Preserve the current route-group split between `(auth)` and `(main)`.

## Validation, Data Access, And Auth

- Validate external input with Zod before touching Prisma or storage helpers; prefer `safeParse()`.
- For JSON requests, use `await request.json().catch(() => null)` before validation.
- Normalize strings with `.trim()` and `.toLowerCase()` where appropriate.
- Centralize Prisma access through `src/lib/prisma.ts` and focused helpers like `src/lib/books.ts`.
- Scope every book read/write by authenticated user ownership; auth checks usually follow `const session = await auth()` and return `401` JSON when absent.
- Do not bypass `assertEpubFile()`, `validateEpubArchive()`, or `resolveStoredUploadFilePath()`.

## Error Handling

- API handlers should return `NextResponse` JSON.
- For expected API failures, return `NextResponse.json({ error: "..." }, { status })`.
- Use `400`, `401`, `404`, and `500` appropriately for validation, auth, missing-resource, and unexpected failures.
- Prefer returning `null` for expected absence in helpers instead of throwing.
- Keep messages user-safe; do not leak stacks, SQL errors, or internal paths.
- Handle expected filesystem cases explicitly, including `ENOENT`, and clean up partial side effects on failure.

## Testing Conventions

- Current tests use `node:test` with `node:assert/strict`.
- Regression tests import TypeScript source directly from `src/`; `tsconfig.json` uses `moduleResolution: "bundler"`.
- Keep smoke scripts deterministic with explicit assertions on status and error messages.
- There is no per-file typecheck command; use `pnpm typecheck` for type verification.
- Smoke test against a running local app with `$env:READLINGO_BASE_URL = "http://localhost:3000"` and `pnpm phase1:smoke`.

## Agent Workflow

- Inspect existing patterns before inventing new helpers or modules.
- Prefer incremental changes over broad refactors unless the task explicitly asks for cleanup.
- Run Prettier instead of manual formatting for touched files.
- Keep comments sparse; add them only when the code is not self-explanatory.
- Prefer the local PostgreSQL instance referenced by `DATABASE_URL`; do not assume Docker is required.
- Beads is available via `bd` for persistent multi-step task tracking when work spans multiple sessions or agents; keep the repo in stealth mode and do not commit `.beads/` state.
- Do not commit `.env`, uploaded EPUBs, `.next/`, local logs, or other generated/runtime artifacts.

## High-Value Reference Files

- `package.json` - canonical scripts and `lint-staged` config
- `eslint.config.mjs` and `tsconfig.json` - lint, strict typing, and `@/*` alias behavior
- `prisma/schema.prisma` - source of truth for models and indexes
- `src/auth.ts` - current NextAuth configuration pattern
- `src/app/api/books/route.ts` and `src/app/api/books/[bookId]/progress/route.ts` - route validation and error-handling patterns
- `src/lib/books.ts` - owned-resource Prisma helper pattern

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **readlingo**. Use GitNexus for code understanding, blast-radius analysis, and safer refactors.

If any GitNexus tool reports a stale index, run `pnpm gitnexus:analyze` before relying on graph results. This repo pins `gitnexus@1.6.4-rc.41` because stable `1.6.3` currently crashes during analyze on this Windows setup, while the upstream RC includes native dependency fixes.

## Required Workflow

- At the start of code work, check GitNexus freshness with `gitnexus_list_repos` or `pnpm gitnexus:status`.
- Before editing any function, class, method, or shared code symbol, run `gitnexus_impact({ target: "symbolName", direction: "upstream" })` and report the blast radius.
- If impact analysis returns HIGH or CRITICAL risk, warn the user before editing.
- When exploring unfamiliar code, use `gitnexus_query({ query: "concept" })` to find execution flows before falling back to text search.
- When you need callers, callees, and process participation for a symbol, use `gitnexus_context({ name: "symbolName" })`.
- Before committing, run `gitnexus_detect_changes()` to verify affected symbols and execution flows.

## Safety Rules

- Do not edit code symbols without prior impact analysis. Documentation-only changes do not require symbol impact analysis.
- Do not ignore HIGH or CRITICAL risk warnings.
- Do not rename symbols with find-and-replace; use `gitnexus_rename`.
- Do not commit changes without checking affected scope with GitNexus.

<!-- gitnexus:end -->
