import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readOptionalWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8").catch(
    () => "",
  );
}

test("library search debounces route-scoped URL-backed query updates", async () => {
  const searchSource = await readOptionalWorkspaceFile(
    "src/components/library/library-search.tsx",
  );

  assert.match(searchSource, /"use client";/);
  assert.match(searchSource, /import \{ Search \} from "lucide-react";/);
  assert.match(searchSource, /useSearchParams\(/);
  assert.match(searchSource, /useRouter\(/);
  assert.match(searchSource, /usePathname\(/);
  assert.match(searchSource, /getFilteredPageHref\(/);
  assert.match(searchSource, /setTimeout\([\s\S]*300/);
  assert.match(searchSource, /q:/);
  assert.match(searchSource, /page: 1/);
  assert.doesNotMatch(searchSource, /collection:/);
  assert.match(searchSource, /text-ink-soft/);
  assert.match(searchSource, /bg-surface/);
});

test("collection pills are server-rendered shelf links, not inline library filters", async () => {
  const pillsSource = await readOptionalWorkspaceFile(
    "src/components/library/collection-pills.tsx",
  );

  assert.match(pillsSource, /type CollectionPillsProps = \{/);
  assert.match(pillsSource, /_count: \{ books: number \};/);
  assert.match(pillsSource, /from "next\/link"/);
  assert.match(pillsSource, /href="\/library"/);
  assert.match(pillsSource, /bg-foreground text-background/);
  assert.match(pillsSource, /\/library\/collections\/\$\{collection\.id\}/);
  assert.match(pillsSource, /overflow-x-auto/);
  assert.match(pillsSource, /scrollbarWidth:\s*"none"/);
  assert.doesNotMatch(pillsSource, /"use client";/);
  assert.doesNotMatch(pillsSource, /getLibraryHref\(/);
  assert.doesNotMatch(pillsSource, /fetch\("\/api\/collections"/);
  assert.doesNotMatch(pillsSource, /useRouter\(/);
  assert.doesNotMatch(pillsSource, /<form/);
  assert.doesNotMatch(pillsSource, /Create collection/);
});

test("shelf row, card, and create dialog split server rendering from client mutation", async () => {
  const [rowSource, cardSource, dialogSource] = await Promise.all([
    readOptionalWorkspaceFile(
      "src/components/library/collection-shelves-row.tsx",
    ),
    readOptionalWorkspaceFile("src/components/library/collection-card.tsx"),
    readOptionalWorkspaceFile(
      "src/components/library/create-collection-dialog.tsx",
    ),
  ]);

  assert.match(rowSource, /CollectionShelvesRow/);
  assert.match(
    rowSource,
    /import \{ CollectionCard \} from "@\/components\/library\/collection-card";/,
  );
  assert.match(
    rowSource,
    /import \{ CreateCollectionDialog \} from "@\/components\/library\/create-collection-dialog";/,
  );
  assert.match(rowSource, /collections\.map/);
  assert.match(rowSource, /Your Shelves/);
  assert.match(rowSource, /overflow-x-auto/);
  assert.match(rowSource, /scrollbarWidth:\s*"none"/);
  assert.match(rowSource, /<CreateCollectionDialog/);
  assert.doesNotMatch(rowSource, /"use client";/);

  assert.match(cardSource, /CollectionCard/);
  assert.match(cardSource, /from "next\/link"/);
  assert.match(cardSource, /_count: \{ books: number \};/);
  assert.match(cardSource, /coverBook/);
  assert.match(cardSource, /coverUrl/);
  assert.match(cardSource, /coverBlurDataUrl/);
  assert.match(cardSource, /STACK_LAYER_STYLES/);
  assert.match(cardSource, /stackedCovers/);
  assert.match(cardSource, /FallbackCover/);
  assert.match(cardSource, /paper-shadow/);
  assert.match(cardSource, /\/api\/covers\//);
  assert.match(cardSource, /\/library\/collections\/\$\{collection\.id\}/);
  assert.doesNotMatch(cardSource, /"use client";/);

  assert.match(dialogSource, /"use client";/);
  assert.match(dialogSource, /Dialog/);
  assert.match(dialogSource, /DialogContent/);
  assert.match(dialogSource, /DialogTitle/);
  assert.match(dialogSource, /DialogTrigger/);
  assert.match(dialogSource, /fetch\("\/api\/collections"/);
  assert.match(dialogSource, /method: "POST"/);
  assert.match(dialogSource, /response\.status === 409/);
  assert.match(dialogSource, /name\.trim\(\)/);
  assert.match(dialogSource, /maxLength=\{100\}/);
  assert.match(dialogSource, /setOpen\(false\)/);
  assert.match(dialogSource, /router\.refresh\(\)/);
});

test("collection header keeps client-only shelf management actions", async () => {
  const headerSource = await readOptionalWorkspaceFile(
    "src/components/library/collection-header.tsx",
  );

  assert.match(headerSource, /"use client";/);
  assert.match(headerSource, /AlertDialog/);
  assert.match(headerSource, /method: "PATCH"/);
  assert.match(headerSource, /method: "DELETE"/);
  assert.match(headerSource, /saveName/);
  assert.match(headerSource, /coverBookId: null/);
  assert.match(headerSource, /STACK_LAYER_STYLES/);
});

test("book card actions provide library membership controls and shelf-detail cover controls", async () => {
  const [bookCardSource, actionsSource] = await Promise.all([
    readOptionalWorkspaceFile("src/components/library/book-card.tsx"),
    readOptionalWorkspaceFile("src/components/library/book-card-actions.tsx"),
  ]);

  assert.match(
    bookCardSource,
    /collections\?: Array<\{ id: string; displayName: string; hasBook: boolean \}>;/,
  );
  assert.match(
    bookCardSource,
    /collectionContext\?: \{ collectionId: string \};/,
  );
  assert.match(
    bookCardSource,
    /import \{ BookCardActions \} from "@\/components\/library\/book-card-actions";/,
  );
  assert.match(bookCardSource, /<BookCardActions/);
  assert.match(bookCardSource, /collectionContext=\{collectionContext\}/);

  assert.match(actionsSource, /"use client";/);
  assert.match(actionsSource, /DeleteBookButton/);
  assert.match(actionsSource, /DropdownMenuCheckboxItem/);
  assert.match(actionsSource, /DropdownMenuItem/);
  assert.match(actionsSource, /DropdownMenuLabel/);
  assert.match(actionsSource, /DropdownMenuSeparator/);
  assert.match(actionsSource, /No collections yet/);
  assert.match(actionsSource, /FolderPlus|Bookmark/);
  assert.match(
    actionsSource,
    /collectionContext\?: \{ collectionId: string \};/,
  );
  assert.match(actionsSource, /method: isChecked \? "DELETE" : "POST"/);
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collection\.id\}\/books`/,
  );
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collection\.id\}\/books\/\$\{bookId\}`/,
  );
  assert.match(
    actionsSource,
    /Set as Shelf Cover|set as shelf cover|setAsCover/i,
  );
  assert.match(
    actionsSource,
    /Remove from Shelf|remove from shelf|removeFromShelf/i,
  );
  assert.match(actionsSource, /method: "PATCH"/);
  assert.match(actionsSource, /method: "DELETE"/);
  assert.match(actionsSource, /coverBookId/);
  assert.match(actionsSource, /collectionId/);
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collectionContext\.collectionId\}`/,
  );
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collectionContext\.collectionId\}\/books\/\$\{bookId\}`/,
  );
  assert.match(actionsSource, /router\.refresh\(\)/);
  assert.match(actionsSource, /bg-surface/);
  assert.match(actionsSource, /border-line/);
});

test("library page wires search, shelves, memberships, and all-books pagination without collection filters", async () => {
  const pageSource = await readOptionalWorkspaceFile(
    "src/app/(main)/library/page.tsx",
  );

  assert.match(
    pageSource,
    /import \{ CollectionShelvesRow \} from "@\/components\/library\/collection-shelves-row";/,
  );
  assert.match(
    pageSource,
    /import \{ LibrarySearch \} from "@\/components\/library\/library-search";/,
  );
  assert.match(
    pageSource,
    /import \{ getUserCollections \} from "@\/lib\/collections";/,
  );
  assert.match(
    pageSource,
    /const \[books, totalCount, allCollections\] = await Promise\.all\(\[/,
  );
  assert.match(
    pageSource,
    /searchParams:\s*Promise<\{\s*page\?: string;\s*q\?: string;?\s*\}>;/s,
  );
  assert.match(pageSource, /getUserCollections\(session\.user\.id\)/);
  assert.match(
    pageSource,
    /collections:\s*\{\s*select:\s*\{\s*collectionId: true/s,
  );
  assert.match(pageSource, /<LibrarySearch/);
  assert.match(pageSource, /<CollectionShelvesRow/);
  assert.match(
    pageSource,
    /<CollectionPills collections=\{allCollections\} \/>/,
  );
  assert.match(pageSource, /hasBook: book\.collections\.some/);
});

test("collection detail page wires scoped search, header actions, and shelf-only pagination", async () => {
  const pageSource = await readOptionalWorkspaceFile(
    "src/app/(main)/library/collections/[id]/page.tsx",
  );

  assert.match(pageSource, /from "next\/navigation";/);
  assert.match(
    pageSource,
    /import \{ CollectionHeader \} from "@\/components\/library\/collection-header";/,
  );
  assert.match(
    pageSource,
    /import \{ LibrarySearch \} from "@\/components\/library\/library-search";/,
  );
  assert.match(pageSource, /getCollectionDetail/);
  assert.match(pageSource, /getCollectionBooks/);
  assert.match(pageSource, /getUserCollections/);
  assert.match(pageSource, /notFound\(\)/);
  assert.match(pageSource, /<CollectionHeader/);
  assert.match(pageSource, /<LibrarySearch/);
  assert.match(pageSource, /<LibraryPagination/);
  assert.match(pageSource, /<BookCard/);
  assert.match(pageSource, /collectionContext=\{\{ collectionId: id \}\}/);
  assert.match(pageSource, /collections=\{allCollections\.map/);
  assert.match(pageSource, /hasBook: book\.collections\.some/);
  assert.match(pageSource, /\/library\/collections\/\$\{id\}/);
});
