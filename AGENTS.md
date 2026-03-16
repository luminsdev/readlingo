# AGENTS.md

## Stack Snapshot

- Package manager: `pnpm` (`pnpm-lock.yaml` present)
- Framework: Next.js 15 App Router + React 19 + TypeScript
- Styling: Tailwind CSS v4 + shadcn/ui + `prettier-plugin-tailwindcss`
- Data/auth: Prisma + PostgreSQL + NextAuth credentials flow
- Local environment: PostgreSQL is already installed locally; do not assume Docker is required
- Shell preference: prefer PowerShell-friendly commands when giving examples
- Validation: Zod schemas in `src/lib/*-validation.ts`
- Tests: Node built-in test runner in `scripts/*.test.mjs`

## External Rule Files

- No `.cursor/rules/` directory was found.
- No `.cursorrules` file was found.
- No `.github/copilot-instructions.md` file was found.

## Setup Commands

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:generate
pnpm dev
```

## Local Environment Notes

- Prefer the locally installed PostgreSQL instance referenced by `DATABASE_URL` in `.env`.
- Use `docker compose up -d db` only if the local PostgreSQL server is unavailable or the user explicitly wants the containerized database.
- When writing one-off shell commands for the user, prefer PowerShell-compatible syntax over Bash-only idioms.

## Core Commands

```bash
pnpm dev            # start Next dev server
pnpm build          # production build
pnpm start          # run built app
pnpm lint           # ESLint across repo
pnpm typecheck      # TypeScript strict check
pnpm format         # Prettier write
pnpm format:check   # Prettier check
pnpm phase1:smoke   # end-to-end smoke script against running app
pnpm phase2:test    # node:test regression suite
pnpm db:generate    # prisma client generation
pnpm db:migrate     # prisma migrate dev
pnpm db:studio      # prisma studio
```

## Single-File / Single-Test Commands

```bash
pnpm exec eslint src/lib/utils.ts
pnpm exec prettier --check src/lib/utils.ts
pnpm exec prettier --write src/lib/utils.ts

# There is no dedicated per-file typecheck script; use full project typecheck.
pnpm typecheck

# Run the current Node test file directly.
node --test scripts/phase2_reader_regressions.test.mjs

# Run one test by name pattern.
node --test --test-name-pattern="getReaderNavigationDirection" scripts/phase2_reader_regressions.test.mjs

# Smoke test requires the app running first.
READLINGO_BASE_URL=http://localhost:3000 pnpm phase1:smoke
```

## Git Hooks

- `.husky/pre-commit` runs `pnpm lint-staged`
- Staged `*.{js,jsx,ts,tsx,mjs,cjs}` files get `eslint --fix` then `prettier --write`
- Staged `*.{json,md,css,yml,yaml}` files get `prettier --write`

## Project Layout

- `src/app/` - App Router pages, layouts, and API routes
- `src/components/` - UI components, including shadcn primitives in `src/components/ui/`
- `src/lib/` and `src/types/` - business logic, validation, Prisma helpers, shared types
- `prisma/schema.prisma` - database schema
- `scripts/` - smoke and regression tests; `uploads/` - generated runtime data

## Import Conventions

- Use ES modules everywhere.
- Group imports as: Node/React/Next/third-party, blank line, internal `@/` imports.
- Prefer `@/` alias over long relative paths for `src/*`.
- Use type-only imports when possible: `import type Foo from "..."` or `import { type Foo } from "..."`.
- Prefer named exports for shared helpers, components, schemas, and types.
- Default exports are normal for Next `page.tsx` and `layout.tsx` files.
- Keep import ordering stable; do not hand-sort Tailwind class strings, let Prettier do it.

## Formatting Rules

- Follow Prettier exactly: double quotes, semicolons, trailing commas.
- Run `pnpm format` or `pnpm exec prettier --write <file>` instead of manual formatting.
- Tailwind classes are automatically sorted by the Prettier plugin.
- Use concise comments only when behavior is not obvious from code.

## TypeScript Rules

- `tsconfig.json` is strict; do not weaken types with `any` unless unavoidable.
- Prefer explicit unions such as `string | null` over vague falsy handling.
- Derive request/input types from Zod via `z.infer<typeof schema>`.
- Keep route params typed explicitly; this codebase uses Next 15 async params patterns like `{ params }: { params: Promise<{ bookId: string }> }`.

## Naming Conventions

- Components, Prisma models, and types: `PascalCase`
- Functions, variables, hooks, and schema instances: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Boolean names should read naturally: `isReady`, `hasReaderMetadataChanged`, `canGoNext`
- Validation schemas use the `*Schema` suffix.

## React / Next.js Conventions

- Server Components are the default; add `"use client"` only when hooks, browser APIs, or client-side events are needed.
- Pages and layouts may be `async`; keep server data fetching there when practical.
- Use `redirect()` in server components for auth gating.
- Use `useRouter()` only in client components; API handlers live in `src/app/api/**/route.ts` and return `NextResponse`.

## Validation and Data Access

- Validate external input with Zod before touching Prisma or storage helpers.
- Prefer `safeParse()` for request bodies and credentials.
- Normalize strings during validation with `.trim()` and `.toLowerCase()` transforms when appropriate.
- Centralize Prisma access through `src/lib/prisma.ts` and domain helpers in `src/lib/books.ts`; always scope book access by authenticated user ownership.

## Error Handling

- For expected API failures, return `NextResponse.json({ error: "..." }, { status })`.
- For invalid JSON bodies, use `await request.json().catch(() => null)` before validation.
- Catch unknown errors as `error`, then narrow with `instanceof Error`.
- Prefer user-safe messages; do not leak stacks or raw internals in API responses.
- Handle expected filesystem cases explicitly, e.g. `ENOENT` in file reads/deletes.
- Use `null` / `404` / `401` for expected absence and authorization failures instead of throwing.

## Filesystem and Upload Rules

- EPUB uploads are restricted by helper functions in `src/lib/book-storage.ts`.
- Do not bypass `assertEpubFile()`, `validateEpubArchive()`, or `resolveStoredUploadFilePath()`.
- Treat `uploads/` and `.next/` as generated/runtime data, not source.

## Testing Conventions

- Current tests use `node:test` plus `node:assert/strict`.
- Test names are sentence-style behavior statements.
- Keep smoke scripts deterministic and rely on explicit status/error assertions.

## Agent Workflow

- For targeted edits, run file-scoped lint/format checks first.
- Before finishing substantial TypeScript changes, run `pnpm typecheck`.
- When touching route handlers, auth, Prisma, or build-sensitive code, run `pnpm build`.
- When touching reader or upload helpers, run `node --test scripts/phase2_reader_regressions.test.mjs`.
- Do not commit `.env`, uploaded EPUBs, `.next/`, or local logs.
- Keep `PLANNING.md` and `TASKS.md` available as local planning artifacts for the CLI to read in future sessions.
- Do not add `PLANNING.md` or `TASKS.md` to `.gitignore`; leave them as visible untracked files unless the user explicitly asks to commit them.

## High-Value Reference Files

- `package.json` - canonical scripts
- `eslint.config.mjs` and `.prettierrc.json` - lint and formatting rules
- `tsconfig.json` - strict typing and `@/*` path alias
- `prisma/schema.prisma` - data model
- `src/app/api/books/route.ts` and `src/app/api/books/[bookId]/progress/route.ts` - API patterns
- `src/components/reader/reader-workspace.tsx` - largest client-side stateful component
