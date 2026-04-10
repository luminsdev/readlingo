import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";
import sharp from "sharp";

import {
  extractCoverFromEpub,
  getCoverR2Key,
} from "../src/lib/cover-extraction.ts";

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

test("extractCoverFromEpub reads EPUB2 cover metadata with reordered attributes", async () => {
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

  const coverBuffer = await extractCoverFromEpub(epubBytes);

  assert.ok(coverBuffer instanceof Buffer);

  const metadata = await sharp(coverBuffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok((metadata.width ?? 0) > 0);
  assert.ok((metadata.width ?? 0) <= 400);
});

test("extractCoverFromEpub reads EPUB3 cover-image manifest entries", async () => {
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

  const coverBuffer = await extractCoverFromEpub(epubBytes);

  assert.ok(coverBuffer instanceof Buffer);
});

test("extractCoverFromEpub falls back to the first image and handles root-relative hrefs", async () => {
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

  const coverBuffer = await extractCoverFromEpub(epubBytes);

  assert.ok(coverBuffer instanceof Buffer);
});

test("getCoverR2Key strips the r2 prefix and rejects other URLs", () => {
  assert.equal(getCoverR2Key("r2://covers/book.jpg"), "covers/book.jpg");
  assert.throws(() => getCoverR2Key("https://example.com/cover.jpg"));
});
