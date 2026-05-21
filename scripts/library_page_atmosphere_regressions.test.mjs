import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("library page uses the upload dialog trigger and proxy cover metadata", async () => {
  const pageSource = await readWorkspaceFile("src/app/(main)/library/page.tsx");

  assert.match(
    pageSource,
    /import \{ UploadBookDialog \} from "@\/components\/library\/upload-book-dialog";/,
  );
  assert.doesNotMatch(pageSource, /UploadBookForm/);
  assert.doesNotMatch(pageSource, /CardContent/);
  assert.match(pageSource, /updatedAt: true,/);
  assert.match(pageSource, /coverBlurDataUrl: true,/);
  assert.match(pageSource, /hasCover=\{!!book\.coverUrl\}/);
  assert.match(pageSource, /coverBlurDataUrl=\{book\.coverBlurDataUrl\}/);
  assert.match(pageSource, /<UploadBookDialog \/>/);
  assert.match(pageSource, /className="bg-line-strong h-px"/);
  assert.match(pageSource, /Your shelf is waiting/);
});

test("upload dialog wraps the upload form in a shadcn dialog", async () => {
  const [dialogSource, componentSource] = await Promise.all([
    readWorkspaceFile("src/components/ui/dialog.tsx"),
    readWorkspaceFile("src/components/library/upload-book-dialog.tsx"),
  ]);

  assert.match(dialogSource, /@radix-ui\/react-dialog/);
  assert.match(dialogSource, /const Dialog = DialogPrimitive\.Root/);
  assert.match(dialogSource, /const DialogTrigger = DialogPrimitive\.Trigger/);
  assert.match(dialogSource, /const DialogClose = DialogPrimitive\.Close/);
  assert.match(dialogSource, /export \{/);
  assert.match(componentSource, /export function UploadBookDialog\(\)/);
  assert.match(
    componentSource,
    /<Dialog open=\{isOpen\} onOpenChange=\{setIsOpen\}>/,
  );
  assert.match(componentSource, /<DialogTrigger asChild>/);
  assert.match(
    componentSource,
    /<UploadBookForm onSuccess=\{\(\) => setIsOpen\(false\)\} \/>/,
  );
  assert.match(componentSource, /Add a new EPUB/);
});

test("upload form exposes an optional success callback and calls it after refresh", async () => {
  const formSource = await readWorkspaceFile(
    "src/components/library/upload-book-form.tsx",
  );

  assert.match(
    formSource,
    /export function UploadBookForm\(\{ onSuccess \}: \{ onSuccess\?: \(\) => void \} = \{\}\)/,
  );
  assert.match(formSource, /router\.refresh\(\);\s*onSuccess\?\.\(\);/);
});

test("book card supports proxy covers and the existing reading action treatment", async () => {
  const bookCardSource = await readWorkspaceFile(
    "src/components/library/book-card.tsx",
  );

  assert.match(bookCardSource, /hasCover: boolean;/);
  assert.match(bookCardSource, /coverBlurDataUrl: string \| null;/);
  assert.match(bookCardSource, /hasStartedReading\?: boolean;/);
  assert.match(bookCardSource, /hasStartedReading = false,/);
  assert.doesNotMatch(bookCardSource, /next\/image/);
  assert.match(bookCardSource, /<img/);
  assert.match(bookCardSource, /src=\{`\/api\/covers\/\$\{id\}\?size=thumb`\}/);
  assert.match(bookCardSource, /loading="lazy"/);
  assert.match(
    bookCardSource,
    /hasStartedReading\s*\?\s*progressPercentage != null/,
  );
  assert.match(bookCardSource, /:\s*"Continue"/);
  assert.match(
    bookCardSource,
    /group-hover:pointer-events-auto[\s\S]*group-hover:opacity-100/,
  );
});
