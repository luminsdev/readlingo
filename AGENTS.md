# AGENTS.md

## Purpose

- Guidance for agentic coding tools working in `C:\Dev\Project\readlingo`
- Prefer `pnpm` and PowerShell-friendly command examples
- Match existing repo patterns before adding new abstractions or refactors

## External Rule Files

- No `.cursor/rules/` directory was found
- No `.cursorrules` file was found
- No `.github/copilot-instructions.md` file was found

## Stack Snapshot

- Next.js 15 App Router + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + `prettier-plugin-tailwindcss`
- Prisma + PostgreSQL in local dev
- NextAuth v5 beta with credentials today; roadmap includes Google OAuth
- Vercel AI SDK with Google and OpenAI-compatible providers
- EPUB rendering/parsing through `epubjs`
- Validation with Zod in `src/lib/*-validation.ts`
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

# There is no per-file typecheck command.
pnpm typecheck

# Run one regression file directly
node --test scripts/phase2_reader_regressions.test.mjs
node --test scripts/phase3_ai_regressions.test.mjs
node --test scripts/phase4_srs_regressions.test.mjs

# Run one test by name
node --test --test-name-pattern="getReaderNavigationDirection" scripts/phase2_reader_regressions.test.mjs
node --test --test-name-pattern="computeSRSUpdate applies the Good transition from defaults" scripts/phase4_srs_regressions.test.mjs

# Smoke test against a running local app
$env:READLINGO_BASE_URL = "http://localhost:3000"
pnpm phase1:smoke
```

## Project Layout

- `src/app/` - App Router pages, layouts, route groups, and API handlers
- `src/app/api/**/route.ts` - JSON endpoints and auth handlers
- `src/components/` - feature UI plus `src/components/ui/` primitives
- `src/lib/` - domain helpers, validation, Prisma access, reader logic, AI helpers
- `src/types/` - shared app and library typings
- `prisma/schema.prisma` - source of truth for data models and indexes
- `scripts/` - smoke and regression tests
- `uploads/` - runtime EPUB storage; generated data, not source

## Imports And Modules

- Use ES modules everywhere
- Group imports as: Node/React/Next/third-party, blank line, internal `@/` imports
- Prefer `@/` aliases for `src/*` instead of long relative paths
- Use `import type` for type-only imports when possible
- Prefer named exports for shared helpers, schemas, and reusable components
- Keep default exports for Next `page.tsx` and `layout.tsx` files
- `tsconfig.json` uses `moduleResolution: "bundler"` and allows importing `.ts` extensions in test files

## Formatting And Styling Rules

- Follow Prettier exactly: double quotes, semicolons, trailing commas
- Let `prettier-plugin-tailwindcss` sort Tailwind classes; do not hand-sort them
- Run Prettier instead of manual formatting for touched files
- Keep comments sparse; add them only when behavior is not obvious
- ESLint extends `next/core-web-vitals` and `next/typescript`

## TypeScript Rules

- `strict` is enabled; do not weaken types casually
- Avoid `any` unless unavoidable and tightly scoped
- Prefer explicit unions like `string | null` over vague optionality
- Derive request and form payload types from Zod via `z.infer<typeof schema>`
- Use `satisfies` to preserve inference for config objects and Prisma selects
- Narrow unknown errors with `instanceof Error` before reading `.message`
- Keep helper return shapes explicit when used across routes and components

## Naming Conventions

- Components, Prisma models, and shared types use `PascalCase`
- Functions, variables, hooks, and schema values use `camelCase`
- Constants use `UPPER_SNAKE_CASE`
- Boolean names should read naturally: `isReady`, `hasSelection`, `canGoNext`
- Validation schemas use the `*Schema` suffix
- Test names should be sentence-style behavior descriptions

## Next.js And React Conventions

- Prefer Server Components; add `"use client"` only for hooks, browser APIs, refs, or event handlers
- Pages and layouts may be `async`; keep server-side data fetching there when practical
- Use `redirect()` in server components for auth gating
- Use `useRouter()` only in client components
- API handlers should return `NextResponse`
- Type route params explicitly; this repo uses patterns like `{ params }: { params: Promise<{ bookId: string }> }`
- Preserve the current route-group split between `(auth)` and `(main)`

## Validation, Data Access, And Auth

- Validate external input with Zod before touching Prisma or storage helpers
- Prefer `safeParse()` for JSON bodies, credentials, query params, and route params
- For JSON requests, use `await request.json().catch(() => null)` before validation
- Normalize strings with `.trim()` and `.toLowerCase()` where appropriate
- Centralize Prisma access through `src/lib/prisma.ts` and focused helpers like `src/lib/books.ts`
- Scope every book read/write by authenticated user ownership
- Auth checks usually follow `const session = await auth()` and return `401` JSON when absent
- Do not bypass `assertEpubFile()`, `validateEpubArchive()`, or `resolveStoredUploadFilePath()`

## Error Handling Guidelines

- For expected API failures, return `NextResponse.json({ error: "..." }, { status })`
- Use `400`, `401`, and `404` for expected validation, auth, and not-found failures
- Prefer returning `null` for expected absence in helpers instead of throwing
- Keep messages user-safe; do not leak stacks, SQL errors, or internal paths
- Handle expected filesystem cases explicitly, including `ENOENT`
- Clean up partial side effects on failure, as the upload route already does

## Testing Guidelines

- Current tests use `node:test` with `node:assert/strict`
- Regression tests import TypeScript source directly from `src/`
- Keep smoke scripts deterministic with explicit assertions on status and error messages
- If you change reader flows or upload logic, run `node --test scripts/phase2_reader_regressions.test.mjs`
- If you change AI response shaping or prompt contracts, run `node --test scripts/phase3_ai_regressions.test.mjs`
- If you change flashcard or SRS logic, run `node --test scripts/phase4_srs_regressions.test.mjs`
- Before finishing substantial TypeScript work, run `pnpm typecheck`
- When touching routes, auth, Prisma, or other build-sensitive code, run `pnpm build`

## Agent Workflow Expectations

- Prefer the local PostgreSQL instance referenced by `DATABASE_URL`; do not assume Docker is required
- Treat `uploads/` and `.next/` as generated runtime data
- Run file-scoped lint and format checks first for targeted edits when practical
- Prefer incremental changes over broad refactors unless the task explicitly asks for cleanup
- Follow existing validation, auth, and API patterns before inventing new abstractions
- Do not commit `.env`, uploaded EPUBs, `.next/`, or local logs
- Keep `PLANNING.md` and `TASKS.md` visible and consistent if they already exist

## High-Value Reference Files

- `package.json` - canonical scripts and `lint-staged` config
- `eslint.config.mjs` - lint rules and ignore behavior
- `tsconfig.json` - strict typing and `@/*` path alias
- `prisma/schema.prisma` - source of truth for models and indexes
- `src/auth.ts` - current NextAuth configuration pattern
- `src/app/api/books/route.ts` - upload route and cleanup/error handling pattern
- `src/app/api/books/[bookId]/progress/route.ts` - request validation pattern
- `src/lib/books.ts` - owned-resource Prisma helper pattern
