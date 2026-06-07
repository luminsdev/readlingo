import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readOptionalWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8").catch(
    () => "",
  );
}

test("library search debounces URL-backed query updates", async () => {
  const searchSource = await readOptionalWorkspaceFile(
    "src/components/library/library-search.tsx",
  );

  assert.match(searchSource, /"use client";/);
  assert.match(searchSource, /import \{ Search \} from "lucide-react";/);
  assert.match(searchSource, /useSearchParams\(/);
  assert.match(searchSource, /useRouter\(/);
  assert.match(searchSource, /setTimeout\([\s\S]*300/);
  assert.match(searchSource, /getLibraryHref\(/);
  assert.match(searchSource, /q:/);
  assert.match(searchSource, /page: 1/);
  assert.match(searchSource, /text-ink-soft/);
  assert.match(searchSource, /bg-surface/);
});

test("collection pills filter, create collections, and preserve URL state", async () => {
  const pillsSource = await readOptionalWorkspaceFile(
    "src/components/library/collection-pills.tsx",
  );

  assert.match(pillsSource, /"use client";/);
  assert.match(pillsSource, /type CollectionPillsProps = \{/);
  assert.match(pillsSource, /activeCollectionId: string \| undefined;/);
  assert.match(pillsSource, /_count: \{ books: number \};/);
  assert.match(pillsSource, /getLibraryHref\(/);
  assert.match(pillsSource, /collection:/);
  assert.match(pillsSource, /page: 1/);
  assert.match(pillsSource, /fetch\("\/api\/collections"/);
  assert.match(pillsSource, /method: "POST"/);
  assert.match(pillsSource, /response\.status === 409/);
  assert.match(pillsSource, /router\.refresh\(\)/);
  assert.match(pillsSource, /overflow-x-auto/);
  assert.match(pillsSource, /scrollbarWidth:\s*"none"/);
});

test("book card actions provide delete and collection membership controls", async () => {
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
    /import \{ BookCardActions \} from "@\/components\/library\/book-card-actions";/,
  );
  assert.match(bookCardSource, /<BookCardActions/);

  assert.match(actionsSource, /"use client";/);
  assert.match(actionsSource, /DeleteBookButton/);
  assert.match(actionsSource, /DropdownMenuCheckboxItem/);
  assert.match(actionsSource, /DropdownMenuLabel/);
  assert.match(actionsSource, /No collections yet/);
  assert.match(actionsSource, /FolderPlus|Bookmark/);
  assert.match(actionsSource, /method: isChecked \? "DELETE" : "POST"/);
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collection\.id\}\/books`/,
  );
  assert.match(
    actionsSource,
    /`\/api\/collections\/\$\{collection\.id\}\/books\/\$\{bookId\}`/,
  );
  assert.match(actionsSource, /router\.refresh\(\)/);
  assert.match(actionsSource, /bg-surface/);
  assert.match(actionsSource, /border-line/);
});

test("library page wires search, collections, memberships, and filtered pagination", async () => {
  const pageSource = await readOptionalWorkspaceFile(
    "src/app/(main)/library/page.tsx",
  );

  assert.match(
    pageSource,
    /import \{ CollectionPills \} from "@\/components\/library\/collection-pills";/,
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
    /import \{ getLibraryHref \} from "@\/lib\/library-url";/,
  );
  assert.match(
    pageSource,
    /const \[books, totalCount, allCollections\] = await Promise\.all\(\[/,
  );
  assert.match(pageSource, /getUserCollections\(session\.user\.id\)/);
  assert.match(
    pageSource,
    /collections:\s*\{\s*select:\s*\{\s*collectionId: true/s,
  );
  assert.match(pageSource, /<LibrarySearch/);
  assert.match(pageSource, /<CollectionPills/);
  assert.match(pageSource, /activeCollectionId=\{collectionId\}/);
  assert.match(
    pageSource,
    /collections=\{allCollections\.map\(\(collection\) => \(\{/,
  );
  assert.match(pageSource, /hasBook: book\.collections\.some/);
  assert.match(
    pageSource,
    /filters=\{\{ q: trimmedQuery, collection: collectionId \}\}/,
  );
  assert.match(pageSource, /getLibraryHref\(filters, \{ page/);
});
