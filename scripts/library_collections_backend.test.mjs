import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readOptionalWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8").catch(
    () => "",
  );
}

test("Prisma schema defines shelves with custom cover relation and membership timestamps", async () => {
  const schemaSource = await readOptionalWorkspaceFile("prisma/schema.prisma");

  assert.match(schemaSource, /collections\s+Collection\[\]/);
  assert.match(schemaSource, /collections\s+BookCollection\[\]/);
  assert.match(
    schemaSource,
    /coverForCollections\s+Collection\[\]\s+@relation\("collectionCover"\)/,
  );
  assert.match(schemaSource, /model Collection \{/);
  assert.match(schemaSource, /displayName\s+String/);
  assert.match(schemaSource, /normalizedName\s+String/);
  assert.match(schemaSource, /coverBookId\s+String\?/);
  assert.match(
    schemaSource,
    /coverBook\s+Book\?\s+@relation\("collectionCover", fields: \[coverBookId\], references: \[id\], onDelete: SetNull\)/,
  );
  assert.match(
    schemaSource,
    /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(schemaSource, /@@unique\(\[userId, normalizedName\]\)/);
  assert.match(schemaSource, /@@index\(\[userId, order\]\)/);
  assert.match(schemaSource, /model BookCollection \{/);
  assert.match(schemaSource, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(schemaSource, /@@id\(\[bookId, collectionId\]\)/);
  assert.match(schemaSource, /@@index\(\[collectionId, order\]\)/);
  assert.match(schemaSource, /@@index\(\[collectionId, createdAt\]\)/);
});

test("collection validation schemas support name and cover updates while rejecting empty updates", async () => {
  const validationSource = await readOptionalWorkspaceFile(
    "src/lib/collection-validation.ts",
  );

  assert.match(validationSource, /import \{ z \} from "zod";/);
  assert.match(
    validationSource,
    /export const collectionNameSchema = z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\);/,
  );
  assert.match(
    validationSource,
    /export const createCollectionSchema = z\s*\.object/,
  );
  assert.match(
    validationSource,
    /export const updateCollectionSchema = z\s*\.object/,
  );
  assert.match(validationSource, /name:\s*collectionNameSchema\.optional\(\)/);
  assert.match(
    validationSource,
    /coverBookId:[\s\S]*?\.nullable\(\)[\s\S]*?\.optional\(\)/,
  );
  assert.match(validationSource, /\.refine\(/);
  assert.match(
    validationSource,
    /export const addBookToCollectionSchema = z\.object\(\{\s*bookId: z\.string\(\)\.min\(1\),\s*\}\);/s,
  );
});

test("collection helpers centralize ownership, detail queries, cover membership, and duplicate handling", async () => {
  const helpersSource = await readOptionalWorkspaceFile(
    "src/lib/collections.ts",
  );

  for (const functionName of [
    "getUserCollections",
    "createCollection",
    "updateCollection",
    "deleteCollection",
    "addBookToCollection",
    "removeBookFromCollection",
    "getCollectionDetail",
    "getCollectionBooks",
  ]) {
    assert.match(
      helpersSource,
      new RegExp(`export async function ${functionName}\\(`),
    );
  }

  assert.match(helpersSource, /from "@\/lib\/prisma"/);
  assert.match(helpersSource, /_count:\s*\{\s*select:\s*\{\s*books: true/s);
  assert.match(
    helpersSource,
    /normalizedName\s*=\s*displayName\.toLowerCase\(\)/,
  );
  assert.match(
    helpersSource,
    /prisma\.collection\.findFirst\(\{\s*where:\s*\{\s*id:\s*collectionId,\s*userId/s,
  );
  assert.match(
    helpersSource,
    /prisma\.book\.findFirst\(\{\s*where:\s*\{\s*id:\s*bookId,\s*userId/s,
  );
  assert.match(helpersSource, /return "exists";/);
  assert.match(helpersSource, /prisma\.bookCollection\.create/);
  assert.match(helpersSource, /prisma\.bookCollection\.delete/);
  assert.match(
    helpersSource,
    /coverBook:\s*\{\s*select:\s*\{[\s\S]*?coverUrl:\s*true[\s\S]*?coverBlurDataUrl:\s*true/s,
  );
  assert.match(helpersSource, /coverUrl:\s*\{\s*not:\s*null\s*\}/);
  assert.match(helpersSource, /orderBy:\s*\{\s*createdAt:\s*"desc"\s*\}/);
  assert.match(helpersSource, /prisma\.\$transaction/);
  assert.match(helpersSource, /coverBookId:\s*bookId/);
  assert.match(helpersSource, /coverBookId:\s*null/);
});

test("collection helpers convert unique constraint races into conflict results", async () => {
  const helpersSource = await readOptionalWorkspaceFile(
    "src/lib/collections.ts",
  );

  assert.match(helpersSource, /import \{ Prisma \} from "@prisma\/client";/);
  assert.match(
    helpersSource,
    /error instanceof Prisma\.PrismaClientKnownRequestError/,
  );
  assert.match(helpersSource, /error\.code === "P2002"/);
  assert.match(
    helpersSource,
    /catch \(error\)[\s\S]*?if \(isUniqueConstraintError\(error\)\)[\s\S]*?return null;/,
  );
  assert.match(
    helpersSource,
    /catch \(error\)[\s\S]*?if \(isUniqueConstraintError\(error\)\)[\s\S]*?return "exists";/,
  );
});

test("collection routes require auth, validate JSON, and return safe REST statuses", async () => {
  const [indexRoute, itemRoute, booksRoute, membershipRoute] =
    await Promise.all([
      readOptionalWorkspaceFile("src/app/api/collections/route.ts"),
      readOptionalWorkspaceFile("src/app/api/collections/[id]/route.ts"),
      readOptionalWorkspaceFile("src/app/api/collections/[id]/books/route.ts"),
      readOptionalWorkspaceFile(
        "src/app/api/collections/[id]/books/[bookId]/route.ts",
      ),
    ]);

  assert.match(indexRoute, /export async function GET\(\)/);
  assert.match(indexRoute, /export async function POST\(request: Request\)/);
  assert.match(
    indexRoute,
    /const body = await request\.json\(\)\.catch\(\(\) => null\);/,
  );
  assert.match(indexRoute, /createCollectionSchema\.safeParse\(body\)/);
  assert.match(indexRoute, /\{ status: 201 \}/);
  assert.match(indexRoute, /\{ status: 409 \}/);
  assert.match(indexRoute, /A collection with this name already exists/);

  assert.match(itemRoute, /export async function PATCH\(/);
  assert.match(itemRoute, /export async function DELETE\(/);
  assert.match(itemRoute, /updateCollectionSchema\.safeParse\(body\)/);
  assert.match(itemRoute, /updateCollection\(/);
  assert.match(
    itemRoute,
    /\{ params \}: \{ params: Promise<\{ id: string \}> \}/,
  );
  assert.match(itemRoute, /\{ status: 404 \}/);
  assert.match(itemRoute, /\{ status: 409 \}/);
  assert.match(itemRoute, /"invalid-cover"/);
  assert.match(itemRoute, /\{ status: 400 \}/);
  assert.match(itemRoute, /new NextResponse\(null, \{ status: 204 \}\)/);

  assert.match(booksRoute, /export async function POST\(/);
  assert.match(booksRoute, /addBookToCollectionSchema\.safeParse\(body\)/);
  assert.match(booksRoute, /\{ status: 201 \}/);
  assert.match(booksRoute, /\{ status: 404 \}/);
  assert.match(booksRoute, /\{ status: 409 \}/);

  assert.match(membershipRoute, /export async function DELETE\(/);
  assert.match(
    membershipRoute,
    /\{ params \}: \{ params: Promise<\{ id: string; bookId: string \}> \}/,
  );
  assert.match(membershipRoute, /removeBookFromCollection\(/);
  assert.match(membershipRoute, /\{ status: 404 \}/);
  assert.match(membershipRoute, /new NextResponse\(null, \{ status: 204 \}\)/);

  for (const routeSource of [
    indexRoute,
    itemRoute,
    booksRoute,
    membershipRoute,
  ]) {
    assert.match(routeSource, /const session = await auth\(\);/);
    assert.match(
      routeSource,
      /return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/,
    );
  }
});

test("library and collection pages keep all-books search separate from shelf search", async () => {
  const [libraryPageSource, collectionPageSource] = await Promise.all([
    readOptionalWorkspaceFile("src/app/(main)/library/page.tsx"),
    readOptionalWorkspaceFile(
      "src/app/(main)/library/collections/[id]/page.tsx",
    ),
  ]);

  assert.match(
    libraryPageSource,
    /searchParams:\s*Promise<\{\s*page\?: string;\s*q\?: string;?\s*\}>;/s,
  );
  assert.match(libraryPageSource, /const where: Prisma\.BookWhereInput = \{/);
  assert.match(
    libraryPageSource,
    /title:\s*\{ contains: trimmedQuery, mode: "insensitive" \}/,
  );
  assert.match(
    libraryPageSource,
    /author:\s*\{ contains: trimmedQuery, mode: "insensitive" \}/,
  );
  assert.match(libraryPageSource, /<CollectionShelvesRow/);
  assert.match(libraryPageSource, /<LibrarySearch/);
  assert.match(libraryPageSource, /const PAGE_SIZE = 20;/);

  assert.match(
    collectionPageSource,
    /params:\s*Promise<\{\s*id: string\s*\}>/s,
  );
  assert.match(
    collectionPageSource,
    /searchParams:\s*Promise<\{\s*page\?: string;\s*q\?: string;?\s*\}>;/s,
  );
  assert.match(
    collectionPageSource,
    /getCollectionDetail\(session\.user\.id,\s*id\)/,
  );
  assert.match(
    collectionPageSource,
    /getCollectionBooks\(session\.user\.id,\s*id,/,
  );
  assert.match(collectionPageSource, /notFound\(\)/);
  assert.match(collectionPageSource, /<LibrarySearch/);
});
