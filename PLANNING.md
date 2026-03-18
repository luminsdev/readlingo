# ReadLingo — Project Planning

## Overview

ReadLingo is an AI-powered EPUB reader designed to break language barriers.
Users can read foreign-language books directly in the browser, get AI-powered
contextual explanations for words and sentences, save vocabulary with example
sentences, and reinforce learning through spaced repetition flashcards.

**Core problem it solves:** Reading foreign-language books is constantly
interrupted by the need to switch apps/tabs to look up words. ReadLingo keeps
the entire reading + learning loop in one place.

---

## Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Language         | TypeScript (strict mode)                        |
| Framework        | Next.js 15 (App Router)                         |
| Styling          | Tailwind CSS + shadcn/ui                        |
| ORM              | Prisma                                          |
| Database         | PostgreSQL (local dev) / Supabase (production)  |
| AI               | Vercel AI SDK — GitHub Models / Gemini / Qwen3  |
| EPUB Parsing     | epub.js                                         |
| Auth             | NextAuth.js v5 (Auth.js)                        |
| Package Manager  | pnpm                                            |
| Linting          | ESLint + Prettier                               |
| Git Hooks        | Husky + lint-staged                             |
| Deploy           | Local-first MVP; production deploy after storage abstraction |

---

## Project Structure

```
readlingo/
├── src/
│   ├── auth.ts                 ← NextAuth configuration + helpers
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (main)/
│   │   │   ├── library/          ← Danh sách sách của user
│   │   │   ├── reader/[bookId]/  ← Trang đọc sách (Phase 2 scaffold)
│   │   │   ├── vocabulary/       ← Quản lý từ vựng đã lưu
│   │   │   │   └── flashcards/   ← Ôn tập spaced repetition
│   │   │   └── layout.tsx
│   │   └── api/
│   │       ├── auth/             ← NextAuth handlers
│   │       │   ├── [...nextauth]/
│   │       │   └── register/
│   │       └── books/            ← Upload, list, delete books
│   │           └── [bookId]/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/                 ← Login/register/sign-out controls
│   │   ├── library/              ← Upload form + library controls
│   │   └── ui/                   ← shadcn/ui components
│   ├── lib/
│   │   ├── auth-validation.ts    ← Zod schemas for auth payloads
│   │   ├── book-storage.ts       ← EPUB storage helpers
│   │   ├── prisma.ts             ← Prisma client singleton
│   │   └── utils.ts              ← Shared utility helpers
│   └── types/
│       ├── epubjs.d.ts           ← EPUB.js typings
│       ├── index.ts              ← Shared TypeScript types
│       └── next-auth.d.ts        ← NextAuth session typing
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── public/
├── .env.example
├── PLANNING.md                   ← This file
└── TASKS.md                      ← Current sprint tasks
```

---

## Database Schema (Prisma)

```prisma
model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String?
  passwordHash  String
  createdAt     DateTime     @default(now())
  books         Book[]
  vocabularies  Vocabulary[]
}

model Book {
  id          String   @id @default(cuid())
  title       String
  author      String?
  coverUrl    String?
  filePath    String           ← stored in /uploads or object storage
  language    String           ← e.g. "en", "ja", "fr"
  createdAt   DateTime @default(now())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  readingProgress ReadingProgress?
  vocabularies    Vocabulary[]
}

model ReadingProgress {
  id          String   @id @default(cuid())
  bookId      String   @unique
  book        Book     @relation(fields: [bookId], references: [id])
  cfi         String           ← EPUB CFI location string
  updatedAt   DateTime @updatedAt
}

model Vocabulary {
  id             String    @id @default(cuid())
  word           String
  definition     String
  exampleSentence String
  contextSentence String    ← sentence from the book where word was found
  sourceLanguage  String
  targetLanguage  String
  createdAt      DateTime  @default(now())
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  bookId         String?
  book           Book?     @relation(fields: [bookId], references: [id])
  srsData        SRSData?
}

model SRSData {
  id             String     @id @default(cuid())
  vocabularyId   String     @unique
  vocabulary     Vocabulary @relation(fields: [vocabularyId], references: [id])
  interval       Int        @default(1)   ← days until next review
  easeFactor     Float      @default(2.5) ← SM-2 ease factor
  repetitions    Int        @default(0)
  nextReviewAt   DateTime   @default(now())
  lastReviewedAt DateTime?
}
```

---

## Features (MVP Scope)

### 1. Authentication
- Email/password register + login via NextAuth.js v5
- JWT-backed Auth.js credentials sessions, each user has an isolated library

### 2. Library
- Upload EPUB files
- Store uploads on local disk per user for the MVP slice
- Display book list with title-first placeholder metadata until reader enrichment lands
- Delete books

### 3. EPUB Reader
- Render EPUB inline in browser using epub.js
- Paginated reading (not scroll)
- Replace placeholder book metadata with parsed EPUB title/author/language
- Save reading progress (CFI string) automatically
- Highlight word or sentence → trigger AI panel

### 4. AI Explanation Panel
- Appears inline when user highlights text (no tab switching)
- Sends: selected text + surrounding paragraph as context
- AI returns:
  - Translation to Vietnamese
  - Part of speech + pronunciation (if single word)
  - Explanation in plain language
  - 1–2 example sentences
- Provider: Vercel AI SDK, switchable between GitHub Models / Gemini / Qwen3

### 5. Vocabulary Manager
- Save word/phrase from AI panel with one click
- Stores: word, definition, example sentence, source sentence from book
- View all saved vocabulary in a filterable list
- Tag by book, language, date

### 6. Flashcard — Spaced Repetition
- Algorithm: SM-2 (simple, well-documented, battle-tested)
- Daily review queue based on nextReviewAt
- Card shows: word → user recalls → reveals definition + example
- User rates recall: Again / Hard / Good / Easy
- SRS data updates accordingly

---

## Out of Scope (v1)

- Social features (sharing vocabulary, public profiles)
- Audio pronunciation
- Mobile app
- PDF support
- Import from Kindle / other formats
- Collaborative reading

---

## AI Prompt Design (core)

```
System: You are a language learning assistant. 
Given a selected text and its surrounding context from a book, 
provide a helpful explanation for a language learner.
Respond in Vietnamese. Be concise.

User: 
Book language: {sourceLanguage}
Selected text: "{selectedText}"
Context: "{surroundingParagraph}"

Provide:
1. Translation
2. (If single word) Part of speech
3. Plain explanation
4. 1 natural example sentence
```

---

## Implementation Order

```
Phase 0 — Foundation
  ✦ Project setup (Next.js, TS, Prisma, shadcn)
  ✦ Auth (NextAuth v5, register/login)
  ✦ Database schema + migrations

Phase 1 — Library Vertical Slice
  ✦ Live auth verification against PostgreSQL
  ✦ Book upload + local disk storage
  ✦ Library page + delete flow
  ✦ Reader route scaffold

Phase 2 — Core Reader
  ✦ EPUB rendering with epub.js
  ✦ Metadata parsing/enrichment
  ✦ Reading progress save/resume

Phase 3 — AI + Vocabulary Slice
  ✦ Vercel AI SDK setup (multi-provider)
  ✦ Text highlight → AI panel
  ✦ Explanation endpoint
  ✦ Save from AI panel
  ✦ Vocabulary list page
  ✦ Filter/search

Phase 4 — Flashcards
  ✦ SM-2 algorithm (lib/srs.ts)
  ✦ Daily review queue
  ✦ Flashcard UI + rating

Phase 5 — MVP Hardening
  ✦ Reliability and validation pass
  ✦ Observability and release checks
  ✦ UX polish across the MVP loop
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/readlingo"

# Auth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Uploads
UPLOAD_DIR="./uploads"

# AI Providers (use whichever is active)
AI_PROVIDER="google"
GITHUB_TOKEN="your-github-pat"           # GitHub Models
GOOGLE_GENERATIVE_AI_API_KEY="..."       # Gemini
# Qwen via OpenAI-compatible endpoint
QWEN_API_KEY="..."
QWEN_BASE_URL="https://..."
```
