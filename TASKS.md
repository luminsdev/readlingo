# ReadLingo Tasks

## Phase 0 - Project Foundation

### Setup

- [x] Scaffold Next.js 15 App Router project with strict TypeScript and `pnpm`
- [x] Configure Tailwind CSS and create a `shadcn/ui`-compatible component baseline
- [x] Add Prettier, Husky, and lint-staged
- [x] Add environment template and local PostgreSQL compose file

### Backend

- [x] Initialize Prisma for PostgreSQL
- [x] Define initial Prisma schema for `User`, `Book`, `ReadingProgress`, `Vocabulary`, and `SRSData`
- [x] Add Prisma singleton helper
- [x] Generate Prisma client and create the first migration

### Frontend

- [x] Replace template landing page with auth-aware routing
- [x] Create `(auth)` and `(main)` route groups
- [x] Create app shell and navigation placeholders for later slices

### Integration

- [x] Add `Auth.js` v5 credentials configuration scaffold
- [x] Wire auth route handler and registration endpoint
- [x] Validate the full auth flow against a running PostgreSQL instance

### Quality Gate

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm db:generate`
- [x] Manual app boot with `.env.example` values and local database running

## Phase 1 - Library Vertical Slice

### Authentication

- [x] Create register page and client form
- [x] Create login page and client form
- [x] Protect `(main)` routes and redirect authenticated users away from auth pages
- [x] Add initial auth success/error states in the client forms
- [x] Refine auth states after live database verification

### Book Management Backend

- [x] Create authenticated `POST /api/books` upload endpoint
- [x] Validate EPUB uploads by type, extension, and size
- [x] Persist uploaded files into per-user storage paths
- [x] Create authenticated `GET /api/books` listing endpoint
- [x] Create authenticated `DELETE /api/books/[bookId]` endpoint
- [x] Enforce per-user ownership checks for book access and deletion

### Book Management Frontend

- [x] Build library upload form
- [x] Build initial library grid with empty state
- [x] Add delete control with optimistic refresh flow
- [x] Add reader route scaffold for upcoming Phase 2 work

### Data and Storage

- [x] Default uploaded books to language `und` until metadata parsing is added
- [x] Keep local disk uploads for the MVP slice and defer object storage until post-MVP hardening
- [x] Add cleanup coverage for partial upload failures once database is running locally

### Quality Gate

- [x] User can register, sign in, upload a valid EPUB, see it in the library, and delete it
- [x] Invalid uploads fail safely with a clear error
- [x] A user cannot list or delete another user's book
- [x] Library layout remains usable on mobile and desktop

## Phase 2 - Reader Vertical Slice

### Reader Backend

- [x] Add book fetch helpers with ownership enforcement for reader routes
- [x] Implement `ReadingProgress` persistence and debounce strategy
- [x] Add save/resume API contract for EPUB CFI locations

### Reader Frontend

- [x] Replace placeholder metadata with parsed EPUB title/author/language
- [x] Integrate `epub.js` for paginated in-browser rendering
- [x] Build reader route layout with future AI side-panel space
- [x] Add previous/next navigation and loading/error states
- [x] Restore saved CFI on reopen and refresh

### Quality Gate

- [x] User can open a book from the library, navigate, refresh, and resume at the same place
- [x] Corrupted EPUB files fail with a clear reader error state

## Phase 3 - AI + Vocabulary Slice

### AI Backend

- [x] Create `src/lib/ai.ts` abstraction with one default provider first
- [x] Add explain endpoint using Vercel AI SDK and the project prompt contract
- [x] Normalize explanation payload shape for the UI

### Vocabulary Backend

- [x] Create vocabulary save endpoint or server action
- [x] Persist selected text, explanation, example sentence, and book context
- [x] Add filterable vocabulary query path by book, language, and date

### Reader Integration

- [x] Capture text selection and surrounding context in reader UI
- [x] Open inline AI explanation panel from selected text
- [x] Add one-click save to vocabulary flow

### Quality Gate

- [x] AI response renders with translation and explanation in Vietnamese
- [x] Saved vocabulary is tied to the correct user and optional book
- [x] Provider failures show user-friendly errors without breaking reader state

## Phase 4 - Flashcards Vertical Slice

### SRS Engine

- [ ] Implement SM-2 scheduling in `src/lib/srs.ts`
- [ ] Decide whether to create `SRSData` eagerly on vocabulary save or lazily on first review
- [ ] Add deterministic unit coverage for Again / Hard / Good / Easy transitions

### Review Experience

- [ ] Query due cards by `nextReviewAt`
- [ ] Build one-card-at-a-time flashcard session UI
- [ ] Add reveal-answer step and rating actions
- [ ] Update `SRSData` and remove reviewed cards from the active queue

### Quality Gate

- [ ] Due cards appear correctly
- [ ] Rating updates are deterministic and reflected immediately in the queue
- [ ] Zero-state and first-time-use states are clear

## Phase 5 - MVP Hardening

### Reliability

- [ ] Audit auth/session expiry behavior
- [ ] Tighten validation and error copy across upload, reader, AI, and review flows
- [ ] Review Prisma indexes and hot-path queries

### Observability

- [ ] Add lightweight logging for upload failures, AI failures, and review submission errors
- [ ] Add a release checklist for env vars, migrations, and smoke tests

### UX Polish

- [ ] Improve empty states and progress messaging across the core loop
- [ ] Smooth rough edges discovered during end-to-end testing

### Quality Gate

- [ ] Fresh account can complete the end-to-end MVP flow without critical errors
- [ ] No core route is missing loading, empty, or error handling
- [ ] Performance is acceptable for normal EPUB sizes
