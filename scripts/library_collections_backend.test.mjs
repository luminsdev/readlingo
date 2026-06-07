import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readOptionalWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8").catch(
    () => "",
  );
}

test("Prisma schema defines user-owned collections with explicit book membership", async () => {
  const schemaSource = await readOptionalWorkspaceFile("prisma/schema.prisma");

  assert.match(schemaSource, /collections\s+Collection\[\]/);
  assert.match(schemaSource, /collections\s+BookCollection\[\]/);
  assert.match(schemaSource, /model Collection \{/);
  assert.match(schemaSource, /displayName\s+String/);
  assert.match(schemaSource, /normalizedName\s+String/);
  assert.match(
    schemaSource,
    /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(schemaSource, /@@unique\(\[userId, normalizedName\]\)/);
  assert.match(schemaSource, /@@index\(\[userId, order\]\)/);
  assert.match(schemaSource, /model BookCollection \{/);
  assert.match(schemaSource, /@@id\(\[bookId, collectionId\]\)/);
  assert.match(schemaSource, /@@index\(\[collectionId, order\]\)/);
});

test("collection validation schemas trim bounded names and require book ids", async () => {
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
    /export const createCollectionSchema = z\.object/,
  );
  assert.match(
    validationSource,
    /export const renameCollectionSchema = z\.object/,
  );
  assert.match(
    validationSource,
    /export const addBookToCollectionSchema = z\.object\(\{\s*bookId: z\.string\(\)\.min\(1\),\s*\}\);/s,
  );
});

test("collection helpers centralize ownership checks and duplicate handling", async () => {
  const helpersSource = await readOptionalWorkspaceFile(
    "src/lib/collections.ts",
  );

  for (const functionName of [
    "getUserCollections",
    "createCollection",
    "renameCollection",
    "deleteCollection",
    "addBookToCollection",
    "removeBookFromCollection",
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
  assert.match(itemRoute, /renameCollectionSchema\.safeParse\(body\)/);
  assert.match(
    itemRoute,
    /\{ params \}: \{ params: Promise<\{ id: string \}> \}/,
  );
  assert.match(itemRoute, /\{ status: 404 \}/);
  assert.match(itemRoute, /\{ status: 409 \}/);
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

test("library page accepts q and collection filters in the Prisma where clause", async () => {
  const pageSource = await readOptionalWorkspaceFile(
    "src/app/(main)/library/page.tsx",
  );

  assert.match(pageSource, /import type \{ Prisma \} from "@prisma\/client";/);
  assert.match(
    pageSource,
    /searchParams:\s*Promise<\{\s*page\?: string;\s*q\?: string;\s*collection\?: string\s*\}>;/s,
  );
  assert.match(
    pageSource,
    /const \{\s*page: pageParam,\s*q: searchQuery,\s*collection: collectionId,?\s*\} = await searchParams;/s,
  );
  assert.match(
    pageSource,
    /const trimmedQuery = searchQuery\?\.trim\(\) \|\| "";/,
  );
  assert.match(pageSource, /const where: Prisma\.BookWhereInput = \{/);
  assert.match(
    pageSource,
    /title:\s*\{ contains: trimmedQuery, mode: "insensitive" \}/,
  );
  assert.match(
    pageSource,
    /author:\s*\{ contains: trimmedQuery, mode: "insensitive" \}/,
  );
  assert.match(pageSource, /collections:\s*\{ some:\s*\{ collectionId \} \}/);
  assert.match(pageSource, /findMany\(\{\s*where,/s);
  assert.match(pageSource, /count\(\{\s*where,\s*\}\)/s);
  assert.match(pageSource, /const PAGE_SIZE = 20;/);
});
