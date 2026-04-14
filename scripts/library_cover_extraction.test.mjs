import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";
import sharp from "sharp";

import { extractEpubInfo, getCoverR2Key } from "../src/lib/cover-extraction.ts";

async function createEpubBytes({ opfPath, opfContent, extraFiles }) {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile media-type="application/oebps-package+xml" full-path="${opfPath}" />
        </rootfiles>
      </container>`,
  );
  zip.file(opfPath, opfContent);

  for (const file of extraFiles) {
    zip.file(file.path, file.data);
  }

  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

async function createTestImageBuffer() {
  return sharp({
    create: {
      width: 12,
      height: 18,
      channels: 3,
      background: "#336699",
    },
  })
    .png()
    .toBuffer();
}

test("extractEpubInfo reads EPUB2 cover metadata with reordered attributes", async () => {
  const imageBuffer = await createTestImageBuffer();
  const epubBytes = await createEpubBytes({
    opfPath: "OEBPS/content.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="2.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata>
          <meta content="cover-image" name="cover" />
        </metadata>
        <manifest>
          <item href="images/cover.png" media-type="image/png" id="cover-image" />
        </manifest>
        <spine />
      </package>`,
    extraFiles: [
      {
        path: "OEBPS/images/cover.png",
        data: imageBuffer,
      },
    ],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.ok(result.cover instanceof Buffer);

  const metadata = await sharp(result.cover).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok((metadata.width ?? 0) > 0);
  assert.ok((metadata.width ?? 0) <= 400);
});

test("extractEpubInfo reads EPUB3 cover-image manifest entries", async () => {
  const imageBuffer = await createTestImageBuffer();
  const epubBytes = await createEpubBytes({
    opfPath: "OPS/package.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <manifest>
          <item id="cover" media-type="image/png" properties="cover-image svg" href="art/cover.png" />
        </manifest>
        <spine />
      </package>`,
    extraFiles: [
      {
        path: "OPS/art/cover.png",
        data: imageBuffer,
      },
    ],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.ok(result.cover instanceof Buffer);
});

test("extractEpubInfo falls back to the first image and handles root-relative hrefs", async () => {
  const imageBuffer = await createTestImageBuffer();
  const epubBytes = await createEpubBytes({
    opfPath: "package.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <manifest>
          <item id="cover" href="/root-cover.png" media-type="image/png" />
        </manifest>
        <spine />
      </package>`,
    extraFiles: [
      {
        path: "root-cover.png",
        data: imageBuffer,
      },
    ],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.ok(result.cover instanceof Buffer);
});

test("extractEpubInfo extracts Dublin Core metadata from OPF", async () => {
  const imageBuffer = await createTestImageBuffer();
  const epubBytes = await createEpubBytes({
    opfPath: "OEBPS/content.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="2.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Test Book Title</dc:title>
          <dc:creator>Jane Doe</dc:creator>
          <dc:language>ja</dc:language>
          <meta content="cover-image" name="cover" />
        </metadata>
        <manifest>
          <item href="images/cover.png" media-type="image/png" id="cover-image" />
        </manifest>
        <spine />
      </package>`,
    extraFiles: [
      {
        path: "OEBPS/images/cover.png",
        data: imageBuffer,
      },
    ],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.equal(result.metadata.title, "Test Book Title");
  assert.equal(result.metadata.author, "Jane Doe");
  assert.equal(result.metadata.language, "ja");
  assert.ok(result.cover instanceof Buffer);
});

test("extractEpubInfo returns null metadata fields when Dublin Core elements are missing", async () => {
  const imageBuffer = await createTestImageBuffer();
  const epubBytes = await createEpubBytes({
    opfPath: "OEBPS/content.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="2.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata>
          <meta content="cover-image" name="cover" />
        </metadata>
        <manifest>
          <item href="images/cover.png" media-type="image/png" id="cover-image" />
        </manifest>
        <spine />
      </package>`,
    extraFiles: [
      {
        path: "OEBPS/images/cover.png",
        data: imageBuffer,
      },
    ],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.equal(result.metadata.title, null);
  assert.equal(result.metadata.author, null);
  assert.equal(result.metadata.language, null);
  assert.ok(result.cover instanceof Buffer);
});

test("extractEpubInfo normalizes language to lowercase", async () => {
  const epubBytes = await createEpubBytes({
    opfPath: "content.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:language>EN-US</dc:language>
        </metadata>
        <manifest />
        <spine />
      </package>`,
    extraFiles: [],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.equal(result.metadata.language, "en-us");
  assert.equal(result.cover, null);
});

test("extractEpubInfo decodes XML entities in Dublin Core metadata", async () => {
  const epubBytes = await createEpubBytes({
    opfPath: "content.opf",
    opfContent: `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Rock &amp; Roll &#x1F3B8;</dc:title>
          <dc:creator>Fran&#231;ois &lt;Auteur&gt;</dc:creator>
        </metadata>
        <manifest />
        <spine />
      </package>`,
    extraFiles: [],
  });

  const result = await extractEpubInfo(epubBytes);

  assert.equal(
    result.metadata.title,
    `Rock & Roll ${String.fromCodePoint(0x1f3b8)}`,
  );
  assert.equal(
    result.metadata.author,
    `Fran${String.fromCodePoint(231)}ois <Auteur>`,
  );
});

test("getCoverR2Key strips the r2 prefix and rejects other URLs", () => {
  assert.equal(getCoverR2Key("r2://covers/book.jpg"), "covers/book.jpg");
  assert.throws(() => getCoverR2Key("https://example.com/cover.jpg"));
});
